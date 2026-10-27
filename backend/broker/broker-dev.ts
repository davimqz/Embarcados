// Broker MQTT de desenvolvimento (aedes), para trabalhar sem instalar o Mosquitto.
// Guarda retidos e LWT em memória: ao reiniciar, tudo some. Na apresentação vale o Mosquitto (decisão 6).
//
// Uso: npm run broker
// Mostra cada conexão e cada mensagem publicada, para servir de "mosquitto_sub -v" durante os testes.

import net from 'node:net';
import { Aedes } from 'aedes';

import { BROKER_PORTA, agora } from '../comum/config.ts';

const broker = await Aedes.createBroker();
const servidor = net.createServer(broker.handle);

broker.on('client', (cliente) => {
  console.log(`${agora()} [BROKER] Conectado: ${cliente.id}`);
});

broker.on('clientDisconnect', (cliente) => {
  console.log(`${agora()} [BROKER] Desconectado: ${cliente.id}`);
});

broker.on('subscribe', (assinaturas, cliente) => {
  for (const a of assinaturas) {
    console.log(`${agora()} [BROKER] ${cliente.id} assinou ${a.topic} (QoS ${a.qos})`);
  }
});

broker.on('publish', (pacote, cliente) => {
  // Mensagens internas do aedes ($SYS/...) não interessam.
  if (pacote.topic.startsWith('$SYS/')) {
    return;
  }
  // O LWT também vem com o cliente que caiu; sem cliente, é mensagem interna do broker.
  const origem = cliente ? cliente.id : 'broker';
  const retido = pacote.retain ? ' [retido]' : '';
  console.log(`${agora()} [MQTT] ${pacote.topic}${retido} de ${origem}: ${pacote.payload.toString()}`);
});

servidor.listen(BROKER_PORTA, () => {
  console.log(`${agora()} [BROKER] Ouvindo em mqtt://localhost:${BROKER_PORTA}`);
});

function encerrar() {
  console.log(`${agora()} [BROKER] Encerrando.`);
  servidor.close();
  broker.close(() => process.exit(0));
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
