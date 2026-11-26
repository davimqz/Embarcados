// Validação dos payloads da placa contra o contrato (docs/topicos-mqtt.md) — T3.1.
// Cada tópico tem a sua regra; a primeira violação encontrada vira o motivo da rejeição.
// Campos a mais são aceitos (e preservados): o contrato define o mínimo que cada payload precisa ter.

import { TOPICOS } from '../comum/config.ts';

// Tópicos que a placa publica e o ingest assina. grupo3/cmd fica de fora: quem publica é o backend.
export const TOPICOS_INGEST = [
  TOPICOS.evento,
  TOPICOS.status,
  TOPICOS.telemetria,
  TOPICOS.alerta,
  TOPICOS.ventilacao,
] as const;
export type TopicoIngest = (typeof TOPICOS_INGEST)[number];

export type Payload = Record<string, unknown> & { device_id: string };

export type Validacao =
  | { ok: true; topico: TopicoIngest; payload: Payload }
  | { ok: false; motivo: string };

type Obj = Record<string, unknown>;
// Cada checagem devolve o motivo da falha, ou null se o campo está de acordo.
type Checagem = (p: Obj) => string | null;

const inteiro = (v: unknown): v is number => Number.isInteger(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function campoInteiro(nome: string, { nulo = false, min = -Infinity, max = Infinity } = {}): Checagem {
  return (p) => {
    if (!(nome in p)) return `campo ${nome} ausente`;
    const v = p[nome];
    if (v === null) return nulo ? null : `${nome} não pode ser null`;
    if (!inteiro(v)) return `${nome} deve ser inteiro${nulo ? ' ou null' : ''}`;
    if (v < min || v > max) return `${nome} fora da faixa ${min}–${max}`;
    return null;
  };
}

function campoNumero(nome: string, { nulo = false } = {}): Checagem {
  return (p) => {
    if (!(nome in p)) return `campo ${nome} ausente`;
    const v = p[nome];
    if (v === null) return nulo ? null : `${nome} não pode ser null`;
    return numero(v) ? null : `${nome} deve ser número${nulo ? ' ou null' : ''}`;
  };
}

function campoEnum(nome: string, valores: readonly string[]): Checagem {
  return (p) => {
    if (!(nome in p)) return `campo ${nome} ausente`;
    return valores.includes(p[nome] as string) ? null : `${nome} deve ser ${valores.join(' ou ')}`;
  };
}

const deviceId: Checagem = (p) =>
  typeof p.device_id === 'string' && p.device_id !== '' ? null : 'device_id ausente ou vazio';

// device_id, ts e seq: comuns a todos os tópicos da placa, menos grupo3/status (sem ts nem seq, ver contrato).
const comuns: Checagem[] = [deviceId, campoInteiro('ts', { nulo: true, min: 0 }), campoInteiro('seq', { min: 1 })];

const REGRAS: Record<TopicoIngest, Checagem[]> = {
  [TOPICOS.evento]: [
    ...comuns,
    campoEnum('evento', ['ENTRADA', 'SAIDA']),
    campoInteiro('entradas', { min: 0 }),
    campoInteiro('saidas', { min: 0 }),
    campoInteiro('saldo'),
    (p) => (p.saldo === (p.entradas as number) - (p.saidas as number) ? null : 'saldo diferente de entradas - saidas'),
  ],
  [TOPICOS.status]: [deviceId, campoEnum('status', ['online', 'offline'])],
  [TOPICOS.telemetria]: [
    ...comuns,
    campoInteiro('temperatura', { nulo: true }),
    campoInteiro('umidade', { nulo: true, min: 0, max: 100 }),
    campoNumero('distancia_cm', { nulo: true }),
    campoInteiro('nivel_pct', { nulo: true, min: 0, max: 100 }),
    (p) => (p.distancia_cm === null && p.nivel_pct !== null ? 'nivel_pct deve ser null quando distancia_cm é null' : null),
  ],
  [TOPICOS.alerta]: [
    ...comuns,
    campoEnum('alerta', ['ATIVO', 'NORMAL']),
    (p) => {
      const m = p.motivos;
      if (!Array.isArray(m)) return 'motivos deve ser uma lista';
      if (m.some((x) => x !== 'TEMPERATURA' && x !== 'UMIDADE')) return 'motivos aceita só TEMPERATURA e UMIDADE';
      if (p.alerta === 'NORMAL' && m.length > 0) return 'motivos deve ser vazio quando alerta é NORMAL';
      return null;
    },
    campoInteiro('temperatura', { nulo: true }),
    campoInteiro('umidade', { nulo: true, min: 0, max: 100 }),
  ],
  [TOPICOS.ventilacao]: [
    ...comuns,
    campoEnum('ventilacao', ['LIGADA', 'DESLIGADA']),
    campoInteiro('cmd_seq', { nulo: true, min: 1 }),
  ],
};

export function validar(topico: string, bruto: Buffer | string): Validacao {
  if (!(TOPICOS_INGEST as readonly string[]).includes(topico)) {
    return { ok: false, motivo: 'tópico fora do contrato' };
  }

  let p: unknown;
  try {
    p = JSON.parse(bruto.toString());
  } catch {
    return { ok: false, motivo: 'JSON inválido' };
  }
  if (typeof p !== 'object' || p === null || Array.isArray(p)) {
    return { ok: false, motivo: 'payload não é um objeto JSON' };
  }

  for (const checar of REGRAS[topico as TopicoIngest]) {
    const motivo = checar(p as Obj);
    if (motivo) return { ok: false, motivo };
  }
  return { ok: true, topico: topico as TopicoIngest, payload: p as Payload };
}
