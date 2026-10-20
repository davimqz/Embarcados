# ADR 0002 — Dashboard: aplicação web própria (React)

- **Status:** aceita
- **Data:** 2026-10-20
- **Decidido por:** grupo 3
- **Task:** T0.4

## Contexto

O M4 pede gráfico da telemetria em tempo real, indicador online/offline (LWT), controle do atuador e histórico vindo
do SQLite. O M5 pede uma tela de verificação de integridade, que compara a Merkle root recalculada com a que está
on-chain. Tudo isso tem que reagir em menos de 2 s.

## Opções consideradas

| | Node-RED Dashboard | Aplicação web própria |
|---|---|---|
| Esforço | Baixo: MQTT, gráficos e botões prontos | Alto: frontend escrito pelo grupo |
| Controle visual | Limitado aos widgets | Total, permite seguir um design system |
| Tela de verificação (T5.4) | Possível, mas improvisada | Natural |

## Decisão

**Aplicação web própria**, com esta stack:

| Camada | Tecnologia | Por quê |
|---|---|---|
| Build / framework | **Vite + React + TypeScript** | Página estática servida localmente; não precisa de servidor próprio, porque o backend já existe |
| Estilo | **Tailwind CSS**, com os tokens do design system no tema | A escala de espaçamento do design system é a de 4 px do Tailwind |
| Componentes | **shadcn/ui** (tabela, card, badge, botão) | É o estilo de tabela neutra que o design system recomenda |
| Gráficos | **Recharts** | Linha/barras em tempo real com pouco código |
| Dados ao vivo | **WebSocket do backend** | Ver abaixo |

**O dashboard não fala MQTT.** O backend (`backend/ingest`, Node.js + TypeScript com Fastify, mqtt.js e
better-sqlite3) assina o broker, grava no SQLite e expõe:

- `WebSocket` com as leituras, os eventos e o status da placa em tempo real;
- `REST` para o histórico (T4.4), para enviar o comando ao atuador (T4.3, o backend publica em `grupo3/cmd`) e para a
  verificação de integridade (T5.4).

Assim, tempo real, histórico e verificação saem de uma única fonte, e o navegador não depende de o broker oferecer MQTT
por WebSocket.

### Identidade visual

O dashboard segue o design system fornecido pelo grupo (tema claro e quente com shell escuro translúcido). Usa os
tokens, mas não o nome nem a marca do produto original:

- **Fundo:** `#FCFAF7`. **Texto:** `#423D38`. **Texto secundário:** `#797067`. **Bordas:** `#E3E0DD`.
- **Laranja principal** `#FE6E00` para ações, item ativo, foco e telemetria. Barras de gráfico a 60% de opacidade.
- **Shell** (barra lateral 256 px e topo 64 px): preto a 70%, com blur de 12 px e borda branca a 10%; texto branco.
- **Status:** verde `#00C758` = online, vermelho `#FB2C36` = offline/alerta, amarelo `#EDB200` = aviso.
- **Tipografia:** fonte do sistema (`ui-sans-serif, system-ui`); rótulos pequenos em caixa alta com espaçamento largo.
- **Raios:** 6 px nos inputs, 8 px nos controles, 12 px nos cards, pílula nos badges.

## Consequências

- Mais trabalho no M4 que com o Node-RED; compensa no M5 (tela de verificação) e na apresentação.
- `dashboard/` vira um projeto Node próprio (`npm run dev`), separado do `backend/`.
- Tudo roda **localmente no notebook** na apresentação (ver `docs/decisoes-pendentes.md`, item 2).
