# Regras de Commit

Padrão: **Conventional Commits em português**. Vale para todos os integrantes, sem exceção.

## Formato

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, ≤ 72 caracteres>

[corpo opcional: o porquê da mudança, não o como]

Refs: T<marco>.<n>
```

- **Descrição:** imperativo ("adicionar", "corrigir"), minúscula, sem ponto final.
- **Corpo:** opcional; explica a motivação ou o trade-off. Linhas com até 72 caracteres.
- **Rodapé `Refs:`** obrigatório. Todo commit aponta para uma task do `TASKS.md`.

O template está em `.gitmessage`. Para usá-lo:

```sh
git config commit.template .gitmessage
```

## Tipos

| Tipo | Uso |
|---|---|
| `feat` | funcionalidade nova |
| `fix` | correção de bug |
| `refactor` | mudança interna sem alterar comportamento |
| `docs` | documentação, ADRs, evidências |
| `test` | testes |
| `chore` | build, configuração, dependências |
| `perf` | desempenho |

## Escopos válidos

`firmware` · `rtos` · `mqtt` · `ingest` · `anchor` · `dashboard` · `chain` · `docs` · `infra`

Escopo novo só entra depois de registrado nesta lista (num commit `docs(docs): ...`).

## Regras

1. **Atômico:** um assunto por commit. Se a descrição precisa de "e", são dois commits.
2. **Rastreável:** todo commit tem `Refs: T<x>.<n>`. Sem task, sem commit.
3. **Compila:** firmware que não compila (`pio run`) não entra na `main`. Backend com teste quebrado (`npm test`) também não.
4. **Incremental:** mudança em código que já funciona é justificada no corpo do commit.
5. **Dependência nova:** justificada em uma linha no corpo do commit.
6. **Autoria humana:** o commit é assinado pelo integrante que fez o trabalho. Sem trailers `Co-Authored-By` de ferramentas nem mensagens geradas automaticamente sem revisão.
7. **Nunca commitar:** `.env`, `config.h`, `.pio/`, `node_modules/`, chaves privadas, mnemônicos, SSID/senha de Wi-Fi ou IP de broker.
   Se acontecer: avisar o grupo na hora, rotacionar o segredo e limpar o histórico. Apagar o arquivo num commit novo **não** basta.

## Exemplos

```
feat(rtos): adicionar task de leitura do sensor com fila dedicada

Refs: T2.1
```

```
fix(mqtt): reconectar broker quando wifi volta

A reconexão só era tentada no setup; após queda de Wi-Fi o
dispositivo ficava offline até reset manual.

Refs: T1.3
```

```
docs(chain): registrar ADR 0001 escolha da testnet

Refs: T0.3
```

## Branches

| Branch | Uso |
|---|---|
| `main` | sempre estável e demonstrável |
| `m<x>/t<x>.<n>-slug` | uma por task (ex.: `m2/t2.1-sensor-dht`) |

- Toda task nasce numa branch própria, criada a partir da `main` atualizada.
- Merge na `main` só com a Definition of Done cumprida (ver [tasks.md](tasks.md)).
- Preferir merge via Pull Request, revisado por pelo menos 1 outro integrante.
- A branch é apagada depois do merge.

## Tags

Ao fechar um marco, cria-se uma tag anotada na `main` (ver [marcos.md](marcos.md)):

```sh
git tag -a v0.<x>.0 -m "M<x> — <nome do marco>"
git push origin v0.<x>.0
```
