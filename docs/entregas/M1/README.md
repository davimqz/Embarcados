# Entrega M1 — Firmware base robusto (`v0.1.0`)

Fechado em 2026-10-20.

## O que foi feito

O firmware do ESP32 conta a entrada e a saída de lotes do silo com dois botões. Ele mantém o padrão
ISR → semáforo → task → fila → task de comunicação e publica cada evento em JSON via MQTT.

| Task | Entrega |
|---|---|
| T1.5 | Dois botões (amarelo GPIO 19 = entrada, vermelho GPIO 21 = saída), uma `TaskBotao` por botão, filtro de ruído de 50 ms |
| T1.2 | Payload JSON em `grupo3/silo/evento` com `device_id`, `ts`, `seq`, `evento` e contadores (ArduinoJson) |
| T1.4 | Horário via NTP (UTC); `ts` marcado no momento do aperto; `null` até sincronizar |
| T1.3 | Reconexão Wi-Fi/MQTT sem travar a task; evento só sai da fila depois de publicado; `online`/`offline` (LWT) retido em `grupo3/status` |
| T1.1 | Código dividido em `botao.*`, `wifi_mqtt.*`, `log_serial.*` e `main.cpp` |

**Critério do marco:** a conexão com o broker cai, a placa reconecta sozinha sem reset e o LWT aparece no broker. ✅

## Como reproduzir

1. `cd firmware && cp include/config.example.h include/config.h` e preencher Wi-Fi e broker.
2. `pio run -t upload` (segurar **BOOT** durante `Connecting...`) e `pio device monitor`.
3. Assinar o broker: `mosquitto_sub -h test.mosquitto.org -t 'grupo3/#' -v`.
4. Apertar 3× amarelo e 3× vermelho → `seq` de 1 a 6 e `saldo:0`.
5. Tirar o cabo USB → ~22 s depois o broker publica `{"status":"offline"}` em `grupo3/status`.

## Evidências

| Arquivo | Mostra |
|---|---|
| [`t1.2-t1.4-json-ntp.log`](t1.2-t1.4-json-ntp.log) | 3 entradas + 3 saídas, JSON com `ts` válido |
| [`t1.3-reconexao-lwt.log`](t1.3-reconexao-lwt.log) | Queda simulada, reconexão, `online`/`offline` e LWT ao desligar a placa |
| [`t1.1-modularizacao.log`](t1.1-modularizacao.log) | Mesmo teste com o firmware modularizado; eventos que esperaram o broker na fila |

## Limitações conhecidas

- Broker público `test.mosquitto.org` (ver `docs/decisoes-pendentes.md`, item 6).
- Os contadores voltam a zero no reboot (item 8).
- O upload exige segurar o botão BOOT.
