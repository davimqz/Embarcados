// Detecção de seq faltante, duplicado e de reboot da placa (T3.3).
// Pelo contrato (docs/topicos-mqtt.md), cada tópico tem o seu próprio seq, que começa em 1 no boot e sobe de 1 em 1:
//   - seq pulando (7 → 9)            → buraco: as mensagens do meio se perderam
//   - mesmo seq e mesmo payload      → duplicata (QoS 1 reentregue, mensagem retida, repetição): não grava de novo
//   - seq menor ou igual, payload novo → reboot: a placa reiniciou e a contagem voltou a 1 (não é erro)
// O controle é por placa (device_id) e por tópico. grupo3/status não tem seq e fica de fora.

export type Ocorrencia =
  | { tipo: 'buraco'; seqAnterior: number | null; seq: number; faltandoDe: number; faltandoAte: number }
  | { tipo: 'duplicata'; seqAnterior: number; seq: number }
  | { tipo: 'reboot'; seqAnterior: number; seq: number };

export type Analise = {
  gravar: boolean; // false só para duplicata
  ocorrencias: Ocorrencia[]; // vazio no caso normal; reboot pode vir junto de um buraco (seq não recomeçou em 1)
};

type Fluxo = {
  ultimoSeq: number;
  // Hashes vistos desde o último boot, para reconhecer duplicatas mesmo fora de ordem (reentrega do QoS 1).
  hashes: Set<string>;
};

// Uma telemetria a cada 5 s dá ~17 000 por dia; guardar os últimos 1 000 hashes cobre ~80 min de reentregas.
const MAX_HASHES = 1000;

export class ControleSeq {
  private readonly fluxos = new Map<string, Fluxo>();

  private static chave(deviceId: string, topico: string): string {
    return `${deviceId}\u0000${topico}`;
  }

  // Retoma o estado a partir do que já está no banco, para não acusar reboot nem perder buraco ao reiniciar o servidor.
  retomar(deviceId: string, topico: string, ultimoSeq: number, hash: string): void {
    this.fluxos.set(ControleSeq.chave(deviceId, topico), { ultimoSeq, hashes: new Set([hash]) });
  }

  analisar(deviceId: string, topico: string, seq: number | null, hash: string): Analise {
    if (seq === null) return { gravar: true, ocorrencias: [] };

    const chave = ControleSeq.chave(deviceId, topico);
    const fluxo = this.fluxos.get(chave);

    if (!fluxo) {
      // Primeira mensagem do fluxo, sem nada no banco: não há anterior para comparar. Um seq alto aqui quase
      // sempre é o backend começando a ouvir com a placa já ligada, não perda.
      this.fluxos.set(chave, { ultimoSeq: seq, hashes: new Set([hash]) });
      return { gravar: true, ocorrencias: [] };
    }

    const anterior = fluxo.ultimoSeq;

    if (fluxo.hashes.has(hash)) {
      return { gravar: false, ocorrencias: [{ tipo: 'duplicata', seqAnterior: anterior, seq }] };
    }

    if (seq <= anterior) {
      // Payload novo com seq que não avançou: a placa reiniciou. Recomeça a contagem deste fluxo.
      const ocorrencias: Ocorrencia[] = [{ tipo: 'reboot', seqAnterior: anterior, seq }];
      if (seq > 1) ocorrencias.push({ tipo: 'buraco', seqAnterior: null, seq, faltandoDe: 1, faltandoAte: seq - 1 });
      this.fluxos.set(chave, { ultimoSeq: seq, hashes: new Set([hash]) });
      return { gravar: true, ocorrencias };
    }

    const ocorrencias: Ocorrencia[] = seq > anterior + 1
      ? [{ tipo: 'buraco', seqAnterior: anterior, seq, faltandoDe: anterior + 1, faltandoAte: seq - 1 }]
      : [];
    fluxo.ultimoSeq = seq;
    fluxo.hashes.add(hash);
    if (fluxo.hashes.size > MAX_HASHES) {
      // Set mantém a ordem de inserção: o primeiro é o mais antigo.
      fluxo.hashes.delete(fluxo.hashes.values().next().value as string);
    }
    return { gravar: true, ocorrencias };
  }
}

// Texto para o log, em português.
export function descrever(o: Ocorrencia): string {
  switch (o.tipo) {
    case 'buraco': {
      const n = o.faltandoAte - o.faltandoDe + 1;
      const intervalo = n === 1 ? `seq ${o.faltandoDe}` : `seq ${o.faltandoDe}..${o.faltandoAte}`;
      const origem = o.seqAnterior === null ? `início do boot → ${o.seq}` : `${o.seqAnterior} → ${o.seq}`;
      return `buraco: ${n} mensagem(ns) perdida(s), ${intervalo} (${origem})`;
    }
    case 'duplicata':
      return `duplicata: seq ${o.seq} com o mesmo payload já recebido; não gravada de novo`;
    case 'reboot':
      return `reboot da placa: seq voltou de ${o.seqAnterior} para ${o.seq}`;
  }
}
