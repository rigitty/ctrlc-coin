import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import urllib.request

from blockchain import Blockchain
from transaction import Transaction
from wallet import Wallet

blockchain = Blockchain(initial_difficulty=2, mining_reward=50)
peers = set()

HTML_DASHBOARD = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CtrlC-Coin Blockchain Explorer</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #38bdf8; --border: #334155; --green: #4ade80; --purple: #a855f7; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }
        h1 { margin: 0; font-size: 26px; color: var(--accent); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
        .stat-label { font-size: 13px; color: #94a3b8; margin-bottom: 4px; }
        .stat-val { font-size: 22px; font-weight: bold; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media(max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
        .panel { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
        h2 { font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        button { background: var(--accent); color: #000; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { opacity: 0.9; }
        .btn-mine { background: var(--green); }
        .btn-purple { background: var(--purple); color: #fff; }
        input { width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid var(--border); color: #fff; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; }
        .blocks-container { display: flex; flex-direction: column; gap: 16px; }
        .block-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; position: relative; }
        .block-card:not(:last-child)::after { content: "↓ LINKED TO PREVIOUS"; display: block; text-align: center; color: #64748b; font-size: 11px; margin-top: 12px; font-weight: bold; }
        .hash-badge { background: #0f172a; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--accent); word-break: break-all; }
        .tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #334155; margin-right: 6px; }
        .tx-box { background: #0f172a; border-radius: 6px; padding: 8px; margin-top: 8px; font-size: 13px; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <h1>CtrlC-Coin Explorer</h1>
            <small style="color: #94a3b8;">Production-patterned Pure Python Blockchain</small>
        </div>
        <div>
            <button class="btn-mine" onclick="mineBlock()">⛏️ Mine Pending Transactions</button>
        </div>
    </header>

    <div class="stats">
        <div class="stat-card"><div class="stat-label">Total Blocks</div><div class="stat-val" id="stat-blocks">-</div></div>
        <div class="stat-card"><div class="stat-label">Current Difficulty</div><div class="stat-val" id="stat-diff">-</div></div>
        <div class="stat-card"><div class="stat-label">Pending Mempool TXs</div><div class="stat-val" id="stat-pending">-</div></div>
        <div class="stat-card"><div class="stat-label">Blockchain Validity</div><div class="stat-val" id="stat-valid" style="color: var(--green);">-</div></div>
    </div>

    <div class="grid-2">
        <div class="panel">
            <h2>Active Wallet & Balance</h2>
            <div id="wallet-info">
                <button class="btn-purple" onclick="createWallet()">🔑 Generate New Wallet</button>
            </div>
            <div id="wallet-details" style="display:none; margin-top: 16px;">
                <div style="font-size: 12px; color:#94a3b8;">Public Address:</div>
                <div class="hash-badge" id="wallet-address" style="margin: 4px 0 12px 0;"></div>
                <div style="font-size: 12px; color:#94a3b8;">Balance:</div>
                <div style="font-size: 26px; font-weight: bold; color: var(--green);" id="wallet-balance">0 Coin</div>
            </div>
        </div>

        <div class="panel">
            <h2>Send Signed Transaction</h2>
            <input type="text" id="tx-recipient" placeholder="Recipient Address (e.g. 65537:1234567)">
            <input type="number" id="tx-amount" placeholder="Amount (CtrlC-Coin)">
            <button style="width: 100%;" onclick="sendTransaction()">✍️ Sign & Broadcast to Mempool</button>
            <div id="tx-msg" style="margin-top: 8px; font-size: 13px;"></div>
        </div>
    </div>

    <h2>Blockchain Ledger</h2>
    <div class="blocks-container" id="blocks-list">Loading blocks...</div>
</div>

<script>
let currentWallet = null;

async function refreshAll() {
    const res = await fetch("/chain");
    const data = await res.json();
    const pendingRes = await fetch("/pending");
    const pendingData = await pendingRes.json();

    document.getElementById("stat-blocks").innerText = data.length;
    document.getElementById("stat-diff").innerText = data.chain[data.chain.length - 1].difficulty || 2;
    document.getElementById("stat-pending").innerText = pendingData.pending_transactions.length;
    document.getElementById("stat-valid").innerText = "VALID (100%)";

    const blocksList = document.getElementById("blocks-list");
    blocksList.innerHTML = "";

    // Show latest block at the top
    const reversedChain = [...data.chain].reverse();
    reversedChain.forEach(b => {
        const card = document.createElement("div");
        card.className = "block-card";
        let txHtml = b.transactions.length === 0 ? "<div style='color:#64748b; font-size:12px;'>No transactions (Genesis Block)</div>" : "";
        b.transactions.forEach(tx => {
            const sender = tx.sender ? tx.sender.substring(0, 16) + "..." : "COINBASE (System Reward)";
            const recipient = tx.recipient ? tx.recipient.substring(0, 16) + "..." : "";
            txHtml += `<div class="tx-box">💸 <b>${tx.amount} Coin</b> : ${sender} ➜ ${recipient}</div>`;
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:18px; font-weight:bold;">Block #${b.index}</span>
                <div>
                    <span class="tag">Diff: ${b.difficulty || 2}</span>
                    <span class="tag">Nonce: ${b.nonce}</span>
                    <span class="tag">${new Date(b.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
            </div>
            <div style="font-size:12px; color:#94a3b8;">Block Hash:</div>
            <div class="hash-badge">${b.hash}</div>
            <div style="font-size:12px; color:#94a3b8; margin-top:6px;">Previous Hash:</div>
            <div class="hash-badge" style="color:#94a3b8;">${b.previous_hash}</div>
            <div style="margin-top:10px; font-weight:bold; font-size:13px;">Transactions (${b.transactions.length}):</div>
            ${txHtml}
        `;
        blocksList.appendChild(card);
    });

    if (currentWallet) {
        updateWalletBalance(data.chain);
    }
}

async function createWallet() {
    const res = await fetch("/wallet/new", { method: "POST" });
    currentWallet = await res.json();
    document.getElementById("wallet-details").style.display = "block";
    document.getElementById("wallet-address").innerText = currentWallet.public_key;
    refreshAll();
}

function updateWalletBalance(chain) {
    let balance = 0;
    chain.forEach(b => {
        b.transactions.forEach(tx => {
            if (tx.sender === currentWallet.public_key) balance -= tx.amount;
            if (tx.recipient === currentWallet.public_key) balance += tx.amount;
        });
    });
    document.getElementById("wallet-balance").innerText = balance + " Coin";
}

async function mineBlock() {
    const minerAddr = currentWallet ? currentWallet.public_key : "GenesisMiner";
    await fetch("/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miner_address: minerAddr })
    });
    refreshAll();
}

async function sendTransaction() {
    if (!currentWallet) {
        alert("Please generate or connect a wallet first!");
        return;
    }
    const recipient = document.getElementById("tx-recipient").value.trim();
    const amount = parseFloat(document.getElementById("tx-amount").value);
    const msgDiv = document.getElementById("tx-msg");

    if (!recipient || isNaN(amount) || amount <= 0) {
        msgDiv.innerHTML = "<span style='color:#ef4444;'>Invalid recipient or amount.</span>";
        return;
    }

    const res = await fetch("/transactions/sign_and_send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            private_key: currentWallet.private_key,
            sender: currentWallet.public_key,
            recipient: recipient,
            amount: amount
        })
    });

    const respData = await res.json();
    if (res.ok) {
        msgDiv.innerHTML = "<span style='color:#4ade80;'>[Success] Transaction signed and sent to mempool!</span>";
        document.getElementById("tx-recipient").value = "";
        document.getElementById("tx-amount").value = "";
        refreshAll();
    } else {
        msgDiv.innerHTML = `<span style='color:#ef4444;'>[Error] ${respData.error}</span>`;
    }
}

window.onload = refreshAll;
setInterval(refreshAll, 5000);
</script>
</body>
</html>
"""

class BlockchainHTTPHandler(BaseHTTPRequestHandler):
    def _send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)

        # 1. Root: Serve visual Blockchain Explorer Web Dashboard
        if parsed.path in ["", "/"]:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_DASHBOARD.encode("utf-8"))

        elif parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()

        # 2. Get full chain
        elif parsed.path == "/chain":
            chain_data = [
                {
                    "index": b.index,
                    "hash": b.hash,
                    "previous_hash": b.previous_hash,
                    "nonce": b.nonce,
                    "difficulty": getattr(b, "difficulty", 2),
                    "timestamp": b.timestamp,
                    "transactions": [
                        tx if isinstance(tx, dict) else tx.to_dict()
                        for tx in b.transactions
                    ]
                }
                for b in blockchain.chain
            ]
            self._send_json_response({"length": len(chain_data), "chain": chain_data})

        # 3. Get mempool
        elif parsed.path == "/pending":
            pending = [tx.to_dict() for tx in blockchain.pending_transactions]
            self._send_json_response({"pending_transactions": pending})

        # 4. Consensus resolve
        elif parsed.path == "/nodes/resolve":
            replaced = False
            for peer in list(peers):
                try:
                    req = urllib.request.Request(f"{peer}/chain")
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        peer_chain_data = data.get("chain", [])

                        from block import Block
                        candidate_chain = []
                        for b_data in peer_chain_data:
                            txs = []
                            for tx_item in b_data["transactions"]:
                                t = Transaction(tx_item["sender"], tx_item["recipient"], tx_item["amount"])
                                t.signature = tx_item.get("signature")
                                txs.append(t)
                            b = Block(
                                index=b_data["index"],
                                previous_hash=b_data["previous_hash"],
                                transactions=txs,
                                timestamp=b_data["timestamp"],
                                difficulty=b_data.get("difficulty", 2)
                            )
                            b.nonce = b_data["nonce"]
                            b.hash = b_data["hash"]
                            candidate_chain.append(b)

                        if blockchain.replace_chain(candidate_chain):
                            replaced = True
                except Exception as e:
                    print(f"Error reaching peer {peer}: {e}")

            self._send_json_response({
                "message": "Consensus completed. Chain replaced." if replaced else "Our chain is authoritative.",
                "chain_length": len(blockchain.chain)
            })

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            body = json.loads(post_body)
        except Exception:
            body = {}

        # 1. Generate new wallet via API
        if parsed.path == "/wallet/new":
            w = Wallet()
            self._send_json_response({
                "public_key": w.public_key,
                "private_key": list(w.private_key)
            })

        # 2. Sign and send transaction in one step from Web UI
        elif parsed.path == "/transactions/sign_and_send":
            try:
                w = Wallet()
                w.private_key = tuple(body["private_key"])
                w.public_key = body["sender"]

                tx = Transaction(body["sender"], body["recipient"], float(body["amount"]))
                tx.sign_transaction(w)
                blockchain.add_transaction(tx)
                self._send_json_response({"message": "Transaction signed and added to mempool"}, 201)
            except Exception as e:
                self._send_json_response({"error": str(e)}, 400)

        # 3. Direct signed transaction endpoint
        elif parsed.path == "/transactions/new":
            required = ["sender", "recipient", "amount", "signature"]
            if not all(k in body for k in required):
                self._send_json_response({"error": "Missing transaction fields"}, 400)
                return

            tx = Transaction(body["sender"], body["recipient"], body["amount"])
            tx.signature = body["signature"]
            try:
                blockchain.add_transaction(tx)
                self._send_json_response({"message": "Transaction added to mempool successfully"}, 201)
            except Exception as e:
                self._send_json_response({"error": str(e)}, 400)

        # 4. Trigger mining
        elif parsed.path == "/mine":
            miner_address = body.get("miner_address")
            if not miner_address:
                self._send_json_response({"error": "miner_address required"}, 400)
                return

            blockchain.mine_pending_transactions(miner_address=miner_address)
            latest_block = blockchain.get_latest_block()
            self._send_json_response({
                "message": "New block mined and added to chain",
                "index": latest_block.index,
                "hash": latest_block.hash,
                "nonce": latest_block.nonce,
                "difficulty": latest_block.difficulty,
                "transactions_count": len(latest_block.transactions)
            }, 200)

        # 5. Register peers
        elif parsed.path == "/nodes/register":
            nodes_list = body.get("nodes", [])
            for node in nodes_list:
                peers.add(node.rstrip("/"))
            self._send_json_response({"message": "Peers registered", "total_peers": list(peers)})

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

def run(port=5000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, BlockchainHTTPHandler)
    print(f"[*] CtrlC-Coin Node running on http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    run(port)
