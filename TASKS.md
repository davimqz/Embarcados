# TASKS — Backlog vivo

> Formato e regras em `CLAUDE.md` §4. Status: `todo | doing | review | done | blocked`.
> Responsável `—` = ainda não atribuído; o grupo distribui.

**Marco atual:** M2 — Sensoriamento (T2.1–T2.4 em review, aguardando o protótipo) · M0 fechado (`v0.0.0`) · M1 fechado em 2026-10-20 (`v0.1.0`)

> **Decisões em aberto:** ver [`docs/decisoes-pendentes.md`](docs/decisoes-pendentes.md) — o que falta decidir para cada marco, com opções e recomendação.

> **Nota (2026-10-20):** T1.2, T1.3, T1.4 e T1.5 foram implementadas na branch `m1/wip-botoes-silo`
> enquanto este arquivo estava fora do repositório, e registradas aqui depois. Os commits dessa branch
> não têm `Refs:` nem seguem a regra de uma branch por task.

---

## M0 — Fundação (setup e decisões) · tag `v0.0.0`

### T0.1 — Criar estrutura de pastas, .gitignore e README inicial
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** —
- **Descrição:** criar o esqueleto de pastas definido em `CLAUDE.md` §2, um `.gitignore` que bloqueie segredos e artefatos de build, e um README inicial.
- **Critérios de aceite:**
  - [x] Pastas `docs/{decisoes,entregas}`, `firmware/`, `backend/{ingest,anchor}`, `dashboard/` existem no repo
  - [x] `.gitignore` cobre `config.h`, `.env`, `.pio/`, `node_modules/`, `*.db`, chaves/mnemônicos
  - [x] README descreve o projeto, a estrutura e aponta para `CLAUDE.md` e `TASKS.md`
- **Evidência:** `docs/entregas/M0/t0.1-estrutura.txt` (saída de `git ls-files`)

### T0.2 — Migrar código da AP02 para firmware/ com config.h
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T0.1
- **Descrição:** trazer o projeto PlatformIO da AP02 para `firmware/` sem mudar comportamento, movendo SSID, senha, IP do broker e nº do grupo para `config.h` (ignorado) com `config.example.h` versionado.
- **Critérios de aceite:**
  - [x] `pio run` em `firmware/` compila sem erros
  - [x] Nenhum segredo em arquivo versionado (`git grep` por SSID/senha/IP retorna vazio)
  - [x] Build falha com mensagem clara se `config.h` não existir
- **Evidência:** `docs/entregas/M0/t0.2-pio-run.log`

### T0.3 — Registrar ADR 0001: escolha da testnet blockchain
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** —
- **Descrição:** decidir entre Cardano Preprod e EVM testnet (Sepolia/Amoy) e registrar o porquê em `docs/decisoes/0001-rede-blockchain.md`. Decisão do grupo.
- **Critérios de aceite:**
  - [x] ADR com contexto, opções, decisão e consequências
  - [x] Campo "Rede blockchain" do `CLAUDE.md` §1 preenchido
- **Evidência:** [`docs/decisoes/0001-rede-blockchain.md`](docs/decisoes/0001-rede-blockchain.md) — Cardano Preprod

### T0.4 — Registrar ADR 0002: dashboard Node-RED vs web
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** —
- **Descrição:** escolher a tecnologia do dashboard e registrar em `docs/decisoes/0002-dashboard.md`. Decisão do grupo.
- **Critérios de aceite:**
  - [x] ADR com contexto, opções, decisão e consequências
  - [x] Linha "Dashboard" da stack no `CLAUDE.md` §2 atualizada
- **Evidência:** [`docs/decisoes/0002-dashboard.md`](docs/decisoes/0002-dashboard.md) — web própria (Vite + React + TS)

### T0.5 — Definir tema/sensor e escrever docs/arquitetura.md
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** —
- **Descrição:** fechar o domínio do projeto e o(s) sensor(es)/atuador(es) usados; documentar a arquitetura em `docs/arquitetura.md`. Decisão do grupo.
- **Tema confirmado em 2026-10-20:** controle de lotes de um silo de grãos, com botão amarelo (GPIO 19) = entrada e vermelho (GPIO 21) = saída (ver T1.5).
- **Hardware decidido em 2026-10-22:** DHT11 + HC-SR04, LED de alerta e LED de ventilação (itens 1–5 de [`docs/decisoes-pendentes.md`](docs/decisoes-pendentes.md)). Escotilha do silo manual, sem eletrônica.
- **Critérios de aceite:**
  - [x] Campo "Tema/domínio" do `CLAUDE.md` §1 preenchido
  - [x] `docs/arquitetura.md` com diagrama, componentes, tasks FreeRTOS previstas e pinagem
- **Medidas para a impressão 3D:** o grupo optou por usar as medidas padrão das peças, sem medir (§3 do `arquitetura.md`), com folgas maiores e uma peça de teste antes do silo. A pinagem é conferida na montagem (M2).
- **Evidência:** `docs/arquitetura.md`

### T0.6 — Criar docs/topicos-mqtt.md com contrato inicial
- **Marco:** M0
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T0.5
- **Descrição:** registrar o contrato de tópicos e payloads (legado `/botao/status` + `/<grupo>/status`, `/<grupo>/telemetria`, `/<grupo>/cmd`) antes de qualquer implementação.
- **Critérios de aceite:**
  - [x] Cada tópico com direção, QoS, retain e exemplo de payload JSON (`device_id`, `ts`, `seq`)
  - [x] Payload de telemetria reflete o sensor definido em T0.5: `grupo3/telemetria` com temperatura e umidade (DHT11) e distância/nível (HC-SR04)
  - [x] `grupo3/cmd` definido (ventilação manual), com confirmação em `grupo3/ventilacao`; alerta por limiar em `grupo3/alerta`
- **Observações:** cada tópico tem o seu próprio `seq`; o `ts` da telemetria é o da leitura. O PubSubClient só publica em QoS 0.
- **Evidência:** `docs/topicos-mqtt.md`

---

## M1 — Firmware base robusto · tag `v0.1.0` · **fechado em 2026-10-20**

Resumo e evidências: [`docs/entregas/M1/README.md`](docs/entregas/M1/README.md).

**Critério do marco:** desconectar o broker e reconectar sem reset; LWT visível no broker.

### T1.1 — Modularizar o firmware em wifi_mqtt.* e botao.*
- **Marco:** M1
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T1.3
- **Descrição:** tirar do `main.cpp` a conexão Wi-Fi/MQTT e a leitura dos botões, sem mudar comportamento. Fica depois da T1.3 para não mover código que ainda vai mudar.
- **Critérios de aceite:**
  - [x] Módulos `wifi_mqtt.{h,cpp}`, `botao.{h,cpp}` e `log_serial.{h,cpp}` (headers em `include/`); `main.cpp` fica com o `setup()` e a `TaskComunicacao` (regra do silo: contadores e JSON)
  - [x] `pio run` sem warnings novos
  - [x] Mesmo teste da T1.5 na placa dá o mesmo resultado (3 entradas + 3 saídas → `saldo:0`)
- **Evidência:** `docs/entregas/M1/t1.1-modularizacao.log`

### T1.2 — Publicar eventos em JSON com ArduinoJson
- **Marco:** M1
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T0.6
- **Descrição:** trocar o payload de texto por JSON com `device_id`, `ts`, `seq` e `evento`, no tópico `grupo3/silo/evento`.
- **Critérios de aceite:**
  - [x] Contrato registrado em `docs/topicos-mqtt.md` antes do código
  - [x] Payload com `device_id`, `ts`, `seq`, `evento` + contadores `entradas`, `saidas`, `saldo`
  - [x] `seq` sobe de 1 em 1 sem buracos (log: 1 a 6)
  - [x] Placa publica em `grupo3/silo/evento`; o legado `/botao/status` foi descontinuado
- **Evidência:** `docs/entregas/M1/t1.2-t1.4-json-ntp.log` · commit `63305ac`

### T1.3 — Reconexão Wi-Fi/MQTT resiliente + LWT
- **Marco:** M1
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T1.2
- **Descrição:** reconectar sem travar a `TaskComunicacao` (uma tentativa a cada 5 s) e publicar o estado da placa em `grupo3/status`, com o `offline` vindo do LWT. Evento só sai da fila depois de publicado, para não se perder numa queda.
- **Critérios de aceite:**
  - [x] Tópico `grupo3/status` registrado em `docs/topicos-mqtt.md`
  - [x] `pio run` compila sem warnings novos
  - [x] `{"status":"online"}` retido em `grupo3/status` ao conectar
  - [x] Após a queda da conexão MQTT, a placa reconecta sozinha em ≤ 5 s, sem reset
  - [x] Botão apertado durante a queda é publicado na volta, com o `seq` seguinte — verificado no boot, com o MQTT ainda conectando (`docs/entregas/M1/t1.1-modularizacao.log`)
  - [x] Placa desligada → broker publica `{"status":"offline"}` em ≤ ~25 s (24 s no teste)
- **Evidência:** `docs/entregas/M1/t1.3-reconexao-lwt.log` (monitor serial + mensagens do broker)

### T1.4 — Sincronizar horário via NTP para o ts
- **Marco:** M1
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T1.2
- **Descrição:** acertar o relógio via SNTP (UTC) e marcar o `ts` no momento do aperto, levando-o pela fila junto com o evento.
- **Critérios de aceite:**
  - [x] `ts` em segundos Unix UTC, coerente com o horário real (log de 2026-10-20 ~11h46 BRT)
  - [x] `ts` vai como `null` enquanto o NTP não sincronizou
  - [x] `ts` é o horário do aperto, não o da publicação
- **Evidência:** `docs/entregas/M1/t1.2-t1.4-json-ntp.log` · commit `63305ac`

### T1.5 — Contar entrada e saída de lotes do silo com dois botões
- **Marco:** M1
- **Status:** done
- **Responsável:** Davi
- **Depende de:** T0.2
- **Descrição:** estender o botão da AP02 para dois botões (entrada e saída), mantendo o padrão ISR → semáforo → task → fila → comunicação, com uma `TaskBotao` por botão. Task registrada depois de implementada; histórico em `docs/sessoes/2026-10-15-botoes-silo.md`.
- **Critérios de aceite:**
  - [x] Amarelo (GPIO 19) = entrada, vermelho (GPIO 21) = saída, ambos com `INPUT_PULLUP`
  - [x] 3 entradas + 3 saídas na placa → `saldo=0`, sem eventos fantasmas
  - [x] Modo de diagnóstico de pinos removido do firmware
- **Evidência:** `docs/entregas/M1/t1.2-t1.4-json-ntp.log` · commits `1df4aa3`, `04d84a8`, `206418e`

## M2 — Sensoriamento · tag `v0.2.0`

**Critério do marco:** telemetria contínua com `seq` sem buracos por 10 min.

> O protótipo ainda não foi montado: o código das tasks do M2 é escrito e compilado antes, e cada task fica em
> `review` até ser testada na placa, com a evidência salva em `docs/entregas/M2/`.

### T2.1 — Ler o DHT11 e o HC-SR04 numa task periódica
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T0.6
- **Descrição:** criar a `TaskSensores` (módulo `sensores.*`), que a cada 5 s lê temperatura e umidade (DHT11, GPIO 4) e a distância até o grão (HC-SR04, TRIG 26 / ECHO 27), calcula o nível em % e registra a leitura no log serial. A publicação fica para a T2.2.
- **Critérios de aceite:**
  - [x] `pio run` sem warnings novos (`docs/entregas/M2/t2.1-pio-run.log`)
  - [ ] Na placa, uma linha `[SENSOR]` a cada 5 s com temperatura, umidade, distância e nível coerentes (mão no DHT11 sobe a umidade; objeto perto do HC-SR04 sobe o nível)
  - [ ] Com o DHT11 ou o HC-SR04 desligado, o campo dele sai como falha, sem travar a task
  - [ ] Os botões continuam contando entradas e saídas com a `TaskSensores` rodando
  - [ ] Prioridade, stack e núcleo justificados em `docs/arquitetura.md` §4; folga de stack registrada no log
- **Em review:** código compilado; falta montar o protótipo, testar na placa e salvar o log serial. Calibrar `SILO_DIST_VAZIO_CM` / `SILO_DIST_CHEIO_CM` no `config.h` na montagem.
- **Evidência:** `docs/entregas/M2/t2.1-pio-run.log` · falta `docs/entregas/M2/t2.1-sensores.log` (placa)

### T2.2 — Publicar a telemetria em grupo3/telemetria
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T2.1
- **Descrição:** a `TaskSensores` põe cada leitura numa fila própria, e a `TaskComunicacao` publica em `grupo3/telemetria` conforme o contrato, com `seq` próprio do tópico e o `ts` da leitura.
- **Critérios de aceite:**
  - [ ] Payload igual ao de `docs/topicos-mqtt.md` (campos com falha saem como `null`)
  - [ ] 10 min de telemetria no broker com `seq` sem buracos (~120 mensagens)
  - [ ] Leituras feitas durante uma queda do broker são publicadas na volta, em ordem, até o tamanho da fila
- **Em review:** código compilado (`pio run` sem warnings, `docs/entregas/M2/t2.2-pio-run.log`); falta rodar 10 min na placa. Dá para testar sem os sensores ligados: temperatura e umidade saem `null`; ligar o ECHO ao GND para a distância também sair `null` em vez de ruído do pino solto.
- **Evidência:** `docs/entregas/M2/t2.2-telemetria.log` (mensagens do broker)

### T2.3 — Acender o LED de alerta por limiar e publicar em grupo3/alerta
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T2.2
- **Descrição:** ao cruzar 30 °C / 70% (volta em 28 °C / 65%), a placa acende o LED vermelho (GPIO 22), mesmo sem rede, e publica a mudança de estado em `grupo3/alerta` (retido).
- **Critérios de aceite:**
  - [ ] Segurar/soprar o DHT11 acende o LED e publica `"ATIVO"` com o motivo
  - [ ] Ao esfriar abaixo de 28 °C e 65%, o LED apaga e sai `"NORMAL"`, sem piscar perto do limite
  - [ ] Com o broker fora, o LED continua respondendo ao limiar
- **Em review:** código compilado (`pio run` sem warnings, `docs/entregas/M2/t2.3-pio-run.log`); falta testar na placa com o DHT11 e o LED. O alerta roda dentro da `TaskSensores`, sem notify (motivo em `docs/arquitetura.md` §4).
- **Evidência:** `docs/entregas/M2/t2.3-alerta.log` + foto/vídeo do LED

### T2.4 — Ligar a ventilação por comando em grupo3/cmd
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T2.2
- **Descrição:** a placa assina `grupo3/cmd`, a `TaskComunicacao` repassa o comando por fila à `TaskAtuador`, que liga/desliga o LED de ventilação (GPIO 23) e confirma em `grupo3/ventilacao` (retido).
- **Critérios de aceite:**
  - [ ] `LIGAR`/`DESLIGAR` publicado à mão no broker muda o LED em < 1 s e volta em `grupo3/ventilacao` com o `cmd_seq`
  - [ ] Comando com JSON inválido, `device_id` de outra placa ou valor desconhecido é descartado com log
  - [ ] Depois de um reboot a ventilação começa desligada e publica `"DESLIGADA"`
- **Em review:** código compilado (`pio run` sem warnings, `docs/entregas/M2/t2.4-pio-run.log`); falta testar na placa com o LED. Dá para testar só com a ESP32: o `cmd_seq` volta em `grupo3/ventilacao` mesmo sem o LED ligado.
- **Evidência:** `docs/entregas/M2/t2.4-comando.log` + vídeo do LED

### T2.5 — Ajustar a pinagem do firmware ao protótipo montado
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T2.4
- **Descrição:** o protótipo foi montado e testado com `firmware/teste-montagem/` (2026-11-19). O firmware, o esquemático e a pinagem documentada passam a seguir a placa: DHT11 no GPIO 25, TRIG no 5, ECHO no 14, botões no 19/21, LEDs no 22/23.
- **Critérios de aceite:**
  - [x] Sensores no firmware: DHT11 no GPIO 25, TRIG no 5, ECHO no 14; `pio run` sem warnings novos
  - [x] LEDs de alerta e ventilação mantidos no 22 (vermelho) e 23 (azul), sem conflito com o DHT11
  - [x] `docs/arquitetura.md` §2, `docs/decisoes-pendentes.md` e `hardware/esquematico/diagram.json` mostram a pinagem nova
  - [x] Teste de montagem na placa: botões, DHT11 e HC-SR04 respondendo (`firmware/teste-montagem/`)
  - [ ] Firmware principal na placa: linhas `[SENSOR]` com temperatura, umidade e distância coerentes (vale também para a T2.1)
- **Evidência:** `docs/entregas/M2/t2.5-sensores.log` (monitor serial do firmware principal)

### T2.6 — Testar na bancada os dois LEDs RGB
- **Marco:** M2
- **Status:** review
- **Responsável:** Davi
- **Depende de:** —
- **Descrição:** programa de teste separado do firmware (env `teste-rgb` no PlatformIO) que passa cada LED RGB por vermelho, verde, azul, amarelo, ciano, magenta, branco e apagado, para conferir a montagem antes de usar os LEDs no firmware. Task registrada depois de implementada.
- **Critérios de aceite:**
  - [x] `pio run -e teste-rgb` e `pio run -e esp32dev` compilam; o firmware principal não inclui `src/testes/`
  - [x] Pinos: LED 1 R=GPIO15, G=GPIO2, B=GPIO4 · LED 2 R=GPIO26, G=GPIO32, B=GPIO33 (o R do LED 2 saiu do GPIO35, que só funciona como entrada)
  - [x] As 8 cores aparecem nos dois LEDs na placa (confirmado pelo grupo)
- **Evidência:** pendente: foto/vídeo dos LEDs em `docs/entregas/M2/`

## M3 — Ingestão e persistência · tag `v0.3.0`

_Tasks T3.1–T3.4._

## M4 — Dashboard · tag `v0.4.0`

> **Exceção à regra "não pular marco" (pedida em 2026-11-17, a referendar pelo grupo):** o enunciado da disciplina
> cobra um **protótipo do front-end** no Check Point (17/11) e dá 15 pts ao dashboard. A T4.0 adianta a tela com
> **dados simulados no navegador**, sem depender do M2 nem do M3. Condições (as mesmas da exceção do M3):
> - o M4 só **fecha** (tag `v0.4.0`) depois de M2 e M3 fecharem, com o critério do marco repetido com a placa real;
> - evidências feitas com dados simulados ficam marcadas como `-simulador` no nome do arquivo;
> - a fonte simulada segue o contrato (`docs/topicos-mqtt.md`); se divergirem, vale o contrato.

### T4.0 — Criar o protótipo do dashboard com dados simulados
- **Marco:** M4
- **Status:** review
- **Responsável:** Luiz Felipe
- **Depende de:** T0.4, T0.6
- **Descrição:** projeto `dashboard/` (Vite + React + TS + Tailwind + Recharts, ADR 0002) com a tela de visão geral alimentada por uma fonte simulada que segue o contrato MQTT, atrás de uma interface (`FonteDados`) que o WebSocket do backend vai implementar depois. Pedida pela exceção acima.
- **Critérios de aceite:**
  - [x] `npm run build` (tipos + bundle) sem erros nem avisos
  - [x] Gráfico de temperatura/umidade com os limiares do alerta; nível de grão e saldo de lotes
  - [x] Selo online/offline (LWT) e último `seq` por tópico
  - [x] Botão da ventilação só muda de estado quando chega `grupo3/ventilacao` com o `cmd_seq` do comando; sem confirmação em 5 s, avisa
  - [x] Aviso de alerta com a histerese do contrato (ATIVO > 30 °C / 70 %; NORMAL < 28 °C e < 65 %)
  - [x] Tela marcada como **Simulado** e painel para simular a placa (clima, botões, queda)
  - [x] Sem estouro horizontal em 375 px nem em 1440 px
- **Observações:** a troca pela fonte real está descrita em `frontend/README.md` (pasta renomeada na T4.5). O histórico (T4.4) e a tela de integridade (M5) aparecem desabilitados no menu.
- **Evidência:** `docs/entregas/M4/T4.0-dashboard-desktop-simulador.png`, `docs/entregas/M4/T4.0-dashboard-celular-simulador.png`, `docs/entregas/M4/T4.0-npm-run-build.log`

### T4.5 — Organizar o frontend em abas de controle, dashboard e histórico
- **Marco:** M4
- **Status:** review
- **Responsável:** Luiz Felipe
- **Depende de:** T4.0
- **Descrição:** pedido do grupo em 2026-11-19 para cobrir o "visualização, interação e gestão" do enunciado: renomear `dashboard/` para `frontend/` e dividir a tela em três abas (**Controle**, **Dashboard** com mais gráficos e indicadores, **Histórico** em forma de log). Ainda com dados simulados, na mesma exceção da T4.0.
- **Critérios de aceite:**
  - [x] Pasta `frontend/`, com `CLAUDE.md`, README e ADR 0002 apontando para ela
  - [x] Controle: estado da placa, estado do alerta (LED vermelho) e movimentação de lotes
  - [x] Sem ventilação na interface: o grupo não tem como ligar/desligar um ventilador (pedido de 2026-11-19)
  - [x] Dashboard: ao vivo + indicadores e gráficos de 1 h / 6 h / 24 h (médias, mín./máx., tempo em alerta, lotes por hora, nível, falhas do DHT11)
  - [x] Histórico: log com filtro por tipo e período, busca e exportação CSV
  - [x] Nenhum gráfico com eixo duplo (temperatura e umidade separados)
  - [x] Navegação no celular (barra inferior) sem estouro horizontal em 375 px
  - [x] `npm run build` sem erros nem avisos
- **Observações:** a fonte simulada ganhou 24 h de histórico (1 leitura/min, semente fixa) e a interface `FonteDados` ganhou `consultar()`, que o backend vai implementar como REST (T4.4).
- **Evidência:** `docs/entregas/M4/T4.5-{controle,dashboard,historico}-desktop-simulador.png`, `docs/entregas/M4/T4.5-{dashboard,historico}-celular-simulador.png`, `docs/entregas/M4/T4.5-npm-run-build.log`

_Tasks T4.1–T4.4 a detalhar; dependem do WebSocket do `backend/ingest` (M3)._

## M5 — Camada Blockchain · tag `v0.5.0`

_Tasks T5.1–T5.5 (depende de T0.3)._

## M6 — Fechamento e apresentação · tag `v1.0.0`

_Tasks T6.1–T6.4._
