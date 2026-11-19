import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variantes = {
  primario: "bg-laranja text-white hover:bg-laranja-escuro",
  contorno: "border border-borda bg-superficie text-texto hover:bg-fundo",
  fantasma: "text-texto hover:bg-borda/50",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof variantes; tamanho?: "md" | "sm" };

export function Button({ variante = "primario", tamanho = "md", className, type = "button", ...p }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-controle font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tamanho === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-xs",
        variantes[variante],
        className,
      )}
      {...p}
    />
  );
}
