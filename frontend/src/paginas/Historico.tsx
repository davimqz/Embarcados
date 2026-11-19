import { useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import type { FonteDados, Mensagem } from "@/dados/tipos";
import type { RegistroComando } from "@/dados/useSilo";
import { useConsulta } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type Tipo = "telemetria" | "lote" | "alerta" | "ventilacao" | "comando";

type Linha = { ts: number; tipo: Tipo; seq: number | null; descricao: string; critico?: boolean; payload: string };

const TIPOS: { tipo: Tipo; rotulo: string; tom: "neutro" | "laranja" | "erro" | "ok" | "aviso" }[] = [
  { tipo: "telemetria", rotulo: "Telemetria", tom: "neutro" },
  { tipo: "lote", rotulo: "Lote", tom: "ok" },
  { tipo: "alerta", rotulo: "Alerta", tom: "erro" },
  { tipo: "ventilacao", rotulo: "Ventilação", tom: "laranja" },
  { tipo: "comando", rotulo: "Comando", tom: "aviso" },
];

const POR_PAGINA = 100;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Aba Histórico: log de tudo o que a placa publicou e dos comandos enviados, com filtro e exportação CSV. */
export function Historico({ fonte, comandos }: { fonte: FonteDados; comandos: RegistroComando[] }) {
  const [horas, setHoras] = useState(1);
  const [ativos, setAtivos] = useState<Set<Tipo>>(() => new Set(["lote", "alerta", "ventilacao", "comando"]));
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const { dados, erro, recarregar } = useConsulta(fonte, horas);

  const linhas = useMemo(() => {
    if (!dados) return null;
    const desde = Math.floor(Date.now() / 1000) - horas * 3600;
    const todas = [
      ...dados.map(paraLinha),
      ...comandos
        .filter((c) => c.enviadoEm / 1000 >= desde)
        .map<Linha>((c) => ({
          ts: Math.floor(c.enviadoEm / 1000),
          tipo: "comando",
          seq: c.seq,
          descricao: `VENTILACAO · ${c.valor} → ${c.situacao}${c.respostaEm ? ` em ${c.respostaEm - c.enviadoEm} ms` : ""}`,
          critico: c.situacao === "sem resposta",
          payload: JSON.stringify({ seq: c.seq, comando: "VENTILACAO", valor: c.valor }),
        })),
    ];
    const q = busca.trim().toLowerCase();
    return todas.filter((l) => ativos.has(l.tipo) && (!q || l.descricao.toLowerCase().includes(q))).sort((a, b) => b.ts - a.ts);
  }, [dados, comandos, horas, ativos, busca]);

  const alternar = (t: Tipo) => {
    setLimite(POR_PAGINA);
    setAtivos((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Registro de mensagens</h2>
          <p className="text-sm text-texto-2">Tudo o que a placa publicou e os comandos enviados. Cada linha guarda o payload original.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorPeriodo horas={horas} aoMudar={(h) => (setHoras(h), setLimite(POR_PAGINA))} />
          <Button variante="contorno" tamanho="sm" className="h-9" onClick={recarregar} aria-label="Atualizar">
            <RefreshCw aria-hidden className="size-4" />
          </Button>
          <Button variante="contorno" tamanho="sm" className="h-9" disabled={!linhas?.length} onClick={() => linhas && exportarCsv(linhas, horas)}>
            <Download aria-hidden className="size-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-borda px-4 py-3">
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Tipos de mensagem</legend>
            {TIPOS.map(({ tipo, rotulo }) => (
              <label
                key={tipo}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-laranja",
                  ativos.has(tipo) ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-borda text-texto-2 hover:text-texto",
                )}
              >
                <input type="checkbox" className="sr-only" checked={ativos.has(tipo)} onChange={() => alternar(tipo)} />
                {rotulo}
              </label>
            ))}
          </fieldset>
          <label className="relative ml-auto w-full sm:w-64">
            <span className="sr-only">Buscar no registro</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-2" />
            <input
              type="search"
              value={busca}
              onChange={(e) => (setBusca(e.target.value), setLimite(POR_PAGINA))}
              placeholder="Buscar (ex.: SAIDA, ATIVO, #3)"
              className="h-9 w-full rounded-input border border-borda bg-superficie pr-3 pl-8 text-sm placeholder:text-texto-2/70 focus-visible:outline-2 focus-visible:outline-laranja"
            />
          </label>
        </div>

        <CardContent className="px-0 pb-0">
          {erro ? (
            <p className="px-5 py-8 text-sm text-erro">Não foi possível carregar o histórico ({erro}). Tente “Atualizar”.</p>
          ) : linhas === null ? (
            <p className="px-5 py-8 text-sm text-texto-2">Carregando…</p>
          ) : linhas.length === 0 ? (
            <p className="px-5 py-8 text-sm text-texto-2">Nenhuma mensagem com esses filtros. Marque outros tipos ou aumente o período.</p>
          ) : (
            <>
              <p className="px-5 pt-3 text-xs text-texto-2" aria-live="polite">
                {linhas.length.toLocaleString("pt-BR")} {linhas.length === 1 ? "mensagem" : "mensagens"}
                {linhas.length > limite && ` · mostrando as ${limite} mais recentes`}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-borda text-left">
                      <th scope="col" className="rotulo px-5 py-2 font-semibold">Quando</th>
                      <th scope="col" className="rotulo py-2 font-semibold">Tipo</th>
                      <th scope="col" className="rotulo py-2 font-semibold">O que aconteceu</th>
                      <th scope="col" className="rotulo px-5 py-2 text-right font-semibold">seq</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, limite).map((l, i) => {
                      const t = TIPOS.find((x) => x.tipo === l.tipo)!;
                      return (
                        <tr key={`${l.tipo}-${l.seq}-${l.ts}-${i}`} className={cn("border-b border-borda/60", l.critico && "bg-erro/5")} title={l.payload}>
                          <td className="px-5 py-2 font-mono text-xs whitespace-nowrap tabular-nums text-texto-2">{fmt.format(l.ts * 1000)}</td>
                          <td className="py-2">
                            <Badge tom={t.tom}>{t.rotulo}</Badge>
                          </td>
                          <td className={cn("py-2", l.critico && "font-medium text-[#c4141d]")}>{l.descricao}</td>
                          <td className="px-5 py-2 text-right font-mono text-xs tabular-nums text-texto-2">{l.seq ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {linhas.length > limite && (
                <div className="p-4 text-center">
                  <Button variante="contorno" tamanho="sm" onClick={() => setLimite((n) => n + POR_PAGINA * 5)}>
                    Mostrar mais {Math.min(POR_PAGINA * 5, linhas.length - limite)}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function paraLinha(m: Mensagem): Linha {
  const payload = JSON.stringify(m.payload);
  switch (m.topico) {
    case "grupo3/telemetria": {
      const p = m.payload;
      const falha = p.temperatura === null;
      return {
        ts: p.ts ?? 0,
        tipo: "telemetria",
        seq: p.seq,
        critico: falha,
        payload,
        descricao: `${falha ? "DHT11 sem leitura" : `${p.temperatura} °C · ${p.umidade} %`} · nível ${p.nivel_pct ?? "—"} % (${p.distancia_cm ?? "—"} cm)`,
      };
    }
    case "grupo3/silo/evento":
      return { ts: m.payload.ts ?? 0, tipo: "lote", seq: m.payload.seq, payload, descricao: `${m.payload.evento} de lote · saldo ${m.payload.saldo} (${m.payload.entradas} entradas, ${m.payload.saidas} saídas)` };
    case "grupo3/alerta":
      return {
        ts: m.payload.ts ?? 0,
        tipo: "alerta",
        seq: m.payload.seq,
        payload,
        critico: m.payload.alerta === "ATIVO",
        descricao:
          m.payload.alerta === "ATIVO"
            ? `ATIVO: ${m.payload.motivos.join(" e ").toLowerCase()} (${m.payload.temperatura} °C, ${m.payload.umidade} %)`
            : `NORMAL: voltou ao normal (${m.payload.temperatura} °C, ${m.payload.umidade} %)`,
      };
    case "grupo3/ventilacao":
      return {
        ts: m.payload.ts ?? 0,
        tipo: "ventilacao",
        seq: m.payload.seq,
        payload,
        descricao: `${m.payload.ventilacao}${m.payload.cmd_seq !== null ? ` · confirma o comando #${m.payload.cmd_seq}` : " · estado do boot"}`,
      };
    case "grupo3/status":
      return { ts: 0, tipo: "telemetria", seq: null, payload, descricao: m.payload.status };
  }
}

/** CSV com ; (abre direto no Excel em pt-BR) e BOM para os acentos. */
function exportarCsv(linhas: Linha[], horas: number) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const corpo = [
    ["ts_unix", "quando", "tipo", "seq", "descricao", "payload"].join(";"),
    ...linhas.map((l) => [l.ts, fmt.format(l.ts * 1000), l.tipo, l.seq ?? "", esc(l.descricao), esc(l.payload)].join(";")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `silo-grupo3-historico-${horas}h-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
