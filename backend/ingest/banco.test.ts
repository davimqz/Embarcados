import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Banco, sha256 } from './banco.ts';
import { validar } from './contrato.ts';

const TEL = '{"device_id":"esp32-t","ts":1795096305,"seq":7,"temperatura":23,"umidade":60,"distancia_cm":10.3,"nivel_pct":19}';

function gravarValida(banco: Banco, topico: string, texto: string, recebidoEm?: number) {
  const v = validar(topico, Buffer.from(texto));
  assert.ok(v.ok, `deveria aceitar: ${texto}`);
  return banco.gravar(v.topico, v.payload, Buffer.from(texto), recebidoEm);
}

test('sha256 de um payload fixo bate com o valor conhecido', () => {
  // echo -n 'abc' | sha256sum
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('hash gravado de um payload de telemetria fixo bate com o valor calculado fora do Node', () => {
  // printf '%s' "$TEL" | sha256sum
  const esperado = '51698c1d8abfb64f939cbab1378b050fdc8cd2654bf9ce744f80ee367e708406';
  assert.equal(sha256(TEL), esperado);
  const banco = new Banco(':memory:');
  assert.equal(gravarValida(banco, 'grupo3/telemetria', TEL).hash, esperado);
  banco.fechar();
});

test('grava tópico, device_id, seq, ts, recebimento, payload bruto e hash', () => {
  const banco = new Banco(':memory:');
  gravarValida(banco, 'grupo3/telemetria', TEL, 1795096306123);
  const [l] = banco.todas();
  assert.deepEqual(l, {
    id: 1,
    topico: 'grupo3/telemetria',
    device_id: 'esp32-t',
    seq: 7,
    ts: 1795096305,
    recebido_em: 1795096306123,
    payload: TEL,
    hash: sha256(TEL),
  });
  banco.fechar();
});

test('preserva o payload byte a byte, sem reformatar o JSON', () => {
  const banco = new Banco(':memory:');
  const torto = '{ "device_id" : "esp32-t", "ts":null,"seq":1,  "temperatura":23,"umidade":60,"distancia_cm":10.30,"nivel_pct":19 }';
  const l = gravarValida(banco, 'grupo3/telemetria', torto);
  assert.equal(banco.todas()[0].payload, torto);
  assert.equal(l.ts, null);
  banco.fechar();
});

test('status sem seq nem ts vira null nas colunas', () => {
  const banco = new Banco(':memory:');
  const l = gravarValida(banco, 'grupo3/status', '{"device_id":"esp32-t","status":"online"}');
  assert.equal(l.seq, null);
  assert.equal(l.ts, null);
  banco.fechar();
});

test('hash recalculado do banco bate; adulterar o payload é detectado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'silo-'));
  const caminho = join(dir, 'sub', 'teste.db'); // pasta inexistente: o banco cria sozinho
  try {
    const banco = new Banco(caminho);
    gravarValida(banco, 'grupo3/telemetria', TEL);
    gravarValida(banco, 'grupo3/telemetria', TEL.replace('"seq":7', '"seq":8'));
    assert.deepEqual(banco.conferirHashes(), []);
    banco.fechar();

    // Reabre o mesmo arquivo (persistiu) e altera uma linha por fora, como na demonstração do M5.
    const reaberto = new Banco(caminho);
    assert.equal(reaberto.total, 2);
    (reaberto as unknown as { db: { exec(sql: string): void } }).db
      .exec(`UPDATE leituras SET payload = replace(payload, '"temperatura":23', '"temperatura":99') WHERE id = 2`);
    assert.deepEqual(reaberto.conferirHashes().map((l) => l.id), [2]);
    reaberto.fechar();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recusa bytes que não são UTF-8 válido em vez de gravar texto trocado', () => {
  const banco = new Banco(':memory:');
  const bytes = Buffer.concat([Buffer.from('{"device_id":"esp32-t","x":"'), Buffer.from([0xff]), Buffer.from('"}')]);
  assert.throws(() => banco.gravar('grupo3/status', { device_id: 'esp32-t' }, bytes));
  assert.equal(banco.total, 0);
  banco.fechar();
});
