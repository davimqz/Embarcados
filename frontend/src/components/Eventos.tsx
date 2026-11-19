import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge } from "@/components/ui/badge";
import type { EventoSilo } from "@/dados/tipos";
import { formatarHora, plural } from "@/lib/formato";
import { COR_BOTAO } from "@/components/BotoesPlaca";

/** Entradas e saídas de lotes (grupo3/silo/evento), mais recentes primeiro. */
export function Eventos({ eventos }: { eventos: EventoSilo[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Movimentação de lotes</CardTitle>
        <span className="rotulo">{plural(eventos.length, "recente", "recentes")}</span>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {eventos.length === 0 ? (
          <div className="px-5 pb-3"><EstadoVazio icone={Package} titulo="Nenhum lote movimentado ainda" detalhe="Aperte o botão amarelo (entrada) ou o vermelho (saída) na placa." /></div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-superficie">
                <tr className="border-b border-borda text-left">
                  <th scope="col" className="rotulo px-5 py-2 font-semibold">Hora</th>
                  <th scope="col" className="rotulo py-2 font-semibold">Lote</th>
                  <th scope="col" className="rotulo py-2 text-right font-semibold">Saldo</th>
                  <th scope="col" className="rotulo hidden px-5 py-2 text-right font-semibold sm:table-cell">seq</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={`${e.device_id}-${e.seq}-${e.ts}`} className="border-b border-borda/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs whitespace-nowrap tabular-nums text-texto-2">{formatarHora(e.ts)}</td>
                    <td className="py-2">
                      <Badge tom="neutro">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: COR_BOTAO[e.evento] }} />
                        {e.evento === "ENTRADA" ? "Entrada · amarelo" : "Saída · vermelho"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-5 text-right font-mono tabular-nums sm:pr-0">{e.saldo}</td>
                    <td className="hidden px-5 py-2 text-right font-mono text-xs tabular-nums text-texto-2 sm:table-cell">{e.seq}</td>
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
