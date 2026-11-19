import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventoSilo } from "@/dados/tipos";
import { formatarHora } from "@/lib/formato";

/** Entradas e saídas de lotes (grupo3/silo/evento), mais recentes primeiro. */
export function Eventos({ eventos }: { eventos: EventoSilo[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Movimentação de lotes</CardTitle>
        <span className="rotulo">{eventos.length} recentes</span>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {eventos.length === 0 ? (
          <p className="px-5 pb-3 text-sm text-texto-2">Nenhum lote movimentado ainda.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-superficie">
                <tr className="border-b border-borda text-left">
                  <th scope="col" className="rotulo px-5 py-2 font-semibold">Hora</th>
                  <th scope="col" className="rotulo py-2 font-semibold">Lote</th>
                  <th scope="col" className="rotulo py-2 text-right font-semibold">Saldo</th>
                  <th scope="col" className="rotulo px-5 py-2 text-right font-semibold">seq</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={`${e.device_id}-${e.seq}-${e.ts}`} className="border-b border-borda/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs tabular-nums text-texto-2">{formatarHora(e.ts)}</td>
                    <td className="py-2">
                      <Badge tom={e.evento === "ENTRADA" ? "ok" : "neutro"}>{e.evento === "ENTRADA" ? "Entrada" : "Saída"}</Badge>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{e.saldo}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs tabular-nums text-texto-2">{e.seq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
