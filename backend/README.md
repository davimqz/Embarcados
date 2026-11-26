# Backend do silo

Node.js 24 + TypeScript. O Node roda os `.ts` direto (remove os tipos), sem etapa de compilação; `npm run build` só
checa os tipos.

| Pasta | O que é | Task |
|---|---|---|
| `comum/` | Configuração (`.env`) e nomes dos tópicos | T3.0 |
| `broker/` | Broker MQTT de desenvolvimento (aedes), para não precisar instalar o Mosquitto | T3.0 |
| `simulador/` | Simulador da placa: publica o mesmo que o firmware do M2 | T3.0 |
| `ingest/` | Servidor do painel (MQTT → WebSocket/REST, T4.6), validação do contrato (`contrato.ts`, T3.1); depois, SQLite | T4.6, T3.1–T3.3 |
| `anchor/` | Serviço de ancoragem na Cardano Preprod | M5 |

## Como rodar

```sh
cd backend
npm install
cp .env.example .env      # opcional: sem .env valem os padrões (broker em localhost:1883)

npm run broker            # terminal 1: broker local, mostra cada mensagem publicada
npm run simulador         # terminal 2: a "placa"
```

## Servidor do painel (frontend com dados reais)

```sh
npm run servidor          # assina o broker do .env e serve o painel em http://localhost:3000
npm test                  # testes do validador do contrato e do arquivo em memória
```

O `servidor` (`ingest/servidor.ts`) assina os cinco tópicos da placa (`grupo3/status`, `grupo3/telemetria`,
`grupo3/silo/evento`, `grupo3/alerta` e `grupo3/ventilacao`) e valida cada payload contra o contrato
(`ingest/contrato.ts`, campo a campo, conforme `docs/topicos-mqtt.md`). Payload fora do contrato (JSON inválido, campo
faltando, tipo ou valor errado) é **rejeitado** e aparece no log com o motivo. As mensagens válidas dos quatro tópicos
que o painel mostra são repassadas como `{ topico, payload }`, com o payload sem alteração; `grupo3/ventilacao` é
validado, mas não vai ao painel (decisão 14 em `docs/decisoes-pendentes.md`). Se o broker cair, o servidor tenta
reconectar a cada 3 s:

| Rota | O que faz |
|---|---|
| `ws://localhost:3000/ws` | Ao conectar, manda as mensagens dos últimos 10 min (mais o último status e alerta); depois, cada mensagem nova |
| `GET /api/mensagens?desde=&ate=&topicos=a,b` | Histórico por período (`ts` em segundos UTC; mensagem com `ts: null` usa a hora de chegada) |
| `GET /api/saude` | Broker, conexão, total de mensagens guardadas e painéis abertos |

As mensagens ficam **só em memória** (até 20 000, ~24 h): ao reiniciar o servidor, o histórico some. O SQLite entra
na T3.2, neste mesmo serviço.

Com a placa real, o `.env` aponta para o mesmo broker do `config.h` do firmware:

```sh
MQTT_URL=mqtt://broker.hivemq.com:1883
```

No terminal do simulador, as teclas mudam o silo: `a`/`e` aquecer/esfriar, `u`/`s` umedecer/secar, `1`/`2` botão de
entrada/saída e `q` sair (o broker publica o `offline` pelo LWT, como numa placa desligada).

Opções do simulador (depois de `--`):

| Opção | Padrão | Efeito |
|---|---|---|
| `--intervalo <ms>` | 5000 | Intervalo da telemetria |
| `--device <id>` | `esp32-grupo3-sim0001` | `device_id` |
| `--perda <0..1>` | 0 | Chance de não publicar uma mensagem (buraco no `seq`) |
| `--repeticao <0..1>` | 0 | Chance de publicar a mesma mensagem duas vezes |
| `--falha-sensor <0..1>` | 0 | Chance de uma leitura sair com `null` |
| `--sem-botoes` | — | Desliga os apertos automáticos de botão |

Exemplo, para testar a detecção de `seq` (T3.3):

```sh
npm run simulador -- --intervalo 1000 --perda 0.1 --repeticao 0.1
```

Para mandar um comando à placa (simulada ou real), publique em `grupo3/cmd` conforme `docs/topicos-mqtt.md`.

## O simulador e a placa

O simulador existe porque o M3 foi adiantado antes de o protótipo ser montado (exceção registrada no `TASKS.md`,
seção M3). Ele segue o contrato de `docs/topicos-mqtt.md` e repete as regras do firmware (limiar com histerese,
validação de comandos, `seq` por tópico). Se os dois divergirem, vale o contrato.

Para usar a placa real, basta não rodar o simulador e apontar o `config.h` do firmware para o mesmo broker.
