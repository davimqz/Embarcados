# Embarcados

Sistema IoT com ESP32 + FreeRTOS que publica leituras de sensor via MQTT, persiste os
dados e ancora lotes numa testnet blockchain para provar que não foram adulterados.

**Fluxo:** ESP32 (FreeRTOS) → broker MQTT → `ingest` (SQLite) → `dashboard`
· `anchor` (Merkle root on-chain)

## Integrantes

| Nome | GitHub |
|---|---|
| Davi Marques Oliveira | [@davimqz](https://github.com/davimqz) |
| _a preencher_ | |

## Estrutura

```
firmware/          projeto PlatformIO do ESP32 (pio run aqui dentro)
backend/ingest/    serviço que assina o broker, valida e persiste
backend/anchor/    serviço que agrupa leituras e registra a Merkle root on-chain
dashboard/         visualização em tempo real e verificação de integridade
docs/decisoes/     ADRs (registros de decisão)
docs/entregas/     evidências de cada marco (M0–M6)
```

## Como trabalhar

- Backlog e marco atual: [TASKS.md](TASKS.md)
- Regras de [tasks](docs/regras/tasks.md) · [commits](docs/regras/commits.md) · [marcos](docs/regras/marcos.md)
- Template de commit: `git config commit.template .gitmessage`

## Firmware

```sh
cd firmware
pio run            # compila
pio run -t upload  # grava no ESP32
pio device monitor # log serial
```
