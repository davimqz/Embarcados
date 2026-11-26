import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Arquivo, interpretar, type Mensagem } from './arquivo.ts';

const tel = (seq: number, ts: number | null) =>
  JSON.stringify({ device_id: 'esp32-t', ts, seq, temperatura: 23, umidade: 60, distancia_cm: 10.3, nivel_pct: 19 });

function msg(topico: string, texto: string): Mensagem {
  const r = interpretar(topico, texto);
  assert.ok(r.ok, `deveria aceitar: ${texto}`);
  return r.mensagem;
}

test('aceita telemetria do contrato sem alterar o payload', () => {
  const r = interpretar('grupo3/telemetria', tel(7, 1795096305));
  assert.ok(r.ok);
  assert.deepEqual(r.mensagem, { topico: 'grupo3/telemetria', payload: JSON.parse(tel(7, 1795096305)) });
});

test('aceita ts null (relógio ainda sem NTP) e status sem seq', () => {
  assert.ok(interpretar('grupo3/telemetria', tel(1, null)).ok);
  assert.ok(interpretar('grupo3/status', '{"device_id":"esp32-t","status":"offline"}').ok);
});

test('descarta JSON inválido, sem device_id, sem seq e tópico fora do painel', () => {
  assert.equal(interpretar('grupo3/telemetria', 'oi').ok, false);
  assert.equal(interpretar('grupo3/telemetria', '{"seq":1,"ts":null}').ok, false);
  assert.equal(interpretar('grupo3/alerta', '{"device_id":"x","ts":null}').ok, false);
  assert.equal(interpretar('grupo3/status', '{"device_id":"x","status":"talvez"}').ok, false);
  assert.equal(interpretar('grupo3/cmd', '{"device_id":"x","seq":1,"ts":null}').ok, false);
});

test('consulta por período usa o ts da placa, ou a chegada quando ts é null', () => {
  const a = new Arquivo();
  a.adicionar(msg('grupo3/telemetria', tel(1, null)), 1000);
  a.adicionar(msg('grupo3/telemetria', tel(2, 2000)), 2005);
  a.adicionar(msg('grupo3/status', '{"device_id":"esp32-t","status":"online"}'), 2010);
  assert.deepEqual(a.consultar(0, 1500).map((m) => m.payload.seq), [1]);
  assert.deepEqual(a.consultar(1500, 3000, ['grupo3/telemetria']).map((m) => m.payload.seq), [2]);
  assert.equal(a.consultar(0, 3000).length, 3);
});

test('recentes traz a janela e o último status e alerta, mesmo antigos', () => {
  const a = new Arquivo();
  a.adicionar(msg('grupo3/status', '{"device_id":"esp32-t","status":"online"}'), 100);
  a.adicionar(msg('grupo3/alerta', '{"device_id":"esp32-t","ts":110,"seq":1,"alerta":"ATIVO","motivos":["UMIDADE"],"temperatura":23,"umidade":95}'));
  a.adicionar(msg('grupo3/telemetria', tel(1, 120)));
  a.adicionar(msg('grupo3/telemetria', tel(2, 5000)));
  const r = a.recentes(600, 5100);
  assert.deepEqual(r.map((m) => m.topico), ['grupo3/status', 'grupo3/alerta', 'grupo3/telemetria']);
  assert.equal(r[2]!.payload.seq, 2);
});

test('descarta as mais antigas quando passa do máximo', () => {
  const a = new Arquivo(3);
  for (let i = 1; i <= 5; i++) a.adicionar(msg('grupo3/telemetria', tel(i, i)));
  assert.equal(a.tamanho, 3);
  assert.deepEqual(a.consultar(0, 10).map((m) => m.payload.seq), [3, 4, 5]);
});
