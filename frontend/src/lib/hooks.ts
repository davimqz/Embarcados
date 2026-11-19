import { useCallback, useEffect, useState } from "react";
import type { FonteDados, Mensagem, Topico } from "@/dados/tipos";

/** Relógio que atualiza a cada segundo (para os "há N s"). */
export function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

export const PERIODOS = [
  { horas: 1, rotulo: "1 h" },
  { horas: 6, rotulo: "6 h" },
  { horas: 24, rotulo: "24 h" },
] as const;

/** Consulta o histórico das últimas `horas` e refaz a cada 15 s (no M4 real: REST do backend). */
export function useConsulta(fonte: FonteDados, horas: number, topicos?: Topico[]) {
  const [dados, setDados] = useState<Mensagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chave = topicos?.join(",");

  const carregar = useCallback(() => {
    const ate = Math.floor(Date.now() / 1000);
    fonte
      .consultar({ desde: ate - horas * 3600, ate, topicos })
      .then((m) => {
        setDados(m);
        setErro(null);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "falha na consulta"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte, horas, chave]);

  useEffect(() => {
    setDados(null);
    carregar();
    const id = setInterval(carregar, 15000);
    return () => clearInterval(id);
  }, [carregar]);

  return { dados, erro, recarregar: carregar };
}
