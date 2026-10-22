# TASKS — Backlog vivo

> Formato e regras em `CLAUDE.md` §4. Status: `todo | doing | review | done | blocked`.
> Responsável `—` = ainda não atribuído; o grupo distribui.

**Marco atual:** M0 — Fundação (pendente: T0.6) · M1 fechado em 2026-10-20 (`v0.1.0`)

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
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T0.5
- **Descrição:** registrar o contrato de tópicos e payloads (legado `/botao/status` + `/<grupo>/status`, `/<grupo>/telemetria`, `/<grupo>/cmd`) antes de qualquer implementação.
- **Critérios de aceite:**
  - [x] Cada tópico com direção, QoS, retain e exemplo de payload JSON (`device_id`, `ts`, `seq`)
  - [ ] Payload de telemetria reflete o sensor definido em T0.5 — hoje a telemetria é `grupo3/silo/evento` (proposta da T0.5); fecha quando o tema for confirmado
- **Observações:** `grupo3/cmd` ainda não foi definido; criar quando houver comando do servidor para a placa.
- **Evidência:** `docs/topicos-mqtt.md`

### T0.7 — Modelar o silo em 3D e gerar os STLs
- **Marco:** M0
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T0.5
- **Descrição:** gerar as peças do silo para a impressora do grupo (12 × 12 × 12 cm) a partir das medidas do §3 de `docs/arquitetura.md`, com o modelo paramétrico versionado em `hardware/silo-3d/`. Pedido do grupo, fora do roadmap original.
- **Critérios de aceite:**
  - [x] Script gera base, tampa da base, corpo, tampa do silo, capa do sensor, escotilha e peça de teste em STL
  - [x] Toda peça cabe em 120 × 120 × 120 mm e é sólida fechada (manifold)
  - [x] README com orientação de impressão, quantidade de cada peça e montagem
  - [ ] Peça de teste impressa e conferida com o HC-SR04, um LED e um botão
- **Em review:** falta imprimir a peça de teste e conferir os encaixes com as peças reais.
- **Evidência:** `hardware/silo-3d/stl/`, `docs/entregas/M0/t0.7-silo-3d.png` (prévia) e foto da peça de teste

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

_Tasks T2.1–T2.4. Detalhar ao fechar o M1 (depende do sensor de T0.5)._

## M3 — Ingestão e persistência · tag `v0.3.0`

_Tasks T3.1–T3.4._

## M4 — Dashboard · tag `v0.4.0`

_Tasks T4.1–T4.4 (depende de T0.4)._

## M5 — Camada Blockchain · tag `v0.5.0`

_Tasks T5.1–T5.5 (depende de T0.3)._

## M6 — Fechamento e apresentação · tag `v1.0.0`

_Tasks T6.1–T6.4._
