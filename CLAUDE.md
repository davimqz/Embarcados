# CLAUDE.md — Prompt-mãe do Projeto IoT + Blockchain (Sistemas Embarcados · CESAR School)

> Este arquivo é a fonte de verdade do projeto. Leia-o inteiro no início de toda sessão e siga-o à risca.
> Em caso de conflito entre um pedido avulso e este arquivo, pergunte antes de agir.

---

## 1. Contexto

- **Disciplina:** Sistemas Embarcados — CESAR School (Profs. Bella / Jymmy)
- **Tipo:** projeto acadêmico em grupo
- **Objetivo:** sistema IoT com **ESP32 + FreeRTOS + MQTT + dashboard**, com uma camada de **blockchain** que garante a integridade dos dados coletados (prova de que a telemetria não foi adulterada).
- **Tema/domínio do sensor:** `<<PREENCHER: ex. monitoramento de temperatura de carga, controle de acesso, consumo de energia>>`
- **Grupo:** `GRUPO3` · Participantes: `<<nomes>>`
- **Rede blockchain:** `<<PREENCHER: Cardano Preprod | EVM testnet (Sepolia/Amoy)>>` — decidida no M0, nunca mainnet.

### Ponto de partida
Já existe uma base funcional da Atividade Prática 02 (`firmware/src/main.cpp`): ISR de botão com debounce → semáforo binário → TaskBotao → fila (10 ints) → TaskComunicacao (Wi-Fi + MQTT) publicando em `/botao/status`. **Essa arquitetura (ISR → semáforo → task → fila → task de comunicação) é o padrão do projeto e deve ser preservada e estendida, não reescrita.**

---

## 2. Arquitetura alvo

```
[Sensores/Botão] → ISR → Semáforo → Task Leitura → Fila → Task Comunicação
                                                            │ MQTT (1883)
                                                            ▼
                                              Broker (Mosquitto / Node-RED)
                                                            │
                                ┌───────────────────────────┼───────────────────────────┐
                                ▼                           ▼                           ▼
                        Serviço de Ingestão          Dashboard (tempo real)     Serviço de Ancoragem
                        (valida + persiste)          (Node-RED UI ou web)       (lote → Merkle root → tx)
                                │                                                       │
                                ▼                                                       ▼
                             Banco (SQLite)  ◄──────────── tx hash por lote ──────── Blockchain testnet
```

### Stack
| Camada | Tecnologia |
|---|---|
| Firmware | ESP32 · PlatformIO · Arduino framework · FreeRTOS · PubSubClient · ArduinoJson |
| Broker | Mosquitto (ou Node-RED com aedes) |
| Backend | Node.js (TypeScript) · mqtt.js · SQLite |
| Dashboard | Node-RED Dashboard **ou** web simples (decidir no M0) |
| Blockchain | SDK da rede escolhida (Mesh/Lucid para Cardano · ethers.js para EVM) |

### Estrutura do repositório
```
/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── arquitetura.md
│   ├── decisoes/            # ADRs: 0001-rede-blockchain.md, ...
│   ├── topicos-mqtt.md      # contrato de tópicos e payloads
│   └── entregas/            # evidências por marco (prints, vídeos, logs)
├── firmware/                # projeto PlatformIO
│   ├── platformio.ini
│   ├── include/config.example.h
│   └── src/
├── backend/
│   ├── ingest/
│   └── anchor/
├── dashboard/               # flows Node-RED exportados (.json) ou app web
└── TASKS.md                 # backlog vivo (ver seção 4)
```

---

## 3. Regras gerais (inegociáveis)

1. **Nunca commitar segredos.** SSID, senha, IP do broker, chaves de carteira e mnemônicos ficam em `config.h` / `.env`, ambos no `.gitignore`. Sempre manter `config.example.h` / `.env.example` atualizados.
2. **Firmware segue as regras de FreeRTOS da disciplina:**
   - ISR com `IRAM_ATTR`, sem `Serial`, sem `delay`, sem lógica pesada; só sinaliza (semáforo/notify).
   - Comunicação entre tasks via fila ou event group, nunca variável global sem proteção.
   - Toda criação de semáforo, fila e task tem o retorno checado.
   - Só `vTaskDelay` dentro de tasks, nunca `delay`.
3. **Contrato MQTT é lei.** Qualquer tópico ou payload novo é registrado em `docs/topicos-mqtt.md` **antes** de ser implementado. Payloads em JSON com `device_id`, `ts` e `seq`.
4. **Blockchain só em testnet.** Nunca dado bruto on-chain, apenas hashes (Merkle root de lotes).
5. **Não reescrever o que funciona.** Mudanças em código existente são incrementais e justificadas no commit.
6. **Sem dependência nova sem justificar** em uma linha no PR/commit.
7. **Português** em docs, commits e mensagens de log; identificadores de código podem ser em português (padrão atual) — manter consistência por arquivo.
8. **Na dúvida, pergunte.** Não invente requisito acadêmico.

---

## 4. Regras de Task

Todo trabalho vive em `TASKS.md`. Nenhum código é escrito sem uma task correspondente.

### Formato
```md
### T<marco>.<n> — <título no imperativo>
- **Marco:** M<x>
- **Status:** todo | doing | review | done | blocked
- **Responsável:** <nome>
- **Depende de:** T<..> (ou —)
- **Descrição:** o que e por quê, em 1–3 linhas.
- **Critérios de aceite:**
  - [ ] critério verificável 1
  - [ ] critério verificável 2
- **Evidência:** caminho em docs/entregas/ (print, log serial, vídeo, tx hash)
```

### Regras
- **Tamanho:** uma task cabe em uma sessão (≤ ~2h). Se não cabe, quebre.
- **Uma task `doing` por vez** por responsável.
- **Critérios de aceite verificáveis** (log serial, mensagem no broker, tela, tx no explorer). Nada de "funcionar bem".
- **Definition of Done:**
  1. Critérios de aceite marcados.
  2. Compila sem warnings novos (`pio run`) / testes passam (`npm test`).
  3. Evidência salva em `docs/entregas/M<x>/`.
  4. Docs afetados atualizados (`topicos-mqtt.md`, `arquitetura.md`, README).
  5. Commit(s) seguindo a seção 5.
- **Bloqueio:** marcar `blocked`, escrever o motivo e o que destrava. Não contornar em silêncio.
- **Fluxo do Claude Code por task:** ler a task → propor plano curto → implementar → rodar build/teste → atualizar `TASKS.md` → commitar → resumir em 3 linhas o que mudou.

---

## 5. Regras de Commit

**Conventional Commits em português.**

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, ≤ 72 chars>

[corpo opcional: o porquê, não o como]

Refs: T<marco>.<n>
```

| Tipo | Uso |
|---|---|
| `feat` | funcionalidade nova |
| `fix` | correção de bug |
| `refactor` | mudança interna sem alterar comportamento |
| `docs` | documentação, ADRs, evidências |
| `test` | testes |
| `chore` | build, config, dependências |
| `perf` | desempenho |

**Escopos válidos:** `firmware`, `rtos`, `mqtt`, `ingest`, `anchor`, `dashboard`, `chain`, `docs`, `infra`.

**Regras**
- Commits **atômicos**: um assunto por commit; nada de "várias coisas".
- Todo commit referencia a task (`Refs: T2.3`).
- Firmware que não compila **não** é commitado na `main`.
- Proibido commitar `.env`, `config.h`, `.pio/`, `node_modules/`, chaves.
- Exemplos:
  - `feat(rtos): adicionar task de leitura do sensor com fila dedicada`
  - `fix(mqtt): reconectar broker quando wifi volta`
  - `docs(chain): registrar ADR 0001 escolha da testnet`

### Branches
- `main` — sempre estável e demonstrável.
- `m<x>/t<x>.<n>-slug` — uma branch por task (ex.: `m2/t2.1-sensor-dht`).
- Merge na `main` só com a DoD cumprida. Ao fechar um marco: tag `v0.<x>.0`.

---

## 6. Roadmap por Marcos

Cada marco termina com **entrega demonstrável**, evidência em `docs/entregas/M<x>/` e tag git.

### M0 — Fundação (setup e decisões)
**Meta:** repo pronto e decisões travadas.
- T0.1 Criar estrutura de pastas, `.gitignore`, README inicial.
- T0.2 Migrar código da AP02 para `firmware/`, extraindo configs para `config.h` (+ `config.example.h`).
- T0.3 ADR 0001: escolha da testnet blockchain.
- T0.4 ADR 0002: dashboard (Node-RED vs web).
- T0.5 Definir tema/sensor e escrever `docs/arquitetura.md`.
- T0.6 Criar `docs/topicos-mqtt.md` com contrato inicial.
**Entrega:** repo organizado; firmware da AP02 compilando a partir de `firmware/`. **Tag:** `v0.0.0`.

### M1 — Firmware base robusto
**Meta:** padrão ISR → semáforo → task → fila → comunicação sólido e reutilizável.
- T1.1 Modularizar firmware (`wifi_mqtt.*`, `botao.*`, `config.h`).
- T1.2 Payload JSON (`device_id`, `ts`, `seq`, `evento`) com ArduinoJson.
- T1.3 Reconexão Wi-Fi/MQTT resiliente + LWT (`/<grupo>/status` = offline).
- T1.4 Sincronizar horário via NTP para `ts`.
**Critério:** desconectar o broker e reconectar sem reset; LWT visível no broker.
**Entrega:** log serial + print do broker. **Tag:** `v0.1.0`.

### M2 — Sensoriamento
**Meta:** leitura real de sensor(es) do tema.
- T2.1 Task de leitura periódica do sensor (prioridade e stack justificadas).
- T2.2 Fila de leituras → TaskComunicacao publica em `/<grupo>/telemetria`.
- T2.3 Eventos por limiar (ex.: alerta) via ISR/notify quando aplicável.
- T2.4 Comando remoto: assinar `/<grupo>/cmd` (ex.: ligar LED/atuador).
**Critério:** telemetria contínua com `seq` sem buracos por 10 min.
**Entrega:** vídeo curto da placa + mensagens chegando. **Tag:** `v0.2.0`.

### M3 — Ingestão e persistência
**Meta:** dados saem do broker e ficam guardados.
- T3.1 Serviço `ingest` assinando tópicos e validando o schema.
- T3.2 Persistir em SQLite (tabela `leituras` com hash SHA-256 de cada payload).
- T3.3 Detectar `seq` faltante/duplicado e registrar.
- T3.4 Testes do validador e do hash.
**Critério:** 100% das mensagens do M2 persistidas; testes passando.
**Entrega:** dump da tabela + saída dos testes. **Tag:** `v0.3.0`.

### M4 — Dashboard
**Meta:** visualização em tempo real.
- T4.1 Gráfico em tempo real da telemetria.
- T4.2 Indicador online/offline (LWT) e último `seq`.
- T4.3 Controle do atuador pelo dashboard (`/<grupo>/cmd`).
- T4.4 Histórico a partir do SQLite.
**Critério:** apertar o botão/variar o sensor reflete no dashboard em < 2 s.
**Entrega:** print/vídeo do dashboard. **Tag:** `v0.4.0`.

### M5 — Camada Blockchain (integridade)
**Meta:** provar que os dados não foram adulterados.
- T5.1 Serviço `anchor`: agrupar leituras em lotes (por N leituras ou T minutos).
- T5.2 Calcular Merkle root do lote e registrar on-chain na testnet (metadata/tx/evento de contrato).
- T5.3 Salvar `tx_hash` e `merkle_root` por lote no SQLite.
- T5.4 Endpoint/tela de verificação: recalcular root do lote e comparar com o on-chain.
- T5.5 Demonstração de adulteração: alterar 1 linha no banco → verificação falha.
**Critério:** lote ancorado visível no explorer; verificação positiva e negativa funcionando.
**Entrega:** link do explorer + print das duas verificações. **Tag:** `v0.5.0`.

### M6 — Fechamento e apresentação
**Meta:** pronto para avaliação.
- T6.1 README final: como rodar cada parte (passo a passo).
- T6.2 Diagrama de arquitetura final + justificativa das decisões FreeRTOS (prioridades, stacks, núcleos).
- T6.3 Roteiro de demo (5 min) e checklist pré-apresentação.
- T6.4 Revisão de segredos no histórico do git.
**Entrega:** demo ensaiada. **Tag:** `v1.0.0`.

---

## 7. Protocolo de sessão do Claude Code

Ao iniciar:
1. Ler `CLAUDE.md` e `TASKS.md`.
2. Dizer em qual marco o projeto está e qual a próxima task `todo` desbloqueada.
3. Aguardar confirmação antes de começar (ou seguir se o pedido já indicar a task).

Durante:
- Trabalhar **uma task por vez**, na branch dela.
- Rodar `pio run` (firmware) e/ou `npm test` (backend) antes de declarar pronto.
- Não alterar arquivos fora do escopo da task sem avisar.

Ao terminar:
- Atualizar status em `TASKS.md`.
- Commitar conforme seção 5.
- Responder com: **o que mudou · como validar · próxima task sugerida** (máx. 5 linhas).

---

## 8. Proibido

- Commitar credenciais, mnemônicos ou chaves privadas.
- Usar mainnet ou gastar fundos reais.
- `delay()`, `Serial.print` ou lógica pesada dentro de ISR.
- Pular marco (ex.: blockchain antes da ingestão estar persistindo).
- Apagar evidências de entregas anteriores.
- Marcar task como `done` sem evidência.
