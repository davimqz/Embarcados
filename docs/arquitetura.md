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
| 1 | LED RGB 5 mm, cátodo comum (só o canal vermelho) | Alerta local de temperatura/umidade |
| 1 | LED RGB 5 mm, cátodo comum (só o canal azul ou verde) | Ventilação do silo (comando remoto, sempre manual) |
| 1 | Resistor 220 Ω | Canal vermelho do LED de alerta |
| 1 | Resistor 100 Ω | Canal azul/verde do LED de ventilação (com 220 Ω ele fica fraco a 3,3 V) |
| 2 | Resistor 1 kΩ + 2 kΩ (ou 1 kΩ + 2 × 1 kΩ em série) | Divisor de tensão do ECHO do HC-SR04 |
| 1 | Protoboard de 400 pontos (com trilhos de alimentação) | ESP32 encaixado nela + resistores. Um trilho com 3,3 V (DHT11) e o outro com 5 V do VIN (HC-SR04) |
| — | Jumpers | Ligações até os sensores, LEDs e botões, que ficam no corpo e na tampa do silo |

Ficam de fora: TCRT5000 (reserva) e potenciômetro. A escotilha **abre com a mão** e não tem eletrônica.

### Pinagem

| Componente | Pino do componente | Liga em |
|---|---|---|
| Botão entrada (amarelo) | um lado / outro lado | GPIO 19 / GND (`INPUT_PULLUP`) |
| Botão saída (vermelho) | um lado / outro lado | GPIO 21 / GND (`INPUT_PULLUP`) |
| DHT11 | VCC · DATA · GND | 3V3 · **GPIO 4** · GND |
| HC-SR04 | VCC · TRIG · ECHO · GND | **VIN (5 V)** · **GPIO 26** · divisor → **GPIO 27** · GND |
| LED alerta (RGB) | perna R · perna mais longa (cátodo) | **GPIO 22** → 220 Ω → R · cátodo → GND · G e B sem ligação |
| LED ventilação (RGB) | perna B (ou G) · perna mais longa (cátodo) | **GPIO 23** → 100 Ω → B · cátodo → GND · R e G sem ligação |

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

> **Medidas dos anúncios da Casa da Robótica, onde o grupo comprou as peças; o que o anúncio não informa usa a medida
> padrão do modelo mais comum** (marcado como "padrão"; o HC-SR04, a protoboard e a placa do ESP32 não têm medida no anúncio). Como
> podem variar ±1 mm entre fabricantes, o modelo usa folgas maiores que o normal: **+0,5 mm em furos** e **+1 mm em
> bolsos e encaixes**. Antes de imprimir o silo, imprimir uma **plaquinha de teste** (~10 min) com os furos do HC-SR04,
> de um LED e de um botão, e conferir com as peças reais.

| Peça | Medida adotada (mm) | Furo / bolso no modelo (mm) | Observação |
|---|---|---|---|
| ESP32 DevKit V1 (30 pinos, micro-USB — anúncio) | Placa 51,5 × 28,3 · altura 13 (pinos embaixo + módulo em cima) · micro-USB centralizado num lado curto | Bolso 52,5 × 29,3 · abertura do USB 12 × 8 | Sem furos de fixação: prender por trilho ou bolso. Deixar acesso aos botões BOOT/EN, ao lado do USB |
| HC-SR04 | Placa 45 × 20 × 1,6 · transdutores Ø16, 12 de altura, centros a 26 · 4 pinos num lado longo | 2 furos Ø16,5 com centros a 26 · rebaixo 46 × 21 para a placa | Os transdutores atravessam a tampa virados para baixo; os pinos ficam para cima, dentro da capa |
| DHT11 (módulo, com cabos) | **23 × 12 × 5 com terminais (anúncio)** | Bolso 24 × 13 × 6 · janela 16 × 12,5 na frente do sensor | Janela ou grade para o ar do silo chegar no sensor. Se a peça real tiver plaquinha maior (~32 × 14), aumentar o bolso para 33 × 15 |
| Protoboard 400 pontos | 82 × 55 × 8,5 (padrão) | Bolso 83 × 56 | Fica na base com o ESP32 encaixado nela, o USB virado para a parede da base |
| Botão táctil 12 × 12 com capa (kit KP25) | **Corpo 12 × 12 × 7 (anúncio)** · capa Ø11,5 e altura total ~13 (padrão, o anúncio não informa) | Furo Ø12,5 para a capa | Fica por dentro da parede, só a capa aparece |
| LED RGB 5 mm, 4 pernas | **Ø5 (anúncio)** · aba Ø5,8 · altura 8,6 (padrão) | Furo Ø5,5 | A aba segura o LED por dentro; prever espaço atrás para as 4 pernas |
| Jumper (conector) | +12 de altura acima do pino | — | Somar em toda peça com jumper encaixado |

### Restrições do silo

Modelo pronto em [`hardware/silo-3d/`](../hardware/silo-3d/) (T0.7): STLs, script paramétrico e instruções de
impressão e montagem.

- **Volume da impressora: 12 × 12 × 12 cm.** O silo foi dividido em peças que cabem nesse cubo:

  | Peça | Medida externa | Conteúdo |
  |---|---|---|
  | Base + tampa da base | 112 × 112 × 45 + 7 mm | Protoboard com o ESP32 (altura interna de ~40 mm); **botões e LEDs no painel da frente**; USB na lateral |
  | Corpo do silo | Ø104 × 112 mm (parede de 2 mm) | Grão; escotilha de entrada (em cima) e de saída (embaixo), deslizantes; conduíte externo para os fios |
  | Tampa do silo + capa | Ø104 × 8 mm + 57 × 52 × 17 mm | HC-SR04 com os transdutores atravessando a tampa; DHT11 num bolso embaixo da tampa |

  Montado, o silo fica com ~18 cm de altura. Botões e LEDs ficaram na base, e não no corpo, para os fios não passarem
  pelo grão.
- **Passagem dos fios:** HC-SR04 (4 fios) e DHT11 (3 fios) descem por um conduíte (Ø8 por dentro) atrás do corpo até a
  base.
- **HC-SR04 na tampa, apontando para baixo.** Ele não mede a menos de ~2–3 cm: o grão cheio precisa ficar pelo menos 3 cm
  abaixo dos transdutores. Sobram **~8 cm de coluna útil de grão**. O HC-SR04 tem resolução de ~3 mm, o que dá ~25
  níveis distintos, suficiente para mostrar o nível em % no dashboard. O feixe abre ~15°: com 10 cm de diâmetro interno
  e ~11 cm de altura, o som não bate na parede.
- **DHT11 embaixo da tampa**, virado para dentro do silo, acima do grão e longe do ESP32 (que esquenta).
- **Escotilhas manuais.** Sem sensor nem atuador; os botões registram a entrada e a saída de cada lote.

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
