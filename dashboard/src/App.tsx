import { useEffect, useState } from "react";
import { History, LayoutDashboard, ShieldCheck, TriangleAlert, Wheat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Diagnostico } from "@/components/Diagnostico";
import { Eventos } from "@/components/Eventos";
import { GraficoClima } from "@/components/GraficoClima";
import { PainelSimulacao } from "@/components/PainelSimulacao";
import { Silo } from "@/components/Silo";
import { Ventilacao } from "@/components/Ventilacao";
import { FonteSimulada } from "@/dados/fonteSimulada";
import { useSilo } from "@/dados/useSilo";
import { formatarHora } from "@/lib/formato";

// Única troca necessária quando o backend (M3) existir: uma FonteWebSocket com a mesma interface.
const fonte = new FonteSimulada();
const SIMULADO = fonte instanceof FonteSimulada;

const NAV = [
  { rotulo: "Visão geral", icone: LayoutDashboard, ativo: true, nota: null },
  { rotulo: "Histórico", icone: History, ativo: false, nota: "T4.4" },
  { rotulo: "Integridade", icone: ShieldCheck, ativo: false, nota: "M5" },
];

export default function App() {
  const { estado, comandar } = useSilo(fonte);
  const agora = useAgora();
  const online = estado.status?.status === "online";
  const alertaAtivo = estado.alerta?.alerta === "ATIVO";

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barra lateral (shell escuro translúcido, ADR 0002) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/10 bg-black/70 text-white backdrop-blur-md lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <Wheat aria-hidden className="size-5 text-laranja" />
          <span className="font-semibold">Silo · Grupo 3</span>
        </div>
        <nav aria-label="Seções" className="flex-1 p-3">
          <ul className="grid gap-1">
            {NAV.map(({ rotulo, icone: Icone, ativo, nota }) => (
              <li key={rotulo}>
                <a
                  href={ativo ? "#" : undefined}
                  aria-current={ativo ? "page" : undefined}
                  aria-disabled={!ativo || undefined}
                  className={
                    ativo
                      ? "flex items-center gap-3 rounded-controle bg-laranja px-3 py-2 text-sm font-medium"
                      : "flex cursor-not-allowed items-center gap-3 rounded-controle px-3 py-2 text-sm text-white/45"
                  }
                >
                  <Icone aria-hidden className="size-4" />
                  {rotulo}
                  {nota && <span className="ml-auto text-[10px] tracking-wider uppercase">{nota}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-5 text-xs text-white/60">
          <p className="rotulo !text-white/40">Placa</p>
          <p className="mt-1 truncate font-mono text-white/80">{estado.status?.device_id ?? "—"}</p>
        </div>
      </aside>

      {/* Topo */}
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-white/10 bg-black/70 px-4 text-white backdrop-blur-md sm:px-6">
        <Wheat aria-hidden className="size-5 text-laranja lg:hidden" />
        <h1 className="min-w-0 truncate font-semibold">
          <span className="lg:hidden">Silo · </span>Visão geral
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {SIMULADO && (
            <Badge tom="shell" className="text-aviso" title="Dados gerados no navegador, sem placa nem backend">
              Simulado
            </Badge>
          )}
          <Badge tom="shell" aria-live="polite">
            <span aria-hidden className={`size-2 rounded-full ${online ? "bg-ok" : "bg-erro"}`} />
            {estado.status === null ? "Sem status" : online ? "Online" : "Offline"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
        {alertaAtivo && estado.alerta && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-erro/40 bg-erro/8 px-4 py-3">
            <TriangleAlert aria-hidden className="size-5 shrink-0 text-erro" />
            <p className="min-w-0 flex-1 text-sm">
              <strong className="font-semibold">Alerta no silo:</strong>{" "}
              {estado.alerta.motivos.map((m) => (m === "TEMPERATURA" ? "temperatura acima de 30 °C" : "umidade acima de 70 %")).join(" e ")}{" "}
              <span className="text-texto-2">desde {formatarHora(estado.alerta.ts)}. Volta ao normal abaixo de 28 °C e 65 %.</span>
            </p>
            {estado.ventilacao?.ventilacao !== "LIGADA" && (
              <Button tamanho="sm" disabled={!online || estado.comandoPendente !== null} onClick={() => comandar("LIGAR")}>
                Ligar ventilação
              </Button>
            )}
          </div>
        )}

        {!online && estado.status !== null && (
          <p role="status" className="rounded-card border border-borda bg-superficie px-4 py-3 text-sm text-texto-2">
            A placa saiu do ar (LWT). Os valores abaixo são da última mensagem recebida, {formatarHora(estado.leituras.at(-1)?.ts ?? null)}.
          </p>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <GraficoClima leituras={estado.leituras} />
          <Silo leitura={estado.leituras.at(-1)} ultimoEvento={estado.eventos[0]} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_380px_380px]">
          <Eventos eventos={estado.eventos} />
          <Ventilacao estado={estado} comandar={comandar} />
          <Diagnostico estado={estado} agora={agora} />
        </div>

        {SIMULADO && <PainelSimulacao fonte={fonte} />}
      </main>
    </div>
  );
}

function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}
