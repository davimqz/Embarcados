import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Ponto = { rotulo: string; v: number | null };

type Props = {
  dados: Ponto[];
  cor: string;
  unidade: string;
  nome: string;
  dominio: [number, number];
  ticks?: number[];
  limiar?: { valor: number; rotulo: string };
  area?: boolean;
  altura?: number;
};

/**
 * A escala padrão cobre a faixa normal do silo; se uma leitura sai dela (DHT11 vai até 50 °C e 95 %), o eixo cresce
 * no mesmo passo das marcas, em vez de a linha ser desenhada fora do gráfico.
 */
function ajustarEscala(dados: Ponto[], [min, max]: [number, number], ticks?: number[]) {
  const vals = dados.map((d) => d.v).filter((v): v is number => v !== null);
  if (vals.length === 0) return { dominio: [min, max] as [number, number], ticks };
  const passo = ticks && ticks.length > 1 ? ticks[1] - ticks[0] : 5;
  const novoMin = Math.min(min, Math.floor(Math.min(...vals) / passo) * passo);
  const novoMax = Math.max(max, Math.ceil(Math.max(...vals) / passo) * passo);
  if (novoMin === min && novoMax === max) return { dominio: [min, max] as [number, number], ticks };
  const novas: number[] = [];
  for (let t = novoMin; t <= novoMax; t += passo) novas.push(t);
  return { dominio: [novoMin, novoMax] as [number, number], ticks: ticks ? novas : undefined };
}

/** Uma série, um eixo (sem eixo duplo). Falha de leitura (null) aparece como intervalo na linha. */
export function GraficoSerie({ dados, cor, unidade, nome, dominio: dominioBase, ticks: ticksBase, limiar, area, altura = 160 }: Props) {
  const { dominio, ticks } = ajustarEscala(dados, dominioBase, ticksBase);
  const eixoX = <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} minTickGap={56} />;
  const eixoY = (
    <YAxis domain={dominio} ticks={ticks} width={40} tick={{ fontSize: 11, fill: "var(--color-texto-2)" }} tickLine={false} axisLine={false} unit={unidade} />
  );
  const grade = <CartesianGrid stroke="var(--color-borda)" vertical={false} />;
  const dica = (
    <Tooltip
      cursor={{ stroke: "var(--color-texto-2)", strokeDasharray: "3 3" }}
      contentStyle={{ borderRadius: 8, border: "1px solid var(--color-borda)", fontSize: 12, color: "var(--color-texto)" }}
      formatter={(v) => [v === null || v === undefined ? "falha na leitura" : `${v}${unidade}`, nome]}
    />
  );
  const linhaLimiar = limiar && (
    <ReferenceLine
      y={limiar.valor}
      stroke="var(--color-erro)"
      strokeDasharray="4 4"
      strokeOpacity={0.7}
      label={{ value: limiar.rotulo, position: "insideTopRight", fontSize: 10, fill: "var(--color-texto-2)" }}
    />
  );

  return (
    <div style={{ height: altura }} role="img" aria-label={`Gráfico de ${nome.toLowerCase()} ao longo do tempo`}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {grade}
            {eixoX}
            {eixoY}
            {linhaLimiar}
            {dica}
            <Area dataKey="v" stroke={cor} strokeWidth={2} fill={cor} fillOpacity={0.18} isAnimationActive={false} />
          </AreaChart>
        ) : (
          <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {grade}
            {eixoX}
            {eixoY}
            {linhaLimiar}
            {dica}
            <Line dataKey="v" stroke={cor} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
