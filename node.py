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

NODE_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else Config.DEFAULT_PORT
DEFAULT_NODE_NAME = f"Node_{NODE_PORT}"

CHAIN_FILE = f"chaindata_{NODE_PORT}.json"
KEYSTORE_FILE = f"keystore_{NODE_PORT}.json"

active_node_wallet = None
keystore_address = None

if os.path.exists(KEYSTORE_FILE):
    try:
        with open(KEYSTORE_FILE, "r", encoding="utf-8") as f:
            keystore_data = json.load(f)
            keystore_address = keystore_data.get("address")
    except Exception:
        pass

# Load existing blockchain or generate and save
if os.path.exists(CHAIN_FILE):
    try:
        blockchain = Blockchain.load_from_file(CHAIN_FILE)
    except Exception:
        blockchain = Blockchain()
        blockchain.save_to_file(CHAIN_FILE)
else:
    blockchain = Blockchain()
    blockchain.save_to_file(CHAIN_FILE)

def save_node_state():
    try:
        blockchain.save_to_file(CHAIN_FILE)
    except Exception as e:
        log_terminal(f"State save error: {e}", "warn")

peers = set()
auto_mining_enabled = Config.AUTO_MINING_ENABLED
ALIASES = {}

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# In-memory circular log buffer for the embedded live terminal app
node_logs = collections.deque(maxlen=100)

def log_terminal(msg, level="info"):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{level.upper()}] {msg}"
    node_logs.append(entry)
    print(f"[{DEFAULT_NODE_NAME}] {entry}")

log_terminal(f"Node initialized on port {NODE_PORT}")

def format_address(address):
    if not address or address == "COINBASE":
        return "COINBASE"
    if len(address) > 18:
        return f"{address[:8]}...{address[-6:]}"
    return address

def get_or_create_alias(address):
    if not address or address == "COINBASE":
        return "COINBASE"
    return ALIASES.get(address, format_address(address))

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
                    save_node_state()
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

        miner_addr = active_node_wallet.public_key if active_node_wallet else keystore_address
        if auto_mining_enabled and len(blockchain.pending_transactions) > 0 and miner_addr:
            try:
                log_terminal(f"Auto-Miner: {len(blockchain.pending_transactions)} pending TX(s) found. Mining...", "mine")
                new_block, stats = blockchain.mine_pending_transactions(miner_address=miner_addr)
                save_node_state()
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

        elif parsed.path == "/wallet/status":
            status = "unlocked" if active_node_wallet is not None else ("locked" if os.path.exists(KEYSTORE_FILE) else "no_wallet")
            addr = active_node_wallet.public_key if active_node_wallet else keystore_address
            self._send_json_response({
                "status": status,
                "address": addr,
                "alias": DEFAULT_NODE_NAME
            })

        elif parsed.path == "/wallet/current":
            if active_node_wallet is None:
                status = "locked" if os.path.exists(KEYSTORE_FILE) else "no_wallet"
                self._send_json_response({
                    "status": status,
                    "alias": DEFAULT_NODE_NAME,
                    "address": keystore_address,
                    "public_key": keystore_address,
                    "error": "Cüzdan kilitli veya henüz oluşturulmadı"
                }, 200)
            else:
                self._send_json_response({
                    "status": "unlocked",
                    "alias": DEFAULT_NODE_NAME,
                    "address": active_node_wallet.public_key,
                    "public_key": active_node_wallet.public_key,
                    "mnemonic": getattr(active_node_wallet, "mnemonic", "")
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
        global auto_mining_enabled, active_node_wallet, keystore_address
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            body = json.loads(post_body)
        except Exception:
            body = {}

        if parsed.path == "/wallet/create":
            password = body.get("password", "").strip()
            if not password:
                self._send_json_response({"error": "Lütfen cüzdanı şifrelemek için bir parola belirleyin."}, 400)
                return
            w = Wallet.generate_with_mnemonic()
            w.save_keystore_file(KEYSTORE_FILE, password)
            active_node_wallet = w
            keystore_address = w.public_key
            ALIASES[w.public_key] = DEFAULT_NODE_NAME
            log_terminal(f"Created new HD Wallet (BIP-39 12 words) for {DEFAULT_NODE_NAME}", "wallet")
            self._send_json_response({
                "status": "unlocked",
                "address": w.public_key,
                "public_key": w.public_key,
                "mnemonic": w.mnemonic,
                "alias": DEFAULT_NODE_NAME
            }, 201)

        elif parsed.path == "/wallet/import":
            mnemonic_str = body.get("mnemonic", "").strip()
            password = body.get("password", "").strip()
            if not mnemonic_str or not password:
                self._send_json_response({"error": "12 kelimelik tohum ve parola zorunludur."}, 400)
                return
            try:
                w = Wallet.from_mnemonic(mnemonic_str)
                w.save_keystore_file(KEYSTORE_FILE, password)
                active_node_wallet = w
                keystore_address = w.public_key
                ALIASES[w.public_key] = DEFAULT_NODE_NAME
                log_terminal(f"Imported HD Wallet via seed phrase for {DEFAULT_NODE_NAME}", "wallet")
                self._send_json_response({
                    "status": "unlocked",
                    "address": w.public_key,
                    "public_key": w.public_key,
                    "alias": DEFAULT_NODE_NAME
                }, 200)
            except Exception as e:
                self._send_json_response({"error": f"İçe aktarma hatası: {e}"}, 400)

        elif parsed.path == "/wallet/unlock":
            password = body.get("password", "").strip()
            if not os.path.exists(KEYSTORE_FILE):
                self._send_json_response({"error": "Kayıtlı cüzdan dosyası bulunamadı."}, 404)
                return
            try:
                w = Wallet.load_keystore_file(KEYSTORE_FILE, password)
                active_node_wallet = w
                keystore_address = w.public_key
                ALIASES[w.public_key] = DEFAULT_NODE_NAME
                log_terminal(f"Wallet unlocked successfully for {DEFAULT_NODE_NAME}", "wallet")
                self._send_json_response({
                    "status": "unlocked",
                    "address": w.public_key,
                    "public_key": w.public_key,
                    "alias": DEFAULT_NODE_NAME,
                    "mnemonic": getattr(w, "mnemonic", "")
                }, 200)
            except Exception as e:
                log_terminal(f"Failed unlock attempt: {e}", "warn")
                self._send_json_response({"error": str(e)}, 401)

        elif parsed.path == "/wallet/lock":
            active_node_wallet = None
            log_terminal(f"Wallet locked by user for {DEFAULT_NODE_NAME}", "wallet")
            self._send_json_response({"status": "locked"})

        elif parsed.path == "/wallet/reset":
            active_node_wallet = None
            keystore_address = None
            if os.path.exists(KEYSTORE_FILE):
                try:
                    os.remove(KEYSTORE_FILE)
                except Exception:
                    pass
            log_terminal("Wallet keystore reset. Ready for new wallet.", "wallet")
            self._send_json_response({"status": "no_wallet"})

        elif parsed.path == "/miner/toggle":
            auto_mining_enabled = not auto_mining_enabled
            log_terminal(f"Auto-Mining toggled to: {'ENABLED' if auto_mining_enabled else 'DISABLED'}", "mine")
            self._send_json_response({"auto_mining": auto_mining_enabled})

        elif parsed.path == "/transactions/sign_and_send":
            if active_node_wallet is None:
                self._send_json_response({"error": "Cüzdan kilitli! Transfer göndermek için lütfen önce parolanızla cüzdanınızı açın."}, 401)
                return
            try:
                recipient = body.get("recipient", "").strip()
                for pub, name in ALIASES.items():
                    if name.lower() == recipient.lower():
                        recipient = pub
                        break

                amount = float(body.get("amount", 0))
                tx = Transaction(active_node_wallet.public_key, recipient, amount)
                tx.sign_transaction(active_node_wallet)
                blockchain.add_transaction(tx)

                sender_name = get_or_create_alias(active_node_wallet.public_key)
                recipient_name = get_or_create_alias(recipient)
                log_terminal(f"Signed TX: {sender_name} ➜ {recipient_name} ({amount} Coin)", "tx")

                tx_payload = tx.to_dict()
                threading.Thread(target=broadcast_transaction_to_peers, args=(tx_payload,)).start()

                self._send_json_response({"message": "Transaction signed and broadcasted to network", "tx": tx_payload}, 201)
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
            miner_address = body.get("miner_address") or (active_node_wallet.public_key if active_node_wallet else keystore_address)
            if not miner_address:
                self._send_json_response({"error": "Madencilik ödülü için geçerli cüzdan bulunamadı. Lütfen önce cüzdan oluşturun veya kilidini açın."}, 400)
                return
            miner_name = get_or_create_alias(miner_address)
            log_terminal(f"Manual Mine triggered for {miner_name}...", "mine")
            new_block, stats = blockchain.mine_pending_transactions(miner_address=miner_address)
            save_node_state()

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
                save_node_state()
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
