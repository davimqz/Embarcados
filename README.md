# Projeto Embarcados — IoT + Blockchain

Projeto da disciplina **Sistemas Embarcados** (CESAR School) · Grupo 3.

## Integrantes

| Nome | GitHub |
|---|---|
| Davi Marques Oliveira | [@davimqz](https://github.com/davimqz) |
| _a preencher_ | |

Sistema IoT com **ESP32 + FreeRTOS + MQTT + dashboard**, com uma camada de **blockchain**
(testnet) que ancora a Merkle root de lotes de telemetria para provar que os dados não
foram adulterados.

```
ESP32 (ISR → semáforo → task → fila → task MQTT)
   │ MQTT
   ▼
Broker ──► Ingestão (valida + SQLite) ──► Ancoragem (Merkle root → testnet)
   └────► Dashboard (tempo real)
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `firmware/` | Projeto PlatformIO do ESP32 |
| `backend/ingest/` | Serviço que assina o broker, valida e persiste em SQLite |
| `backend/anchor/` | Serviço que agrupa leituras em lotes e ancora a Merkle root on-chain |
| `dashboard/` | Flows Node-RED exportados ou app web |
| `docs/arquitetura.md` | Arquitetura e decisões de FreeRTOS |
| `docs/topicos-mqtt.md` | Contrato de tópicos e payloads |
| `docs/decisoes/` | ADRs |
| `docs/entregas/M<x>/` | Evidências de cada marco |

## Como trabalhamos

- **[`CLAUDE.md`](CLAUDE.md)**: regras do projeto (segredos, FreeRTOS, commits, branches, roadmap).
- **[`TASKS.md`](TASKS.md)**: backlog. Nenhum código entra sem uma task.
- Regras detalhadas de [tasks](docs/regras/tasks.md) · [commits](docs/regras/commits.md) · [marcos](docs/regras/marcos.md).
- Commits em Conventional Commits em português, com `Refs: T<marco>.<n>`.
  Template: `git config commit.template .gitmessage`.
- Uma branch por task: `m<x>/t<x>.<n>-slug`.

## Como rodar

### Firmware

Requer [PlatformIO](https://platformio.org/).

```bash
cd firmware
cp include/config.example.h include/config.h   # preencher Wi-Fi e broker
pio run                                        # compilar
pio run -t upload && pio device monitor        # gravar e abrir serial
```

`config.h` está no `.gitignore` e **nunca** deve ser commitado.

### Backend e dashboard

A preencher nos marcos M3–M5.
