# Regras de Marcos

O projeto avança em **marcos** (M0 a M6). Cada marco tem uma meta, um conjunto de tasks,
um critério de saída verificável e termina com **entrega demonstrável**, evidência em
`docs/entregas/M<x>/` e **tag git**.

## Regras

1. **Ordem obrigatória:** nenhum marco é pulado. Task de M<x+1> só vai para `doing` depois
   que o critério de saída de M<x> foi atingido (ex.: nada de blockchain antes da ingestão persistir).
2. **Critério de saída é lei:** o marco só fecha quando o critério foi demonstrado e registrado.
3. **Task nova num marco aberto** é permitida, desde que caiba na meta do marco.
   O que não cabe vai para o marco seguinte.
4. **Uma tag por marco**, criada na `main` no fechamento: `v0.<x>.0` (M6 = `v1.0.0`).
5. **Evidências são permanentes:** nada em `docs/entregas/` é apagado depois do fechamento.

## Checklist de fechamento de marco

- [ ] Todas as tasks do marco em `done` (ou movidas explicitamente para outro marco, com motivo).
- [ ] Critério de saída demonstrado; evidência em `docs/entregas/M<x>/`.
- [ ] `docs/entregas/M<x>/README.md` com resumo: o que foi feito, como reproduzir, lista de evidências.
- [ ] Docs atualizados (README, `arquitetura.md`, `topicos-mqtt.md`).
- [ ] `main` compila e roda a demo do marco.
- [ ] Tag `v0.<x>.0` criada e enviada (ver [commits.md](commits.md#tags)).
- [ ] Seção do marco no `TASKS.md` marcada como **fechada** com a data.

---

## Roadmap

### M0 — Fundação · `v0.0.0`
**Meta:** repositório pronto e decisões travadas.
- T0.1 Criar estrutura de pastas, `.gitignore` e README inicial.
- T0.2 Migrar código da AP02 para `firmware/`, extraindo configs para `config.h` (+ `config.example.h`).
- T0.3 ADR 0001: escolha da testnet blockchain.
- T0.4 ADR 0002: dashboard (Node-RED vs web).
- T0.5 Definir tema/sensor e escrever `docs/arquitetura.md`.
- T0.6 Criar `docs/topicos-mqtt.md` com contrato inicial.

**Critério de saída:** repo organizado; firmware da AP02 compilando a partir de `firmware/`; ADRs 0001 e 0002 aceitos.

### M1 — Firmware base robusto · `v0.1.0`
**Meta:** padrão ISR → semáforo → task → fila → comunicação sólido e reutilizável.
- T1.1 Modularizar firmware (`wifi_mqtt.*`, `botao.*`, `config.h`).
- T1.2 Payload JSON (`device_id`, `ts`, `seq`, `evento`) com ArduinoJson.
- T1.3 Reconexão Wi-Fi/MQTT resiliente + LWT (`/<grupo>/status` = offline).
- T1.4 Sincronizar horário via NTP para `ts`.

**Critério de saída:** desconectar o broker e reconectar sem reset; LWT visível no broker.
**Entrega:** log serial + print do broker.

### M2 — Sensoriamento · `v0.2.0`
**Meta:** leitura real de sensor(es) do tema.
- T2.1 Task de leitura periódica do sensor (prioridade e stack justificadas).
- T2.2 Fila de leituras → TaskComunicacao publica em `/<grupo>/telemetria`.
- T2.3 Eventos por limiar (ex.: alerta) via ISR/notify quando aplicável.
- T2.4 Comando remoto: assinar `/<grupo>/cmd` (ex.: ligar LED/atuador).

**Critério de saída:** telemetria contínua com `seq` sem buracos por 10 min.
**Entrega:** vídeo curto da placa + mensagens chegando.

### M3 — Ingestão e persistência · `v0.3.0`
**Meta:** dados saem do broker e ficam guardados.
- T3.1 Serviço `ingest` assinando tópicos e validando o schema.
- T3.2 Persistir em SQLite (tabela `leituras` com hash SHA-256 de cada payload).
- T3.3 Detectar `seq` faltante/duplicado e registrar.
- T3.4 Testes do validador e do hash.

**Critério de saída:** 100% das mensagens do M2 persistidas; testes passando.
**Entrega:** dump da tabela + saída dos testes.

### M4 — Dashboard · `v0.4.0`
**Meta:** visualização em tempo real.
- T4.1 Gráfico em tempo real da telemetria.
- T4.2 Indicador online/offline (LWT) e último `seq`.
- T4.3 Controle do atuador pelo dashboard (`/<grupo>/cmd`).
- T4.4 Histórico a partir do SQLite.

**Critério de saída:** apertar o botão/variar o sensor reflete no dashboard em < 2 s.
**Entrega:** print/vídeo do dashboard.

### M5 — Camada Blockchain (integridade) · `v0.5.0`
**Meta:** provar que os dados não foram adulterados.
- T5.1 Serviço `anchor`: agrupar leituras em lotes (por N leituras ou T minutos).
- T5.2 Calcular Merkle root do lote e registrar on-chain na testnet.
- T5.3 Salvar `tx_hash` e `merkle_root` por lote no SQLite.
- T5.4 Endpoint/tela de verificação: recalcular root do lote e comparar com o on-chain.
- T5.5 Demonstração de adulteração: alterar 1 linha no banco → verificação falha.

**Critério de saída:** lote ancorado visível no explorer; verificação positiva e negativa funcionando.
**Entrega:** link do explorer + print das duas verificações.

### M6 — Fechamento e apresentação · `v1.0.0`
**Meta:** pronto para avaliação.
- T6.1 README final: como rodar cada parte (passo a passo).
- T6.2 Diagrama de arquitetura final + justificativa das decisões FreeRTOS (prioridades, stacks, núcleos).
- T6.3 Roteiro de demo (5 min) e checklist pré-apresentação.
- T6.4 Revisão de segredos no histórico do git.

**Critério de saída:** demo ensaiada de ponta a ponta em até 5 min.
**Entrega:** roteiro + gravação do ensaio.
