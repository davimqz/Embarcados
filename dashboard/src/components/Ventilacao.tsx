import { Fan, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstadoSilo } from "@/dados/useSilo";
import { formatarHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Props = {
  estado: Pick<EstadoSilo, "ventilacao" | "comandoPendente" | "comandoSemResposta" | "status">;
  comandar: (v: "LIGAR" | "DESLIGAR") => void;
};

/** T4.3: comando manual pelo backend em grupo3/cmd; o estado só muda quando a placa confirma em grupo3/ventilacao. */
export function Ventilacao({ estado, comandar }: Props) {
  const { ventilacao, comandoPendente, comandoSemResposta, status } = estado;
  const ligada = ventilacao?.ventilacao === "LIGADA";
  const offline = status?.status !== "online";
  const proximo = ligada ? "DESLIGAR" : "LIGAR";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventilação</CardTitle>
        <Badge tom={ligada ? "laranja" : "neutro"} ponto>
          {ventilacao ? (ligada ? "Ligada" : "Desligada") : "Sem estado"}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Fan
          aria-hidden
          className={cn("size-10 shrink-0", ligada ? "animate-spin text-laranja [animation-duration:1.6s]" : "text-texto-2/50")}
        />
        <div className="min-w-0 flex-1">
          <Button
            className="w-full"
            variante={ligada ? "contorno" : "primario"}
            disabled={offline || comandoPendente !== null}
            onClick={() => comandar(proximo)}
          >
            {comandoPendente ? (
              <>
                <LoaderCircle aria-hidden className="size-4 animate-spin" /> Aguardando a placa…
              </>
            ) : ligada ? (
              "Desligar ventilação"
            ) : (
              "Ligar ventilação"
            )}
          </Button>
          <p className="mt-2 text-xs text-texto-2" aria-live="polite">
            {offline
              ? "Placa offline: o comando não chegaria."
              : comandoSemResposta !== null
                ? `Comando #${comandoSemResposta} sem confirmação em 5 s. Tente de novo.`
                : ventilacao?.cmd_seq != null
                  ? `Confirmado o comando #${ventilacao.cmd_seq} às ${formatarHora(ventilacao.ts)}.`
                  : "Sempre manual: a placa nunca liga sozinha."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
