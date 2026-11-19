const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** ts do contrato (segundos UTC ou null) → hora local. */
export function formatarHora(ts: number | null) {
  return ts === null ? "sem horário" : hora.format(new Date(ts * 1000));
}

export function haQuanto(msDesde: number | null, agora: number) {
  if (msDesde === null) return "nunca";
  const s = Math.max(0, Math.round((agora - msDesde) / 1000));
  if (s < 60) return `há ${s} s`;
  return `há ${Math.floor(s / 60)} min`;
}

/** "1 entrada" / "0 entradas" / "3 entradas". Não usa Intl.PluralRules: em pt-BR ele trata 0 como singular ("0 entrada"). */
export const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export const valorOuTraco = (v: number | null | undefined, casas = 0) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
