# ADR 0001 — Rede blockchain: Cardano Preprod

- **Status:** aceita
- **Data:** 2026-10-20
- **Decidido por:** grupo 3
- **Task:** T0.3

## Contexto

O M5 precisa provar que a telemetria guardada no SQLite não foi adulterada. O serviço `anchor` agrupa leituras em
lotes, calcula a Merkle root de cada lote e registra só esse hash numa blockchain de teste (`CLAUDE.md` §3.4: nunca
dado bruto on-chain, nunca mainnet). Qualquer pessoa pode depois recalcular a root a partir do banco e comparar com
o que está on-chain.

## Opções consideradas

| | Cardano Preprod | EVM testnet (Sepolia / Amoy) |
|---|---|---|
| Como registrar o hash | **Metadata da transação**, que é feita para guardar dados arbitrários; não precisa de contrato | Campo `data` da transação ou um contrato simples que emite um evento |
| SDK em TypeScript | Mesh SDK ou Lucid Evolution + Blockfrost | ethers.js / viem |
| Moedas de teste | Faucet oficial da Cardano | Vários faucets da Sepolia exigem saldo em mainnet |
| Material de referência | Menor | Muito maior |

## Decisão

**Cardano Preprod**, com:

- **Mesh SDK** (`@meshsdk/core`) para montar e assinar as transações;
- **Blockfrost**, no plano gratuito e na rede Preprod, como provedor de acesso à rede;
- o hash do lote gravado na **metadata** da transação, sem smart contract.

A Preprod foi escolhida em vez da Preview porque é a rede de teste mais estável e próxima da mainnet. A antiga rede
"testnet" da Cardano foi desativada em 2023.

## Consequências

- Precisa de uma **carteira de teste**: o mnemônico fica no `.env` do `backend/anchor`, nunca versionado
  (`.gitignore` já cobre `.env`, `*.mnemonic`, `*.skey`). Ela é abastecida com tADA pelo faucet da Preprod.
- Precisa de uma **chave de API da Blockfrost** para a Preprod, também no `.env`.
- Cada lote ancorado custa uma taxa de transação (~0,2 tADA), então o tamanho do lote (T5.1) deve evitar uma
  transação por leitura.
- O formato exato da metadata (label e campos) é definido na T5.2 e registrado em `docs/arquitetura.md`.
- A verificação (T5.4) consulta a transação pela Blockfrost e compara a root on-chain com a recalculada.
