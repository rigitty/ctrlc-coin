import json
import threading
import time
from block import Block
from transaction import Transaction
from config import Config

class Blockchain:
    def __init__(self, initial_difficulty=None, initial_reward=None):
        self.difficulty = initial_difficulty or Config.INITIAL_DIFFICULTY
        self.initial_reward = initial_reward or Config.INITIAL_REWARD
        self.adjustment_interval = Config.ADJUSTMENT_INTERVAL
        self.target_time_per_block = Config.TARGET_TIME_PER_BLOCK
        self.halving_interval = Config.HALVING_INTERVAL

        self.pending_transactions = []
        self.lock = threading.Lock()
        self.chain = [self.create_genesis_block()]

    @property
    def current_mining_reward(self):
        halvings = len(self.chain) // self.halving_interval
        reward = self.initial_reward / (2 ** halvings)
        return round(reward, 4)

    def create_genesis_block(self):
        genesis_block = Block(
            index=0,
            previous_hash="0",
            transactions=[],
            difficulty=1
        )
        genesis_block.mine_block(1)
        return genesis_block

    def get_latest_block(self):
        return self.chain[-1]

    def adjust_difficulty(self):
        if len(self.chain) < self.adjustment_interval:
            return self.difficulty

        latest_block = self.get_latest_block()
        prev_adjustment_block = self.chain[-self.adjustment_interval]

        actual_time = latest_block.timestamp - prev_adjustment_block.timestamp
        expected_time = self.adjustment_interval * self.target_time_per_block

        allow_decrease = getattr(Config, "ALLOW_DIFFICULTY_DECREASE", False)
        min_diff = getattr(Config, "MIN_DIFFICULTY", 6)

        if actual_time < (expected_time / 2):
            self.difficulty += 1
            print(f"\n[Difficulty Adjustment] Blocks mined too fast ({actual_time:.2f}s < {expected_time}s). Difficulty increased to {self.difficulty}!\n")
        elif actual_time > (expected_time * 2):
            if allow_decrease and self.difficulty > min_diff:
                self.difficulty = max(min_diff, self.difficulty - 1)
                print(f"\n[Difficulty Adjustment] Blocks mined too slowly ({actual_time:.2f}s > {expected_time}s). Difficulty decreased to {self.difficulty}!\n")
            else:
                print(f"\n[Difficulty Adjustment] Blocks mined slowly ({actual_time:.2f}s), but difficulty decrease is disabled (Floor: {min_diff}). Kept at {self.difficulty}.\n")

        return self.difficulty

    def add_transaction(self, transaction):
        with self.lock:
            # Reject coinbase transactions submitted by users
            if transaction.sender is None:
                return False

            if not transaction.is_valid():
                raise ValueError("Invalid transaction signature!")

            if transaction.amount <= 0:
                raise ValueError("Transaction amount must be greater than 0!")

            sender_balance = self.get_balance_of_address(transaction.sender)
            if sender_balance < transaction.amount:
                raise ValueError("Insufficient balance!")

            tx_hash = transaction.calculate_hash()
            for p_tx in self.pending_transactions:
                if p_tx.calculate_hash() == tx_hash:
                    return False

            self.pending_transactions.append(transaction)
            return True

    def mine_pending_transactions(self, miner_address):
        with self.lock:
            start_t = time.time()
            reward_amount = self.current_mining_reward
            reward_tx = Transaction(sender=None, recipient=miner_address, amount=reward_amount)

            # Strict Bitcoin rule: Coinbase is NEVER in mempool, it is injected directly into block[0]
            user_txs = [tx for tx in self.pending_transactions if tx.sender is not None]
            block_txs = [reward_tx] + user_txs

            if len(self.chain) % self.adjustment_interval == 0:
                self.adjust_difficulty()

            latest_block = self.get_latest_block()
            new_block = Block(
                index=latest_block.index + 1,
                previous_hash=latest_block.hash,
                transactions=block_txs,
                difficulty=self.difficulty
            )

            sample_logs = []
            target = "0" * self.difficulty
            while not new_block.hash.startswith(target):
                if new_block.nonce < 3 or new_block.nonce % 2000 == 0:
                    sample_logs.append({"nonce": new_block.nonce, "hash": new_block.hash[:16] + "..."})
                new_block.nonce += 1
                new_block.hash = new_block.calculate_hash()

            duration = time.time() - start_t
            self.chain.append(new_block)
            self.pending_transactions = []

            mining_stats = {
                "block_index": new_block.index,
                "difficulty": new_block.difficulty,
                "target": target,
                "winning_nonce": new_block.nonce,
                "winning_hash": new_block.hash,
                "duration": round(duration, 3),
                "samples": sample_logs[:5]
            }
            return new_block, mining_stats

    def add_received_block(self, block):
        with self.lock:
            latest = self.get_latest_block()

            # 1. Ignore duplicate blocks already in our chain
            if any(b.hash == block.hash for b in self.chain):
                return "duplicate"

            # 2. Competing block at same or lower height (Micro-Fork / Race)
            if block.index <= latest.index:
                return "fork"

            # 3. Missing intermediate blocks or parent mismatch
            if block.previous_hash != latest.hash or block.index != latest.index + 1:
                return "gap"

            if block.hash != block.calculate_hash():
                return "invalid"

            target = "0" * block.difficulty
            if not block.hash.startswith(target):
                return "invalid"

            # Strict validation: Exactly 1 coinbase reward transaction allowed per block
            coinbase_count = sum(1 for tx in block.transactions if (tx.sender is None if hasattr(tx, "sender") else tx.get("sender") is None))
            if coinbase_count > 1:
                return "invalid"

            for tx in block.transactions:
                if hasattr(tx, "is_valid") and not tx.is_valid():
                    return "invalid"

            self.chain.append(block)
            min_diff = getattr(Config, "MIN_DIFFICULTY", 5)
            allow_decrease = getattr(Config, "ALLOW_DIFFICULTY_DECREASE", False)
            self.difficulty = block.difficulty if allow_decrease else max(min_diff, block.difficulty)

            confirmed_hashes = {
                (tx if hasattr(tx, "calculate_hash") else Transaction(tx["sender"], tx["recipient"], tx["amount"])).calculate_hash()
                for tx in block.transactions
            }
            self.pending_transactions = [
                tx for tx in self.pending_transactions
                if tx.calculate_hash() not in confirmed_hashes
            ]

            return "accepted"

    def get_balance_of_address(self, address):
        balance = 0
        for block in self.chain:
            for tx in block.transactions:
                sender = tx.sender if hasattr(tx, "sender") else tx.get("sender")
                recipient = tx.recipient if hasattr(tx, "recipient") else tx.get("recipient")
                amount = tx.amount if hasattr(tx, "amount") else tx.get("amount")

                if sender == address:
                    balance -= amount
                if recipient == address:
                    balance += amount
        return balance

    def is_chain_valid(self, chain_to_validate=None):
        chain = chain_to_validate if chain_to_validate is not None else self.chain

        for i in range(1, len(chain)):
            current_block = chain[i]
            previous_block = chain[i - 1]

            if current_block.hash != current_block.calculate_hash():
                return False

            if current_block.previous_hash != previous_block.hash:
                return False

            target = "0" * current_block.difficulty
            if not current_block.hash.startswith(target):
                return False

            coinbase_count = sum(1 for tx in current_block.transactions if (tx.sender is None if hasattr(tx, "sender") else tx.get("sender") is None))
            if coinbase_count > 1:
                return False

            for tx in current_block.transactions:
                if hasattr(tx, "is_valid") and not tx.is_valid():
                    return False

        return True

    def replace_chain(self, new_chain):
        with self.lock:
            if len(new_chain) > len(self.chain) and self.is_chain_valid(new_chain):
                new_confirmed_hashes = set()
                for b in new_chain:
                    for tx in b.transactions:
                        tx_obj = tx if hasattr(tx, "calculate_hash") else Transaction(tx["sender"], tx["recipient"], tx["amount"])
                        new_confirmed_hashes.add(tx_obj.calculate_hash())

                recovered_txs = []
                for b in self.chain[1:]:
                    for tx in b.transactions:
                        tx_obj = tx if hasattr(tx, "calculate_hash") else Transaction(tx["sender"], tx["recipient"], tx["amount"])
                        if tx_obj.sender is not None and tx_obj.calculate_hash() not in new_confirmed_hashes:
                            recovered_txs.append(tx_obj)

                self.chain = new_chain
                self.difficulty = self.chain[-1].difficulty

                for r_tx in recovered_txs:
                    try:
                        self.add_transaction(r_tx)
                    except Exception:
                        pass

                return True
            return False

    def save_to_file(self, filepath="chaindata.json"):
        chain_data = []
        for block in self.chain:
            block_dict = {
                "index": block.index,
                "previous_hash": block.previous_hash,
                "timestamp": block.timestamp,
                "difficulty": block.difficulty,
                "nonce": block.nonce,
                "hash": block.hash,
                "transactions": [
                    tx if isinstance(tx, dict) else tx.to_dict()
                    for tx in block.transactions
                ]
            }
            chain_data.append(block_dict)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(chain_data, f, indent=4)

    @classmethod
    def load_from_file(cls, filepath="chaindata.json"):
        with open(filepath, "r", encoding="utf-8") as f:
            chain_data = json.load(f)

        loaded_chain = []
        for b_data in chain_data:
            tx_objs = []
            for tx_item in b_data["transactions"]:
                t = Transaction(tx_item["sender"], tx_item["recipient"], tx_item["amount"])
                t.signature = tx_item.get("signature")
                tx_objs.append(t)

            block = Block(
                index=b_data["index"],
                previous_hash=b_data["previous_hash"],
                transactions=tx_objs,
                timestamp=b_data["timestamp"],
                difficulty=b_data.get("difficulty", 2)
            )
            block.nonce = b_data["nonce"]
            block.hash = b_data["hash"]
            loaded_chain.append(block)

        min_diff = getattr(Config, "MIN_DIFFICULTY", 5)
        allow_decrease = getattr(Config, "ALLOW_DIFFICULTY_DECREASE", False)
        loaded_diff = loaded_chain[-1].difficulty
        effective_diff = loaded_diff if allow_decrease else max(min_diff, loaded_diff)

        blockchain = cls(initial_difficulty=effective_diff)
        blockchain.difficulty = effective_diff
        blockchain.chain = loaded_chain

        if not blockchain.is_chain_valid():
            raise ValueError("Corrupted blockchain file: validation failed!")

        return blockchain
