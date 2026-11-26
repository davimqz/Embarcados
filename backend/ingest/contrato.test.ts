import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validar } from './contrato.ts';

// Exemplos válidos tirados de docs/topicos-mqtt.md.
const VALIDOS: Record<string, Record<string, unknown>> = {
  'grupo3/silo/evento': { device_id: 'esp32-t', ts: 1792500000, seq: 7, evento: 'ENTRADA', entradas: 5, saidas: 2, saldo: 3 },
  'grupo3/status': { device_id: 'esp32-t', status: 'online' },
  'grupo3/telemetria': { device_id: 'esp32-t', ts: 1792500005, seq: 42, temperatura: 27, umidade: 61, distancia_cm: 5.8, nivel_pct: 62 },
  'grupo3/alerta': { device_id: 'esp32-t', ts: 1792500040, seq: 3, alerta: 'ATIVO', motivos: ['TEMPERATURA'], temperatura: 31, umidade: 64 },
  'grupo3/ventilacao': { device_id: 'esp32-t', ts: 1792500101, seq: 2, ventilacao: 'LIGADA', cmd_seq: 5 },
};

// Rejeita o payload válido do tópico com `mudanca` aplicada; undefined remove o campo.
function rejeita(topico: string, mudanca: Record<string, unknown>, motivoEsperado: RegExp) {
  const p: Record<string, unknown> = { ...VALIDOS[topico], ...mudanca };
  for (const [k, v] of Object.entries(mudanca)) if (v === undefined) delete p[k];
  const r = validar(topico, JSON.stringify(p));
  assert.equal(r.ok, false, `${topico} deveria rejeitar ${JSON.stringify(mudanca)}`);
  if (!r.ok) assert.match(r.motivo, motivoEsperado);
}

test('aceita o exemplo do contrato de cada tópico, sem alterar o payload', () => {
  for (const [topico, payload] of Object.entries(VALIDOS)) {
    const r = validar(topico, JSON.stringify(payload));
    assert.ok(r.ok, `${topico}: ${r.ok ? '' : r.motivo}`);
    assert.deepEqual(r.payload, payload);
  }
});

test('aceita ts null, leituras null e campos a mais', () => {
  assert.ok(validar('grupo3/telemetria', JSON.stringify({ ...VALIDOS['grupo3/telemetria'], ts: null, temperatura: null, umidade: null, distancia_cm: null, nivel_pct: null })).ok);
  assert.ok(validar('grupo3/ventilacao', JSON.stringify({ ...VALIDOS['grupo3/ventilacao'], cmd_seq: null })).ok);
  assert.ok(validar('grupo3/alerta', JSON.stringify({ ...VALIDOS['grupo3/alerta'], alerta: 'NORMAL', motivos: [] })).ok);
  assert.ok(validar('grupo3/status', JSON.stringify({ ...VALIDOS['grupo3/status'], extra: 1 })).ok);
});

test('rejeita JSON inválido, payload que não é objeto e tópico fora do contrato', () => {
  assert.deepEqual(validar('grupo3/telemetria', '{temperatura: 27'), { ok: false, motivo: 'JSON inválido' });
  assert.deepEqual(validar('grupo3/telemetria', '[1,2]'), { ok: false, motivo: 'payload não é um objeto JSON' });
  assert.deepEqual(validar('grupo3/telemetria', 'null'), { ok: false, motivo: 'payload não é um objeto JSON' });
  assert.deepEqual(validar('grupo3/cmd', '{}'), { ok: false, motivo: 'tópico fora do contrato' });
});

test('rejeita device_id, ts e seq fora do contrato em qualquer tópico com seq', () => {
  for (const topico of ['grupo3/silo/evento', 'grupo3/telemetria', 'grupo3/alerta', 'grupo3/ventilacao']) {
    rejeita(topico, { device_id: undefined }, /device_id/);
    rejeita(topico, { device_id: '' }, /device_id/);
    rejeita(topico, { ts: undefined }, /ts ausente/);
    rejeita(topico, { ts: '1792500000' }, /ts deve ser inteiro/);
    rejeita(topico, { seq: undefined }, /seq ausente/);
    rejeita(topico, { seq: 1.5 }, /seq deve ser inteiro/);
    rejeita(topico, { seq: 0 }, /seq fora da faixa/);
    rejeita(topico, { seq: null }, /seq não pode ser null/);
  }
});

test('rejeita evento fora do contrato', () => {
  rejeita('grupo3/silo/evento', { evento: 'entrada' }, /evento deve ser/);
  rejeita('grupo3/silo/evento', { entradas: -1 }, /entradas fora da faixa/);
  rejeita('grupo3/silo/evento', { saidas: undefined }, /saidas ausente/);
  rejeita('grupo3/silo/evento', { saldo: 4 }, /saldo diferente/);
});

test('rejeita status fora do contrato', () => {
  rejeita('grupo3/status', { status: 'talvez' }, /status deve ser/);
  rejeita('grupo3/status', { device_id: 42 }, /device_id/);
});

test('rejeita telemetria fora do contrato', () => {
  rejeita('grupo3/telemetria', { temperatura: 27.5 }, /temperatura deve ser inteiro/);
  rejeita('grupo3/telemetria', { umidade: 101 }, /umidade fora da faixa/);
  rejeita('grupo3/telemetria', { distancia_cm: '5.8' }, /distancia_cm deve ser número/);
  rejeita('grupo3/telemetria', { nivel_pct: undefined }, /nivel_pct ausente/);
  rejeita('grupo3/telemetria', { distancia_cm: null }, /nivel_pct deve ser null/);
});

test('rejeita alerta fora do contrato', () => {
  rejeita('grupo3/alerta', { alerta: 'LIGADO' }, /alerta deve ser/);
  rejeita('grupo3/alerta', { motivos: 'TEMPERATURA' }, /motivos deve ser uma lista/);
  rejeita('grupo3/alerta', { motivos: ['PRESSAO'] }, /motivos aceita só/);
  rejeita('grupo3/alerta', { alerta: 'NORMAL' }, /motivos deve ser vazio/);
});

test('rejeita ventilacao fora do contrato', () => {
  rejeita('grupo3/ventilacao', { ventilacao: 'ON' }, /ventilacao deve ser/);
  rejeita('grupo3/ventilacao', { cmd_seq: undefined }, /cmd_seq ausente/);
  rejeita('grupo3/ventilacao', { cmd_seq: 'cinco' }, /cmd_seq deve ser inteiro/);
});
