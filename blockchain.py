import json
import time
from block import Block
from transaction import Transaction

class Blockchain:
    ADJUSTMENT_INTERVAL = 5       # Difficulty adjustment every 5 blocks
    TARGET_TIME_PER_BLOCK = 2     # Target seconds per block
    HALVING_INTERVAL = 5          # Mining reward halves every 5 blocks
    INITIAL_REWARD = 50           # Initial mining reward

    def __init__(self, initial_difficulty=2):
        self.difficulty = initial_difficulty
        self.pending_transactions = []
        self.chain = [self.create_genesis_block()]

    @property
    def current_mining_reward(self):
        # Calculate halving based on current chain length
        # Halvings count: number of times 5 blocks have passed
        halvings = len(self.chain) // self.HALVING_INTERVAL
        reward = self.INITIAL_REWARD / (2 ** halvings)
        return round(reward, 4)

    def create_genesis_block(self):
        genesis_block = Block(
            index=0,
            previous_hash="0",
            transactions=[],
            difficulty=self.difficulty
        )
        genesis_block.mine_block(self.difficulty)
        return genesis_block

    def get_latest_block(self):
        return self.chain[-1]

    def adjust_difficulty(self):
        if len(self.chain) < self.ADJUSTMENT_INTERVAL:
            return self.difficulty

        latest_block = self.get_latest_block()
        prev_adjustment_block = self.chain[-self.ADJUSTMENT_INTERVAL]

        actual_time = latest_block.timestamp - prev_adjustment_block.timestamp
        expected_time = self.ADJUSTMENT_INTERVAL * self.TARGET_TIME_PER_BLOCK

        if actual_time < (expected_time / 2):
            self.difficulty += 1
            print(f"\n[Difficulty Adjustment] Blocks mined too fast ({actual_time:.2f}s < {expected_time}s). Difficulty increased to {self.difficulty}!\n")
        elif actual_time > (expected_time * 2):
            self.difficulty = max(1, self.difficulty - 1)
            print(f"\n[Difficulty Adjustment] Blocks mined too slowly ({actual_time:.2f}s > {expected_time}s). Difficulty decreased to {self.difficulty}!\n")

        return self.difficulty

    def add_transaction(self, transaction):
        if not transaction.is_valid():
            raise ValueError("Invalid transaction signature!")

        if transaction.amount <= 0:
            raise ValueError("Transaction amount must be greater than 0!")

        if transaction.sender is not None:
            sender_balance = self.get_balance_of_address(transaction.sender)
            if sender_balance < transaction.amount:
                raise ValueError("Insufficient balance!")

        self.pending_transactions.append(transaction)

    def mine_pending_transactions(self, miner_address):
        # Dynamically calculate reward according to Halving rules
        reward_amount = self.current_mining_reward
        reward_tx = Transaction(sender=None, recipient=miner_address, amount=reward_amount)
        self.pending_transactions.append(reward_tx)

        if len(self.chain) % self.ADJUSTMENT_INTERVAL == 0:
            self.adjust_difficulty()

        latest_block = self.get_latest_block()
        new_block = Block(
            index=latest_block.index + 1,
            previous_hash=latest_block.hash,
            transactions=self.pending_transactions,
            difficulty=self.difficulty
        )
        new_block.mine_block(self.difficulty)
        self.chain.append(new_block)

        self.pending_transactions = []

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

            for tx in current_block.transactions:
                if hasattr(tx, "is_valid") and not tx.is_valid():
                    return False

        return True

    def replace_chain(self, new_chain):
        if len(new_chain) > len(self.chain) and self.is_chain_valid(new_chain):
            self.chain = new_chain
            self.difficulty = self.chain[-1].difficulty
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

        blockchain = cls(initial_difficulty=loaded_chain[-1].difficulty)
        blockchain.chain = loaded_chain

        if not blockchain.is_chain_valid():
            raise ValueError("Corrupted blockchain file: validation failed!")

        return blockchain
