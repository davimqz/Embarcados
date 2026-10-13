# TASKS — Backlog vivo

> Formato e regras em `CLAUDE.md` §4. Status: `todo | doing | review | done | blocked`.
> Responsável `—` = ainda não atribuído; o grupo distribui.

**Marco atual:** M0 — Fundação

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
- **Status:** todo
- **Responsável:** Davi
- **Depende de:** T0.1
- **Descrição:** trazer o projeto PlatformIO da AP02 para `firmware/` sem mudar comportamento, movendo SSID, senha, IP do broker e nº do grupo para `config.h` (ignorado) com `config.example.h` versionado.
- **Critérios de aceite:**
  - [ ] `pio run` em `firmware/` compila sem erros
  - [ ] Nenhum segredo em arquivo versionado (`git grep` por SSID/senha/IP retorna vazio)
  - [ ] Build falha com mensagem clara se `config.h` não existir
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
- **Critérios de aceite:**
  - [ ] Campo "Tema/domínio" do `CLAUDE.md` §1 preenchido
  - [ ] `docs/arquitetura.md` com diagrama, componentes, tasks FreeRTOS previstas e pinagem
- **Evidência:** `docs/arquitetura.md`

### T0.6 — Criar docs/topicos-mqtt.md com contrato inicial
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** T0.5
- **Descrição:** registrar o contrato de tópicos e payloads (legado `/botao/status` + `/<grupo>/status`, `/<grupo>/telemetria`, `/<grupo>/cmd`) antes de qualquer implementação.
- **Critérios de aceite:**
  - [ ] Cada tópico com direção, QoS, retain e exemplo de payload JSON (`device_id`, `ts`, `seq`)
  - [ ] Payload de telemetria reflete o sensor definido em T0.5
- **Evidência:** `docs/topicos-mqtt.md`

---

## M1 — Firmware base robusto · tag `v0.1.0`

_Tasks T1.1–T1.4 conforme `CLAUDE.md` §6. Detalhar ao fechar o M0._

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
