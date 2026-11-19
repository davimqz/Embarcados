// Fonte SIMULADA: imita, no navegador, o que a placa publica (firmware do M2) e o que o backend repassaria.
// Segue docs/topicos-mqtt.md: seq por tópico, ts em segundos UTC, alerta com histerese.
// Sem ventilação: o grupo não tem como ligar/desligar o ventilador (decisão de 2026-11-19).
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
  private seq = { telemetria: 0, evento: 0, alerta: 0 };

  private temperatura = 26;
  private umidade = 58;
  private nivel = 45;
  private entradas = 6;
  private saidas = 2;
  private alertaAtivo = false;
  private online = true;
  private hist: Mensagem[] = [];
  /** Tudo o que "o banco" guardou: 24 h anteriores (1 leitura/min) + o que foi publicado nesta sessão. */
  private arquivo: Mensagem[];

  constructor() {
    // A sessão ao vivo continua de onde o histórico parou (mesmo boot: contadores e seq seguem).
    const a = gerarArquivo24h();
    this.arquivo = a.mensagens;
    Object.assign(this.seq, a.seq);
    this.entradas = a.entradas;
    this.saidas = a.saidas;
    this.nivel = a.nivel;
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
    this.avaliarAlerta(agora, true);
    this.arquivo.push(...this.hist);
  }

  historico() {
    const h = this.hist;
    this.hist = [];
    return h;
  }

  async consultar({ desde, ate, topicos }: { desde: number; ate: number; topicos?: Mensagem["topico"][] }) {
    await new Promise((r) => setTimeout(r, 250)); // latência simulada, para o estado "carregando" aparecer
    return this.arquivo.filter((m) => {
      if (topicos && !topicos.includes(m.topico)) return false;
      const ts = "ts" in m.payload ? m.payload.ts : null;
      return ts !== null && ts >= desde && ts <= ate;
    });
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
    // Passeio aleatório lento.
    this.temperatura = limitar(this.temperatura + (Math.random() - 0.5) * 0.8, 15, 40);
    this.umidade = limitar(this.umidade + (Math.random() - 0.5) * 1.6, 30, 90);
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
    this.arquivo.push(m);
    this.ouvintes.forEach((f) => f(m));
  }
}

/**
 * 24 h anteriores à sessão, 1 leitura por minuto, com ciclo diário de temperatura (pico à tarde),
 * lotes no horário comercial e alertas pela mesma histerese do contrato.
 * Semente fixa: o histórico é o mesmo a cada recarga.
 */
function gerarArquivo24h() {
  let semente = 20261119;
  const rand = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const out: Mensagem[] = [];
  const fim = agoraS() - 6 * 60; // termina antes do histórico ao vivo
  const inicio = fim - 24 * 3600;
  const seq = { tel: 0, ev: 0, al: 0 };
  let entradas = 0;
  let saidas = 0;
  let nivel = 20;
  let ativo = false;
  let ruidoT = 0;
  let ruidoU = 0;
  for (let ts = inicio; ts <= fim; ts += 60) {
    const d = new Date(ts * 1000);
    const h = d.getHours() + d.getMinutes() / 60;
    const ciclo = Math.sin(((h - 9) / 24) * 2 * Math.PI); // máximo por volta das 15h
    ruidoT = ruidoT * 0.9 + (rand() - 0.5) * 0.6;
    ruidoU = ruidoU * 0.9 + (rand() - 0.5) * 1.2;
    const t = Math.round(25 + ciclo * 5.5 + ruidoT);
    const u = Math.round(56 - ciclo * 11 + ruidoU);
    if (h >= 7 && h <= 18 && rand() < 0.035) {
      const ev: "ENTRADA" | "SAIDA" = nivel > 85 || (nivel > 30 && rand() < 0.4) ? "SAIDA" : "ENTRADA";
      if (ev === "ENTRADA") {
        entradas++;
        nivel = Math.min(100, nivel + PASSO_NIVEL_LOTE);
      } else {
        saidas++;
        nivel = Math.max(0, nivel - PASSO_NIVEL_LOTE);
      }
      out.push({ topico: "grupo3/silo/evento", payload: { device_id: DEVICE_ID, ts: ts - 20, seq: ++seq.ev, evento: ev, entradas, saidas, saldo: entradas - saidas } });
    }
    const falha = rand() < 0.01;
    const dist = DIST_VAZIO_CM - (nivel / 100) * (DIST_VAZIO_CM - DIST_CHEIO_CM);
    out.push({
      topico: "grupo3/telemetria",
      payload: { device_id: DEVICE_ID, ts, seq: ++seq.tel, temperatura: falha ? null : t, umidade: falha ? null : u, distancia_cm: Math.round(dist * 10) / 10, nivel_pct: Math.round(nivel) },
    });
    if (falha) continue;
    const motivos: ("TEMPERATURA" | "UMIDADE")[] = [];
    if (t > 30) motivos.push("TEMPERATURA");
    if (u > 70) motivos.push("UMIDADE");
    const novo: boolean = !ativo && motivos.length > 0 ? true : ativo && t < 28 && u < 65 ? false : ativo;
    if (novo !== ativo) {
      ativo = novo;
      out.push({ topico: "grupo3/alerta", payload: { device_id: DEVICE_ID, ts, seq: ++seq.al, alerta: novo ? "ATIVO" : "NORMAL", motivos: novo ? motivos : [], temperatura: t, umidade: u } });
    }
  }
  return {
    mensagens: out,
    seq: { telemetria: seq.tel, evento: seq.ev, alerta: seq.al },
    entradas,
    saidas,
    nivel,
  };
}

const agoraS = () => Math.floor(Date.now() / 1000);
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
