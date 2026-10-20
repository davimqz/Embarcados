# Decisões pendentes para fechar o projeto

> Atualizado em 2026-10-20, com o M1 fechado (tag `v0.1.0`).
> Cada item diz **o que decidir**, **por que importa**, **as opções**, **a recomendação** e **o que fica travado** até a decisão.
> Ao decidir um item, registre a resposta aqui (campo **Decisão**) e, se for estrutural, numa ADR em `docs/decisoes/`.

## Já decidido

| Assunto | Decisão | Onde está registrado |
|---|---|---|
| Tema | Controle de lotes de um **silo de grãos** | `CLAUDE.md` §1, T0.5 |
| Rede blockchain | **Cardano Preprod** (Mesh SDK + Blockfrost, hash na metadata) | [ADR 0001](decisoes/0001-rede-blockchain.md) |
| Dashboard | **Web própria**: Vite + React + TS + Tailwind + shadcn/ui + Recharts, alimentada pelo backend via WebSocket | [ADR 0002](decisoes/0002-dashboard.md) |
| Backend | Node.js + TypeScript · Fastify · mqtt.js · better-sqlite3 | [ADR 0002](decisoes/0002-dashboard.md), `CLAUDE.md` §2 |
| Contrato MQTT dos botões | `grupo3/silo/evento` e `grupo3/status` (LWT) | [`topicos-mqtt.md`](topicos-mqtt.md) |

## Resumo do que falta

| # | Decisão | Urgência | Trava |
|---|---|---|---|
| 1 | Qual sensor | 🔴 agora | T0.5, T0.6, todo o M2 |
| 2 | Qual atuador | 🔴 agora | T2.4, T4.3 |
| 3 | Pinagem do sensor e do atuador | 🔴 agora (sai do 1 e do 2) | `docs/arquitetura.md`, T2.1 |
| 4 | Intervalo de leitura do sensor | 🟡 antes do M2 | T2.1, critério do M2 |
| 5 | Limiar do alerta | 🟡 antes da T2.3 | T2.3 |
| 6 | Broker MQTT usado na apresentação | 🟡 antes do M3 | M3, demo |
| 7 | Onde o sistema roda na apresentação | 🟡 antes do M3 | M3, M4 |
| 8 | Saldo do silo depois de um reboot | 🟢 antes do M4 | T4.x |
| 9 | Tamanho do lote ancorado na blockchain | 🟢 antes do M5 | T5.1 |
| 10 | Fonte oficial das regras (`CLAUDE.md` × `docs/regras/`) | 🟢 quando der | consistência |
| 11 | Integrantes do grupo | 🟢 antes do M6 | README, apresentação |
| 12 | Design system completo no repositório | 🟢 antes do M4 | M4 |

---

## 1. Qual sensor 🔴

**O que decidir:** qual sensor faz a leitura periódica do silo.

**Por que importa:** o M2 exige **telemetria contínua**: uma task que lê o sensor de tempos em tempos e publica em
`grupo3/telemetria`, com `seq` sem buracos por 10 minutos. Os botões não servem para isso, porque só geram eventos
quando alguém aperta. Sem o sensor, também não dá para fechar o contrato da telemetria (T0.6) nem a arquitetura (T0.5).

| Opção | O que mede | No silo | Prós | Contras |
|---|---|---|---|---|
| **DHT22** | Temperatura e umidade | Calor e umidade são o que estraga o grão armazenado | 1 fio de dados; biblioteca pronta; precisão boa (±0,5 °C) | Lê no máximo a cada 2 s |
| DHT11 | Temperatura e umidade | Idem | Mais barato | Precisão pior (±2 °C, passo de 1 °C) |
| HC-SR04 | Distância (ultrassom) | Nível de grão no silo (distância do topo) | Dá um "quanto tem no silo" visual | Precisa de 2 pinos; o eco funciona a 5 V e exige divisor de tensão para o ESP32 (3,3 V) |
| DHT22 + HC-SR04 | Os dois | Clima + nível | Dashboard mais rico | Duas tasks de leitura e mais fiação; mais trabalho no M2 |

**Recomendação:** **DHT22**. Encaixa no tema (conservação do grão), tem um limiar de alerta natural (item 5) e é o
mais simples de ligar. O HC-SR04 pode entrar depois como extra, se sobrar tempo.

**Destrava:** T0.5 (`docs/arquitetura.md`), T0.6 (payload de `grupo3/telemetria`) e T2.1–T2.3.

**Decisão:** _a preencher_

## 2. Qual atuador 🔴

**O que decidir:** o que a placa liga e desliga quando recebe um comando remoto.

**Por que importa:** a T2.4 exige que a placa **assine `grupo3/cmd`** e acione algo; a T4.3 exige um botão no dashboard
que mande esse comando. Também define o payload de `grupo3/cmd` no contrato MQTT.

| Opção | Simula | Prós | Contras |
|---|---|---|---|
| **LED** | Ventilação ligada/desligada | Nenhum risco; 1 resistor | Visualmente simples |
| Relé | Ventilação do silo (carga real) | Mais realista; "clique" audível na demo | Precisa de módulo relé; cuidado com a alimentação (muitos módulos são de 5 V) |
| Buzzer | Alarme sonoro | Chama atenção no alerta | Barulho na apresentação; não é bem "comando" |

**Recomendação:** **relé (ou LED, se não tiver relé) representando a ventilação do silo**. Isso fecha a história do
projeto: a temperatura sobe → alerta no dashboard → operador liga a ventilação pelo dashboard → a placa aciona o relé.
O buzzer pode ser usado junto, como alarme local do limiar (T2.3).

**Destrava:** T2.4, T4.3, contrato de `grupo3/cmd`.

**Decisão:** _a preencher_

## 3. Pinagem 🔴

**O que decidir:** em quais GPIOs ligar o sensor e o atuador.

**Por que importa:** vai para o `docs/arquitetura.md` (exigido pela T0.5) e para o firmware. Alguns pinos do ESP32
atrapalham o boot ou não servem para todo uso.

**Já em uso:** GPIO 19 (botão amarelo, entrada) e GPIO 21 (botão vermelho, saída).

**Sugestão (se não houver motivo para outra):**

| Componente | GPIO | Observação |
|---|---|---|
| DHT22 (dados) | **4** | Livre, sem função especial no boot. Resistor de 10 kΩ de pull-up entre dados e 3,3 V, se o módulo não tiver |
| Relé / LED (ventilação) | **23** | Saída digital comum. LED com resistor de 220–330 Ω |
| Buzzer (se usado) | **22** | Saída digital comum |
| HC-SR04 (se usado) | TRIG **26**, ECHO **27** | ECHO com divisor de tensão (5 V → 3,3 V) |

**Evitar:** GPIO 0, 2, 5, 12 e 15 (definem o modo de boot), 6–11 (memória flash), 1 e 3 (Serial) e 34–39 (só entrada,
servem apenas para leitura).

**Decisão:** _a preencher (confirmar depois de montar)_

## 4. Intervalo de leitura do sensor 🟡

**O que decidir:** de quanto em quanto tempo a placa lê e publica a telemetria.

**Por que importa:** define quantas mensagens a demo do M2 gera (critério: 10 min sem buracos), o volume do banco no
M3 e quantos lotes vão para a blockchain no M5. O DHT22 não pode ser lido mais rápido que a cada 2 s.

**Opções:** 2 s (300 leituras em 10 min; o gráfico mexe bastante) · **5 s** (120 leituras) · 10 s (60) · 60 s (realista
para um silo, mas a demo fica parada).

**Recomendação:** **5 s**. O gráfico se mexe na apresentação, e o volume continua pequeno. Fica num `#define`, fácil de
mudar.

**Decisão:** _a preencher_

## 5. Limiar do alerta 🟡

**O que decidir:** a partir de que valor a placa gera um alerta (T2.3), publicado como evento e mostrado no dashboard.

**Por que importa:** é o que dá sentido ao sensor na demo; também define o critério de teste da T2.3.

**Recomendação para grão armazenado:** alerta se **temperatura > 30 °C** ou **umidade relativa > 70%**. Para a demo,
basta segurar o sensor na mão ou soprar nele para passar do limiar. Para evitar que o alerta fique ligando e desligando
perto do limite, ele só volta ao normal 2 °C ou 5% abaixo do limiar.

**Decisão:** _a preencher (ou confirmar com o professor se há um valor esperado)_

## 6. Broker MQTT da apresentação 🟡

**O que decidir:** em qual broker a placa e o backend se conectam.

**Por que importa:** hoje o firmware usa o `test.mosquitto.org`, que é **público**: qualquer pessoa vê e publica nos
tópicos, e ele pode cair ou ficar lento no dia da apresentação. O broker da turma (`172.26.113.122:1883`) estava fora do
ar em 2026-10-20.

| Opção | Prós | Contras |
|---|---|---|
| Broker da turma | Oficial da disciplina | Estava fora do ar; IP precisa ser confirmado com os professores |
| **Mosquitto no notebook** | Sob controle do grupo; funciona sem internet | O `config.h` precisa do IP do notebook, que muda conforme a rede; o firewall do Windows tem que liberar a porta 1883 |
| `test.mosquitto.org` | Já funciona | Público e sem garantia |

**Recomendação:** **perguntar aos professores** se o broker da turma estará no ar e é obrigatório. Se não for, usar o
**Mosquitto no notebook** na apresentação, de preferência com o notebook e a placa num hotspot de celular, para o IP
não mudar.

**Decisão:** _a preencher_

## 7. Onde o sistema roda na apresentação 🟡

**O que decidir:** se backend, banco e dashboard rodam no notebook ou na nuvem.

**Por que importa:** o backend precisa ficar conectado ao broker o tempo todo e usa SQLite, um arquivo local. A maioria
das hospedagens gratuitas desliga o serviço quando ninguém acessa e não guarda arquivos.

**Recomendação:** **tudo local no notebook** (backend, SQLite e dashboard em `localhost`). A única coisa externa é a
Cardano Preprod, acessada pela Blockfrost. Se quiserem um link público depois, dá para hospedar só o dashboard, mas não
é necessário para avaliar.

**Decisão:** _a preencher_

## 8. Saldo do silo depois de um reboot 🟢

**O que decidir:** o que acontece com o saldo do silo (entradas − saídas) quando a placa reinicia.

**Por que importa:** hoje os contadores ficam na memória da placa e **voltam a zero no reboot**: o dashboard mostraria um
silo "vazio" depois de uma queda de energia.

| Opção | Como funciona |
|---|---|
| **Backend recalcula** | O backend soma todos os eventos guardados no SQLite e mostra o saldo real; a placa continua mandando os contadores, mas eles viram informação de diagnóstico |
| Placa guarda na flash | O firmware salva os contadores na NVS (memória que sobrevive ao reboot) |

**Recomendação:** **backend recalcula**. Os eventos já vão para o banco no M3, e a blockchain vai provar exatamente
esses eventos. A fonte de verdade fica no lugar que é auditado.

**Decisão:** _a preencher_

## 9. Tamanho do lote ancorado na blockchain 🟢

**O que decidir:** quantas leituras entram em cada lote cuja Merkle root vai para a Cardano (T5.1).

**Por que importa:** cada lote é uma transação, que custa uma taxa (~0,2 tADA) e leva de 20 s a 1 min para confirmar.
Lotes pequenos geram muitas transações; lotes grandes demoram para aparecer na demo.

**Recomendação:** **fechar um lote a cada 5 minutos ou 50 leituras, o que vier primeiro**. Com leitura a cada 5 s, a
demo do M5 mostra um lote novo a cada ~4 minutos. Dá para reduzir na hora da apresentação.

**Decisão:** _a preencher_

## 10. Fonte oficial das regras 🟢

**O que decidir:** qual documento manda quando as regras divergirem.

**Por que importa:** as regras de tasks, commits e marcos estão **em dois lugares**: no `CLAUDE.md` e em
`docs/regras/*.md` (que veio do PR #1). Se um for atualizado sem o outro, vão se contradizer. Exemplo já existente:
`docs/regras/tasks.md` pede evidências como `T1.3-...` (T maiúsculo), e as do M1 foram salvas como `t1.3-...`.

**Recomendação:** `docs/regras/` como fonte oficial (é público e organizado por assunto), e o `CLAUDE.md` com um resumo
que aponta para lá. Depois, renomear as evidências do M1 para o padrão.

**Decisão:** _a preencher_

## 11. Integrantes do grupo 🟢

**O que decidir:** nome e GitHub de cada integrante e quem fica responsável por quais tasks.

**Por que importa:** o README e o `CLAUDE.md` §1 ainda estão com "a preencher", e as tasks do M2 em diante não têm
responsável. Isso aparece na avaliação.

**Decisão:** _a preencher_

## 12. Design system completo no repositório 🟢

**O que decidir:** se o arquivo completo do design system usado no dashboard pode ficar no repositório, que é público.

**Por que importa:** a ADR 0002 já registra os tokens principais (cores, tipografia, shell). O arquivo original
descreve outro produto (com o nome e a marca dele). Se ele for de uso restrito, não deve ser publicado.

**Recomendação:** guardar só os tokens adaptados, em `dashboard/` e no tema do Tailwind, sem o nome do produto original.

**Decisão:** _a preencher_

---

## Ordem sugerida para fechar o projeto

1. **Agora:** decidir os itens 1–3 → fechar T0.5 e T0.6 → tag `v0.0.0` (M0).
2. **M2 — Sensoriamento** (`v0.2.0`): itens 4 e 5. Leitura do sensor, telemetria, alerta e comando do atuador.
3. **M3 — Ingestão** (`v0.3.0`): itens 6 e 7. Backend grava tudo no SQLite com o hash de cada mensagem.
4. **M4 — Dashboard** (`v0.4.0`): itens 8 e 12. Tempo real, online/offline, botão da ventilação e histórico.
5. **M5 — Blockchain** (`v0.5.0`): item 9. Lotes ancorados na Preprod e tela de verificação (positiva e com adulteração).
6. **M6 — Fechamento** (`v1.0.0`): itens 10 e 11. README final, diagrama, roteiro da demo de 5 min e revisão de segredos.

### Antes de cada marco, tenha em mãos

| Marco | Precisa ter |
|---|---|
| M2 | Sensor e atuador montados na protoboard |
| M3 | Node.js 20+ instalado no notebook; broker definido (item 6) |
| M5 | Carteira de teste Cardano com tADA do [faucet da Preprod](https://docs.cardano.org/cardano-testnets/tools/faucet); chave de API da [Blockfrost](https://blockfrost.io) para a Preprod |
| M6 | Revisão de segredos no histórico: o nome da rede Wi-Fi aparece em commits antigos (ver T6.4) |
