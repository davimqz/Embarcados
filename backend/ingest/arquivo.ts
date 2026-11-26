// Interpretação das mensagens da placa e arquivo em memória para o painel (T4.6).
// A validação do contrato fica em contrato.ts (T3.1); o SQLite é da T3.2.

import { TOPICOS } from '../comum/config.ts';
import { validar, type Payload } from './contrato.ts';

// Tópicos que o frontend entende (frontend/src/dados/tipos.ts). grupo3/ventilacao saiu da interface na T4.5.
export const TOPICOS_PAINEL = [TOPICOS.status, TOPICOS.telemetria, TOPICOS.evento, TOPICOS.alerta] as const;
export type TopicoPainel = (typeof TOPICOS_PAINEL)[number];

export type { Payload };

// O mesmo formato que o frontend recebe pelo WebSocket: tópico + payload do contrato, sem alteração.
export type Mensagem = { topico: TopicoPainel; payload: Payload };

export type Resultado = { ok: true; mensagem: Mensagem } | { ok: false; motivo: string };

export function ehDoPainel(topico: string): topico is TopicoPainel {
  return (TOPICOS_PAINEL as readonly string[]).includes(topico);
}

// Valida contra o contrato (contrato.ts) e aceita só os tópicos que o painel entende.
export function interpretar(topico: string, bruto: Buffer | string): Resultado {
  if (!ehDoPainel(topico)) return { ok: false, motivo: 'tópico fora do painel' };
  const v = validar(topico, bruto);
  if (!v.ok) return v;
  return { ok: true, mensagem: { topico, payload: v.payload } };
}

type Registro = { mensagem: Mensagem; ts: number };

// Guarda as últimas mensagens em memória. Ao reiniciar o servidor, tudo some (o SQLite da T3.2 resolve).
export class Arquivo {
  private registros: Registro[] = [];
  private readonly maximo: number;

  // 20 000 mensagens ≈ 24 h de telemetria a cada 5 s, mais eventos e alertas.
  constructor(maximo = 20_000) {
    this.maximo = maximo;
  }

  // agoraS: horário de chegada, usado quando a placa ainda não tem relógio (ts null) ou no status, que não tem ts.
  adicionar(mensagem: Mensagem, agoraS = Math.floor(Date.now() / 1000)): void {
    const ts = typeof mensagem.payload.ts === 'number' ? mensagem.payload.ts : agoraS;
    this.registros.push({ mensagem, ts });
    if (this.registros.length > this.maximo) {
      this.registros.splice(0, this.registros.length - this.maximo);
    }
  }

  get tamanho(): number {
    return this.registros.length;
  }

  // O que um painel recém-aberto precisa: a janela recente inteira e o último status e alerta, mesmo que antigos.
  recentes(janelaS: number, agoraS = Math.floor(Date.now() / 1000)): Mensagem[] {
    const corte = agoraS - janelaS;
    const recentes = this.registros.filter((r) => r.ts >= corte);
    const extras: Registro[] = [];
    for (const topico of [TOPICOS.status, TOPICOS.alerta]) {
      const ultimo = this.registros.findLast((r) => r.mensagem.topico === topico);
      if (ultimo && !recentes.includes(ultimo)) extras.push(ultimo);
    }
    return [...extras, ...recentes].map((r) => r.mensagem);
  }

  consultar(desde: number, ate: number, topicos?: readonly string[]): Mensagem[] {
    return this.registros
      .filter((r) => r.ts >= desde && r.ts <= ate && (!topicos || topicos.includes(r.mensagem.topico)))
      .map((r) => r.mensagem);
  }
}
