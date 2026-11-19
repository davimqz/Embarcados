import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstadoSilo } from "@/dados/useSilo";
import type { Topico } from "@/dados/tipos";
import { haQuanto } from "@/lib/formato";

const TOPICOS: Exclude<Topico, "grupo3/status">[] = ["grupo3/telemetria", "grupo3/silo/evento", "grupo3/alerta", "grupo3/ventilacao"];

/** T4.2: último seq por tópico e buracos vistos (a detecção oficial é do backend, T3.3). */
export function Diagnostico({ estado, agora }: { estado: EstadoSilo; agora: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagens</CardTitle>
        <span className="text-xs text-texto-2">última {haQuanto(estado.ultimaMensagem, agora)}</span>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-borda/70 text-sm">
          {TOPICOS.map((t) => (
            <div key={t} className="flex items-center justify-between gap-3 py-1.5">
              <dt className="truncate font-mono text-xs text-texto-2">{t}</dt>
              <dd className="font-mono tabular-nums">
                <span className="text-texto-2">seq </span>
                {estado.ultimoSeq[t] ?? "—"}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-xs text-texto-2">Mensagens perdidas (buracos de seq)</dt>
            <dd className={estado.buracos > 0 ? "font-mono font-semibold text-erro" : "font-mono"}>{estado.buracos}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
