# TASKS — Backlog vivo

> Formato e regras em `CLAUDE.md` §4. Status: `todo | doing | review | done | blocked`.
> Responsável `—` = ainda não atribuído; o grupo distribui.

**Marco atual:** M0 — Fundação (pendentes: T0.3, T0.4, T0.5) · firmware já avançou no M1 (ver abaixo)

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
- **Status:** todo
- **Responsável:** —
- **Depende de:** —
- **Descrição:** decidir entre Cardano Preprod e EVM testnet (Sepolia/Amoy) e registrar o porquê em `docs/decisoes/0001-rede-blockchain.md`. Decisão do grupo.
- **Critérios de aceite:**
  - [ ] ADR com contexto, opções, decisão e consequências
  - [ ] Campo "Rede blockchain" do `CLAUDE.md` §1 preenchido
- **Evidência:** o próprio ADR

### T0.4 — Registrar ADR 0002: dashboard Node-RED vs web
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** —
- **Descrição:** escolher a tecnologia do dashboard e registrar em `docs/decisoes/0002-dashboard.md`. Decisão do grupo.
- **Critérios de aceite:**
  - [ ] ADR com contexto, opções, decisão e consequências
  - [ ] Linha "Dashboard" da stack no `CLAUDE.md` §2 atualizada
- **Evidência:** o próprio ADR

### T0.5 — Definir tema/sensor e escrever docs/arquitetura.md
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** —
- **Descrição:** fechar o domínio do projeto e o(s) sensor(es)/atuador(es) usados; documentar a arquitetura em `docs/arquitetura.md`. Decisão do grupo.
- **Proposta em uso no firmware (falta o grupo confirmar):** controle de lotes de um silo, com botão amarelo (GPIO 19) = entrada e vermelho (GPIO 21) = saída (ver T1.5).
- **Critérios de aceite:**
  - [ ] Campo "Tema/domínio" do `CLAUDE.md` §1 preenchido
  - [ ] `docs/arquitetura.md` com diagrama, componentes, tasks FreeRTOS previstas e pinagem
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

---

## M1 — Firmware base robusto · tag `v0.1.0`

**Critério do marco:** desconectar o broker e reconectar sem reset; LWT visível no broker.

### T1.1 — Modularizar o firmware em wifi_mqtt.* e botao.*
- **Marco:** M1
- **Status:** todo
- **Responsável:** —
- **Depende de:** T1.3
- **Descrição:** tirar do `main.cpp` a conexão Wi-Fi/MQTT e a leitura dos botões, sem mudar comportamento. Fica depois da T1.3 para não mover código que ainda vai mudar.
- **Critérios de aceite:**
  - [ ] `firmware/src/` com `wifi_mqtt.{h,cpp}` e `botao.{h,cpp}`; `main.cpp` só cria filas, semáforos e tasks
  - [ ] `pio run` sem warnings novos
  - [ ] Mesmo teste da T1.5 na placa dá o mesmo resultado (3 entradas + 3 saídas → `saldo:0`)
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
- **Status:** review
- **Responsável:** Davi
- **Depende de:** T1.2
- **Descrição:** reconectar sem travar a `TaskComunicacao` (uma tentativa a cada 5 s) e publicar o estado da placa em `grupo3/status`, com o `offline` vindo do LWT. Evento só sai da fila depois de publicado, para não se perder numa queda.
- **Critérios de aceite:**
  - [x] Tópico `grupo3/status` registrado em `docs/topicos-mqtt.md`
  - [x] `pio run` compila sem warnings novos
  - [x] `{"status":"online"}` retido em `grupo3/status` ao conectar
  - [x] Após a queda da conexão MQTT, a placa reconecta sozinha em ≤ 5 s, sem reset
  - [ ] Botão apertado durante a queda é publicado na volta, com o `seq` seguinte — **não testado**
  - [ ] Placa desligada → broker publica `{"status":"offline"}` em ≤ ~25 s — **não testado** (o LWT apareceu na queda simulada)
- **Evidência:** `docs/entregas/M1/t1.3-reconexao-lwt.log` (monitor serial + mensagens do broker)
- **Observações:** em 2026-10-20 o grupo decidiu seguir para as próximas tasks sem os dois testes pendentes. Fazer antes de fechar o M1 (tag `v0.1.0`).

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
