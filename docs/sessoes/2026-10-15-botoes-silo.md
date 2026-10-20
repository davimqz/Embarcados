# Sessão 2026-10-15 — Botões de entrada/saída do silo

> Relatório de passagem para retomar o trabalho na próxima sessão.
> Branch: `m1/wip-botoes-silo` (criada a partir da `main` em `d5f0091`). **Não foi feito push.**

## 1. Onde paramos (leia primeiro)

- O firmware em `firmware/src/main.cpp` **compila**, mas a última versão **NÃO foi gravada nem testada** na placa.
  Ela tira a trava de 200 ms da ISR e conta ruído em silêncio (ver §3, decisão 9).
- **Problema aberto de hardware:** o pino **D19 (botão amarelo)** recebe pulsos de ruído contínuos (~5/s ou mais) com o botão solto.
  - Some quando o fio do D19 é desconectado → pino e firmware OK.
  - Continua depois de trocar o botão amarelo por outro e de trocar os botões de lugar → **suspeitos: jumper do D19 ou fileira da protoboard**.
  - Hipótese: acoplamento com o Serial (TX0/RX0 ficam ao lado do D19), já que os pulsos apareciam colados a cada linha `[TESTE]`.
- Próximo teste combinado com o usuário: trocar o jumper do D19 por um curto, mudar a fileira, gravar o firmware novo,
  observar `ruidos: amarelo=` por 10 s em repouso e depois apertar 3× amarelo + 3× vermelho → esperado `entradas=3 saidas=3 saldo=0`.

## 2. O que foi feito, em ordem

| # | Problema | Causa | Resolução |
|---|---|---|---|
| 1 | Upload falhava: `Wrong boot mode detected (0x13)` | Auto-reset da placa não entra em modo download | Segurar **BOOT** durante `Connecting...` (sem mudança de código) |
| 2 | Wi-Fi não conectava | SSID errado no `config.h` (nome de outra rede) | `config.h` atualizado; adicionado log de `WiFi.status()` a cada 5 s |
| 3 | MQTT `Estado: -2` (TCP não abre) | Broker da turma `172.26.113.122:1883` fora do ar — o PC na mesma rede também não alcança (ping e TCP falham) | `MQTT_BROKER` trocado para `test.mosquitto.org` (alcançável pela rede do CESAR) |
| 4 | Usuário tem 2 botões e quer contar entrada/saída de lotes do silo | — | Firmware estendido para 2 botões (ver §3) |
| 5 | LED de energia piscava ao apertar o vermelho; `␀` no serial | Botão vermelho em **curto 3V3–GND** (diagnóstico confirmado pelo professor) | Fiação refeita; pinos trocados para D19/D18 |
| 6 | Linhas do serial se misturando | Tasks de dois núcleos escrevendo no `Serial` ao mesmo tempo | Mutex no Serial (`logSerial()`) |
| 7 | Entradas fantasmas (7 contadas para 3 apertos) | Ruído no D19 (ver §1) | Debounce por confirmação de 50 ms + ignorar os 2 s após o boot |
| 8 | Filtro novo descartava ruído, mas apertos reais se perdiam | Trava de 200 ms dentro da ISR, acionada pelo ruído, engolia o aperto seguinte | Trava removida da ISR (**não testado na placa**) |

Validações feitas na placa (logs colados pelo usuário):
- Wi-Fi conecta (`IP 172.26.64.234`) e publica em `test.mosquitto.org` → `/botao/status`.
- Eventos apertados antes do MQTT conectar ficam na fila e são publicados em ordem depois (nenhum perdido).
- Segurando só o vermelho por 3 s: `D19=1 D18=0` o tempo todo → fiação do vermelho correta.
- Com o fio do D19 removido: zero eventos de ruído.

## 3. Decisões tomadas

1. **Pinos:** amarelo = **GPIO 19** (`BOTAO_ENTRADA_PIN`, ENTRADA), vermelho = **GPIO 18** (`BOTAO_SAIDA_PIN`, SAÍDA).
   Escolha do usuário. Substituiu D18/D5 — o GPIO 5 é strapping pin e foi evitado. GPIO 27 (AP02) não é mais usado.
2. **Botões entre GPIO e GND com `INPUT_PULLUP`**, interrupção em `FALLING`. Sem resistor externo.
3. **Arquitetura preservada** (CLAUDE.md §1): uma ISR genérica (`attachInterruptArg`) + um semáforo binário **por botão**
   + uma instância de `TaskBotao` por botão (struct `Botao` passada como parâmetro) → **mesma fila** → `TaskComunicacao`.
4. **Fila carrega o tipo de evento** (`EVENTO_ENTRADA = 1`, `EVENTO_SAIDA = 2`).
5. **Contadores ficam na `TaskComunicacao`**, a única consumidora da fila, então não precisam de mutex. Zeram no reboot.
6. **Payload** (string, tópico `/botao/status`): `ENTRADA-GRUPO3 entradas=N saidas=M saldo=K` / `SAIDA-GRUPO3 ...`.
7. **Mutex no Serial:** `logSerial(fmt, ...)` monta a linha num buffer de 160 bytes e escreve segurando `xMutexSerial`.
   Mutex (e não semáforo binário) por causa da herança de prioridade. Todo `Serial.print` passa por ela.
8. **Filtros de botão na `TaskBotao`:** `confirmarAperto()` exige LOW contínuo por `CONFIRMA_MS = 50` (amostra a cada 5 ms);
   eventos nos primeiros `IGNORAR_INICIO_MS = 2000` após o fim do `setup()` são descartados; após aperto válido,
   espera soltar + `DEBOUNCE_MS = 200` e drena o semáforo.
9. **ISR sem trava de tempo** (última mudança, não testada): a ISR só dá o semáforo; ruído é descartado na task em < 1 ms
   e contado em `Botao::ruidos`.
10. **Modo diagnóstico** `MODO_TESTE_PINOS 1`: `TaskTestePinos` imprime a cada 1 s `[TESTE] D19=.. D18=.. | ruidos: amarelo=.. vermelho=..`.

## 4. Decisões suspeitas / dívidas — revisar

- **Trabalho fora do processo do CLAUDE.md:** não existe task em `TASKS.md` para isso, nada foi registrado em
  `docs/topicos-mqtt.md` antes de implementar, e o código começou na `main` (agora movido para esta branch).
  O CLAUDE.md não foi lido no início da sessão. → Criar a task (sugestão: tema do silo é decisão da T0.5) e o contrato MQTT.
- **Payload não é JSON** e não tem `device_id`/`ts`/`seq` (CLAUDE.md §3.3). Mantido em string só para testar; a T1.2 resolve.
- **Tópico legado `/botao/status`** reaproveitado para um payload diferente do da AP02 (`ON-GRUPO3`). Quem consumia o legado vai quebrar.
- **Broker público `test.mosquitto.org`** em `config.h`: qualquer pessoa vê/publica no tópico. Voltar para o broker da turma
  (`172.26.113.122`) assim que ele estiver no ar — e confirmar esse IP com os professores.
- **`MODO_TESTE_PINOS 1` ligado.** Desligar (`0`) antes de qualquer entrega.
- **`Botao::ruidos` é lido pela `TaskTestePinos` sem proteção** (escrito por outra task). Só é usado no diagnóstico e a leitura de
  `uint32_t` é atômica no ESP32, mas fere a regra "nunca variável global sem proteção". Remover ou proteger ao fechar o diagnóstico.
- **Ruído do D19 mascarado por software.** Os filtros escondem o sintoma; a causa física ainda não foi achada (§1).
  Considerar pull-up externo de 10 kΩ entre o pino e o 3V3.
- **Filtro de 2 s após o boot** foi colocado porque o D19 ia a LOW logo após o boot; provavelmente é o mesmo ruído.
  Se o hardware for corrigido, avaliar remover.
- **Contadores voláteis:** zeram a cada reboot. Se o saldo do silo precisar sobreviver a reinício, persistir (NVS/Preferences)
  ou deixar o backend (M3) recalcular a partir dos eventos.
- **Arquivos apagados no working tree** (estavam assim antes da sessão, origem desconhecida): `CLAUDE.md`, `TASKS.md`,
  `README.md`, `.gitignore`, `.gitattributes` e `docs/` da raiz. **Não foram incluídos em commit.** Restaurar com
  `git restore CLAUDE.md TASKS.md README.md .gitignore .gitattributes docs/` se não foi intencional.
  Como o `.gitignore` da raiz sumiu, `include/config.h` foi adicionado ao `firmware/.gitignore` para não vazar a senha do Wi-Fi.
- **Upload exige segurar BOOT** sempre. Correção de hardware possível: capacitor de 10 µF entre EN e GND.

## 5. Próximos passos

1. **Hardware:** trocar o jumper do D19, mudar a fileira, afastar o fio do TX0/RX0; se possível, pull-up de 10 kΩ.
2. **Gravar e testar** a versão atual (`pio run -t upload` segurando BOOT; `pio device monitor`).
   Critério: `ruidos: amarelo` estável em repouso; 3×amarelo + 3×vermelho → `entradas=3 saidas=3 saldo=0`.
3. Se o contador de ruído cair para ~1/s com a linha `[TESTE]` a 1 Hz, está confirmado acoplamento com o Serial → tratar o roteamento do fio.
4. Desligar `MODO_TESTE_PINOS` e remover/proteger o contador de ruído.
5. Restaurar (ou confirmar a remoção de) `CLAUDE.md`, `TASKS.md` etc.
6. Criar a task em `TASKS.md` e registrar o contrato em `docs/topicos-mqtt.md`; depois migrar o payload para JSON (T1.2).
7. Voltar `MQTT_BROKER` para o broker da turma quando ele responder.
8. Merge na `main` só com a DoD cumprida.

## 6. Como retomar

- `git switch m1/wip-botoes-silo`
- Ver o diagrama de montagem (D19/D18 → botão → GND): https://claude.ai/artifact/E7Crgsp7Hh5QxvWLsHSrhS
- Para conferir as mensagens no broker: `mosquitto_sub -h test.mosquitto.org -t /botao/status -v`
  (o assinante Python usado na sessão estava numa pasta temporária e não foi salvo).
