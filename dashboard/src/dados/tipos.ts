// Tipos espelhando o contrato docs/topicos-mqtt.md. Se divergirem, vale o contrato.

export type Telemetria = {
  device_id: string;
  ts: number | null;
  seq: number;
  temperatura: number | null;
  umidade: number | null;
  distancia_cm: number | null;
  nivel_pct: number | null;
};

export type EventoSilo = {
  device_id: string;
  ts: number | null;
  seq: number;
  evento: "ENTRADA" | "SAIDA";
  entradas: number;
  saidas: number;
  saldo: number;
};

export type Alerta = {
  device_id: string;
  ts: number | null;
  seq: number;
  alerta: "ATIVO" | "NORMAL";
  motivos: ("TEMPERATURA" | "UMIDADE")[];
  temperatura: number | null;
  umidade: number | null;
};

export type Ventilacao = {
  device_id: string;
  ts: number | null;
  seq: number;
  ventilacao: "LIGADA" | "DESLIGADA";
  cmd_seq: number | null;
};

export type StatusPlaca = {
  device_id: string;
  status: "online" | "offline";
};

/** Mensagem que o backend vai empurrar pelo WebSocket (ADR 0002): tópico + payload do contrato. */
export type Mensagem =
  | { topico: "grupo3/telemetria"; payload: Telemetria }
  | { topico: "grupo3/silo/evento"; payload: EventoSilo }
  | { topico: "grupo3/alerta"; payload: Alerta }
  | { topico: "grupo3/ventilacao"; payload: Ventilacao }
  | { topico: "grupo3/status"; payload: StatusPlaca };

export type Topico = Mensagem["topico"];

/**
 * Fonte de dados do dashboard. Hoje: simulada no navegador (fonteSimulada).
 * No M4 real: WebSocket + REST do backend/ingest, com a mesma interface.
 */
export interface FonteDados {
  /** Histórico inicial (T4.4 virá do SQLite). */
  historico(): Mensagem[];
  /** Assina as mensagens em tempo real; devolve a função para cancelar. */
  assinar(aoReceber: (m: Mensagem) => void): () => void;
  /** Pede ao backend para publicar em grupo3/cmd; devolve o seq do comando. */
  enviarComando(valor: "LIGAR" | "DESLIGAR"): number;
}
