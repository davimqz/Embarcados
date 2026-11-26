// Simulador da placa: publica o mesmo que o firmware do M2, seguindo docs/topicos-mqtt.md.
// Existe só enquanto o protótipo não está montado (exceção registrada no TASKS.md, seção M3).
// Se o simulador e o firmware divergirem, vale o contrato.
//
// Uso: npm run simulador -- [opções]
//   --intervalo <ms>        intervalo da telemetria (padrão 5000, como LEITURA_INTERVALO_MS)
//   --device <id>           device_id (padrão esp32-grupo<N>-sim0001)
//   --perda <0..1>          chance de não publicar uma mensagem (o seq sobe: vira buraco)
//   --repeticao <0..1>      chance de publicar a mesma mensagem duas vezes (duplicata)
//   --falha-sensor <0..1>   chance de uma leitura sair com null, como DHT11/HC-SR04 com falha
//   --sem-botoes            não gera apertos de botão automáticos
//
// Teclas (no terminal; com a entrada redirecionada, uma por linha):
//   a = aquecer · e = esfriar · u = umedecer · s = secar ·
//   1 = botão de entrada · 2 = botão de saída · q = sair (a placa "cai" e o broker publica o LWT)

import { parseArgs } from 'node:util';
import readline from 'node:readline';
import mqtt from 'mqtt';

import { GRUPO, MQTT_URL, TOPICOS, agora } from '../comum/config.ts';

const { values: opcoes } = parseArgs({
  args: process.argv.slice(2),
  options: {
    intervalo: { type: 'string', default: '5000' },
    device: { type: 'string', default: `esp32-grupo${GRUPO}-sim0001` },
    perda: { type: 'string', default: '0' },
    repeticao: { type: 'string', default: '0' },
    'falha-sensor': { type: 'string', default: '0' },
    'sem-botoes': { type: 'boolean', default: false },
  },
});

const INTERVALO_MS = Number(opcoes.intervalo);
const DEVICE_ID = opcoes.device;
const CHANCE_PERDA = Number(opcoes.perda);
const CHANCE_REPETICAO = Number(opcoes.repeticao);
const CHANCE_FALHA_SENSOR = Number(opcoes['falha-sensor']);

// Mesmos valores do firmware (sensores.h e alerta.h).
const SILO_DIST_VAZIO_CM = 12.0;
const SILO_DIST_CHEIO_CM = 3.0;
const ALERTA_TEMP_LIGA = 30;
const ALERTA_UMID_LIGA = 70;
const ALERTA_TEMP_DESLIGA = 28;
const ALERTA_UMID_DESLIGA = 65;

// --- Estado do "silo" simulado ---
let temperatura = 26.0;   // valores contínuos; o DHT11 entrega inteiros
let umidade = 60.0;
let distanciaCm = 7.5;    // ~50% cheio
let alvoTemperatura = 26.0;
let alvoUmidade = 60.0;

// --- Estado da "placa": um seq por tópico, zerado no boot ---
const seq = { evento: 0, telemetria: 0, alerta: 0, ventilacao: 0 };
let entradas = 0;
let saidas = 0;
let alertaConhecido = false;
let alertaAtivo = false;
let ventilacaoLigada = false;

const tsAgora = () => Math.floor(Date.now() / 1000);
const sorteia = (chance: number) => Math.random() < chance;
const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const cliente = mqtt.connect(MQTT_URL, {
  clientId: DEVICE_ID,
  keepalive: 15,  // MQTT_KEEPALIVE_S do firmware
  reconnectPeriod: 5000,  // RECONEXAO_MS do firmware
  will: {
    topic: TOPICOS.status,
    payload: Buffer.from(JSON.stringify({ device_id: DEVICE_ID, status: 'offline' })),
    qos: 1,
    retain: true,
  },
});

function log(msg: string) {
  console.log(`${agora()} ${msg}`);
}

// Publica respeitando --perda e --repeticao. O seq já foi consumido por quem chamou.
function publicar(topico: string, dados: object, retido = false) {
  const payload = JSON.stringify(dados);
  if (sorteia(CHANCE_PERDA)) {
    log(`[SIM] Perdida de propósito em ${topico}: ${payload}`);
    return;
  }
  const vezes = sorteia(CHANCE_REPETICAO) ? 2 : 1;
  for (let i = 0; i < vezes; i++) {
    cliente.publish(topico, payload, { qos: 0, retain: retido });
  }
  log(`[MQTT] Publicado em ${topico}${vezes > 1 ? ' (2x, repetida de propósito)' : ''}: ${payload}`);
}

// --- grupo3/silo/evento ---
function apertarBotao(tipo: 'ENTRADA' | 'SAIDA') {
  if (tipo === 'ENTRADA') {
    entradas++;
    distanciaCm -= 0.6;  // mais grão: a superfície sobe e fica mais perto do sensor
  } else {
    saidas++;
    distanciaCm += 0.6;
  }
  distanciaCm = limita(distanciaCm, SILO_DIST_CHEIO_CM - 0.5, SILO_DIST_VAZIO_CM + 0.5);
  seq.evento++;
  publicar(TOPICOS.evento, {
    device_id: DEVICE_ID,
    ts: tsAgora(),
    seq: seq.evento,
    evento: tipo,
    entradas,
    saidas,
    saldo: entradas - saidas,
  });
}

// --- grupo3/alerta (mesma regra de alerta.cpp) ---
function avaliarAlerta(t: number | null, u: number | null, ts: number) {
  if (t === null || u === null) {
    return;  // leitura com falha não muda o estado
  }
  const acimaTemp = t > ALERTA_TEMP_LIGA;
  const acimaUmid = u > ALERTA_UMID_LIGA;
  const novoAtivo = !alertaConhecido || !alertaAtivo
    ? acimaTemp || acimaUmid
    : !(t < ALERTA_TEMP_DESLIGA && u < ALERTA_UMID_DESLIGA);

  if (alertaConhecido && novoAtivo === alertaAtivo) {
    return;
  }
  alertaConhecido = true;
  alertaAtivo = novoAtivo;
  log(`[ALERTA] ${alertaAtivo ? 'ATIVO' : 'NORMAL'} (LED vermelho ${alertaAtivo ? 'aceso' : 'apagado'})`);

  const motivos: string[] = [];
  if (alertaAtivo && acimaTemp) motivos.push('TEMPERATURA');
  if (alertaAtivo && acimaUmid) motivos.push('UMIDADE');

  seq.alerta++;
  publicar(TOPICOS.alerta, {
    device_id: DEVICE_ID,
    ts,
    seq: seq.alerta,
    alerta: alertaAtivo ? 'ATIVO' : 'NORMAL',
    motivos,
    temperatura: t,
    umidade: u,
  }, true);
}

// --- grupo3/telemetria ---
function lerSensores() {
  // Passeio aleatório em direção ao alvo, para o gráfico se mexer sem pular.
  temperatura += (alvoTemperatura - temperatura) * 0.3 + (Math.random() - 0.5) * 0.6;
  umidade += (alvoUmidade - umidade) * 0.3 + (Math.random() - 0.5) * 1.5;
  temperatura = limita(temperatura, 0, 50);
  umidade = limita(umidade, 20, 95);

  const ts = tsAgora();
  const dhtOk = !sorteia(CHANCE_FALHA_SENSOR);
  const sonarOk = !sorteia(CHANCE_FALHA_SENSOR);

  const t = dhtOk ? Math.round(temperatura) : null;
  const u = dhtOk ? Math.round(umidade) : null;
  // Ruído de ~3 mm, a resolução do HC-SR04.
  const dist = sonarOk ? Math.round((distanciaCm + (Math.random() - 0.5) * 0.3) * 10) / 10 : null;
  const nivel = dist === null ? null : Math.round(limita(
    (SILO_DIST_VAZIO_CM - dist) * 100 / (SILO_DIST_VAZIO_CM - SILO_DIST_CHEIO_CM), 0, 100));

  // Como no firmware: o seq é dado na leitura, então uma perda vira buraco.
  seq.telemetria++;
  publicar(TOPICOS.telemetria, {
    device_id: DEVICE_ID,
    ts,
    seq: seq.telemetria,
    temperatura: t,
    umidade: u,
    distancia_cm: dist,
    nivel_pct: nivel,
  });

  avaliarAlerta(t, u, ts);
}

// --- grupo3/ventilacao ---
function publicarVentilacao(cmdSeq: number | null) {
  seq.ventilacao++;
  publicar(TOPICOS.ventilacao, {
    device_id: DEVICE_ID,
    ts: tsAgora(),
    seq: seq.ventilacao,
    ventilacao: ventilacaoLigada ? 'LIGADA' : 'DESLIGADA',
    cmd_seq: cmdSeq,
  }, true);
}

// --- grupo3/cmd (mesmas validações de atuador.cpp) ---
function receberComando(payload: Buffer) {
  let cmd: Record<string, unknown>;
  try {
    cmd = JSON.parse(payload.toString());
  } catch {
    log('[CMD] Descartado: JSON invalido.');
    return;
  }
  if (cmd.device_id !== DEVICE_ID) {
    log('[CMD] Descartado: device_id de outra placa.');
    return;
  }
  if (typeof cmd.seq !== 'number' || !Number.isInteger(cmd.seq) || cmd.seq < 0) {
    log('[CMD] Descartado: seq ausente ou invalido.');
    return;
  }
  if (cmd.comando !== 'VENTILACAO') {
    log('[CMD] Descartado: comando desconhecido.');
    return;
  }
  if (cmd.valor !== 'LIGAR' && cmd.valor !== 'DESLIGAR') {
    log('[CMD] Descartado: valor desconhecido.');
    return;
  }
  ventilacaoLigada = cmd.valor === 'LIGAR';
  log(`[ATUADOR] Ventilacao ${ventilacaoLigada ? 'LIGADA' : 'DESLIGADA'} (seq ${cmd.seq}).`);
  // A ventilação ligada esfria e seca o silo aos poucos.
  if (ventilacaoLigada) {
    alvoTemperatura = Math.min(alvoTemperatura, 25);
    alvoUmidade = Math.min(alvoUmidade, 55);
  }
  publicarVentilacao(cmd.seq);
}

// --- Conexão ---
let iniciado = false;

cliente.on('connect', () => {
  log(`[MQTT] Conectado a ${MQTT_URL} como ${DEVICE_ID}`);
  // QoS 0 como no firmware (o PubSubClient só publica em QoS 0); só o LWT é QoS 1.
  cliente.publish(TOPICOS.status, JSON.stringify({ device_id: DEVICE_ID, status: 'online' }), { qos: 0, retain: true });
  cliente.subscribe(TOPICOS.cmd, { qos: 1 }, (erro) => {
    log(erro ? `[MQTT] Falha ao assinar ${TOPICOS.cmd}` : `[MQTT] Assinado: ${TOPICOS.cmd}`);
  });

  // Só no primeiro connect, como o boot da placa: estado inicial da ventilação e início das leituras.
  if (!iniciado) {
    iniciado = true;
    publicarVentilacao(null);
    lerSensores();
    setInterval(lerSensores, INTERVALO_MS);
    if (!opcoes['sem-botoes']) {
      agendarBotao();
    }
  }
});

cliente.on('message', (topico, payload) => {
  if (topico === TOPICOS.cmd) {
    receberComando(payload);
  }
});

cliente.on('offline', () => log('[MQTT] Sem conexao com o broker. Nova tentativa em 5 s.'));
cliente.on('error', (erro) => log(`[MQTT] Erro: ${erro.message}`));

// Apertos automáticos a cada 15–40 s, com mais entradas que saídas.
function agendarBotao() {
  setTimeout(() => {
    apertarBotao(Math.random() < 0.6 ? 'ENTRADA' : 'SAIDA');
    agendarBotao();
  }, 15000 + Math.random() * 25000);
}

// --- Teclas ---
function sair() {
  // end(true) fecha o socket sem DISCONNECT: o broker trata como queda e publica o LWT, como uma placa desligada.
  log('[SIM] Saindo sem desconectar: o broker deve publicar o offline (LWT).');
  cliente.end(true, () => process.exit(0));
}

function tratarTecla(tecla: string) {
  if (tecla === 'q') {
    sair();
  } else if (tecla === 'a') {
    alvoTemperatura = 34; log('[SIM] Aquecendo o silo (alvo 34 C).');
  } else if (tecla === 'e') {
    alvoTemperatura = 24; log('[SIM] Esfriando o silo (alvo 24 C).');
  } else if (tecla === 'u') {
    alvoUmidade = 78; log('[SIM] Umedecendo o silo (alvo 78%).');
  } else if (tecla === 's') {
    alvoUmidade = 55; log('[SIM] Secando o silo (alvo 55%).');
  } else if (tecla === '1') {
    apertarBotao('ENTRADA');
  } else if (tecla === '2') {
    apertarBotao('SAIDA');
  }
}

if (process.stdin.isTTY) {
  // Terminal: uma tecla basta, sem Enter.
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (texto: string | undefined, tecla: { ctrl?: boolean; name?: string }) => {
    if (tecla.ctrl && tecla.name === 'c') {
      sair();
    } else if (texto) {
      tratarTecla(texto);
    }
  });
  log('[SIM] Teclas: a/e aquecer/esfriar · u/s umedecer/secar · 1/2 entrada/saida · q sair');
} else {
  // Entrada redirecionada (roteiro de teste ou de demo): uma tecla por linha.
  readline.createInterface({ input: process.stdin }).on('line', (linha) => tratarTecla(linha.trim()));
}
process.on('SIGINT', sair);
process.on('SIGTERM', sair);
