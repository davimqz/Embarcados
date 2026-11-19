import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Área vazia de gráfico ou lista: ícone + frase curta, com a mesma altura do conteúdo que substitui. */
export function EstadoVazio({ icone: Icone, titulo, detalhe, altura, className }: { icone: LucideIcon; titulo: string; detalhe?: string; altura?: number; className?: string }) {
  return (
    <div
      style={altura ? { height: altura } : undefined}
      className={cn("flex flex-col items-center justify-center gap-2 rounded-controle border border-dashed border-borda px-4 py-6 text-center", className)}
    >
      <Icone aria-hidden className="size-6 text-texto-2/60" />
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {detalhe && <p className="max-w-xs text-xs text-texto-2">{detalhe}</p>}
    </div>
  );
}
