// SÓ EM DESENVOLVIMENTO: alterna a fonte de dados (break-ui). Não aparece no build de produção.
// "real" é a placa pelo servidor do backend (T4.6); "demo" é a FonteSimulada.

export const MODOS_DADOS = [
  { id: "real", rotulo: "Placa" },
  { id: "demo", rotulo: "Demo" },
  { id: "pior", rotulo: "Pior caso" },
  { id: "vazio", rotulo: "Vazio" },
  { id: "um", rotulo: "Um" },
] as const;

export type ModoDados = (typeof MODOS_DADOS)[number]["id"];

export function lerModoDados(): ModoDados {
  const m = new URLSearchParams(window.location.search).get("dados");
  return MODOS_DADOS.some((x) => x.id === m) ? (m as ModoDados) : "real";
}

export function SeletorDadosDev({ atual }: { atual: ModoDados }) {
  const ir = (id: ModoDados) => {
    const url = new URL(window.location.href);
    if (id === "real") url.searchParams.delete("dados");
    else url.searchParams.set("dados", id);
    window.location.assign(url.toString()); // recarrega: a fonte é criada uma vez por carga
  };
  return (
    <div
      role="radiogroup"
      aria-label="Dados de teste (desenvolvimento)"
      style={{ fontFamily: "system-ui, sans-serif" }}
      className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 gap-0.5 rounded-full bg-neutral-200 p-0.5 text-xs shadow lg:bottom-4"
    >
      {MODOS_DADOS.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === atual}
          onClick={() => ir(m.id)}
          className={m.id === atual ? "rounded-full bg-white px-3 py-1 font-medium text-neutral-900" : "rounded-full px-3 py-1 text-neutral-600"}
        >
          {m.rotulo}
        </button>
      ))}
    </div>
  );
}
