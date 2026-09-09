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

def generate_random_alias():
    """Generates a memorable 4-letter uppercase name (e.g. NOVA, ZEUS, LUNA, KORA)."""
    consonants = "BCDFGHJKLMNPQRSTVWXYZ"
    vowels = "AEIOU"
    pattern = random.choice(["CVCV", "CVCC", "VCVC"])
    return "".join(random.choice(consonants) if c == "C" else random.choice(vowels) for c in pattern).upper()

CHAIN_FILE = f"chaindata_{NODE_PORT}.json"
KEYSTORE_FILE = f"keystore_{NODE_PORT}.json"

active_node_wallet = None
keystore_address = None
keystore_alias = None
ALIASES = {}

if os.path.exists(KEYSTORE_FILE):
    try:
        with open(KEYSTORE_FILE, "r", encoding="utf-8") as f:
            keystore_data = json.load(f)
            keystore_address = keystore_data.get("address")
            keystore_alias = keystore_data.get("alias")
            if not keystore_alias:
                keystore_alias = generate_random_alias()
                keystore_data["alias"] = keystore_alias
                with open(KEYSTORE_FILE, "w", encoding="utf-8") as fw:
                    json.dump(keystore_data, fw, indent=2)
            if keystore_address and keystore_alias:
                ALIASES[keystore_address] = keystore_alias
    except Exception:
        pass

def get_current_alias():
    if active_node_wallet and getattr(active_node_wallet, "alias", None):
        return active_node_wallet.alias
    if keystore_alias:
        return keystore_alias
    return f"NODE_{NODE_PORT}"

DEFAULT_NODE_NAME = get_current_alias()

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

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# In-memory circular log buffer for the embedded live terminal app
node_logs = collections.deque(maxlen=100)

def log_terminal(msg, level="info"):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{level.upper()}] {msg}"
    node_logs.append(entry)
    print(f"[{get_current_alias()}] {entry}")

log_terminal(f"Node initialized on port {NODE_PORT} (Alias: {get_current_alias()})")

class MiningTelemetry:
    """Real-time Proof-of-Work mining and nonce telemetry buffer."""
    def __init__(self):
        self.lock = threading.Lock()
        self.is_mining = False
        self.status = "idle"  # "idle" | "mining" | "nonce_found" | "peer_checking" | "peer_accepted" | "race_lost" | "peer_rejected"
        self.status_text_tr = "Beklemede (Madenci beklemede...)"
        self.status_text_en = "Idle (Awaiting miner activation...)"
        self.block_index = 0
        self.difficulty = Config.INITIAL_DIFFICULTY
        self.current_nonce = 0
        self.last_hash = ""
        self.hash_rate = 0
        self.recent_nonces = collections.deque(maxlen=40)
        self.mining_logs = collections.deque(maxlen=120)
        self.last_update = time.time()

    def add_log(self, text, log_type="pow"):
        t_str = time.strftime("%H:%M:%S")
        self.mining_logs.append({
            "time": t_str,
            "type": log_type,
            "text": text
        })

    def start_mining(self, block_index, difficulty, miner_alias):
        with self.lock:
            self.is_mining = True
            self.status = "mining"
            self.block_index = block_index
            self.difficulty = difficulty
            self.status_text_tr = f"[POW] Blok #{block_index} için Nonce taranıyor... (Hedef: {'0'*difficulty})"
            self.status_text_en = f"[POW] Mining Block #{block_index}... (Target: {'0'*difficulty})"
            self.add_log(f"[START] Blok #{block_index} kazımı başlatıldı. Hedef zorluk: {difficulty} ({'0'*difficulty})", "start")

    def record_progress(self, block_index, nonce, hsh, hash_rate, difficulty, won=False):
        with self.lock:
            self.block_index = block_index
            self.current_nonce = nonce
            self.last_hash = hsh
            self.hash_rate = hash_rate
            self.difficulty = difficulty
            self.is_mining = True
            self.last_update = time.time()
            self.recent_nonces.append({
                "nonce": nonce,
                "hash": hsh,
                "time": time.strftime("%H:%M:%S")
            })

            if won:
                self.status = "nonce_found"
                self.status_text_tr = f"[SOLVED] Nonce bulundu! (#{nonce:,}) -> Ağa iletiliyor..."
                self.status_text_en = f"[SOLVED] Nonce found! (#{nonce:,}) -> Broadcasting to network..."
                self.add_log(f"[SOLVED] Nonce bulundu! (#{nonce:,}) -> Hash: {hsh} | Ağa iletiliyor...", "win")
            elif len(self.mining_logs) == 0 or (nonce % 6000 < 1500):
                leading_zeros = len(hsh) - len(hsh.lstrip('0'))
                tag = f"[{leading_zeros} Sıfır Yakalandı!]" if leading_zeros >= 2 else "(Taranıyor...)"
                self.add_log(f"[POW] Nonce: #{nonce:,} -> Hash: {hsh[:18]}... {tag}", "pow")

    def on_nonce_found(self, block_index, nonce, hsh):
        with self.lock:
            self.status = "nonce_found"
            self.status_text_tr = f"[SOLVED] Nonce bulundu! (#{nonce:,}) -> Ağa iletiliyor..."
            self.status_text_en = f"[SOLVED] Nonce found! (#{nonce:,}) -> Broadcasting to network..."
            self.add_log(f"[SOLVED] Nonce bulundu! (#{nonce:,}) -> Hash: {hsh} | Ağa iletiliyor...", "win")

    def on_block_broadcast(self, block_index, peer_count, reward=50):
        with self.lock:
            self.status = "block_propagated"
            self.status_text_tr = f"[NET] Blok #{block_index} ağa başarıyla iletildi (+{reward} COIN)"
            self.status_text_en = f"[NET] Block #{block_index} broadcasted to network (+{reward} COIN)"
            self.add_log(f"[NET] Blok #{block_index} {peer_count} eşe iletildi ve zincire eklendi (+{reward} COIN)", "network")

    def on_peer_block_received(self, block_index, peer_alias, nonce, hsh):
        with self.lock:
            self.status = "peer_checking"
            self.status_text_tr = f"[PEER] Başka birisi buldu (Eş: [{peer_alias}]) -> Blok #{block_index} alındı, kontrol ediliyor..."
            self.status_text_en = f"[PEER] Peer [{peer_alias}] found block! Verifying Block #{block_index}..."
            self.add_log(f"[PEER] Başka birisi buldu: [{peer_alias}] Blok #{block_index} (Nonce: #{nonce:,}) iletti, kontrol ediliyor...", "peer")

    def on_peer_block_accepted(self, block_index, peer_alias):
        with self.lock:
            self.status = "peer_accepted"
            self.status_text_tr = f"[ACCEPTED] Başka birisi buldu: PoW ve kurallar doğrulandı, kabul edildi!"
            self.status_text_en = f"[ACCEPTED] Peer block verified: PoW & consensus valid, accepted!"
            self.add_log(f"[ACCEPTED] Eş [{peer_alias}] tarafından bulunan Blok #{block_index} kontrol edildi: Kabul edildi ve zincire eklendi!", "accepted")

    def on_peer_block_rejected(self, block_index, peer_alias):
        with self.lock:
            self.status = "peer_rejected"
            self.status_text_tr = f"[REJECTED] Eşten gelen Blok #{block_index} geçersiz: PoW veya imza reddedildi!"
            self.status_text_en = f"[REJECTED] Block #{block_index} rejected: Invalid PoW or signature!"
            self.add_log(f"[REJECTED] Eş [{peer_alias}] tarafından iletilen blok geçersiz bulundu ve reddedildi!", "warn")

    def on_race_lost(self, block_index):
        with self.lock:
            self.status = "race_lost"
            self.status_text_tr = f"[RACE] Yarış kaybedildi: Eş bloğu önce çözdü. Yeni blok başlatılıyor..."
            self.status_text_en = f"[RACE] Race lost: Peer solved block first. Preparing next block..."
            self.add_log(f"[RACE] Yarış kaybedildi: Eş bloğu daha önce çözdü. Sıradaki Blok #{block_index + 1} için madenci yeniden başlatılıyor...", "race")

    def set_idle(self, auto_mining_on=False, has_wallet=True):
        with self.lock:
            self.is_mining = False
            self.hash_rate = 0
            if not has_wallet:
                self.status = "idle"
                self.status_text_tr = "[WARN] Cüzdan kilitli. Madencilik için cüzdanınızı açın."
                self.status_text_en = "[WARN] Wallet locked. Unlock wallet to mine."
            elif not auto_mining_on:
                self.status = "idle"
                self.status_text_tr = "[IDLE] Oto-Madenci Kapalı. Başlatmak için 'Oto-Madenci' butonuna tıklayın."
                self.status_text_en = "[IDLE] Auto-Miner OFF. Click 'Auto-Miner' button to start."
            else:
                self.status = "idle"
                self.status_text_tr = "[STANDBY] Madenci beklemede (Yeni blok bekleniyor...)"
                self.status_text_en = "[STANDBY] Miner standby (Awaiting next block...)"

    def get_snapshot(self):
        with self.lock:
            return {
                "is_mining": self.is_mining,
                "status": self.status,
                "status_text_tr": self.status_text_tr,
                "status_text_en": self.status_text_en,
                "block_index": self.block_index,
                "difficulty": self.difficulty,
                "target": "0" * self.difficulty,
                "current_nonce": self.current_nonce,
                "last_hash": self.last_hash,
                "hash_rate": self.hash_rate,
                "recent_nonces": list(self.recent_nonces),
                "logs": list(self.mining_logs)
            }

mining_telemetry = MiningTelemetry()

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
    my_urls = {f"http://127.0.0.1:{NODE_PORT}", f"http://localhost:{NODE_PORT}"}
    for peer in list(peers):
        if peer.rstrip("/") in my_urls:
            peers.discard(peer)
            continue
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
    my_urls = {f"http://127.0.0.1:{NODE_PORT}", f"http://localhost:{NODE_PORT}"}
    for peer in list(peers):
        if peer.rstrip("/") in my_urls:
            peers.discard(peer)
            continue
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
        if auto_mining_enabled and miner_addr:
            try:
                candidate_index = len(blockchain.chain)
                target_diff = blockchain.difficulty
                mining_telemetry.start_mining(
                    block_index=candidate_index,
                    difficulty=target_diff,
                    miner_alias=get_current_alias()
                )
                log_terminal(f"Auto-Miner: Searching Block #{candidate_index} (Diff: {target_diff})...", "mine")

                def on_progress(block_idx, nonce, hsh, hash_rate, diff, won=False):
                    mining_telemetry.record_progress(block_idx, nonce, hsh, hash_rate, diff, won)

                new_block, stats = blockchain.mine_pending_transactions(
                    miner_address=miner_addr,
                    progress_callback=on_progress
                )

                if new_block is None:
                    mining_telemetry.on_race_lost(len(blockchain.chain))
                    log_terminal("Auto-Miner: Race lost! Peer mined block first. Yielding.", "mine")
                    continue

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
                mining_telemetry.on_nonce_found(new_block.index, new_block.nonce, new_block.hash)
                mining_telemetry.on_block_broadcast(new_block.index, len(peers), reward=blockchain.current_mining_reward)
                log_terminal(f"Auto-Miner: WON Block #{new_block.index} (Nonce: {new_block.nonce}, Diff: {new_block.difficulty})", "mine")
                threading.Thread(target=broadcast_block_to_peers, args=(block_dict,)).start()
            except Exception as e:
                log_terminal(f"Auto-Miner error: {e}", "error")
        else:
            mining_telemetry.set_idle(auto_mining_enabled, miner_addr is not None)

def auto_discovery_loop():
    """
    Decentralized P2P Peer Discovery & Health Monitor.
    Automatically scans local network ports (5000-5010) to discover active CtrlC-Coin nodes,
    initiates mutual handshakes, synchronizes blockchain states, and prunes dead connections.
    """
    time.sleep(1.0)
    while True:
        # 1. Probe candidate ports on local network
        candidate_ports = [p for p in range(5000, 5011) if p != NODE_PORT]
        for p in candidate_ports:
            peer_url = f"http://127.0.0.1:{p}"
            if peer_url in peers:
                continue

            try:
                probe_req = urllib.request.Request(f"{peer_url}/wallet/status")
                with urllib.request.urlopen(probe_req, timeout=0.6) as resp:
                    if resp.status == 200:
                        peer_info = json.loads(resp.read().decode("utf-8"))
                        p_addr = peer_info.get("address")
                        p_alias = peer_info.get("alias")
                        if p_addr and p_alias:
                            ALIASES[p_addr] = p_alias
                        peers.add(peer_url)
                        display_peer = f"[{p_alias}]" if p_alias else f"Port {p}"
                        log_terminal(f"Auto-Discovery: Found active peer {display_peer}! Initiating handshake...", "p2p")

                        # Mutual handshake: register our node on the discovered peer
                        try:
                            my_addr = keystore_address or (active_node_wallet.public_key if active_node_wallet else None)
                            handshake_payload = json.dumps({
                                "nodes": [f"http://127.0.0.1:{NODE_PORT}"],
                                "alias": get_current_alias(),
                                "address": my_addr
                            }).encode("utf-8")
                            reg_req = urllib.request.Request(
                                f"{peer_url}/nodes/register",
                                data=handshake_payload,
                                headers={"Content-Type": "application/json"}
                            )
                            with urllib.request.urlopen(reg_req, timeout=1.0) as reg_resp:
                                reg_resp.read()
                        except Exception:
                            pass

                        # Immediate ledger synchronization
                        sync_chain_with_peers()
            except Exception:
                pass

        # 2. Health check active peers and prune disconnected ones
        for active_peer in list(peers):
            try:
                check_req = urllib.request.Request(f"{active_peer}/wallet/status")
                with urllib.request.urlopen(check_req, timeout=0.8) as resp:
                    if resp.status != 200:
                        raise Exception("Unreachable")
            except Exception:
                peers.discard(active_peer)
                log_terminal(f"P2P Network: Peer {active_peer} disconnected.", "warn")

        time.sleep(2.0)

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
                "alias": get_current_alias()
            })

        elif parsed.path == "/wallet/current":
            if active_node_wallet is None:
                status = "locked" if os.path.exists(KEYSTORE_FILE) else "no_wallet"
                self._send_json_response({
                    "status": status,
                    "alias": get_current_alias(),
                    "address": keystore_address,
                    "public_key": keystore_address,
                    "error": "Cüzdan kilitli veya henüz oluşturulmadı"
                }, 200)
            else:
                self._send_json_response({
                    "status": "unlocked",
                    "alias": get_current_alias(),
                    "address": active_node_wallet.public_key,
                    "public_key": active_node_wallet.public_key,
                    "mnemonic": getattr(active_node_wallet, "mnemonic", "")
                })

        elif parsed.path == "/chain":
            chain_data = []
            for b in blockchain.chain:
                miner_addr = None
                if b.transactions:
                    first_tx = b.transactions[0]
                    first_s = first_tx.sender if hasattr(first_tx, "sender") else first_tx.get("sender")
                    first_r = first_tx.recipient if hasattr(first_tx, "recipient") else first_tx.get("recipient")
                    if first_s is None or first_s == "COINBASE":
                        miner_addr = first_r

                miner_alias = ALIASES.get(miner_addr, format_address(miner_addr)) if miner_addr else "GENESIS"

                tx_list = []
                for tx in b.transactions:
                    tx_dict = tx if isinstance(tx, dict) else tx.to_dict()
                    s = tx_dict.get("sender")
                    r = tx_dict.get("recipient")
                    tx_dict["sender_alias"] = ALIASES.get(s, "COINBASE" if not s else format_address(s))
                    tx_dict["recipient_alias"] = ALIASES.get(r, format_address(r))
                    tx_list.append(tx_dict)

                chain_data.append({
                    "index": b.index,
                    "hash": b.hash,
                    "previous_hash": b.previous_hash,
                    "nonce": b.nonce,
                    "difficulty": getattr(b, "difficulty", 2),
                    "timestamp": b.timestamp,
                    "miner": miner_addr,
                    "miner_alias": miner_alias,
                    "transactions": tx_list
                })

            self._send_json_response({
                "length": len(chain_data),
                "total_peers": len(peers),
                "auto_mining": auto_mining_enabled,
                "difficulty": blockchain.difficulty,
                "node_name": get_current_alias(),
                "aliases": ALIASES,
                "chain": chain_data
            })

        elif parsed.path == "/pending":
            pending = []
            for tx in blockchain.pending_transactions:
                t_dict = tx.to_dict()
                s = t_dict.get("sender")
                r = t_dict.get("recipient")
                t_dict["sender_alias"] = ALIASES.get(s, "COINBASE" if not s else format_address(s))
                t_dict["recipient_alias"] = ALIASES.get(r, format_address(r))
                pending.append(t_dict)
            self._send_json_response({"pending_transactions": pending})

        elif parsed.path == "/nodes/resolve":
            sync_chain_with_peers()
            self._send_json_response({
                "message": "Consensus sync completed.",
                "chain_length": len(blockchain.chain)
            })

        elif parsed.path == "/mining/telemetry":
            self._send_json_response(mining_telemetry.get_snapshot())

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

    def do_POST(self):
        global auto_mining_enabled, active_node_wallet, keystore_address, keystore_alias
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
            alias = generate_random_alias()
            w.alias = alias
            w.save_keystore_file(KEYSTORE_FILE, password, alias=alias)
            active_node_wallet = w
            keystore_address = w.public_key
            keystore_alias = alias
            ALIASES[w.public_key] = alias
            log_terminal(f"Created new HD Wallet [{alias}] (BIP-39 12 words)", "wallet")
            self._send_json_response({
                "status": "unlocked",
                "address": w.public_key,
                "public_key": w.public_key,
                "mnemonic": w.mnemonic,
                "alias": alias
            }, 201)

        elif parsed.path == "/wallet/import":
            mnemonic_str = body.get("mnemonic", "").strip()
            password = body.get("password", "").strip()
            if not mnemonic_str or not password:
                self._send_json_response({"error": "12 kelimelik tohum ve parola zorunludur."}, 400)
                return
            try:
                w = Wallet.from_mnemonic(mnemonic_str)
                alias = generate_random_alias()
                w.alias = alias
                w.save_keystore_file(KEYSTORE_FILE, password, alias=alias)
                active_node_wallet = w
                keystore_address = w.public_key
                keystore_alias = alias
                ALIASES[w.public_key] = alias
                log_terminal(f"Imported HD Wallet [{alias}] via seed phrase", "wallet")
                self._send_json_response({
                    "status": "unlocked",
                    "address": w.public_key,
                    "public_key": w.public_key,
                    "alias": alias
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
                if not getattr(w, "alias", None):
                    w.alias = keystore_alias or generate_random_alias()
                    w.save_keystore_file(KEYSTORE_FILE, password, alias=w.alias)
                active_node_wallet = w
                keystore_address = w.public_key
                keystore_alias = w.alias
                ALIASES[w.public_key] = w.alias
                log_terminal(f"Wallet [{w.alias}] unlocked successfully", "wallet")
                self._send_json_response({
                    "status": "unlocked",
                    "address": w.public_key,
                    "public_key": w.public_key,
                    "alias": w.alias,
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
            miner_addr = active_node_wallet.public_key if active_node_wallet else keystore_address
            mining_telemetry.set_idle(auto_mining_enabled, miner_addr is not None)
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
                log_terminal(f"Signed TX: {sender_name} -> {recipient_name} ({amount} Coin)", "tx")

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
            log_terminal(f"Received TX from P2P: {s_name} -> {r_name} ({body['amount']} Coin)", "p2p")

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
            candidate_index = len(blockchain.chain)
            target_diff = blockchain.difficulty
            mining_telemetry.start_mining(
                block_index=candidate_index,
                difficulty=target_diff,
                miner_alias=miner_name
            )

            def on_progress(block_idx, nonce, hsh, hash_rate, diff, won=False):
                mining_telemetry.record_progress(block_idx, nonce, hsh, hash_rate, diff, won)

            new_block, stats = blockchain.mine_pending_transactions(
                miner_address=miner_address,
                progress_callback=on_progress
            )
            if new_block is None:
                mining_telemetry.on_race_lost(len(blockchain.chain))
                log_terminal("Manual Mine aborted: Peer mined block first.", "mine")
                self._send_json_response({"message": "Mining aborted: peer solved block first."}, 200)
                return
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

            mining_telemetry.on_nonce_found(new_block.index, new_block.nonce, new_block.hash)
            mining_telemetry.on_block_broadcast(new_block.index, len(peers), reward=blockchain.current_mining_reward)
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

            remote_miner_addr = None
            if b_data.get("transactions"):
                first_tx = b_data["transactions"][0]
                first_s = first_tx.get("sender")
                first_r = first_tx.get("recipient")
                if first_s is None or first_s == "COINBASE":
                    remote_miner_addr = first_r
            remote_miner_alias = ALIASES.get(remote_miner_addr, format_address(remote_miner_addr))

            mining_telemetry.on_peer_block_received(
                block_index=b_data.get("index", 0),
                peer_alias=remote_miner_alias,
                nonce=b_data.get("nonce", 0),
                hsh=b_data.get("hash", "")
            )

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

            status = blockchain.add_received_block(candidate_block)
            if status == "accepted":
                save_node_state()
                mining_telemetry.on_peer_block_accepted(candidate_block.index, remote_miner_alias)
                log_terminal(f"Accepted winning Block #{candidate_block.index} from peer! Appended to chain.", "p2p")
                self._send_json_response({"message": "Block accepted and appended to local chain"}, 200)
            elif status == "duplicate":
                self._send_json_response({"message": "Block already in chain"}, 200)
            elif status == "fork":
                mining_telemetry.add_log(f"[FORK] Eşzamanlı blok tespit edildi. Senkronize ediliyor...", "consensus")
                log_terminal(f"Fork detected at Block #{candidate_block.index}: Competing block mined simultaneously. Resolving longest chain...", "consensus")
                sync_chain_with_peers()
                self._send_json_response({"message": "Triggered chain resync"}, 200)
            elif status == "gap":
                mining_telemetry.add_log(f"[GAP] Blok #{candidate_block.index} için ara bloklar eksik. Eşten çekiliyor...", "consensus")
                log_terminal(f"Chain gap at Block #{candidate_block.index}. Catching up with peer...", "consensus")
                sync_chain_with_peers()
                self._send_json_response({"message": "Triggered chain resync"}, 200)
            else:
                mining_telemetry.on_peer_block_rejected(candidate_block.index, remote_miner_alias)
                log_terminal(f"Rejected invalid Block #{candidate_block.index} from peer.", "warn")
                self._send_json_response({"error": "Invalid block"}, 400)

        elif parsed.path == "/nodes/register":
            nodes_list = body.get("nodes", [])
            remote_alias = body.get("alias")
            remote_addr = body.get("address")
            if remote_addr and remote_alias:
                ALIASES[remote_addr] = remote_alias

            my_clean_urls = {
                f"http://127.0.0.1:{NODE_PORT}",
                f"http://localhost:{NODE_PORT}"
            }
            new_added = False
            for node in nodes_list:
                cleaned = node.rstrip("/")
                if cleaned not in my_clean_urls and cleaned not in peers:
                    peers.add(cleaned)
                    new_added = True
                    log_terminal(f"P2P Handshake: Connected with peer [{remote_alias or cleaned}]", "p2p")

            if new_added:
                threading.Thread(target=sync_chain_with_peers, daemon=True).start()

            self._send_json_response({"message": "Peers registered", "total_peers": len(peers), "aliases": ALIASES})

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

def run():
    server_address = ("", NODE_PORT)
    miner_thread = threading.Thread(target=auto_miner_loop, daemon=True)
    miner_thread.start()

    discovery_thread = threading.Thread(target=auto_discovery_loop, daemon=True)
    discovery_thread.start()

    httpd = ThreadedHTTPServer(server_address, BlockchainHTTPHandler)
    log_terminal(f"HTTP Server online on port {NODE_PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
