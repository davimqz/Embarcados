// Fonte real (T4.6): mensagens da placa pelo servidor do backend (backend/ingest/servidor.ts).
// /ws e /api passam pelo proxy do Vite (vite.config.ts) até o servidor em localhost:3000.
import type { FonteDados, Mensagem, Topico } from "./tipos";

const RECONEXAO_MS = 2000;

export class FonteWebSocket implements FonteDados {
  /** O servidor manda as mensagens recentes ao conectar, então não há histórico síncrono. */
  historico(): Mensagem[] {
    return [];
  }

  assinar(aoReceber: (m: Mensagem) => void): () => void {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ativo = true;

    const conectar = () => {
      const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocolo}//${window.location.host}/ws`);
      ws.onmessage = (e) => {
        try {
          aoReceber(JSON.parse(e.data as string) as Mensagem);
        } catch {
          console.warn("[WS] Mensagem ignorada (JSON inválido)", e.data);
        }
      };
      // Servidor fora do ar ou reiniciado: tenta de novo; as recentes chegam outra vez e o useSilo ignora as repetidas.
      ws.onclose = () => {
        if (ativo) timer = setTimeout(conectar, RECONEXAO_MS);
      };
    };
    conectar();

    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }

  async consultar({ desde, ate, topicos }: { desde: number; ate: number; topicos?: Topico[] }): Promise<Mensagem[]> {
    const q = new URLSearchParams({ desde: String(desde), ate: String(ate) });
    if (topicos?.length) q.set("topicos", topicos.join(","));
    const r = await fetch(`/api/mensagens?${q}`);
    if (!r.ok) throw new Error(`Falha ao consultar o histórico (HTTP ${r.status})`);
    return (await r.json()) as Mensagem[];
  }
}
