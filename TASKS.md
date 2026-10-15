# TASKS — Backlog do projeto

Regras: [tasks](docs/regras/tasks.md) · [commits](docs/regras/commits.md) · [marcos](docs/regras/marcos.md)

**Marco atual:** M0 — Fundação

---

## M0 — Fundação · `v0.0.0` · aberto

### T0.1 — Criar estrutura de pastas, .gitignore e README inicial
- **Marco:** M0
- **Status:** doing
- **Responsável:** Davi Marques Oliveira
- **Depende de:** —
- **Descrição:** organizar o repositório no layout acordado (`firmware/`, `backend/`, `dashboard/`, `docs/`) para que todos trabalhem sobre a mesma base.
- **Critérios de aceite:**
  - [x] pastas `firmware/`, `backend/ingest/`, `backend/anchor/`, `dashboard/`, `docs/decisoes/`, `docs/entregas/` criadas
  - [x] `.gitignore` cobre `.pio/`, `node_modules/`, `.env`, `config.h`
  - [ ] README com objetivo, integrantes e links para as regras
- **Evidência:** docs/entregas/M0/T0.1-estrutura.txt (árvore do repo)

### T0.2 — Migrar código da AP02 para firmware/
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** T0.1
- **Descrição:** trazer a base da AP02 (ISR → semáforo → TaskBotao → fila → TaskComunicacao) sem reescrever, extraindo SSID, senha e broker para `config.h`.
- **Critérios de aceite:**
  - [ ] `pio run` dentro de `firmware/` compila sem warnings novos
  - [ ] nenhum segredo no código; `config.h` ignorado e `config.example.h` versionado
  - [ ] log serial mostrando publicação em `/botao/status`
- **Evidência:** docs/entregas/M0/T0.2-build-e-serial.log

### T0.3 — Registrar ADR 0001: escolha da testnet blockchain
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** —
- **Descrição:** decidir entre Cardano Preprod e EVM testnet (Sepolia/Amoy) e registrar o porquê.
- **Critérios de aceite:**
  - [ ] `docs/decisoes/0001-rede-blockchain.md` com contexto, opções, decisão e consequências
  - [ ] decisão aprovada pelo grupo (registrada no ADR)
- **Evidência:** docs/decisoes/0001-rede-blockchain.md

### T0.4 — Registrar ADR 0002: dashboard
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** —
- **Descrição:** decidir entre Node-RED Dashboard e web simples.
- **Critérios de aceite:**
  - [ ] `docs/decisoes/0002-dashboard.md` com contexto, opções, decisão e consequências
  - [ ] decisão aprovada pelo grupo (registrada no ADR)
- **Evidência:** docs/decisoes/0002-dashboard.md

### T0.5 — Definir tema/sensor e escrever arquitetura
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** T0.3, T0.4
- **Descrição:** fechar o domínio do sensor e documentar a arquitetura ponta a ponta.
- **Critérios de aceite:**
  - [ ] tema e sensor definidos
  - [ ] `docs/arquitetura.md` com diagrama, componentes e fluxo de dados
- **Evidência:** docs/arquitetura.md

### T0.6 — Criar contrato inicial de tópicos MQTT
- **Marco:** M0
- **Status:** todo
- **Responsável:** —
- **Depende de:** T0.5
- **Descrição:** registrar tópicos e payloads antes de qualquer implementação (contrato MQTT é lei).
- **Critérios de aceite:**
  - [ ] `docs/topicos-mqtt.md` lista tópicos, direção, QoS e exemplo de payload
  - [ ] todo payload tem `device_id`, `ts` e `seq`
- **Evidência:** docs/topicos-mqtt.md

---

## Próximos marcos

M1 a M6 estão descritos no [roadmap](docs/regras/marcos.md#roadmap). As tasks de cada
marco são detalhadas neste arquivo quando o marco anterior fechar.
