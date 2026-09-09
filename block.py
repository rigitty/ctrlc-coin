import hashlib
import json
import time

class Block:
    def __init__(self, index, previous_hash, transactions, timestamp=None, difficulty=2):
        self.index = index
        self.previous_hash = previous_hash
        self.transactions = transactions
        self.timestamp = timestamp or time.time()
        self.difficulty = difficulty
        self.nonce = 0
        self.hash = self.calculate_hash()

    def calculate_hash(self):
        serialized_tx = json.dumps(
            [tx if isinstance(tx, dict) else tx.to_dict() for tx in self.transactions],
            sort_keys=True
        )
        content = f"{self.index}{self.previous_hash}{serialized_tx}{self.timestamp}{self.nonce}{self.difficulty}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def mine_block(self, difficulty=None):
        diff = difficulty if difficulty is not None else self.difficulty
        self.difficulty = diff
        target = "0" * diff
        while not self.hash.startswith(target):
            self.nonce += 1
            self.hash = self.calculate_hash()
