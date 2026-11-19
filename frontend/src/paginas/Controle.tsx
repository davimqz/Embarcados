import { Cpu, Siren, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotoesPlaca } from "@/components/BotoesPlaca";
import { Eventos } from "@/components/Eventos";
import { PainelSimulacao } from "@/components/PainelSimulacao";
import type { FonteSimulada } from "@/dados/fonteSimulada";
import type { EstadoSilo } from "@/dados/useSilo";
import { formatarHora, haQuanto } from "@/lib/formato";
import { useAgora } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type Props = { estado: EstadoSilo; simulador: FonteSimulada | null };

/** Aba Controle: estado da placa, do alerta (LED vermelho) e dos botões de entrada/saída de lotes. */
export function Controle({ estado, simulador }: Props) {
  const agora = useAgora();
  const online = estado.status?.status === "online";
  const alerta = estado.alerta;
  const ativo = alerta?.alerta === "ATIVO";

  return (
    <>
      {ativo && alerta && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-erro/40 bg-erro/8 px-4 py-3">
          <TriangleAlert aria-hidden className="size-5 shrink-0 text-erro" />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">Alerta no silo:</strong>{" "}
            {alerta.motivos.map((m) => (m === "TEMPERATURA" ? "temperatura acima de 30 °C" : "umidade acima de 70 %")).join(" e ")}{" "}
            <span className="text-texto-2">desde {formatarHora(alerta.ts)}. O LED vermelho da placa está aceso.</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Placa</CardTitle>
            <Badge tom={online ? "ok" : "erro"} ponto>
              {estado.status === null ? "Sem status" : online ? "Online" : "Offline"}
            </Badge>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Cpu aria-hidden className="size-10 shrink-0 text-texto-2/60" />
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-texto-2">device_id</dt>
              <dd className="truncate font-mono text-xs leading-5">{estado.status?.device_id ?? "—"}</dd>
              <dt className="text-texto-2">Última mensagem</dt>
              <dd>{haQuanto(estado.ultimaMensagem, agora)}</dd>
              <dt className="text-texto-2">Leituras recebidas</dt>
              <dd className="font-mono tabular-nums">seq {estado.ultimoSeq["grupo3/telemetria"] ?? "—"}</dd>
            </dl>
          </CardContent>
          <p className="border-t border-borda px-5 py-3 text-xs text-texto-2">
            Se a placa cair sem avisar, o broker publica <code className="font-mono">offline</code> (LWT) em 15 a 25 s.
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerta de clima</CardTitle>
            <Badge tom={ativo ? "erro" : "ok"} ponto>
              {alerta ? (ativo ? "Ativo" : "Normal") : "Sem estado"}
            </Badge>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Siren aria-hidden className={cn("size-10 shrink-0", ativo ? "text-erro" : "text-texto-2/50")} />
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-texto-2">LED vermelho</dt>
              <dd className={ativo ? "font-medium text-[#c4141d]" : ""}>{ativo ? "Aceso" : "Apagado"}</dd>
              <dt className="text-texto-2">Liga quando</dt>
              <dd>temperatura &gt; 30 °C ou umidade &gt; 70 %</dd>
              <dt className="text-texto-2">Desliga quando</dt>
              <dd>temperatura &lt; 28 °C e umidade &lt; 65 %</dd>
              <dt className="text-texto-2">Última mudança</dt>
              <dd>{alerta ? formatarHora(alerta.ts) : "—"}</dd>
            </dl>
          </CardContent>
          <p className="border-t border-borda px-5 py-3 text-xs text-texto-2">A placa acende o LED sozinha, mesmo sem rede.</p>
        </Card>
      </div>

      <BotoesPlaca
        eventos={estado.eventos}
        online={online}
        aoApertar={simulador ? (e) => simulador.controlar(e === "ENTRADA" ? "entrada" : "saida") : undefined}
      />

      <Eventos eventos={estado.eventos} />

      {simulador && <PainelSimulacao fonte={simulador} />}
    </>
  );
}
