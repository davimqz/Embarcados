import { PERIODOS } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Seletor segmentado de período (1 h / 6 h / 24 h). */
export function SeletorPeriodo({ horas, aoMudar }: { horas: number; aoMudar: (h: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Período" className="inline-flex rounded-controle border border-borda bg-superficie p-0.5">
      {PERIODOS.map((p) => (
        <button
          key={p.horas}
          type="button"
          role="radio"
          aria-checked={p.horas === horas}
          onClick={() => aoMudar(p.horas)}
          className={cn(
            "h-8 rounded-[6px] px-3 text-sm font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-laranja",
            p.horas === horas ? "bg-laranja text-white" : "text-texto-2 hover:text-texto",
          )}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );
}
