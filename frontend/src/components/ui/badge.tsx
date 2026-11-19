import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tons = {
  neutro: "bg-borda/60 text-texto",
  ok: "bg-ok/12 text-[#00873b]",
  erro: "bg-erro/12 text-[#c4141d]",
  aviso: "bg-aviso/18 text-[#7a5c00]",
  laranja: "bg-laranja/12 text-laranja-escuro",
  shell: "bg-white/10 text-white",
} as const;

type Props = HTMLAttributes<HTMLSpanElement> & { tom?: keyof typeof tons; ponto?: boolean };

export function Badge({ tom = "neutro", ponto, className, children, ...p }: Props) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tons[tom], className)}
      {...p}
    >
      {ponto && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
