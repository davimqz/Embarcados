import { useCallback, useEffect, useReducer } from "react";
import type { Alerta, EventoSilo, FonteDados, Mensagem, StatusPlaca, Telemetria, Topico, Ventilacao } from "./tipos";

const MAX_LEITURAS = 120; // 10 min a cada 5 s
const MAX_EVENTOS = 30;

export type RegistroComando = {
  seq: number;
  valor: "LIGAR" | "DESLIGAR";
  enviadoEm: number; // ms
  respostaEm: number | null; // ms
  situacao: "pendente" | "confirmado" | "sem resposta";
};

export type EstadoSilo = {
  /** Comandos enviados nesta sessão, mais recentes primeiro. */
  comandos: RegistroComando[];
  status: StatusPlaca | null;
  leituras: Telemetria[];
  eventos: EventoSilo[];
  alerta: Alerta | null;
  ventilacao: Ventilacao | null;
  /** seq do comando enviado e ainda não confirmado em grupo3/ventilacao. */
  comandoPendente: { seq: number; valor: "LIGAR" | "DESLIGAR"; desde: number } | null;
  /** Último comando que expirou sem confirmação (placa offline ou perdido). */
  comandoSemResposta: number | null;
  ultimoSeq: Partial<Record<Topico, number>>;
  /** Buracos de seq vistos no dashboard (a detecção oficial é do backend, T3.3). */
  buracos: number;
  ultimaMensagem: number | null;
};

const inicial: EstadoSilo = {
  comandos: [],
  status: null,
  leituras: [],
  eventos: [],
  alerta: null,
  ventilacao: null,
  comandoPendente: null,
  comandoSemResposta: null,
  ultimoSeq: {},
  buracos: 0,
  ultimaMensagem: null,
};

type Acao = { tipo: "msg"; m: Mensagem } | { tipo: "cmd"; seq: number; valor: "LIGAR" | "DESLIGAR" } | { tipo: "cmd-expirou"; seq: number };

function reduzir(s: EstadoSilo, a: Acao): EstadoSilo {
  if (a.tipo === "cmd")
    return {
      ...s,
      comandoPendente: { seq: a.seq, valor: a.valor, desde: Date.now() },
      comandoSemResposta: null,
      comandos: [{ seq: a.seq, valor: a.valor, enviadoEm: Date.now(), respostaEm: null, situacao: "pendente" as const }, ...s.comandos].slice(0, 50),
    };
  if (a.tipo === "cmd-expirou")
    return s.comandoPendente?.seq === a.seq
      ? {
          ...s,
          comandoPendente: null,
          comandoSemResposta: a.seq,
          comandos: s.comandos.map((c) => (c.seq === a.seq ? { ...c, situacao: "sem resposta" as const } : c)),
        }
      : s;

  const { m } = a;
  const base = { ...s, ultimaMensagem: Date.now() };
  if (m.topico === "grupo3/status") return { ...base, status: m.payload };

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
    case "grupo3/ventilacao": {
      const confirmou = s.comandoPendente && m.payload.cmd_seq === s.comandoPendente.seq;
      const comandos = s.comandos.map((c) =>
        c.seq === m.payload.cmd_seq && c.situacao === "pendente" ? { ...c, respostaEm: Date.now(), situacao: "confirmado" as const } : c,
      );
      return { ...comSeq, ventilacao: m.payload, comandos, comandoPendente: confirmou ? null : s.comandoPendente };
    }
  }
}

export function useSilo(fonte: FonteDados) {
  const [estado, despachar] = useReducer(reduzir, inicial);

  useEffect(() => {
    fonte.historico().forEach((m) => despachar({ tipo: "msg", m }));
    return fonte.assinar((m) => despachar({ tipo: "msg", m }));
  }, [fonte]);

  const comandar = useCallback(
    (valor: "LIGAR" | "DESLIGAR") => {
      const seq = fonte.enviarComando(valor);
      despachar({ tipo: "cmd", seq, valor });
      // Sem confirmação em 5 s, libera o botão (o painel mostra que não houve resposta).
      setTimeout(() => despachar({ tipo: "cmd-expirou", seq }), 5000);
      return seq;
    },
    [fonte],
  );

  return { estado, comandar };
}
