import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventoSilo } from "@/dados/tipos";
import { formatarHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Cores dos botões físicos da protoboard (não são tokens de status). */
export const COR_BOTAO = { ENTRADA: "#eab308", SAIDA: "#dc2626" } as const;

const BOTOES = [
  { evento: "ENTRADA", rotulo: "Entrada de lote", cor: "amarelo", pino: "GPIO 19", efeito: "saldo +1", icone: ArrowDownToLine },
  { evento: "SAIDA", rotulo: "Saída de lote", cor: "vermelho", pino: "GPIO 21", efeito: "saldo −1", icone: ArrowUpFromLine },
] as const;

type Props = {
  eventos: EventoSilo[];
  online: boolean;
  /** Só no modo simulado: apertar o botão na tela simula o aperto na placa. */
  aoApertar?: (e: "ENTRADA" | "SAIDA") => void;
};

/** Os dois botões da placa: amarelo = entrada, vermelho = saída (grupo3/silo/evento). */
export function BotoesPlaca({ eventos, online, aoApertar }: Props) {
  const ultimo = eventos[0];
  const ultimoDe = (e: "ENTRADA" | "SAIDA") => eventos.find((x) => x.evento === e);
  const piscando = usePisca(ultimo);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Botões da placa</CardTitle>
          <p className="text-xs text-texto-2">
            Cada aperto publica em <code className="font-mono">grupo3/silo/evento</code>
            {aoApertar && " · no modo simulado, clique no botão para apertar"}
          </p>
        </div>
        <div className="text-right">
          <p className="rotulo">Saldo</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{ultimo?.saldo ?? "—"}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {BOTOES.map((b) => {
          const ev = ultimoDe(b.evento);
          const total = b.evento === "ENTRADA" ? ultimo?.entradas : ultimo?.saidas;
          const aceso = piscando === b.evento;
          const Icone = b.icone;
          const cor = COR_BOTAO[b.evento];
          const tampa = (
            <span
              aria-hidden
              className={cn(
                "grid size-16 shrink-0 place-items-center rounded-full border-4 border-black/15 transition-transform duration-150",
                aceso && "scale-90",
              )}
              style={{ background: cor, boxShadow: aceso ? `0 0 0 8px ${cor}33` : "inset 0 -4px 0 rgb(0 0 0 / 0.2)" }}
            >
              <Icone className={cn("size-6", b.evento === "ENTRADA" ? "text-black/75" : "text-white")} />
            </span>
          );
          return (
            <div
              key={b.evento}
              className={cn("flex items-center gap-4 rounded-card border p-4 transition-colors", aceso ? "border-texto/40 bg-fundo" : "border-borda")}
            >
              {aoApertar ? (
                <button
                  type="button"
                  onClick={() => aoApertar(b.evento)}
                  disabled={!online}
                  aria-label={`Simular aperto do botão ${b.cor} (${b.rotulo.toLowerCase()})`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-laranja disabled:cursor-not-allowed disabled:opacity-50 active:[&>span]:scale-90"
                >
                  {tampa}
                </button>
              ) : (
                tampa
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.rotulo}</p>
                <p className="text-xs text-texto-2">
                  Botão {b.cor} · {b.pino} · {b.efeito}
                </p>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono text-xl font-semibold tabular-nums">{total ?? 0}</span>
                  <span className="text-xs text-texto-2">
                    {(total ?? 0) === 1 ? (b.evento === "ENTRADA" ? "entrada" : "saída") : b.evento === "ENTRADA" ? "entradas" : "saídas"} desde o boot
                  </span>
                </p>
                <p className="text-xs text-texto-2" aria-live="polite">
                  {ev ? `Último aperto às ${formatarHora(ev.ts)}` : "Nenhum aperto ainda"}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Destaca por 700 ms o botão do evento que acabou de chegar (não dispara no carregamento inicial). */
function usePisca(ultimo: EventoSilo | undefined) {
  const [qual, setQual] = useState<"ENTRADA" | "SAIDA" | null>(null);
  const visto = useRef<string | null>(null);
  useEffect(() => {
    if (!ultimo) return;
    const chave = `${ultimo.device_id}-${ultimo.seq}`;
    if (visto.current === null) {
      visto.current = chave;
      return;
    }
    if (chave === visto.current) return;
    visto.current = chave;
    setQual(ultimo.evento);
    const id = setTimeout(() => setQual(null), 700);
    return () => clearTimeout(id);
  }, [ultimo]);
  return qual;
}
