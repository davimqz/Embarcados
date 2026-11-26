// Persistência das mensagens válidas no SQLite (T3.2).
// Cada mensagem vira uma linha em `leituras`, com o payload bruto exatamente como chegou do broker e o SHA-256
// desses bytes: é esse hash que entra na Merkle root dos lotes do M5. O arquivo do banco é criado na primeira
// execução, junto com a pasta, e fica fora do git (*.db no .gitignore).

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

import type { Payload } from './contrato.ts';
import type { Ocorrencia } from './sequencia.ts';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS leituras (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topico      TEXT    NOT NULL,
  device_id   TEXT    NOT NULL,
  seq         INTEGER,          -- null em grupo3/status, que não tem seq (contrato)
  ts          INTEGER,          -- segundos UTC da placa; null sem NTP ou em grupo3/status
  recebido_em INTEGER NOT NULL, -- milissegundos UTC em que o backend recebeu a mensagem
  payload     TEXT    NOT NULL, -- bytes do broker, sem reformatar
  hash        TEXT    NOT NULL  -- SHA-256 (hex) dos bytes de payload
);
CREATE INDEX IF NOT EXISTS leituras_device_topico_seq ON leituras (device_id, topico, seq);
CREATE INDEX IF NOT EXISTS leituras_ts ON leituras (ts);

-- Buracos, duplicatas e reboots detectados no seq (T3.3). Duplicatas não entram em leituras.
CREATE TABLE IF NOT EXISTS ocorrencias_seq (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('buraco', 'duplicata', 'reboot')),
  topico       TEXT    NOT NULL,
  device_id    TEXT    NOT NULL,
  seq_anterior INTEGER,          -- último seq do fluxo; null no buraco de um boot que não começou em 1
  seq          INTEGER NOT NULL, -- seq da mensagem que revelou a ocorrência
  faltando_de  INTEGER,          -- só em buraco: primeiro e último seq perdidos
  faltando_ate INTEGER,
  recebido_em  INTEGER NOT NULL  -- milissegundos UTC
);
`;

export type Leitura = {
  id: number;
  topico: string;
  device_id: string;
  seq: number | null;
  ts: number | null;
  recebido_em: number;
  payload: string;
  hash: string;
};

export type OcorrenciaGravada = {
  id: number;
  tipo: Ocorrencia['tipo'];
  topico: string;
  device_id: string;
  seq_anterior: number | null;
  seq: number;
  faltando_de: number | null;
  faltando_ate: number | null;
  recebido_em: number;
};

// Última leitura com seq de cada placa e tópico, para o ControleSeq retomar depois de reiniciar o servidor.
export type UltimaDoFluxo = { device_id: string; topico: string; seq: number; hash: string };

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// fatal: bytes que não são UTF-8 válido viram erro, em vez de caracteres trocados que mudariam o hash.
const utf8 = new TextDecoder('utf-8', { fatal: true });

export class Banco {
  private readonly db: Database.Database;
  private readonly inserir: Database.Statement;
  private readonly inserirOcorrencia: Database.Statement;

  // caminho ':memory:' serve para os testes.
  constructor(caminho: string) {
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    this.db = new Database(caminho);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(ESQUEMA);
    this.inserir = this.db.prepare(
      `INSERT INTO leituras (topico, device_id, seq, ts, recebido_em, payload, hash)
       VALUES (@topico, @device_id, @seq, @ts, @recebido_em, @payload, @hash)`,
    );
    this.inserirOcorrencia = this.db.prepare(
      `INSERT INTO ocorrencias_seq (tipo, topico, device_id, seq_anterior, seq, faltando_de, faltando_ate, recebido_em)
       VALUES (@tipo, @topico, @device_id, @seq_anterior, @seq, @faltando_de, @faltando_ate, @recebido_em)`,
    );
  }

  // Grava uma mensagem já validada (contrato.ts). bruto são os bytes exatamente como chegaram do broker.
  gravar(topico: string, payload: Payload, bruto: Buffer | string, recebidoEm = Date.now()): Leitura {
    const bytes = typeof bruto === 'string' ? Buffer.from(bruto, 'utf8') : bruto;
    const linha = {
      topico,
      device_id: payload.device_id,
      seq: Number.isInteger(payload.seq) ? (payload.seq as number) : null,
      ts: Number.isInteger(payload.ts) ? (payload.ts as number) : null,
      recebido_em: recebidoEm,
      payload: utf8.decode(bytes),
      hash: sha256(bytes),
    };
    const { lastInsertRowid } = this.inserir.run(linha);
    return { id: Number(lastInsertRowid), ...linha };
  }

  get total(): number {
    return (this.db.prepare('SELECT count(*) AS n FROM leituras').get() as { n: number }).n;
  }

  registrarOcorrencia(topico: string, deviceId: string, o: Ocorrencia, recebidoEm = Date.now()): OcorrenciaGravada {
    const linha = {
      tipo: o.tipo,
      topico,
      device_id: deviceId,
      seq_anterior: o.seqAnterior,
      seq: o.seq,
      faltando_de: o.tipo === 'buraco' ? o.faltandoDe : null,
      faltando_ate: o.tipo === 'buraco' ? o.faltandoAte : null,
      recebido_em: recebidoEm,
    };
    const { lastInsertRowid } = this.inserirOcorrencia.run(linha);
    return { id: Number(lastInsertRowid), ...linha };
  }

  get totalOcorrencias(): number {
    return (this.db.prepare('SELECT count(*) AS n FROM ocorrencias_seq').get() as { n: number }).n;
  }

  ocorrencias(): OcorrenciaGravada[] {
    return this.db.prepare('SELECT * FROM ocorrencias_seq ORDER BY id').all() as OcorrenciaGravada[];
  }

  ultimasPorFluxo(): UltimaDoFluxo[] {
    return this.db.prepare(
      `SELECT device_id, topico, seq, hash FROM leituras
       WHERE id IN (SELECT max(id) FROM leituras WHERE seq IS NOT NULL GROUP BY device_id, topico)`,
    ).all() as UltimaDoFluxo[];
  }

  todas(): Leitura[] {
    return this.db.prepare('SELECT * FROM leituras ORDER BY id').all() as Leitura[];
  }

  // Recalcula o SHA-256 a partir do payload guardado e devolve as linhas em que ele não bate com o hash gravado.
  conferirHashes(): Leitura[] {
    return this.todas().filter((l) => sha256(l.payload) !== l.hash);
  }

  fechar(): void {
    this.db.close();
  }
}
