import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FonteSimulada } from "@/dados/fonteSimulada";

type Controle = Parameters<FonteSimulada["controlar"]>[0];

const GRUPOS: { titulo: string; botoes: [Controle, string][] }[] = [
  { titulo: "Clima", botoes: [["aquecer", "+3 °C"], ["esfriar", "−3 °C"], ["umedecer", "+6 % UR"], ["secar", "−6 % UR"]] },
  { titulo: "Botões da placa", botoes: [["entrada", "Entrada de lote"], ["saida", "Saída de lote"]] },
  { titulo: "Conexão", botoes: [["desconectar", "Derrubar placa"], ["reconectar", "Reconectar"]] },
];

/** Só existe com a fonte simulada: substitui a placa (e as teclas do simulador da T3.0) na demo do protótipo. */
export function PainelSimulacao({ fonte }: { fonte: FonteSimulada }) {
  return (
    <section aria-labelledby="sim-titulo" className="rounded-card border border-dashed border-aviso bg-aviso/8 p-4">
      <h2 id="sim-titulo" className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
        <FlaskConical aria-hidden className="size-4 text-[#7a5c00]" />
        Simulação da placa
        <span className="font-normal text-texto-2">· some quando o backend real estiver ligado</span>
      </h2>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="flex flex-wrap items-center gap-2">
            <span className="rotulo mr-1">{g.titulo}</span>
            {g.botoes.map(([c, rotulo]) => (
              <Button key={c} variante="contorno" tamanho="sm" onClick={() => fonte.controlar(c)}>
                {rotulo}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
