// SÓ PARA DESENVOLVIMENTO (break-ui): fontes fixas com os piores dados realistas do contrato.
// Escolhidas por ?dados=pior | vazio | um em App.tsx, apenas com import.meta.env.DEV.

import type { EventoSilo, FonteDados, Mensagem, Telemetria } from "./tipos";

const ID = "esp32-grupo3-a4cf12b8e9d0"; // formato real: prefixo + MAC (12 hex)

class FonteFixa implements FonteDados {
  constructor(private ao_vivo: Mensagem[], private arquivo: Mensagem[]) {}
  historico() {
    return this.ao_vivo;
  }
  assinar() {
    return () => {};
  }
  async consultar({ desde, ate, topicos }: { desde: number; ate: number; topicos?: Mensagem["topico"][] }) {
    return this.arquivo.filter((m) => {
      if (topicos && !topicos.includes(m.topico)) return false;
      const ts = "ts" in m.payload ? m.payload.ts : null;
      return ts !== null && ts >= desde && ts <= ate;
    });
  }
}

const agora = () => Math.floor(Date.now() / 1000);

/**
 * Pior caso: placa ligada há uma semana (seq altos, contadores grandes), reboot recente que deixou o saldo negativo,
 * DHT11 alternando falha e valores fora da faixa do gráfico, HC-SR04 sem eco, NTP ainda sem horário em parte das
 * mensagens, alerta pelos dois motivos e status nunca recebido (sem retido no broker).
 */
export function fontePiorCaso(): FonteDados {
  const t0 = agora();
  const tel: Telemetria[] = [];
  const base = 120_960 - 120;
  for (let i = 0; i < 120; i++) {
    const ts = i < 6 ? null : t0 - (120 - i) * 5; // primeiras sem NTP
    const falha = i % 9 === 0;
    const semEco = i % 7 === 0;
    tel.push({
      device_id: ID,
      ts,
      seq: base + i,
      temperatura: falha ? null : 44 + (i % 4), // acima do domínio 15–40 do gráfico
      umidade: falha ? null : 92 + (i % 4), // acima de 90
      distancia_cm: semEco ? null : i > 110 ? 2.1 : 12.9, // abaixo de "cheio" e acima de "vazio"
      nivel_pct: semEco ? null : i > 110 ? 100 : 0,
    });
  }
  const ev = (seq: number, evento: "ENTRADA" | "SAIDA", entradas: number, saidas: number, ts: number | null): EventoSilo => ({
    device_id: ID,
    ts,
    seq,
    evento,
    entradas,
    saidas,
    saldo: entradas - saidas,
  });
  const eventos = [
    ev(1, "SAIDA", 0, 1, null),
    ev(2, "SAIDA", 0, 2, null),
    ev(3, "SAIDA", 0, 3, t0 - 200),
  ];
  // Arquivo: 7 dias de contadores altos, depois o reboot; 24 h com 1 leitura/min.
  const arq: Mensagem[] = [];
  for (let i = 0; i < 1440; i++) {
    const ts = t0 - (1440 - i) * 60;
    arq.push({
      topico: "grupo3/telemetria",
      payload: { device_id: ID, ts, seq: 119_000 + i, temperatura: i % 50 === 0 ? null : 44, umidade: 95, distancia_cm: 12.9, nivel_pct: 0 },
    });
    if (i % 3 === 0)
      arq.push({ topico: "grupo3/silo/evento", payload: ev(4000 + i, i % 2 ? "SAIDA" : "ENTRADA", 1284 + i, 1281 + i, ts) });
  }
  arq.push(...eventos.map((p) => ({ topico: "grupo3/silo/evento" as const, payload: p })));
  arq.push(...tel.map((p) => ({ topico: "grupo3/telemetria" as const, payload: p })));

  const vivo: Mensagem[] = [
    ...tel.map((p) => ({ topico: "grupo3/telemetria" as const, payload: p })),
    ...eventos.map((p) => ({ topico: "grupo3/silo/evento" as const, payload: p })),
    {
      topico: "grupo3/alerta",
      payload: { device_id: ID, ts: null, seq: 41, alerta: "ATIVO", motivos: ["TEMPERATURA", "UMIDADE"], temperatura: 47, umidade: 95 },
    },
  ];
  return new FonteFixa(vivo, arq);
}

/** Vazio: placa acabou de ligar e o backend não tem nada gravado. Nenhuma mensagem, nenhum status. */
export function fonteVazia(): FonteDados {
  return new FonteFixa([], []);
}

/** Um: exatamente uma mensagem de cada (pluralização e listas de um item). */
export function fonteUm(): FonteDados {
  const t = agora();
  const tel = { device_id: ID, ts: t - 5, seq: 1, temperatura: 25, umidade: 60, distancia_cm: 7.5, nivel_pct: 50 };
  const e: EventoSilo = { device_id: ID, ts: t - 10, seq: 1, evento: "ENTRADA", entradas: 1, saidas: 0, saldo: 1 };
  const alerta = { device_id: ID, ts: t - 5, seq: 1, alerta: "ATIVO" as const, motivos: ["TEMPERATURA" as const], temperatura: 31, umidade: 60 };
  const vivo: Mensagem[] = [
    { topico: "grupo3/status", payload: { device_id: ID, status: "online" } },
    { topico: "grupo3/telemetria", payload: tel },
    { topico: "grupo3/silo/evento", payload: e },
    { topico: "grupo3/alerta", payload: alerta },
  ];
  return new FonteFixa(vivo, vivo.filter((m) => m.topico !== "grupo3/status"));
}
