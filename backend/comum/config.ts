// Configuração lida do ambiente (.env, carregado pelo `node --env-file-if-exists`).

export const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
export const GRUPO = process.env.GRUPO ?? '3';
export const BROKER_PORTA = Number(process.env.BROKER_PORTA ?? 1883);

// Contrato em docs/topicos-mqtt.md.
export const TOPICOS = {
  evento: `grupo${GRUPO}/silo/evento`,
  status: `grupo${GRUPO}/status`,
  telemetria: `grupo${GRUPO}/telemetria`,
  alerta: `grupo${GRUPO}/alerta`,
  cmd: `grupo${GRUPO}/cmd`,
  ventilacao: `grupo${GRUPO}/ventilacao`,
} as const;

// Horário no formato do log: 2026-10-27 14:05:09.
export function agora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
