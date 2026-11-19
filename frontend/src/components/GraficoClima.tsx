import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/EstadoVazio";
import { GraficoSerie } from "@/components/GraficoSerie";
import type { Telemetria } from "@/dados/tipos";
import { formatarHora, valorOuTraco } from "@/lib/formato";

/** Temperatura e umidade em tempo real (DHT11): dois gráficos alinhados, cada um com o seu limiar de alerta. */
export function GraficoClima({ leituras }: { leituras: Telemetria[] }) {
  const ultima = leituras.at(-1);
  const temp = leituras.map((l) => ({ rotulo: l.ts === null ? "—" : formatarHora(l.ts), v: l.temperatura }));
  const umid = leituras.map((l) => ({ rotulo: l.ts === null ? "—" : formatarHora(l.ts), v: l.umidade }));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Clima dentro do silo · ao vivo</CardTitle>
          <p className="text-xs text-texto-2">DHT11 · uma leitura a cada 5 s · últimos 10 min</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {leituras.length === 0 ? (
          <EstadoVazio icone={Radio} titulo="Aguardando a primeira leitura" detalhe="A placa publica temperatura e umidade a cada 5 s." altura={392} />
        ) : (
          <>
            <Serie titulo="Temperatura" valor={valorOuTraco(ultima?.temperatura)} unidade="°C" cor="var(--color-laranja)">
              <GraficoSerie dados={temp} cor="var(--color-laranja)" unidade="°" nome="Temperatura" dominio={[15, 40]} ticks={[15, 20, 25, 30, 35, 40]} limiar={{ valor: 30, rotulo: "alerta > 30 °C" }} altura={176} />
            </Serie>
            <Serie titulo="Umidade relativa" valor={valorOuTraco(ultima?.umidade)} unidade="%" cor="var(--color-umidade)">
              <GraficoSerie dados={umid} cor="var(--color-umidade)" unidade="%" nome="Umidade" dominio={[30, 90]} ticks={[30, 50, 70, 90]} limiar={{ valor: 70, rotulo: "alerta > 70 %" }} altura={176} />
            </Serie>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Serie({ titulo, valor, unidade, cor, children }: { titulo: string; valor: string; unidade: string; cor: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="rotulo flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: cor }} />
          {titulo}
        </h3>
        <p className="font-mono text-xl font-semibold tabular-nums">
          {valor}
          {valor !== "—" && <span className="text-sm text-texto-2"> {unidade}</span>}
        </p>
      </div>
      {children}
    </div>
  );
}
