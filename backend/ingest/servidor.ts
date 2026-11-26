// Servidor do painel (T4.6): assina os tópicos da placa no broker, valida cada mensagem contra o contrato (T3.1)
// e repassa as válidas ao frontend. As inválidas são rejeitadas com o motivo no log.
//   WebSocket  /ws              → ao conectar, as mensagens recentes; depois, cada mensagem nova
//   REST       /api/mensagens   → ?desde=&ate=&topicos=a,b (ts em segundos UTC), a partir do arquivo em memória
//   REST       /api/saude       → estado da conexão com o broker
// Cada mensagem vai como { topico, payload }, com o payload exatamente como a placa publicou.
//
// Uso: npm run servidor

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import mqtt from 'mqtt';

import { MQTT_URL, SERVIDOR_PORTA, agora } from '../comum/config.ts';
import { Arquivo, ehDoPainel } from './arquivo.ts';
import { TOPICOS_INGEST, validar } from './contrato.ts';

const JANELA_RECENTE_S = 10 * 60; // a tela ao vivo mostra 10 min de leituras

const arquivo = new Arquivo();
const clientes = new Set<WebSocket>();

// --- MQTT ---
const mqttCliente = mqtt.connect(MQTT_URL, {
  clientId: `silo-painel-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 3000,
  connectTimeout: 10_000,
});

mqttCliente.on('connect', () => {
  console.log(`${agora()} [MQTT] Conectado a ${MQTT_URL}`);
  mqttCliente.subscribe([...TOPICOS_INGEST], { qos: 1 }, (erro) => {
    if (erro) console.log(`${agora()} [MQTT] Falha ao assinar: ${erro.message}`);
    else console.log(`${agora()} [MQTT] Assinado: ${TOPICOS_INGEST.join(', ')}`);
  });
});
mqttCliente.on('reconnect', () => console.log(`${agora()} [MQTT] Reconectando a ${MQTT_URL}...`));
mqttCliente.on('offline', () => console.log(`${agora()} [MQTT] Sem conexão com o broker`));
// Conexão recusada chega como AggregateError, com message vazia; o code (ex.: ECONNREFUSED) diz o motivo.
mqttCliente.on('error', (erro) =>
  console.log(`${agora()} [MQTT] Erro: ${erro.message || (erro as NodeJS.ErrnoException).code || erro.name}`));

mqttCliente.on('message', (topico, bruto) => {
  const v = validar(topico, bruto);
  if (!v.ok) {
    console.log(`${agora()} [MQTT] Rejeitada em ${topico} (${v.motivo}): ${bruto.toString().slice(0, 200)}`);
    return;
  }
  if (!ehDoPainel(v.topico)) {
    // Válida, mas o painel não mostra este tópico (grupo3/ventilacao, decisão 14 em aberto).
    console.log(`${agora()} [MQTT] ${topico} ${JSON.stringify(v.payload)} (válida; fora do painel)`);
    return;
  }
  const mensagem = { topico: v.topico, payload: v.payload };
  arquivo.adicionar(mensagem);
  const texto = JSON.stringify(mensagem);
  console.log(`${agora()} [MQTT] ${topico} ${JSON.stringify(v.payload)} → ${clientes.size} painel(is)`);
  for (const ws of clientes) {
    if (ws.readyState === ws.OPEN) ws.send(texto);
  }
});

// --- HTTP / WebSocket ---
const app = Fastify();
await app.register(websocket);

app.get('/ws', { websocket: true }, (ws) => {
  clientes.add(ws);
  const recentes = arquivo.recentes(JANELA_RECENTE_S);
  console.log(`${agora()} [WS] Painel conectado (${clientes.size} aberto(s)); enviando ${recentes.length} mensagem(ns) recente(s)`);
  for (const m of recentes) ws.send(JSON.stringify(m));
  ws.on('close', () => {
    clientes.delete(ws);
    console.log(`${agora()} [WS] Painel desconectado (${clientes.size} aberto(s))`);
  });
});

app.get<{ Querystring: { desde?: string; ate?: string; topicos?: string } }>('/api/mensagens', async (req, res) => {
  const desde = Number(req.query.desde ?? 0);
  const ate = Number(req.query.ate ?? Math.floor(Date.now() / 1000));
  if (!Number.isFinite(desde) || !Number.isFinite(ate)) {
    return res.code(400).send({ erro: 'desde e ate devem ser números (segundos UTC)' });
  }
  const topicos = req.query.topicos ? req.query.topicos.split(',') : undefined;
  return arquivo.consultar(desde, ate, topicos);
});

app.get('/api/saude', async () => ({
  broker: MQTT_URL,
  conectado: mqttCliente.connected,
  mensagens: arquivo.tamanho,
  paineis: clientes.size,
}));

await app.listen({ port: SERVIDOR_PORTA, host: '127.0.0.1' });
console.log(`${agora()} [HTTP] Servidor do painel em http://localhost:${SERVIDOR_PORTA} (WebSocket em /ws)`);
