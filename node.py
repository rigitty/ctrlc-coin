import collections
import json
import os
import random
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse
import urllib.request

from block import Block
from blockchain import Blockchain
from config import Config
from transaction import Transaction
from wallet import Wallet

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

blockchain = Blockchain()
peers = set()
auto_mining_enabled = Config.AUTO_MINING_ENABLED

NODE_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else Config.DEFAULT_PORT
PORT_NAME_MAP = {
    5000: "Alice",
    5001: "Kevin",
    5002: "Bob",
    5003: "Charlie",
    5004: "Emma"
}
DEFAULT_NODE_NAME = PORT_NAME_MAP.get(NODE_PORT, f"Node_{NODE_PORT}")

active_node_wallet = Wallet()
ALIASES = {
    active_node_wallet.public_key: DEFAULT_NODE_NAME
}

NAMES_POOL = ["Alice", "Kevin", "Bob", "Charlie", "David", "Emma", "Grace", "Oliver", "Sophia", "Lucas", "Liam", "Mia", "Zoe", "Noah", "Leo"]
random.shuffle(NAMES_POOL)
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# In-memory circular log buffer for the embedded live terminal app
node_logs = collections.deque(maxlen=100)

def log_terminal(msg, level="info"):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{level.upper()}] {msg}"
    node_logs.append(entry)
    print(f"[{DEFAULT_NODE_NAME}] {entry}")

log_terminal(f"Node initialized as '{DEFAULT_NODE_NAME}' on port {NODE_PORT}")

def get_or_create_alias(address):
    if not address:
        return "System"
    if address not in ALIASES:
        used = set(ALIASES.values())
        avail = [n for n in NAMES_POOL if n not in used]
        ALIASES[address] = avail[0] if avail else f"User_{address[-4:]}"
    return ALIASES[address]

def sync_chain_with_peers():
    for peer in list(peers):
        try:
            req = urllib.request.Request(f"{peer}/chain")
            with urllib.request.urlopen(req, timeout=Config.REQUEST_TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                peer_chain_data = data.get("chain", [])

                for addr, alias in data.get("aliases", {}).items():
                    if addr not in ALIASES:
                        ALIASES[addr] = alias

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
                    log_terminal(f"Consensus: Adopted longer chain from {peer} (Length: {len(blockchain.chain)})", "consensus")
        except Exception:
            pass

def broadcast_transaction_to_peers(tx_dict):
    for peer in list(peers):
        try:
            req = urllib.request.Request(
                f"{peer}/transactions/new",
                data=json.dumps(tx_dict).encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Broadcast": "true"}
            )
            with urllib.request.urlopen(req, timeout=Config.REQUEST_TIMEOUT) as resp:
                resp.read()
                log_terminal(f"Gossip: Broadcasted transaction to peer {peer}", "p2p")
        except Exception as e:
            log_terminal(f"Gossip failed to {peer}: {e}", "warn")

def broadcast_block_to_peers(block_dict):
    for peer in list(peers):
        try:
            req = urllib.request.Request(
                f"{peer}/blocks/receive",
                data=json.dumps({"block": block_dict, "aliases": ALIASES}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=Config.REQUEST_TIMEOUT) as resp:
                resp.read()
                log_terminal(f"Block Propagation: Sent Block #{block_dict['index']} to peer {peer}", "p2p")
        except Exception as e:
            log_terminal(f"Block broadcast failed to {peer}: {e}", "warn")

def auto_miner_loop():
    global active_node_wallet
    while True:
        time.sleep(Config.AUTO_MINING_INTERVAL_SEC)
        if len(peers) > 0:
            sync_chain_with_peers()

        if auto_mining_enabled and len(blockchain.pending_transactions) > 0:
            miner_addr = active_node_wallet.public_key
            try:
                log_terminal(f"Auto-Miner: {len(blockchain.pending_transactions)} pending TX(s) found. Mining...", "mine")
                new_block, stats = blockchain.mine_pending_transactions(miner_address=miner_addr)
                block_dict = {
                    "index": new_block.index,
                    "previous_hash": new_block.previous_hash,
                    "timestamp": new_block.timestamp,
                    "difficulty": new_block.difficulty,
                    "nonce": new_block.nonce,
                    "hash": new_block.hash,
                    "transactions": [tx.to_dict() for tx in new_block.transactions]
                }
                log_terminal(f"Auto-Miner: WON Block #{new_block.index} (Nonce: {new_block.nonce}, Diff: {new_block.difficulty})", "mine")
                threading.Thread(target=broadcast_block_to_peers, args=(block_dict,)).start()
            except Exception as e:
                log_terminal(f"Auto-Miner error: {e}", "error")

class BlockchainHTTPHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Broadcast")

    def _send_json_response(self, data, status_code=200):
        try:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/logs":
            self._send_json_response({"node": DEFAULT_NODE_NAME, "logs": list(node_logs)})

        elif parsed.path in ["", "/"]:
            filepath = os.path.join(WEB_DIR, "index.html")
            if os.path.exists(filepath):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._send_cors_headers()
                self.end_headers()
                with open(filepath, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self._send_json_response({"status": "running", "node": DEFAULT_NODE_NAME})

        elif parsed.path == "/style.css":
            filepath = os.path.join(WEB_DIR, "style.css")
            self.send_response(200)
            self.send_header("Content-Type", "text/css")
            self._send_cors_headers()
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())

        elif parsed.path == "/app.js":
            filepath = os.path.join(WEB_DIR, "app.js")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self._send_cors_headers()
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())

        elif parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()

        elif parsed.path == "/wallet/current":
            self._send_json_response({
                "alias": DEFAULT_NODE_NAME,
                "public_key": active_node_wallet.public_key,
                "private_key": list(active_node_wallet.private_key)
            })

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
            self._send_json_response({
                "length": len(chain_data),
                "total_peers": len(peers),
                "auto_mining": auto_mining_enabled,
                "node_name": DEFAULT_NODE_NAME,
                "aliases": ALIASES,
                "chain": chain_data
            })

        elif parsed.path == "/pending":
            pending = [tx.to_dict() for tx in blockchain.pending_transactions]
            self._send_json_response({"pending_transactions": pending})

        elif parsed.path == "/nodes/resolve":
            sync_chain_with_peers()
            self._send_json_response({
                "message": "Consensus sync completed.",
                "chain_length": len(blockchain.chain)
            })

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

    def do_POST(self):
        global auto_mining_enabled, active_node_wallet
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            body = json.loads(post_body)
        except Exception:
            body = {}

        if parsed.path == "/wallet/new":
            w = Wallet()
            active_node_wallet = w
            alias = get_or_create_alias(w.public_key)
            log_terminal(f"Generated new wallet: {alias}", "wallet")
            self._send_json_response({
                "alias": alias,
                "public_key": w.public_key,
                "private_key": list(w.private_key)
            })

        elif parsed.path == "/miner/toggle":
            auto_mining_enabled = not auto_mining_enabled
            log_terminal(f"Auto-Mining toggled to: {'ENABLED' if auto_mining_enabled else 'DISABLED'}", "mine")
            self._send_json_response({"auto_mining": auto_mining_enabled})

        elif parsed.path == "/transactions/sign_and_send":
            try:
                w = Wallet()
                w.private_key = tuple(body["private_key"])
                w.public_key = body["sender"]

                tx = Transaction(body["sender"], body["recipient"], float(body["amount"]))
                tx.sign_transaction(w)
                blockchain.add_transaction(tx)

                sender_name = get_or_create_alias(body["sender"])
                recipient_name = get_or_create_alias(body["recipient"])
                log_terminal(f"Signed TX: {sender_name} ➜ {recipient_name} ({body['amount']} Coin)", "tx")

                tx_payload = tx.to_dict()
                threading.Thread(target=broadcast_transaction_to_peers, args=(tx_payload,)).start()

                self._send_json_response({"message": "Transaction signed and broadcasted to network"}, 201)
            except Exception as e:
                log_terminal(f"Failed to sign/send TX: {e}", "error")
                self._send_json_response({"error": str(e)}, 400)

        elif parsed.path == "/transactions/new":
            required = ["sender", "recipient", "amount", "signature"]
            if not all(k in body for k in required):
                self._send_json_response({"error": "Missing transaction fields"}, 400)
                return

            tx = Transaction(body["sender"], body["recipient"], body["amount"])
            tx.signature = body["signature"]

            try:
                blockchain.add_transaction(tx)
            except ValueError as e:
                if "Insufficient balance" in str(e):
                    sync_chain_with_peers()
                    try:
                        blockchain.add_transaction(tx)
                    except Exception as e2:
                        self._send_json_response({"error": str(e2)}, 400)
                        return
                else:
                    self._send_json_response({"error": str(e)}, 400)
                    return

            s_name = get_or_create_alias(body["sender"])
            r_name = get_or_create_alias(body["recipient"])
            log_terminal(f"Received TX from P2P: {s_name} ➜ {r_name} ({body['amount']} Coin)", "p2p")

            is_broadcast = self.headers.get("X-Broadcast") == "true"
            if not is_broadcast:
                threading.Thread(target=broadcast_transaction_to_peers, args=(body,)).start()

            self._send_json_response({"message": "Transaction added to mempool successfully"}, 201)

        elif parsed.path == "/mine":
            miner_address = body.get("miner_address") or active_node_wallet.public_key
            miner_name = get_or_create_alias(miner_address)
            log_terminal(f"Manual Mine triggered for {miner_name}...", "mine")
            new_block, stats = blockchain.mine_pending_transactions(miner_address=miner_address)

            block_dict = {
                "index": new_block.index,
                "previous_hash": new_block.previous_hash,
                "timestamp": new_block.timestamp,
                "difficulty": new_block.difficulty,
                "nonce": new_block.nonce,
                "hash": new_block.hash,
                "transactions": [tx.to_dict() for tx in new_block.transactions]
            }

            log_terminal(f"Mined Block #{new_block.index}! Nonce: {new_block.nonce} in {stats['duration']}s", "mine")
            threading.Thread(target=broadcast_block_to_peers, args=(block_dict,)).start()

            self._send_json_response({
                "message": "New block mined and propagated to peers!",
                "block": block_dict,
                "stats": stats
            }, 200)

        elif parsed.path == "/blocks/receive":
            b_data = body.get("block", {})
            peer_aliases = body.get("aliases", {})
            for addr, alias in peer_aliases.items():
                if addr not in ALIASES:
                    ALIASES[addr] = alias

            txs = []
            for tx_item in b_data.get("transactions", []):
                t = Transaction(tx_item["sender"], tx_item["recipient"], tx_item["amount"])
                t.signature = tx_item.get("signature")
                txs.append(t)

            candidate_block = Block(
                index=b_data["index"],
                previous_hash=b_data["previous_hash"],
                transactions=txs,
                timestamp=b_data["timestamp"],
                difficulty=b_data.get("difficulty", 2)
            )
            candidate_block.nonce = b_data["nonce"]
            candidate_block.hash = b_data["hash"]

            accepted = blockchain.add_received_block(candidate_block)
            if accepted:
                log_terminal(f"Accepted winning Block #{candidate_block.index} from peer! Appended to chain.", "p2p")
                self._send_json_response({"message": "Block accepted and appended to local chain"}, 200)
            else:
                log_terminal(f"Received Block #{candidate_block.index} out of sync. Triggering resync...", "warn")
                sync_chain_with_peers()
                self._send_json_response({"message": "Triggered chain resync"}, 200)

        elif parsed.path == "/nodes/register":
            nodes_list = body.get("nodes", [])
            for node in nodes_list:
                peers.add(node.rstrip("/"))
            log_terminal(f"Registered peer nodes: {nodes_list}", "p2p")
            self._send_json_response({"message": "Peers registered", "total_peers": list(peers)})

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

def run():
    server_address = ("", NODE_PORT)
    miner_thread = threading.Thread(target=auto_miner_loop, daemon=True)
    miner_thread.start()

    httpd = ThreadedHTTPServer(server_address, BlockchainHTTPHandler)
    log_terminal(f"HTTP Server online on port {NODE_PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
