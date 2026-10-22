# Arquitetura

> Tema: controle de lotes de um **silo de grãos**. Decisões de origem em [`decisoes-pendentes.md`](decisoes-pendentes.md)
> (itens 1–5), [ADR 0001](decisoes/0001-rede-blockchain.md) e [ADR 0002](decisoes/0002-dashboard.md).
> Contrato MQTT em [`topicos-mqtt.md`](topicos-mqtt.md).

## 1. Visão geral

```
                    ┌──────────────────────── ESP32 DevKit V1 ────────────────────────┐
 Botão entrada ─ISR─┤→ semáforo → TaskBotaoEntrada ─┐                                 │
 Botão saída   ─ISR─┤→ semáforo → TaskBotaoSaida  ──┼→ fila ─┐                        │
 DHT11 + HC-SR04 ───┤→ TaskSensores (5 s) ──────────┘        ├→ TaskComunicacao ──────┼─ Wi-Fi / MQTT
 LED alerta     ◄───┤← limiar (notify)                       │   (publica e assina)   │
 LED ventilação ◄───┤← TaskAtuador ← fila de comandos ◄──────┘                        │
                    └─────────────────────────────────────────────────────────────────┘
                                                    │ MQTT 1883
                                                    ▼
                                         Broker (Mosquitto)
                          ┌─────────────────────────┼──────────────────────────┐
                          ▼                         ▼                          ▼
                  Backend ingest            Dashboard web               Backend anchor
                  (valida + SQLite)         (via WebSocket do backend)  (lote → Merkle root → tx)
                          │                                                    │
                          ▼                                                    ▼
                       SQLite  ◄──────────── tx_hash por lote ───────── Cardano Preprod
```

A parte do ESP32 que já existe (M1) são os botões, a fila e a `TaskComunicacao`. Sensores, alerta e atuador entram no M2
seguindo o mesmo padrão: **ISR/periódico → task → fila → TaskComunicacao**.

## 2. Hardware

### Componentes

| Qtd | Componente | Papel no silo |
|---|---|---|
| 1 | ESP32 DevKit V1 (módulo ESP-WROOM-32, 30 pinos) | Controlador |
| 1 | DHT11 (módulo de 3 pinos) | Temperatura e umidade do grão |
| 1 | HC-SR04 | Nível de grão (distância do topo até a superfície) |
| 2 | Botão táctil | Amarelo = entrada de lote · vermelho = saída de lote |
| 1 | LED vermelho | Alerta local de temperatura/umidade |
| 1 | LED verde ou azul | Ventilação do silo (comando remoto, sempre manual) |
| 2 | Resistor 220–330 Ω | Limitar a corrente dos LEDs |
| 2 | Resistor 1 kΩ + 2 kΩ (ou 1 kΩ + 2 × 1 kΩ em série) | Divisor de tensão do ECHO do HC-SR04 |
| — | Protoboard, jumpers | Montagem |

Ficam de fora: TCRT5000 (reserva) e potenciômetro. A escotilha **abre com a mão** e não tem eletrônica.

### Pinagem

| Componente | Pino do componente | Liga em |
|---|---|---|
| Botão entrada (amarelo) | um lado / outro lado | GPIO 19 / GND (`INPUT_PULLUP`) |
| Botão saída (vermelho) | um lado / outro lado | GPIO 21 / GND (`INPUT_PULLUP`) |
| DHT11 | VCC · DATA · GND | 3V3 · **GPIO 4** · GND |
| HC-SR04 | VCC · TRIG · ECHO · GND | **VIN (5 V)** · **GPIO 26** · divisor → **GPIO 27** · GND |
| LED alerta | ânodo (perna longa) | **GPIO 22** → resistor 220–330 Ω → LED → GND |
| LED ventilação | ânodo (perna longa) | **GPIO 23** → resistor 220–330 Ω → LED → GND |

**Divisor do ECHO** (o HC-SR04 responde com 5 V e o ESP32 aceita até 3,3 V):

```
ECHO ──[ 1 kΩ ]──┬── GPIO 27
                 │
              [ 2 kΩ ]
                 │
                GND          → 5 V × 2/3 ≈ 3,3 V
```

O VIN só tem 5 V com a placa ligada pelo USB. Todos os GND são comuns.
Pinos a evitar: 0, 2, 5, 12 e 15 (boot), 6–11 (flash), 1 e 3 (Serial), 34–39 (só entrada).

## 3. Medidas para a impressão 3D

> **Valores nominais dos modelos mais comuns. Meça cada peça com paquímetro antes de modelar** e registre a medida real
> na coluna "Medido". Folga sugerida para furos e encaixes: +0,3 a 0,5 mm.

| Peça | Nominal (mm) | Medido (mm) | Observação |
|---|---|---|---|
| ESP32 DevKit V1 (30 pinos) | 51,5 × 28,3 · ~13 de altura com os pinos | _a medir_ | Micro-USB num dos lados curtos: deixar passagem para o cabo e acesso aos botões BOOT/EN. Normalmente não tem furos de fixação: prender com trilho ou bolso |
| HC-SR04 | Placa 45 × 20 · transdutores Ø16, ~12 de altura, centros a ~26 | _a medir_ | Os transdutores atravessam a tampa: furos de Ø16 + folga |
| DHT11 (módulo) | Placa ~28–32 × 12–14 · sensor 15,5 × 12 × 5,5 | _a medir_ | Alguns módulos têm furo de Ø3 para parafuso |
| LED 5 mm | Corpo Ø5 · aba Ø5,8 · ~8,6 de altura | _a medir_ | Furo do tamanho do corpo (Ø5 + folga), a aba segura |
| Botão táctil | 6 × 6 ou 12 × 12 | _a medir_ | Confirmar qual modelo e a altura da haste |
| Protoboard | 170 pontos ~47 × 35 × 8,5 · 400 pontos ~82 × 55 × 8,5 | _a medir_ | Confirmar qual vai na base |

### Restrições do silo

- **Mesa da impressora: 12 × 12 cm.** Silo cilíndrico com diâmetro externo de até ~11,5 cm (parede de 2 mm → ~11 cm por
  dentro). Se precisar de mais altura que a impressora permite, imprimir em anéis encaixados.
- **HC-SR04 na tampa, apontando para baixo.** Ele não mede a menos de ~2–3 cm: o grão cheio precisa ficar pelo menos 3 cm
  abaixo dos transdutores. O feixe abre ~15°: com ~11 cm de diâmetro interno e até ~20 cm de altura, o som não bate na
  parede. Parede interna lisa ajuda.
- **DHT11 dentro do silo, na parte de cima**, com furos ou grade na frente do sensor e longe do ESP32 (que esquenta).
- **ESP32 e protoboard numa base separada do grão**, com acesso ao USB para gravar e alimentar.
- **LEDs e botões na face externa**, visíveis na demo.
- **Escotilha manual.** Sem sensor nem atuador; os botões registram a entrada e a saída de cada lote.

## 4. Tasks FreeRTOS

| Task | Núcleo | Prioridade | Stack | Situação | Função |
|---|---|---|---|---|---|
| `TaskBotaoEntrada` | 1 | 2 | 3072 | ✅ M1 | Espera o semáforo da ISR do GPIO 19, confirma o aperto e põe o evento na fila |
| `TaskBotaoSaida` | 1 | 2 | 3072 | ✅ M1 | Idem, GPIO 21 |
| `TaskComunicacao` | 0 | 1 | 8192 | ✅ M1 | Wi-Fi, MQTT, LWT, NTP; tira da fila e publica; vai assinar `grupo3/cmd` |
| `TaskSensores` | 1 | a definir na T2.1 | a definir | M2 (T2.1/T2.2) | A cada 5 s lê o DHT11 e o HC-SR04 e põe a leitura na fila de telemetria |
| alerta por limiar | — | — | — | M2 (T2.3) | Ao cruzar 30 °C / 70% (volta em 28 °C / 65%), avisa por notify, acende o LED vermelho e gera o evento de alerta |
| `TaskAtuador` | 1 | a definir na T2.4 | a definir | M2 (T2.4) | Recebe da `TaskComunicacao`, por fila, o comando de `grupo3/cmd`, aciona o LED de ventilação e confirma o estado |

As prioridades, stacks e a divisão entre tasks do M2 são fixadas e justificadas em cada task, ao implementar. Os
botões ficam acima da comunicação para não perder apertos enquanto a rede reconecta.

## 5. Tópicos MQTT

| Tópico | Direção | Situação |
|---|---|---|
| `grupo3/silo/evento` | ESP32 → broker | ✅ M1 |
| `grupo3/status` (LWT) | ESP32/broker → assinantes | ✅ M1 |
| `grupo3/telemetria` | ESP32 → broker | M2: payload a registrar na T0.6 |
| `grupo3/cmd` | dashboard/backend → ESP32 | M2: payload a registrar antes da T2.4 |

Detalhes e exemplos em [`topicos-mqtt.md`](topicos-mqtt.md).
