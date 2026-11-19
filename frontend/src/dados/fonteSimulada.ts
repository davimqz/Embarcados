// Fonte SIMULADA: imita, no navegador, o que a placa publica (firmware do M2) e o que o backend repassaria.
// Segue docs/topicos-mqtt.md: seq por tópico, ts em segundos UTC, alerta com histerese, ventilação manual.
// Some quando o backend (M3) expuser o WebSocket — basta trocar a fonte em App.tsx.

import type { FonteDados, Mensagem, Telemetria } from "./tipos";

const DEVICE_ID = "esp32-grupo3-simulado";
const PERIODO_MS = 5000; // telemetria a cada 5 s (decisão 4)
const DIST_VAZIO_CM = 12; // config.example.h (M2)
const DIST_CHEIO_CM = 3;
const PASSO_NIVEL_LOTE = 8; // % de nível por lote, só para o simulador parecer coerente

type Controle = "aquecer" | "esfriar" | "umedecer" | "secar" | "entrada" | "saida" | "desconectar" | "reconectar";

export class FonteSimulada implements FonteDados {
  private ouvintes = new Set<(m: Mensagem) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = { telemetria: 0, evento: 0, alerta: 0, ventilacao: 0, cmd: 0 };

  private temperatura = 26;
  private umidade = 58;
  private nivel = 45;
  private entradas = 6;
  private saidas = 2;
  private alertaAtivo = false;
  private ventilacao: "LIGADA" | "DESLIGADA" = "DESLIGADA";
  private online = true;
  private hist: Mensagem[] = [];

  constructor() {
    // 5 min de histórico (60 leituras) + alguns eventos, para o gráfico não nascer vazio.
    const agora = Math.floor(Date.now() / 1000);
    const eventos = new Map<number, "ENTRADA" | "SAIDA">([[56, "ENTRADA"], [38, "ENTRADA"], [19, "SAIDA"]]);
    for (let i = 60; i > 0; i--) {
      const ev = eventos.get(i);
      if (ev) this.hist.push({ topico: "grupo3/silo/evento", payload: this.evento(ev, agora - i * 5 - 2) });
      this.passoClima();
      this.hist.push({ topico: "grupo3/telemetria", payload: this.leitura(agora - i * 5) });
    }
    this.hist.push({ topico: "grupo3/status", payload: { device_id: DEVICE_ID, status: "online" } });
    this.hist.push({
      topico: "grupo3/ventilacao",
      payload: { device_id: DEVICE_ID, ts: agora - 300, seq: ++this.seq.ventilacao, ventilacao: "DESLIGADA", cmd_seq: null },
    });
    this.avaliarAlerta(agora, true);
  }

  historico() {
    const h = this.hist;
    this.hist = [];
    return h;
  }

  assinar(aoReceber: (m: Mensagem) => void) {
    this.ouvintes.add(aoReceber);
    if (!this.timer) this.timer = setInterval(() => this.tick(), PERIODO_MS);
    return () => {
      this.ouvintes.delete(aoReceber);
      if (this.ouvintes.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  enviarComando(valor: "LIGAR" | "DESLIGAR") {
    const cmdSeq = ++this.seq.cmd;
    if (!this.online) return cmdSeq; // placa fora: o comando se perde (sem retain), como no real
    // Latência de ida e volta broker → placa → broker.
    setTimeout(() => {
      this.ventilacao = valor === "LIGAR" ? "LIGADA" : "DESLIGADA";
      this.emitir({
        topico: "grupo3/ventilacao",
        payload: { device_id: DEVICE_ID, ts: agoraS(), seq: ++this.seq.ventilacao, ventilacao: this.ventilacao, cmd_seq: cmdSeq },
      });
    }, 600 + Math.random() * 500);
    return cmdSeq;
  }

  /** Controles do painel de simulação (equivalem às teclas do simulador da T3.0). */
  controlar(c: Controle) {
    switch (c) {
      case "aquecer": this.temperatura += 3; break;
      case "esfriar": this.temperatura -= 3; break;
      case "umedecer": this.umidade += 6; break;
      case "secar": this.umidade -= 6; break;
      case "entrada":
      case "saida":
        if (this.online) this.emitir({ topico: "grupo3/silo/evento", payload: this.evento(c === "entrada" ? "ENTRADA" : "SAIDA", agoraS()) });
        return;
      case "desconectar":
        if (!this.online) return;
        this.online = false;
        // LWT: o broker publica offline (no real, 15–25 s depois; aqui, na hora).
        this.emitir({ topico: "grupo3/status", payload: { device_id: DEVICE_ID, status: "offline" } });
        return;
      case "reconectar":
        if (this.online) return;
        this.online = true;
        this.emitir({ topico: "grupo3/status", payload: { device_id: DEVICE_ID, status: "online" } });
        return;
    }
    this.temperatura = limitar(this.temperatura, 15, 40);
    this.umidade = limitar(this.umidade, 30, 90);
    if (this.online) this.avaliarAlerta(agoraS(), false);
  }

  private tick() {
    this.passoClima();
    if (!this.online) return;
    this.emitir({ topico: "grupo3/telemetria", payload: this.leitura(agoraS()) });
    this.avaliarAlerta(agoraS(), false);
  }

  private passoClima() {
    // Passeio aleatório lento; a ventilação ligada puxa temperatura e umidade para baixo.
    const vent = this.ventilacao === "LIGADA" ? 1 : 0;
    this.temperatura = limitar(this.temperatura + (Math.random() - 0.5) * 0.8 - vent * 0.35, 15, 40);
    this.umidade = limitar(this.umidade + (Math.random() - 0.5) * 1.6 - vent * 0.6, 30, 90);
  }

  private leitura(ts: number): Telemetria {
    const falhaDht = Math.random() < 0.02; // DHT11 falha de vez em quando → null (contrato)
    const distancia = DIST_VAZIO_CM - (this.nivel / 100) * (DIST_VAZIO_CM - DIST_CHEIO_CM) + (Math.random() - 0.5) * 0.2;
    return {
      device_id: DEVICE_ID,
      ts,
      seq: ++this.seq.telemetria,
      temperatura: falhaDht ? null : Math.round(this.temperatura),
      umidade: falhaDht ? null : Math.round(this.umidade),
      distancia_cm: Math.round(distancia * 10) / 10,
      nivel_pct: Math.round(limitar(this.nivel, 0, 100)),
    };
  }

  private evento(ev: "ENTRADA" | "SAIDA", ts: number) {
    if (ev === "ENTRADA") {
      this.entradas++;
      this.nivel = limitar(this.nivel + PASSO_NIVEL_LOTE, 0, 100);
    } else {
      this.saidas++;
      this.nivel = limitar(this.nivel - PASSO_NIVEL_LOTE, 0, 100);
    }
    return {
      device_id: DEVICE_ID,
      ts,
      seq: ++this.seq.evento,
      evento: ev,
      entradas: this.entradas,
      saidas: this.saidas,
      saldo: this.entradas - this.saidas,
    };
  }

  /** Histerese do contrato: ATIVO se T > 30 ou U > 70; NORMAL só se T < 28 e U < 65. */
  private avaliarAlerta(ts: number, forcar: boolean) {
    const t = Math.round(this.temperatura);
    const u = Math.round(this.umidade);
    const motivos: ("TEMPERATURA" | "UMIDADE")[] = [];
    if (t > 30) motivos.push("TEMPERATURA");
    if (u > 70) motivos.push("UMIDADE");
    let novo = this.alertaAtivo;
    if (!this.alertaAtivo && motivos.length > 0) novo = true;
    else if (this.alertaAtivo && t < 28 && u < 65) novo = false;
    if (novo === this.alertaAtivo && !forcar) return;
    this.alertaAtivo = novo;
    const msg: Mensagem = {
      topico: "grupo3/alerta",
      payload: { device_id: DEVICE_ID, ts, seq: ++this.seq.alerta, alerta: novo ? "ATIVO" : "NORMAL", motivos: novo ? motivos : [], temperatura: t, umidade: u },
    };
    if (forcar) this.hist.push(msg);
    else this.emitir(msg);
  }

  private emitir(m: Mensagem) {
    this.ouvintes.forEach((f) => f(m));
  }
}

const agoraS = () => Math.floor(Date.now() / 1000);
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
