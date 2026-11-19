import { useEffect, useReducer } from "react";
import type { Alerta, EventoSilo, FonteDados, Mensagem, StatusPlaca, Telemetria, Topico } from "./tipos";

const MAX_LEITURAS = 120; // 10 min a cada 5 s
const MAX_EVENTOS = 30;

export type EstadoSilo = {
  /** device_id visto em qualquer mensagem (o status retido pode não ter chegado). */
  deviceId: string | null;
  status: StatusPlaca | null;
  leituras: Telemetria[];
  eventos: EventoSilo[];
  alerta: Alerta | null;
  ultimoSeq: Partial<Record<Topico, number>>;
  /** Buracos de seq vistos no dashboard (a detecção oficial é do backend, T3.3). */
  buracos: number;
  ultimaMensagem: number | null;
};

const inicial: EstadoSilo = {
  deviceId: null,
  status: null,
  leituras: [],
  eventos: [],
  alerta: null,
  ultimoSeq: {},
  buracos: 0,
  ultimaMensagem: null,
};

type Acao = { tipo: "msg"; m: Mensagem };

function reduzir(s: EstadoSilo, a: Acao): EstadoSilo {
  const { m } = a;
  const base = { ...s, ultimaMensagem: Date.now(), deviceId: m.payload.device_id };
  if (m.topico === "grupo3/status") return { ...base, status: m.payload };

  // Mensagem repetida (histórico recarregado numa reconexão, QoS 0 reenviado): mesma placa, seq e ts → ignora.
  const igual = (x: { device_id: string; seq: number; ts: number | null }) =>
    x.device_id === m.payload.device_id && x.seq === m.payload.seq && x.ts === m.payload.ts;
  const repetida =
    m.topico === "grupo3/telemetria" ? s.leituras.some(igual) : m.topico === "grupo3/silo/evento" ? s.eventos.some(igual) : !!s.alerta && igual(s.alerta);
  if (repetida) return s;

  // seq por tópico: buraco = pulou; menor = reboot (não conta como erro).
  const anterior = s.ultimoSeq[m.topico];
  const buraco = anterior !== undefined && m.payload.seq > anterior + 1 ? m.payload.seq - anterior - 1 : 0;
  const comSeq = { ...base, ultimoSeq: { ...s.ultimoSeq, [m.topico]: m.payload.seq }, buracos: s.buracos + buraco };

  switch (m.topico) {
    case "grupo3/telemetria":
      return { ...comSeq, leituras: [...s.leituras, m.payload].slice(-MAX_LEITURAS) };
    case "grupo3/silo/evento":
      return { ...comSeq, eventos: [m.payload, ...s.eventos].slice(0, MAX_EVENTOS) };
    case "grupo3/alerta":
      return { ...comSeq, alerta: m.payload };
  }
}

export function useSilo(fonte: FonteDados) {
  const [estado, despachar] = useReducer(reduzir, inicial);

  useEffect(() => {
    fonte.historico().forEach((m) => despachar({ tipo: "msg", m }));
    return fonte.assinar((m) => despachar({ tipo: "msg", m }));
  }, [fonte]);


  return { estado };
}
