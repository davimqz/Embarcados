# Regras de Task

Todo trabalho vive no [`TASKS.md`](../../TASKS.md), na raiz do repositório.
**Nenhum código é escrito sem uma task correspondente.**

## Formato

```md
### T<marco>.<n> — <título no imperativo>
- **Marco:** M<x>
- **Status:** todo | doing | review | done | blocked
- **Responsável:** <nome>
- **Depende de:** T<..> (ou —)
- **Descrição:** o que e por quê, em 1–3 linhas.
- **Critérios de aceite:**
  - [ ] critério verificável 1
  - [ ] critério verificável 2
- **Evidência:** caminho em docs/entregas/M<x>/ (print, log serial, vídeo, tx hash)
```

- **ID:** `T<marco>.<n>`, sequencial dentro do marco. ID usado nunca é reaproveitado, nem se a task for cancelada.
- **Título:** imperativo e específico ("Adicionar LWT ao cliente MQTT", não "MQTT").

## Status

| Status | Significado | Quem move |
|---|---|---|
| `todo` | pronta para começar | qualquer integrante |
| `doing` | em andamento, na branch da task | o responsável |
| `review` | critérios cumpridos, PR aberto aguardando revisão | o responsável |
| `done` | Definition of Done cumprida e merge feito na `main` | o revisor, após o merge |
| `blocked` | parada por fator externo ou dependência | qualquer integrante, com motivo |

Fluxo normal: `todo → doing → review → done`. Qualquer estado pode ir para `blocked` e voltar.

## Regras

1. **Tamanho:** uma task cabe em uma sessão de trabalho (≤ ~2 h). Se não cabe, quebre em mais tasks.
2. **Uma task `doing` por vez** por responsável.
3. **Responsável único:** pode haver pareamento, mas uma pessoa responde pela task.
4. **Critérios de aceite verificáveis:** log serial, mensagem no broker, tela, teste, tx no explorer.
   Nada de "funcionar bem" ou "ficar estável".
5. **Dependências explícitas:** task que depende de outra não vai para `doing` antes da dependência estar `done`.
6. **Escopo fechado:** descobriu trabalho extra? Crie uma task nova em vez de inflar a atual.
7. **Bloqueio:** marque `blocked`, escreva o motivo e o que destrava. Não contorne em silêncio.
   ```md
   - **Status:** blocked
   - **Bloqueio:** broker fora do ar; destrava com Mosquitto local ou retorno do broker.
   ```
8. **Na dúvida sobre requisito acadêmico, pergunte aos professores.** Não invente requisito.

## Definition of Done

Uma task só é `done` quando **todos** os itens abaixo são verdade:

1. Todos os critérios de aceite marcados `[x]`.
2. Compila sem warnings novos (`pio run`) e/ou testes passam (`npm test`).
3. Evidência salva em `docs/entregas/M<x>/` e caminho preenchido no campo **Evidência**.
4. Docs afetados atualizados (`docs/topicos-mqtt.md`, `docs/arquitetura.md`, README).
5. Commits seguindo as [regras de commit](commits.md), todos com `Refs:` da task.
6. Revisada por outro integrante e mergeada na `main`.

Task sem evidência **não** é `done`.

## Fluxo de trabalho por task

1. Escolher a próxima task `todo` desbloqueada do marco atual e colocar seu nome em **Responsável**.
2. Mudar para `doing` e criar a branch `m<x>/t<x>.<n>-slug` a partir da `main`.
3. Escrever um plano curto (3–5 linhas) na descrição do PR.
4. Implementar em commits atômicos.
5. Rodar `pio run` / `npm test`.
6. Salvar a evidência em `docs/entregas/M<x>/`.
7. Atualizar a task no `TASKS.md` (critérios, evidência, status `review`) e abrir o PR.
8. Revisor confere a DoD, faz o merge e marca `done`.

## Nomenclatura de evidências

```
docs/entregas/M<x>/T<x>.<n>-<descricao>.<ext>
```

Exemplos: `T1.3-lwt-broker.png`, `T2.2-telemetria-10min.log`, `T5.2-tx-explorer.md`.
Evidência de entregas anteriores nunca é apagada.
