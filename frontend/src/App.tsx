import { useEffect, useState } from "react";
import { ChartLine, History, SlidersHorizontal, Wheat, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FonteSimulada } from "@/dados/fonteSimulada";
import { useSilo } from "@/dados/useSilo";
import { cn } from "@/lib/utils";
import { Controle } from "@/paginas/Controle";
import { Dashboard } from "@/paginas/Dashboard";
import { Historico } from "@/paginas/Historico";

// Única troca necessária quando o backend (M3) existir: uma FonteWebSocket com a mesma interface.
const fonte = new FonteSimulada();
const SIMULADO = fonte instanceof FonteSimulada;

type Rota = "controle" | "dashboard" | "historico";

const NAV: { rota: Rota; rotulo: string; icone: LucideIcon }[] = [
  { rota: "controle", rotulo: "Controle", icone: SlidersHorizontal },
  { rota: "dashboard", rotulo: "Dashboard", icone: ChartLine },
  { rota: "historico", rotulo: "Histórico", icone: History },
];

export default function App() {
  const { estado } = useSilo(fonte);
  const rota = useRota();
  const online = estado.status?.status === "online";
  const alertaAtivo = estado.alerta?.alerta === "ATIVO";
  const atual = NAV.find((n) => n.rota === rota)!;

  return (
    <div className="min-h-dvh pb-16 lg:pb-0 lg:pl-64">
      {/* Barra lateral (shell escuro translúcido, ADR 0002) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/10 bg-black/70 text-white backdrop-blur-md lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <Wheat aria-hidden className="size-5 text-laranja" />
          <span className="font-semibold">Silo · Grupo 3</span>
        </div>
        <nav aria-label="Seções" className="flex-1 p-3">
          <ul className="grid gap-1">
            {NAV.map(({ rota: r, rotulo, icone: Icone }) => (
              <li key={rotulo}>
                <a
                  href={`#/${r}`}
                  aria-current={r === rota ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-controle px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja",
                    r === rota ? "bg-laranja font-medium" : "text-white/80 hover:bg-white/10",
                  )}
                >
                  <Icone aria-hidden className="size-4" />
                  {rotulo}
                  {r === "controle" && alertaAtivo && <span className="ml-auto size-2 rounded-full bg-erro" title="Alerta ativo" />}
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
          <span className="lg:hidden">Silo · </span>
          {atual.rotulo}
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
        {rota === "controle" && <Controle estado={estado} fonte={fonte} simulado={SIMULADO} />}
        {rota === "dashboard" && <Dashboard estado={estado} fonte={fonte} />}
        {rota === "historico" && <Historico fonte={fonte} />}
      </main>

      {/* Navegação no celular: barra inferior */}
      <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/80 text-white backdrop-blur-md lg:hidden">
        <ul className="grid grid-cols-3">
          {NAV.map(({ rota: r, rotulo, icone: Icone }) => (
            <li key={rotulo}>
              <a
                href={`#/${r}`}
                aria-current={r === rota ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px]", r === rota ? "text-laranja" : "text-white/70")}
              >
                <Icone aria-hidden className="size-5" />
                {rotulo}
                {r === "controle" && alertaAtivo && <span className="absolute top-3 right-[calc(50%-14px)] size-2 rounded-full bg-erro" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

const ROTAS: Rota[] = ["controle", "dashboard", "historico"];

/** Rotas por hash (#/historico): sem dependência de roteador e funciona servindo o dist/ como arquivo estático. */
function useRota(): Rota {
  const ler = () => {
    const r = window.location.hash.replace(/^#\/?/, "") as Rota;
    return ROTAS.includes(r) ? r : "dashboard";
  };
  const [rota, setRota] = useState<Rota>(ler);
  useEffect(() => {
    const aoMudar = () => {
      setRota(ler());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return rota;
}
