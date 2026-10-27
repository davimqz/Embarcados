# Backend do silo

Node.js 24 + TypeScript. O Node roda os `.ts` direto (remove os tipos), sem etapa de compilação; `npm run build` só
checa os tipos.

| Pasta | O que é | Task |
|---|---|---|
| `comum/` | Configuração (`.env`) e nomes dos tópicos | T3.0 |
| `broker/` | Broker MQTT de desenvolvimento (aedes), para não precisar instalar o Mosquitto | T3.0 |
| `simulador/` | Simulador da placa: publica o mesmo que o firmware do M2 | T3.0 |
| `ingest/` | Serviço de ingestão: assina, valida e grava no SQLite | T3.1–T3.3 |
| `anchor/` | Serviço de ancoragem na Cardano Preprod | M5 |

## Como rodar

```sh
cd backend
npm install
cp .env.example .env      # opcional: sem .env valem os padrões (broker em localhost:1883)

npm run broker            # terminal 1: broker local, mostra cada mensagem publicada
npm run simulador         # terminal 2: a "placa"
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
