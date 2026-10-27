# Contrato de tópicos MQTT

Todo tópico ou payload novo é registrado aqui antes de ser implementado.

## Resumo

| Tópico | Direção | QoS | Retain | Situação |
|---|---|---|---|---|
| `grupo3/silo/evento` | ESP32 → broker | 0 | não | ✅ M1 |
| `grupo3/status` | ESP32 / broker (LWT) → assinantes | 1 | sim | ✅ M1 |
| `grupo3/telemetria` | ESP32 → broker | 0 | não | M2 (T2.2), falta testar na placa |
| `grupo3/alerta` | ESP32 → broker | 0 | sim | M2 (T2.3), falta testar na placa |
| `grupo3/cmd` | backend → ESP32 | 1 | não | M2 (T2.4) |
| `grupo3/ventilacao` | ESP32 → broker | 0 | sim | M2 (T2.4) |

**Regras comuns:**

- Todo payload é JSON com `device_id`, `ts` e `seq`, exceto `grupo3/status` (motivo na seção dele).
- `device_id` é `esp32-grupo3-` + MAC da placa em hexadecimal.
- `ts` está em segundos Unix (UTC), via NTP, e vai como `null` enquanto o relógio não sincronizou.
- **Cada tópico tem o seu próprio `seq`**, que começa em 1 no boot e sobe de 1 em 1. Um buraco no `seq` de um tópico
  indica mensagem perdida. Um `seq` menor que o anterior indica que a placa reiniciou.
- O PubSubClient só publica com QoS 0. O QoS 1 da tabela vale para o LWT (`grupo3/status`) e para a assinatura de
  `grupo3/cmd`.

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

## `grupo3/telemetria`

Leitura periódica do silo: temperatura e umidade (DHT11) e nível de grão (HC-SR04). Publicada a cada 5 s.

- **Direção:** ESP32 → broker
- **QoS:** 0 · **Retain:** não
- **Payload:** JSON

```json
{
  "device_id": "esp32-grupo3-a1b2c3d4",
  "ts": 1792500005,
  "seq": 42,
  "temperatura": 27,
  "umidade": 61,
  "distancia_cm": 5.8,
  "nivel_pct": 62
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | Mesmo valor de `grupo3/silo/evento`. |
| `ts` | inteiro \| `null` | Momento da leitura (não o da publicação). |
| `seq` | inteiro | Número da leitura desde o boot. Sobe mesmo quando um sensor falha, para que só a perda de mensagem crie buraco. |
| `temperatura` | inteiro \| `null` | °C. O DHT11 tem passo de 1 °C e precisão de ±2 °C. `null` se a leitura falhou. |
| `umidade` | inteiro \| `null` | Umidade relativa em %. `null` se a leitura falhou. |
| `distancia_cm` | número \| `null` | Distância do HC-SR04 (na tampa) até a superfície do grão, com 1 casa decimal. `null` se o eco não voltou (timeout) ou está fora da faixa do sensor. |
| `nivel_pct` | inteiro \| `null` | Nível de grão de 0 (vazio) a 100 (cheio), calculado pela placa a partir de `distancia_cm` e das distâncias de silo vazio e cheio do `config.h`. Limitado a 0–100. `null` quando `distancia_cm` é `null`. |

A medida bruta (`distancia_cm`) vai junto com o nível para que o backend possa recalcular o nível se a calibração
mudar. O nível de grão (este tópico) e o saldo de lotes (`grupo3/silo/evento`) são medidas independentes: a placa
não cruza uma com a outra.

## `grupo3/alerta`

Mudança no estado do alerta de temperatura/umidade do silo. A placa acende o LED vermelho por conta própria, mesmo
sem rede, e publica neste tópico **só quando o estado muda**. É retido, então quem assina recebe o estado atual na hora.

- **Direção:** ESP32 → broker
- **QoS:** 0 · **Retain:** sim
- **Payload:** JSON

```json
{
  "device_id": "esp32-grupo3-a1b2c3d4",
  "ts": 1792500040,
  "seq": 3,
  "alerta": "ATIVO",
  "motivos": ["TEMPERATURA"],
  "temperatura": 31,
  "umidade": 64
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | Mesmo valor de `grupo3/silo/evento`. |
| `ts` | inteiro \| `null` | Momento da leitura que mudou o estado. |
| `seq` | inteiro | Número da mudança de estado desde o boot. |
| `alerta` | string | `"ATIVO"` ou `"NORMAL"`. |
| `motivos` | array de string | Limiares ultrapassados nessa leitura: `"TEMPERATURA"` e/ou `"UMIDADE"`. Vazio quando `alerta` é `"NORMAL"`. |
| `temperatura` | inteiro \| `null` | °C da leitura que mudou o estado. |
| `umidade` | inteiro \| `null` | % da leitura que mudou o estado. |

**Regra do limiar** (decisão 5 de [`decisoes-pendentes.md`](decisoes-pendentes.md)):

- Passa para `ATIVO` quando **temperatura > 30 °C ou umidade > 70%**.
- Volta para `NORMAL` só quando **temperatura < 28 °C e umidade < 65%**. A diferença (histerese) evita que o alerta
  fique ligando e desligando perto do limite.
- Leitura com falha (`null`) não muda o estado.
- Depois do boot, a placa publica o estado já na **primeira leitura válida** do DHT11 (`seq: 1`), mesmo que seja
  `NORMAL`. Assim, um alerta retido de antes do reboot é substituído logo.

## `grupo3/cmd`

Comando remoto para a placa. Hoje o único comando é ligar/desligar o LED de ventilação, que fica **sempre em manual**:
a placa nunca liga a ventilação sozinha (decisão 2).

- **Direção:** backend → ESP32 (o dashboard pede ao backend, e o backend publica)
- **QoS:** 1 (assinatura da placa) · **Retain:** não
- **Payload:** JSON

```json
{
  "device_id": "esp32-grupo3-a1b2c3d4",
  "ts": 1792500100,
  "seq": 5,
  "comando": "VENTILACAO",
  "valor": "LIGAR"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | Placa de destino. A placa ignora comandos com `device_id` diferente do seu. O backend descobre o valor por `grupo3/status`. |
| `ts` | inteiro | Momento em que o backend emitiu o comando. |
| `seq` | inteiro | Número do comando gerado pelo backend. Volta como `cmd_seq` em `grupo3/ventilacao`, para confirmar a execução. |
| `comando` | string | `"VENTILACAO"`. |
| `valor` | string | `"LIGAR"` ou `"DESLIGAR"`. |

A placa descarta, sem executar, um payload que não seja JSON válido ou que tenha `comando` ou `valor` desconhecido, e
registra o motivo no log serial. Sem retain, um comando antigo não é reaplicado quando a placa reinicia: a ventilação
sempre começa desligada.

## `grupo3/ventilacao`

Estado atual do LED de ventilação. É a confirmação de que um comando de `grupo3/cmd` foi executado. É retido.

- **Direção:** ESP32 → broker
- **QoS:** 0 · **Retain:** sim
- **Payload:** JSON

```json
{
  "device_id": "esp32-grupo3-a1b2c3d4",
  "ts": 1792500101,
  "seq": 2,
  "ventilacao": "LIGADA",
  "cmd_seq": 5
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | string | Mesmo valor de `grupo3/silo/evento`. |
| `ts` | inteiro \| `null` | Momento em que o LED mudou. |
| `seq` | inteiro | Número da mudança de estado desde o boot. |
| `ventilacao` | string | `"LIGADA"` ou `"DESLIGADA"`. |
| `cmd_seq` | inteiro \| `null` | `seq` do comando que causou a mudança. `null` na publicação do boot. |

A placa publica `"DESLIGADA"` com `cmd_seq: null` no boot. Depois, publica a cada comando recebido, mesmo que o estado
não mude (ex.: `LIGAR` com o LED já ligado), para que o backend sempre receba a confirmação do `seq` que enviou.

## `/botao/status` (legado — descontinuado)

Tópico da AP02. Deixou de ser publicado com a migração para `grupo3/silo/evento`.
