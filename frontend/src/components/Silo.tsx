import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventoSilo, Telemetria } from "@/dados/tipos";
import { plural, valorOuTraco } from "@/lib/formato";

/** Nível do grão (HC-SR04) e saldo de lotes (botões): medidas independentes, lado a lado. */
export function Silo({ leitura, ultimoEvento }: { leitura?: Telemetria; ultimoEvento?: EventoSilo }) {
  const nivel = leitura?.nivel_pct ?? null;
  const altura = nivel ?? 0;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Silo</CardTitle>
        <span className="rotulo">HC-SR04 · botões</span>
      </CardHeader>
      <CardContent className="flex flex-1 items-center gap-6">
        {/* Corte do silo: o preenchimento é o nivel_pct da última leitura. */}
        <div
          role="meter"
          aria-label="Nível de grão"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={nivel ?? undefined}
          aria-valuetext={nivel === null ? "sem leitura" : `${nivel}%`}
          className="relative h-52 w-24 shrink-0 overflow-hidden rounded-t-[48px] rounded-b-card border-2 border-texto/70 bg-fundo"
        >
          <div
            className="absolute inset-x-0 bottom-0 bg-laranja/60 transition-[height] duration-700 ease-out"
            style={{ height: `${altura}%` }}
          >
            <div className="h-1 bg-laranja" />
          </div>
          {[25, 50, 75].map((m) => (
            <div key={m} aria-hidden className="absolute inset-x-0 border-t border-dashed border-texto/15" style={{ bottom: `${m}%` }} />
          ))}
        </div>

        <dl className="grid min-w-0 flex-1 gap-4">
          <div>
            <dt className="rotulo">Nível de grão</dt>
            <dd className="font-mono text-4xl font-semibold tabular-nums text-texto">
              {valorOuTraco(nivel)}
              {nivel !== null && <span className="text-lg text-texto-2">%</span>}
            </dd>
            <dd className="text-xs text-texto-2">
              {leitura?.distancia_cm == null ? "eco não voltou" : `${valorOuTraco(leitura.distancia_cm, 1)} cm da tampa ao grão`}
            </dd>
          </div>
          <div className="border-t border-borda pt-4">
            <dt className="rotulo">Saldo de lotes</dt>
            <dd className="font-mono text-4xl font-semibold tabular-nums text-texto">{valorOuTraco(ultimoEvento?.saldo)}</dd>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
              <span className="inline-flex items-center gap-1">
                <ArrowDownToLine aria-hidden className="size-3.5" /> {plural(ultimoEvento?.entradas ?? 0, "entrada", "entradas")}
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowUpFromLine aria-hidden className="size-3.5" /> {plural(ultimoEvento?.saidas ?? 0, "saída", "saídas")}
              </span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
