import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Banco } from './banco.ts';
import { ControleSeq, descrever } from './sequencia.ts';

const D = 'esp32-t';
const T = 'grupo3/telemetria';

test('sequência normal não gera ocorrência', () => {
  const c = new ControleSeq();
  for (let s = 1; s <= 5; s++) assert.deepEqual(c.analisar(D, T, s, `h${s}`), { gravar: true, ocorrencias: [] });
});

test('buraco 7 → 9 é registrado com o intervalo faltante', () => {
  const c = new ControleSeq();
  c.analisar(D, T, 7, 'h7');
  const a = c.analisar(D, T, 9, 'h9');
  assert.equal(a.gravar, true);
  assert.deepEqual(a.ocorrencias, [{ tipo: 'buraco', seqAnterior: 7, seq: 9, faltandoDe: 8, faltandoAte: 8 }]);
  assert.match(descrever(a.ocorrencias[0]), /seq 8 \(7 → 9\)/);
});

test('duplicata (mesmo seq e payload) é registrada e não é gravada, mesmo fora de ordem', () => {
  const c = new ControleSeq();
  c.analisar(D, T, 1, 'h1');
  c.analisar(D, T, 2, 'h2');
  assert.deepEqual(c.analisar(D, T, 2, 'h2'), { gravar: false, ocorrencias: [{ tipo: 'duplicata', seqAnterior: 2, seq: 2 }] });
  assert.equal(c.analisar(D, T, 1, 'h1').gravar, false); // reentrega antiga do QoS 1
  assert.deepEqual(c.analisar(D, T, 3, 'h3').ocorrencias, []); // a contagem segue normal
});

test('seq menor com payload novo é reboot, não erro; se não recomeçou em 1, também acusa o buraco', () => {
  const c = new ControleSeq();
  c.analisar(D, T, 41, 'a');
  c.analisar(D, T, 42, 'b');
  assert.deepEqual(c.analisar(D, T, 1, 'c'), { gravar: true, ocorrencias: [{ tipo: 'reboot', seqAnterior: 42, seq: 1 }] });
  assert.deepEqual(c.analisar(D, T, 2, 'd').ocorrencias, []);

  assert.deepEqual(c.analisar(D, T, 2, 'e').ocorrencias, [
    { tipo: 'reboot', seqAnterior: 2, seq: 2 },
    { tipo: 'buraco', seqAnterior: null, seq: 2, faltandoDe: 1, faltandoAte: 1 },
  ]);
});

test('cada placa e cada tópico têm seq próprio; status (sem seq) passa direto', () => {
  const c = new ControleSeq();
  c.analisar(D, T, 5, 'x');
  assert.deepEqual(c.analisar(D, 'grupo3/alerta', 1, 'y').ocorrencias, []);
  assert.deepEqual(c.analisar('outra', T, 1, 'z').ocorrencias, []);
  assert.deepEqual(c.analisar(D, 'grupo3/status', null, 's'), { gravar: true, ocorrencias: [] });
  assert.deepEqual(c.analisar(D, 'grupo3/status', null, 's'), { gravar: true, ocorrencias: [] });
});

test('retoma do banco: mensagem retida já gravada é duplicata; o seq seguinte não vira reboot', () => {
  const banco = new Banco(':memory:');
  banco.gravar(T, { device_id: D, seq: 1 }, '{"device_id":"esp32-t","seq":1}');
  banco.gravar(T, { device_id: D, seq: 2 }, '{"device_id":"esp32-t","seq":2}');
  banco.gravar('grupo3/status', { device_id: D }, '{"device_id":"esp32-t","status":"online"}');
  const ultimas = banco.ultimasPorFluxo();
  assert.deepEqual(ultimas.map((u) => [u.topico, u.seq]), [[T, 2]]);

  const c = new ControleSeq();
  for (const u of ultimas) c.retomar(u.device_id, u.topico, u.seq, u.hash);
  assert.equal(c.analisar(D, T, 2, ultimas[0].hash).gravar, false);
  assert.deepEqual(c.analisar(D, T, 4, 'h4').ocorrencias, [{ tipo: 'buraco', seqAnterior: 2, seq: 4, faltandoDe: 3, faltandoAte: 3 }]);
  banco.fechar();
});

test('ocorrência é gravada em ocorrencias_seq', () => {
  const banco = new Banco(':memory:');
  banco.registrarOcorrencia(T, D, { tipo: 'buraco', seqAnterior: 7, seq: 10, faltandoDe: 8, faltandoAte: 9 }, 123);
  banco.registrarOcorrencia(T, D, { tipo: 'reboot', seqAnterior: 10, seq: 1 }, 124);
  assert.deepEqual(banco.ocorrencias(), [
    { id: 1, tipo: 'buraco', topico: T, device_id: D, seq_anterior: 7, seq: 10, faltando_de: 8, faltando_ate: 9, recebido_em: 123 },
    { id: 2, tipo: 'reboot', topico: T, device_id: D, seq_anterior: 10, seq: 1, faltando_de: null, faltando_ate: null, recebido_em: 124 },
  ]);
  assert.equal(banco.totalOcorrencias, 2);
  banco.fechar();
});
