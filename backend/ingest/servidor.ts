// Servidor do painel (T4.6): assina os tópicos da placa no broker e repassa cada mensagem ao frontend.
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
import { Arquivo, TOPICOS_PAINEL, interpretar } from './arquivo.ts';

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
  mqttCliente.subscribe([...TOPICOS_PAINEL], { qos: 1 }, (erro) => {
    if (erro) console.log(`${agora()} [MQTT] Falha ao assinar: ${erro.message}`);
    else console.log(`${agora()} [MQTT] Assinado: ${TOPICOS_PAINEL.join(', ')}`);
  });
});
mqttCliente.on('reconnect', () => console.log(`${agora()} [MQTT] Reconectando a ${MQTT_URL}...`));
mqttCliente.on('offline', () => console.log(`${agora()} [MQTT] Sem conexão com o broker`));
mqttCliente.on('error', (erro) => console.log(`${agora()} [MQTT] Erro: ${erro.message}`));

mqttCliente.on('message', (topico, bruto) => {
  const r = interpretar(topico, bruto);
  if (!r.ok) {
    console.log(`${agora()} [MQTT] Descartada em ${topico} (${r.motivo}): ${bruto.toString().slice(0, 200)}`);
    return;
  }
  arquivo.adicionar(r.mensagem);
  const texto = JSON.stringify(r.mensagem);
  console.log(`${agora()} [MQTT] ${topico} ${JSON.stringify(r.mensagem.payload)} → ${clientes.size} painel(is)`);
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
