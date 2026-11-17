import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Telemetria } from "@/dados/tipos";
import { formatarHora, valorOuTraco } from "@/lib/formato";

const COR_T = "var(--color-laranja)";
const COR_U = "var(--color-umidade)";

/** Temperatura e umidade (DHT11) com os limiares de alerta do contrato (30 °C / 70 %). */
export function GraficoClima({ leituras }: { leituras: Telemetria[] }) {
  const ultima = leituras.at(-1);
  const dados = leituras.map((l) => ({ hora: formatarHora(l.ts), t: l.temperatura, u: l.umidade }));

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap items-start">
        <div>
          <CardTitle>Clima dentro do silo</CardTitle>
          <p className="text-xs text-texto-2">DHT11 · uma leitura a cada 5 s · últimos 10 min</p>
        </div>
        <dl className="flex gap-6">
          <Leitura rotulo="Temperatura" valor={valorOuTraco(ultima?.temperatura)} unidade="°C" cor={COR_T} />
          <Leitura rotulo="Umidade" valor={valorOuTraco(ultima?.umidade)} unidade="%" cor={COR_U} />
        </dl>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <p className="grid h-64 place-items-center text-sm text-texto-2">Aguardando a primeira leitura…</p>
        ) : (
          <div className="h-64" role="img" aria-label="Gráfico de temperatura e umidade ao longo do tempo">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--color-borda)" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} minTickGap={48} />
                <YAxis yAxisId="t" domain={[15, 40]} ticks={[15, 20, 25, 30, 35, 40]} tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} unit="°" />
                <YAxis yAxisId="u" orientation="right" domain={[30, 90]} ticks={[30, 45, 60, 75, 90]} tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} unit="%" />
                <ReferenceLine yAxisId="t" y={30} stroke={COR_T} strokeDasharray="4 4" strokeOpacity={0.6} />
                <ReferenceLine yAxisId="u" y={70} stroke={COR_U} strokeDasharray="4 4" strokeOpacity={0.6} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--color-borda)", fontSize: 12 }}
                  formatter={(v, nome) => (nome === "t" ? [`${v} °C`, "Temperatura"] : [`${v} %`, "Umidade"])}
                />
                <Line yAxisId="t" dataKey="t" stroke={COR_T} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="u" dataKey="u" stroke={COR_U} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-texto-2">
          Tracejado = limiar de alerta (temperatura &gt; 30 °C ou umidade &gt; 70 %). Falhas de leitura aparecem como intervalos na linha.
        </p>
      </CardContent>
    </Card>
  );
}

function Leitura({ rotulo, valor, unidade, cor }: { rotulo: string; valor: string; unidade: string; cor: string }) {
  return (
    <div>
      <dt className="rotulo flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: cor }} />
        {rotulo}
      </dt>
      <dd className="font-mono text-2xl font-semibold tabular-nums">
        {valor}
        <span className="text-sm text-texto-2"> {unidade}</span>
      </dd>
    </div>
  );
}
