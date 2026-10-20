# Contrato de tópicos MQTT

Todo tópico ou payload novo é registrado aqui antes de ser implementado.

## `grupo3/silo/evento`

Publicado pelo ESP32 a cada lote que entra ou sai do silo (botão amarelo = entrada, vermelho = saída).

- **Direção:** ESP32 → broker
- **QoS:** 0 · **Retain:** não
- **Payload:** JSON

```json
{
  "device_id": "esp32-grupo3-a1b2c3d4",
  "ts": 1792500000,
  "seq": 7,
  "evento": "ENTRADA",
  "entradas": 5,
  "saidas": 2,
  "saldo": 3
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | `esp32-grupo3-` + MAC da placa em hexadecimal. Fixo por placa. |
| `ts` | inteiro \| `null` | Momento do aperto, em segundos Unix (UTC), via NTP. `null` se o relógio ainda não sincronizou. |
| `seq` | inteiro | Número do evento desde o boot, começando em 1. Volta a 1 no reboot: um `seq` menor que o anterior indica reinício da placa. |
| `evento` | string | `"ENTRADA"` ou `"SAIDA"`. |
| `entradas` | inteiro | Total de entradas desde o boot. |
| `saidas` | inteiro | Total de saídas desde o boot. |
| `saldo` | inteiro | `entradas - saidas`. Pode ser negativo. |

Os contadores são voláteis e zeram no reboot. A fonte de verdade para o saldo histórico são os eventos.

## `grupo3/status`

Diz se o ESP32 está conectado ao broker. É retido, então quem assina recebe o estado atual na hora.

- **Direção:** ESP32 → broker (o `offline` é publicado pelo próprio broker, como LWT)
- **QoS:** 1 · **Retain:** sim
- **Payload:** JSON

```json
{"device_id": "esp32-grupo3-a1b2c3d4", "status": "online"}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | Mesmo valor de `grupo3/silo/evento`. |
| `status` | string | `"online"`: publicado pelo ESP32 logo após conectar. `"offline"`: LWT, publicado pelo broker quando a conexão cai sem aviso. |

Com keep-alive de 15 s, o broker publica o `offline` entre 15 s e 25 s depois de a placa sumir.
Não tem `ts` nem `seq`: o LWT é fixado no momento da conexão e não pode carregar o horário da queda.

## `/botao/status` (legado — descontinuado)

Tópico da AP02. Deixou de ser publicado com a migração para `grupo3/silo/evento`.
