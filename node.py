import json
import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse
import urllib.request

from block import Block
from blockchain import Blockchain
from transaction import Transaction
from wallet import Wallet

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

blockchain = Blockchain(initial_difficulty=2)
peers = set()

ALIASES = {}
NAMES_POOL = ["Alice", "Kevin", "Bob", "Charlie", "David", "Emma", "Grace", "Oliver", "Sophia", "Lucas", "Liam", "Mia", "Zoe", "Noah", "Leo"]
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

def get_or_create_alias(address):
    if not address:
        return "System"
    if address not in ALIASES:
        used = set(ALIASES.values())
        avail = [n for n in NAMES_POOL if n not in used]
        ALIASES[address] = avail[0] if avail else f"User_{address[-4:]}"
    return ALIASES[address]

def broadcast_transaction_to_peers(tx_dict):
    for peer in list(peers):
        try:
            req = urllib.request.Request(
                f"{peer}/transactions/new",
                data=json.dumps(tx_dict).encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Broadcast": "true"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                resp.read()
        except Exception:
            pass

def broadcast_block_to_peers(block_dict):
    for peer in list(peers):
        try:
            req = urllib.request.Request(
                f"{peer}/blocks/receive",
                data=json.dumps({"block": block_dict, "aliases": ALIASES}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                resp.read()
        except Exception:
            pass

class BlockchainHTTPHandler(BaseHTTPRequestHandler):
    def _send_json_response(self, data, status_code=200):
        try:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def _serve_static_file(self, filename, content_type):
        filepath = os.path.join(WEB_DIR, filename)
        if os.path.exists(filepath):
            try:
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                with open(filepath, "rb") as f:
                    self.wfile.write(f.read())
            except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                pass
        else:
            self._send_json_response({"error": "File not found"}, 404)

    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path in ["", "/"]:
            self._serve_static_file("index.html", "text/html; charset=utf-8")
        elif parsed.path == "/style.css":
            self._serve_static_file("style.css", "text/css; charset=utf-8")
        elif parsed.path == "/app.js":
            self._serve_static_file("app.js", "application/javascript; charset=utf-8")
        elif parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()

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
                "aliases": ALIASES,
                "chain": chain_data
            })

        elif parsed.path == "/pending":
            pending = [tx.to_dict() for tx in blockchain.pending_transactions]
            self._send_json_response({"pending_transactions": pending})

        elif parsed.path == "/nodes/resolve":
            replaced = False
            for peer in list(peers):
                try:
                    req = urllib.request.Request(f"{peer}/chain")
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        peer_chain_data = data.get("chain", [])

                        peer_aliases = data.get("aliases", {})
                        for addr, alias in peer_aliases.items():
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
                            replaced = True
                except Exception as e:
                    print(f"Error reaching peer {peer}: {e}")

            self._send_json_response({
                "message": "Consensus completed. Chain replaced & orphan TXs recovered to mempool." if replaced else "Our chain is authoritative.",
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

        if parsed.path == "/wallet/new":
            w = Wallet()
            alias = get_or_create_alias(w.public_key)
            self._send_json_response({
                "alias": alias,
                "public_key": w.public_key,
                "private_key": list(w.private_key)
            })

        elif parsed.path == "/transactions/sign_and_send":
            try:
                w = Wallet()
                w.private_key = tuple(body["private_key"])
                w.public_key = body["sender"]

                tx = Transaction(body["sender"], body["recipient"], float(body["amount"]))
                tx.sign_transaction(w)
                blockchain.add_transaction(tx)

                get_or_create_alias(body["sender"])
                get_or_create_alias(body["recipient"])

                tx_payload = tx.to_dict()
                threading.Thread(target=broadcast_transaction_to_peers, args=(tx_payload,)).start()

                self._send_json_response({"message": "Transaction signed and broadcasted to network"}, 201)
            except Exception as e:
                self._send_json_response({"error": str(e)}, 400)

        elif parsed.path == "/transactions/new":
            required = ["sender", "recipient", "amount", "signature"]
            if not all(k in body for k in required):
                self._send_json_response({"error": "Missing transaction fields"}, 400)
                return

            tx = Transaction(body["sender"], body["recipient"], body["amount"])
            tx.signature = body["signature"]
            try:
                added = blockchain.add_transaction(tx)
                get_or_create_alias(body["sender"])
                get_or_create_alias(body["recipient"])

                is_broadcast = self.headers.get("X-Broadcast") == "true"
                if added and not is_broadcast:
                    threading.Thread(target=broadcast_transaction_to_peers, args=(body,)).start()

                self._send_json_response({"message": "Transaction added to mempool successfully"}, 201)
            except Exception as e:
                self._send_json_response({"error": str(e)}, 400)

        elif parsed.path == "/mine":
            miner_address = body.get("miner_address")
            if not miner_address:
                self._send_json_response({"error": "miner_address required"}, 400)
                return

            get_or_create_alias(miner_address)
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
                print(f"[P2P Network] Accepted winning Block #{candidate_block.index} from peer!")
                self._send_json_response({"message": "Block accepted and appended to local chain"}, 200)
            else:
                self._send_json_response({"message": "Block rejected or out of sync"}, 400)

        elif parsed.path == "/nodes/register":
            nodes_list = body.get("nodes", [])
            for node in nodes_list:
                peers.add(node.rstrip("/"))
            self._send_json_response({"message": "Peers registered", "total_peers": list(peers)})

        else:
            self._send_json_response({"error": "Endpoint not found"}, 404)

def run(port=5000):
    server_address = ("", port)
    httpd = ThreadedHTTPServer(server_address, BlockchainHTTPHandler)
    print(f"[*] CtrlC-Coin Node running on http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    run(port)
