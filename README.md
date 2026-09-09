# CtrlC-Coin

CtrlC-Coin is an educational, production-patterned, pure Python blockchain implementation built from scratch with zero external dependencies.

---

## Architecture & Project Structure

```
CtrlC-Coin/
├── block.py           # Core: Block structure, SHA-256 hashing & PoW mining
├── transaction.py     # Core: Transaction structure & cryptographic validation
├── wallet.py          # Core: Pure Python asymmetric RSA key pair & digital signing
├── blockchain.py      # Core Engine: Ledger, Halving, Dynamic Difficulty & Consensus
├── node.py            # Backend: HTTP REST API Server & P2P Gossip Relay
├── cli.py             # CLI Client: Multi-wallet terminal interface
├── start_demo.ps1     # Automation: 1-Click 2-Node Peered Live Network Demo
└── web/               # Decoupled Web Frontend
    ├── index.html     # Live Blockchain Explorer & Wallet Dashboard
    ├── style.css      # Dark-mode styling
    └── app.js         # Client-side state, P2P polling & wallet UI logic
```

---

## Key Features

- **Cryptographic Hashing:** SHA-256 with Avalanche effect.
- **Dynamic Difficulty Adjustment:** Scales mining target difficulty based on block creation speed.
- **Halving Mechanism:** Block rewards halve at regular block intervals (Bitcoin deflationary model).
- **Asymmetric Cryptography:** Pure Python RSA key generation (`e = 65537`), digital transaction signing, and verification.
- **P2P Gossip Relay:** Transactions broadcast automatically to all network peers.
- **Mempool Recovery:** Orphaned blocks discarded during consensus return their valid transactions back to the mempool.
- **Nakamoto Consensus:** Automatic fork resolution via the Longest Valid Chain Rule.
- **Decoupled Web Explorer:** Clean separation of concerns with frontend assets served from `/web`.

---

## 1-Click Live Network Demo (Presentation Mode)

Run the automated simulation script in PowerShell:
```powershell
.\start_demo.ps1
```
This automatically boots:
- **Node 1** on `http://localhost:5000` (Alice's Node)
- **Node 2** on `http://localhost:5001` (Kevin's Node)
- Connects both nodes as P2P peers and launches both Web Dashboards in your browser.
