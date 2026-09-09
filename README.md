# CtrlC-Coin

CtrlC-Coin is an educational, production-patterned, pure Python blockchain implementation built from scratch with zero external dependencies.

## Architecture & Core Features

- **Cryptographic Hashing:** Every block is secured using SHA-256 with the Avalanche effect.
- **Proof of Work (PoW):** Mining mechanism requiring dynamic difficulty target zeros and deterministic `nonce` iteration.
- **Asymmetric Cryptography & Digital Signatures:** Pure Python RSA key generation (`public_key` as address, `private_key` for signing). Transactions are cryptographically signed and verified to prevent impersonation and tampering.
- **Mempool & Mining Rewards:** Transactions sit in a pending pool (mempool) until mined into a block. The miner receives a Coinbase reward transaction.
- **Double-Spending & Overspending Protection:** Strict balance checks before accepting transactions into the pool.
- **Persistence:** Local JSON serialization and automated integrity verification on startup.
- **Distributed Consensus:** Nakamoto Consensus implementation (Longest Valid Chain Rule) for resolving network forks.
- **P2P HTTP Node Server:** REST API server built with Python standard library `http.server` supporting peer registration and distributed consensus.
- **Interactive CLI Client:** Terminal interface for wallet management, mining, transaction creation, and chain inspection.

---

## File Structure

| File | Description |
| :--- | :--- |
| `block.py` | Defines `Block` data structure, SHA-256 hash calculation, and `mine_block` PoW loop. |
| `transaction.py` | Defines `Transaction` class, serialization, hashing, and digital signature validation. |
| `wallet.py` | Pure Python RSA key pair generation, message hashing, digital signing, and public verification. |
| `blockchain.py` | Core engine managing chain array, genesis block, mempool, validation, disk I/O, and consensus. |
| `node.py` | HTTP REST API node server for running distributed network peers. |
| `cli.py` | Interactive terminal node client with multi-wallet management. |

---

## Getting Started

### Prerequisites
- Python 3.10+ (Built and tested with Python 3.13)
- No third-party packages required (Standard Library only).

### 1. Interactive CLI Client
To start the interactive command-line node:
```bash
python cli.py
```
From the menu:
- Press `1` to generate a wallet.
- Press `5` to mine pending transactions and earn 50 CtrlC-Coin.
- Press `4` to send signed transactions to other addresses.
- Press `2` to list wallets and view live balances.

---

### 2. Running a Distributed Network (HTTP Nodes)

#### Start Node 1 (Port 5000):
```bash
python node.py 5000
```

#### Start Node 2 (Port 5001) in another terminal:
```bash
python node.py 5001
```

#### Connect Node 2 to Node 1:
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/nodes/register" -Method Post -ContentType "application/json" -Body '{"nodes": ["http://localhost:5000"]}'
```

#### Trigger Consensus on Node 2:
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/nodes/resolve" -Method Get
```

---

## REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Node health and available endpoint catalog |
| `/chain` | `GET` | Returns full blockchain data and length |
| `/pending` | `GET` | Returns transactions currently in mempool |
| `/transactions/new` | `POST` | Submits a signed transaction (`sender`, `recipient`, `amount`, `signature`) |
| `/mine` | `POST` | Mines mempool into a new block with reward to `miner_address` |
| `/nodes/register` | `POST` | Registers peer node URLs (`{"nodes": ["http://..."]}`) |
| `/nodes/resolve` | `GET` | Runs consensus algorithm against all registered peers |
