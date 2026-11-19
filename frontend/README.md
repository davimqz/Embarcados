# Frontend — Silo · Grupo 3

Aplicação web do monitoramento do silo (ADR 0002): Vite + React + TypeScript, Tailwind CSS com os tokens do design
system, componentes no estilo shadcn/ui e gráficos com Recharts. A pasta se chamava `dashboard/` até a T4.5.

> **Estado atual: protótipo com dados simulados.** Não há placa nem backend envolvidos: a classe `FonteSimulada`
> (`src/dados/fonteSimulada.ts`) gera no navegador as mesmas mensagens do contrato
> [`docs/topicos-mqtt.md`](../docs/topicos-mqtt.md), com 24 h de histórico anterior. O topo da tela mostra o selo
> **Simulado** enquanto for assim.

## Como rodar

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # checagem de tipos + build de produção em dist/
```

## As três abas

| Aba | Endereço | O que tem |
|---|---|---|
| **Controle** | `#/controle` | Estado da placa (online/offline pelo LWT), estado do alerta (LED vermelho) com os limiares, entradas e saídas de lotes (botões da placa) e o painel de simulação da placa. Sem ventilação: o grupo não tem como ligar/desligar um ventilador |
| **Dashboard** | `#/dashboard` (inicial) | Ao vivo: temperatura e umidade dos últimos 10 min, nível de grão, saldo de lotes e último `seq` por tópico. Período (1 h / 6 h / 24 h): médias, mín./máx., tempo em alerta, lotes movimentados, falhas do DHT11, % do tempo acima dos limiares, gráficos de temperatura, umidade e nível e lotes por hora |
| **Histórico** | `#/historico` | Log de tudo o que a placa publicou, com filtro por tipo e por período, busca e **exportação CSV** (separador `;` e acentos, abre direto no Excel) |

Cada gráfico tem uma série e um eixo só. Temperatura e umidade ficam em gráficos separados, cada um com a linha do
seu limiar de alerta.

## Como trocar o simulado pelo backend real

Toda a tela consome a interface `FonteDados` (`src/dados/tipos.ts`):

- `historico()` → leituras iniciais da tela ao vivo;
- `consultar({ desde, ate, topicos })` → REST do backend sobre o SQLite (T4.4);
- `assinar()` → WebSocket do backend, com `{ topico, payload }` exatamente como no contrato.

Quando o `backend/ingest` (M3) expuser isso, basta criar uma `FonteWebSocket` com a mesma interface e trocar a linha
`const fonte = new FonteSimulada()` em `src/App.tsx`. O painel de simulação e o selo **Simulado** somem sozinhos.

## Estrutura

```
src/
├── App.tsx                 # shell (barra lateral, topo, barra inferior no celular) e rotas por hash
├── paginas/                # Controle, Dashboard, Historico
├── dados/
│   ├── tipos.ts            # tipos do contrato MQTT + interface FonteDados
│   ├── fonteSimulada.ts    # placa + backend simulados (temporário)
│   └── useSilo.ts          # estado ao vivo: leituras, eventos, alerta e seq por tópico
├── components/             # Silo, GraficoClima, GraficoSerie, Eventos, Diagnostico, ...
│   └── ui/                 # card, badge, button (estilo shadcn/ui)
├── lib/                    # formatação, hooks (consulta ao histórico, relógio)
└── index.css               # tokens do design system (@theme do Tailwind)
```
