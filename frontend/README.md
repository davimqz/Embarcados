# Dashboard — Silo · Grupo 3

Aplicação web do monitoramento do silo (ADR 0002): Vite + React + TypeScript, Tailwind CSS com os tokens do design
system, componentes no estilo shadcn/ui e gráficos com Recharts.

> **Estado atual (T4.0): protótipo com dados simulados.** Não há placa nem backend envolvidos: a classe
> `FonteSimulada` (`src/dados/fonteSimulada.ts`) gera no navegador as mesmas mensagens do contrato
> [`docs/topicos-mqtt.md`](../docs/topicos-mqtt.md). O topo da tela mostra o selo **Simulado** enquanto for assim.

## Como rodar

```bash
cd dashboard
npm install
npm run dev      # http://localhost:5173
npm run build    # checagem de tipos + build de produção em dist/
```

## O que a tela mostra

| Área | Tópico de origem | Task do roadmap |
|---|---|---|
| Gráfico de temperatura e umidade, com os limiares de alerta | `grupo3/telemetria` | T4.1 |
| Silo: nível de grão (HC-SR04) e saldo de lotes (botões) | `grupo3/telemetria`, `grupo3/silo/evento` | T4.1 |
| Selo online/offline e último `seq` por tópico | `grupo3/status` (LWT), todos | T4.2 |
| Aviso de alerta, com atalho para ligar a ventilação | `grupo3/alerta` | T4.1 / T4.3 |
| Botão da ventilação: só muda quando a placa confirma o `cmd_seq` | `grupo3/cmd` → `grupo3/ventilacao` | T4.3 |
| Movimentação de lotes | `grupo3/silo/evento` | T4.4 (histórico virá do SQLite) |
| Painel "Simulação da placa" (aquecer, umedecer, botões, derrubar a placa) | — | só no protótipo |

## Como trocar o simulado pelo backend real

Toda a tela consome a interface `FonteDados` (`src/dados/tipos.ts`):

- `historico()` → virá do REST do backend (SQLite, T4.4);
- `assinar()` → virá do WebSocket do backend, com `{ topico, payload }` exatamente como no contrato;
- `enviarComando()` → `POST` no backend, que publica em `grupo3/cmd`.

Quando o `backend/ingest` (M3) expuser isso, basta criar uma `FonteWebSocket` com a mesma interface e trocar a linha
`const fonte = new FonteSimulada()` em `src/App.tsx`. O painel de simulação e o selo **Simulado** somem sozinhos.

## Estrutura

```
src/
├── App.tsx                 # shell (barra lateral + topo) e grade do painel
├── dados/
│   ├── tipos.ts            # tipos do contrato MQTT + interface FonteDados
│   ├── fonteSimulada.ts    # placa + backend simulados (temporário)
│   └── useSilo.ts          # estado do painel: últimas leituras, seq, comando pendente
├── components/             # Silo, GraficoClima, Ventilacao, Eventos, Diagnostico, PainelSimulacao
│   └── ui/                 # card, badge, button (estilo shadcn/ui)
└── index.css               # tokens do design system (@theme do Tailwind)
```
