import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Diagnostico } from "@/components/Diagnostico";
import { GraficoClima } from "@/components/GraficoClima";
import { GraficoSerie } from "@/components/GraficoSerie";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import { Silo } from "@/components/Silo";
import type { Alerta, EventoSilo, FonteDados, Mensagem, Telemetria } from "@/dados/tipos";
import type { EstadoSilo } from "@/dados/useSilo";
import { plural, valorOuTraco } from "@/lib/formato";
import { useAgora, useConsulta } from "@/lib/hooks";

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDiaHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Aba Dashboard: o estado agora (ao vivo) e os indicadores do período escolhido (histórico). */
export function Dashboard({ estado, fonte }: { estado: EstadoSilo; fonte: FonteDados }) {
  const agora = useAgora();
  const [horas, setHoras] = useState(24);
  const { dados } = useConsulta(fonte, horas);
  // Estado do alerta no início do período: último alerta gravado antes dele (o backend responde com desde = 0).
  const [anterior, setAnterior] = useState<"ATIVO" | "NORMAL" | null>(null);
  useEffect(() => {
    const ate = Math.floor(Date.now() / 1000) - horas * 3600 - 1;
    let vivo = true;
    fonte.consultar({ desde: 0, ate, topicos: ["grupo3/alerta"] }).then((ms) => {
      const u = ms.at(-1);
      if (vivo) setAnterior(u?.topico === "grupo3/alerta" ? u.payload.alerta : null);
    });
    return () => {
      vivo = false;
    };
  }, [fonte, horas, dados]);
  const alertaAoVivo = estado.alerta?.alerta === "ATIVO";
  const p = useMemo(() => (dados ? resumir(dados, horas, anterior, alertaAoVivo) : null), [dados, horas, anterior, alertaAoVivo]);
  const ultima = estado.leituras.at(-1);

  return (
    <>
      {/* Ao vivo */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <GraficoClima leituras={estado.leituras} />
        <div className="grid gap-4">
          <Silo leitura={ultima} ultimoEvento={estado.eventos[0]} />
          <Diagnostico estado={estado} agora={agora} />
        </div>
      </div>

      {/* Período */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Indicadores do período</h2>
          <p className="text-sm text-texto-2">
            {p ? `${plural(p.nLeituras, "leitura", "leituras")}, de ${fmtDiaHora.format(p.inicio * 1000)} a ${fmtDiaHora.format(p.fim * 1000)}` : "Carregando o histórico…"}
          </p>
        </div>
        <SeletorPeriodo horas={horas} aoMudar={setHoras} />
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Temperatura" valor={valorOuTraco(p?.temp?.media, 1)} unidade="°C média" detalhe={faixa(p?.temp, "mín.", "°C")} />
        <Indicador rotulo="Umidade" valor={valorOuTraco(p?.umid?.media, 1)} unidade="% média" detalhe={faixa(p?.umid, "mín.", "%")} />
        <Indicador
          rotulo="Tempo em alerta"
          valor={valorOuTraco(p?.pctAlerta, 1)}
          unidade="%"
          detalhe={p ? `${p.nAlertas} ${p.nAlertas === 1 ? "alerta disparado" : "alertas disparados"}` : "—"}
          destaque={!!p && (p.pctAlerta ?? 0) > 0}
        />
        <Indicador
          rotulo="Lotes movimentados"
          valor={p ? String(p.entradas + p.saidas) : "—"}
          unidade={p && p.entradas + p.saidas === 1 ? "lote" : "lotes"}
          detalhe={p ? `${plural(p.entradas, "entrada", "entradas")} · ${plural(p.saidas, "saída", "saídas")}` : "—"}
        />
        <Indicador rotulo="Nível de grão" valor={valorOuTraco(p?.nivelUltimo)} unidade="% agora" detalhe={faixa(p?.nivel, "variou de", "%")} />
        <Indicador
          rotulo="Falhas do DHT11"
          valor={valorOuTraco(p?.pctFalha, 1)}
          unidade="%"
          detalhe={p ? `${p.nFalhas} de ${p.nLeituras.toLocaleString("pt-BR")} leituras` : "—"}
        />
        <Indicador rotulo="Temperatura acima de 30 °C" valor={valorOuTraco(p?.pctTempAlta, 1)} unidade="% do tempo" detalhe="limiar de alerta do contrato" />
        <Indicador rotulo="Umidade acima de 70 %" valor={valorOuTraco(p?.pctUmidAlta, 1)} unidade="% do tempo" detalhe="limiar de alerta do contrato" />
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Temperatura no período</CardTitle>
            <span className="rotulo">°C</span>
          </CardHeader>
          <CardContent>
            {p ? (
              <GraficoSerie dados={p.serieTemp} cor="var(--color-laranja)" unidade="°" nome="Temperatura" dominio={[15, 40]} ticks={[15, 20, 25, 30, 35, 40]} limiar={{ valor: 30, rotulo: "alerta > 30 °C" }} altura={200} />
            ) : (
              <Carregando />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Umidade no período</CardTitle>
            <span className="rotulo">%</span>
          </CardHeader>
          <CardContent>
            {p ? (
              <GraficoSerie dados={p.serieUmid} cor="var(--color-umidade)" unidade="%" nome="Umidade" dominio={[30, 90]} ticks={[30, 50, 70, 90]} limiar={{ valor: 70, rotulo: "alerta > 70 %" }} altura={200} />
            ) : (
              <Carregando />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Nível de grão no período</CardTitle>
            <span className="rotulo">HC-SR04 · %</span>
          </CardHeader>
          <CardContent>
            {p ? <GraficoSerie dados={p.serieNivel} cor="var(--color-laranja)" unidade="%" nome="Nível" dominio={[0, 100]} ticks={[0, 25, 50, 75, 100]} area altura={200} /> : <Carregando />}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Lotes por {horas === 1 ? "10 min" : "hora"}</CardTitle>
            <span className="rotulo">entradas e saídas</span>
          </CardHeader>
          <CardContent>
            {p && p.entradas + p.saidas === 0 ? (
              <EstadoVazio icone={Package} titulo="Nenhum lote movimentado" detalhe="Os apertos dos botões amarelo e vermelho aparecem aqui." altura={200} />
            ) : p ? (
              <div className="h-[200px]" role="img" aria-label="Gráfico de barras de entradas e saídas de lotes por intervalo">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.lotes} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid stroke="var(--color-borda)" vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} width={40} tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "var(--color-borda)", fillOpacity: 0.4 }} contentStyle={{ borderRadius: 8, border: "1px solid var(--color-borda)", fontSize: 12 }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--color-texto)" }} />
                    <Bar dataKey="entradas" name="Entradas" fill="var(--color-laranja)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="saidas" name="Saídas" fill="var(--color-umidade)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Carregando />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Indicador({ rotulo, valor, unidade, detalhe, destaque }: { rotulo: string; valor: string; unidade: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="rounded-card border border-borda bg-superficie px-4 py-3">
      <dt className="rotulo">{rotulo}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-semibold tabular-nums ${destaque ? "text-erro" : ""}`}>{valor}</span>
        {valor !== "—" && <span className="text-xs text-texto-2">{unidade}</span>}
      </dd>
      <dd className="mt-0.5 text-xs text-texto-2">{detalhe}</dd>
    </div>
  );
}

/** "mín. 19 · máx. 31 °C", "variou de 28 a 100 %" ou "sem leituras no período". */
function faixa(e: { min: number; max: number } | null | undefined, prefixo: string, unidade: string) {
  if (e === undefined) return "—";
  if (e === null) return "sem leituras no período";
  return prefixo === "mín." ? `mín. ${e.min} · máx. ${e.max} ${unidade}` : `${prefixo} ${e.min} a ${e.max} ${unidade}`;
}

function Carregando() {
  return <div className="h-[200px] animate-pulse rounded-controle bg-borda/40" aria-label="Carregando" />;
}

/** Agrega as mensagens do período em indicadores e séries (reduzidas a ~200 pontos para o gráfico). */
function resumir(ms: Mensagem[], horas: number, anterior: "ATIVO" | "NORMAL" | null, alertaAoVivo: boolean) {
  const tel = ms.filter((m): m is { topico: "grupo3/telemetria"; payload: Telemetria } => m.topico === "grupo3/telemetria").map((m) => m.payload);
  const evs = ms.filter((m): m is { topico: "grupo3/silo/evento"; payload: EventoSilo } => m.topico === "grupo3/silo/evento").map((m) => m.payload);
  const als = ms.filter((m): m is { topico: "grupo3/alerta"; payload: Alerta } => m.topico === "grupo3/alerta").map((m) => m.payload);
  tel.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  const fim = Math.floor(Date.now() / 1000);
  const inicio = fim - horas * 3600;
  const vals = (k: "temperatura" | "umidade" | "nivel_pct") => tel.map((t) => t[k]).filter((v): v is number => v !== null);
  // Sem leitura no período, min/máx./média ficam null (nunca 0, que seria um dado falso).
  const est = (v: number[]) => (v.length ? { min: Math.min(...v), max: Math.max(...v), media: v.reduce((a, b) => a + b, 0) / v.length } : null);
  const temps = vals("temperatura");
  const umids = vals("umidade");
  const niveis = vals("nivel_pct");

  // Tempo em alerta: integra a duração entre leituras enquanto o estado está ATIVO.
  const transicoes = [...als].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  // Sem registro anterior e sem mudança no período, o alerta ativo agora já estava ativo no início.
  let ativo = anterior !== null ? anterior === "ATIVO" : transicoes.length === 0 && alertaAoVivo;
  let segAlerta = 0;
  let cursor = inicio;
  for (const a of transicoes) {
    if (ativo) segAlerta += (a.ts ?? cursor) - cursor;
    ativo = a.alerta === "ATIVO";
    cursor = a.ts ?? cursor;
  }
  if (ativo) segAlerta += fim - cursor;

  const passo = Math.max(1, Math.ceil(tel.length / 200));
  const amostra = tel.filter((_, i) => i % passo === 0);
  const serie = (k: "temperatura" | "umidade" | "nivel_pct") => amostra.map((t) => ({ rotulo: fmtHora.format((t.ts ?? 0) * 1000), v: t[k] }));

  // Lotes por intervalo (10 min para 1 h; 1 h para os demais).
  const intervalo = horas === 1 ? 600 : 3600;
  const baldes = new Map<number, { rotulo: string; entradas: number; saidas: number }>();
  for (let t = Math.floor(inicio / intervalo) * intervalo; t <= fim; t += intervalo) baldes.set(t, { rotulo: fmtHora.format(t * 1000), entradas: 0, saidas: 0 });
  for (const e of evs) {
    const b = baldes.get(Math.floor((e.ts ?? 0) / intervalo) * intervalo);
    if (b) e.evento === "ENTRADA" ? b.entradas++ : b.saidas++;
  }

  const nFalhas = tel.filter((t) => t.temperatura === null).length;
  return {
    inicio,
    fim,
    nLeituras: tel.length,
    temp: est(temps),
    umid: est(umids),
    nivel: est(niveis),
    nivelUltimo: niveis.at(-1) ?? null,
    entradas: evs.filter((e) => e.evento === "ENTRADA").length,
    saidas: evs.filter((e) => e.evento === "SAIDA").length,
    nAlertas: als.filter((a) => a.alerta === "ATIVO").length,
    pctAlerta: tel.length ? (segAlerta / (fim - inicio)) * 100 : null,
    nFalhas,
    pctFalha: tel.length ? (nFalhas / tel.length) * 100 : null,
    pctTempAlta: temps.length ? (temps.filter((t) => t > 30).length / temps.length) * 100 : null,
    pctUmidAlta: umids.length ? (umids.filter((u) => u > 70).length / umids.length) * 100 : null,
    serieTemp: serie("temperatura"),
    serieUmid: serie("umidade"),
    serieNivel: serie("nivel_pct"),
    lotes: [...baldes.values()],
  };
}
