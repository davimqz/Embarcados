import { Cpu, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PainelSimulacao } from "@/components/PainelSimulacao";
import { Ventilacao } from "@/components/Ventilacao";
import type { FonteSimulada } from "@/dados/fonteSimulada";
import type { EstadoSilo, RegistroComando } from "@/dados/useSilo";
import { formatarHora, haQuanto } from "@/lib/formato";
import { useAgora } from "@/lib/hooks";

type Props = {
  estado: EstadoSilo;
  comandar: (v: "LIGAR" | "DESLIGAR") => void;
  fonte: FonteSimulada;
  simulado: boolean;
};

/** Aba Controle: tudo o que age sobre a placa (grupo3/cmd) e o retorno de cada comando. */
export function Controle({ estado, comandar, fonte, simulado }: Props) {
  const agora = useAgora();
  const online = estado.status?.status === "online";

  return (
    <>
      {estado.alerta?.alerta === "ATIVO" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-erro/40 bg-erro/8 px-4 py-3">
          <TriangleAlert aria-hidden className="size-5 shrink-0 text-erro" />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">Alerta no silo:</strong>{" "}
            {estado.alerta.motivos.map((m) => (m === "TEMPERATURA" ? "temperatura acima de 30 °C" : "umidade acima de 70 %")).join(" e ")}{" "}
            <span className="text-texto-2">desde {formatarHora(estado.alerta.ts)}. Ligar a ventilação ajuda a baixar os dois.</span>
          </p>
          {estado.ventilacao?.ventilacao !== "LIGADA" && (
            <Button tamanho="sm" disabled={!online || estado.comandoPendente !== null} onClick={() => comandar("LIGAR")}>
              Ligar ventilação
            </Button>
          )}
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
              <dt className="text-texto-2">Alerta</dt>
              <dd>{estado.alerta?.alerta === "ATIVO" ? "Ativo" : "Normal"}</dd>
              <dt className="text-texto-2">Ventilação</dt>
              <dd>{estado.ventilacao?.ventilacao === "LIGADA" ? "Ligada" : "Desligada"}</dd>
            </dl>
          </CardContent>
          <p className="border-t border-borda px-5 py-3 text-xs text-texto-2">
            Se a placa cair sem avisar, o broker publica <code className="font-mono">offline</code> (LWT) em 15 a 25 s.
          </p>
        </Card>

        <Ventilacao estado={estado} comandar={comandar} />
      </div>

      <RegistroComandos comandos={estado.comandos} />

      {simulado && <PainelSimulacao fonte={fonte} />}
    </>
  );
}

const SITUACAO = {
  pendente: { rotulo: "Aguardando", tom: "aviso" },
  confirmado: { rotulo: "Confirmado", tom: "ok" },
  "sem resposta": { rotulo: "Sem resposta", tom: "erro" },
} as const;

function RegistroComandos({ comandos }: { comandos: RegistroComando[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Comandos enviados</CardTitle>
          <p className="text-xs text-texto-2">
            <code className="font-mono">grupo3/cmd</code> → confirmação em <code className="font-mono">grupo3/ventilacao</code> pelo <code className="font-mono">cmd_seq</code>
          </p>
        </div>
        <span className="rotulo">{comandos.length} nesta sessão</span>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {comandos.length === 0 ? (
          <p className="px-5 pb-3 text-sm text-texto-2">Nenhum comando enviado ainda. Use o botão da ventilação acima.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th scope="col" className="rotulo px-5 py-2 font-semibold">seq</th>
                  <th scope="col" className="rotulo py-2 font-semibold">Comando</th>
                  <th scope="col" className="rotulo py-2 font-semibold">Enviado</th>
                  <th scope="col" className="rotulo py-2 text-right font-semibold">Resposta</th>
                  <th scope="col" className="rotulo px-5 py-2 text-right font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {comandos.map((c) => (
                  <tr key={c.seq} className="border-b border-borda/60 last:border-0">
                    <td className="px-5 py-2 font-mono tabular-nums text-texto-2">#{c.seq}</td>
                    <td className="py-2">VENTILACAO · {c.valor}</td>
                    <td className="py-2 font-mono text-xs tabular-nums text-texto-2">{formatarHora(Math.floor(c.enviadoEm / 1000))}</td>
                    <td className="py-2 text-right font-mono text-xs tabular-nums">{c.respostaEm ? `${c.respostaEm - c.enviadoEm} ms` : "—"}</td>
                    <td className="px-5 py-2 text-right">
                      <Badge tom={SITUACAO[c.situacao].tom} ponto>
                        {SITUACAO[c.situacao].rotulo}
                      </Badge>
                    </td>
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
