from block import Block
from transaction import Transaction

class Blockchain:
    def __init__(self, difficulty=2, mining_reward=10):
        self.difficulty = difficulty
        self.mining_reward = mining_reward
        self.pending_transactions = []
        self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        genesis_block = Block(index=0, previous_hash="0", transactions=[])
        genesis_block.mine_block(self.difficulty)
        return genesis_block

    def get_latest_block(self):
        return self.chain[-1]

    def add_transaction(self, transaction):
        self.pending_transactions.append(transaction)

    def mine_pending_transactions(self, miner_address):
        # 1. Add mining reward transaction (sender is None / System)
        reward_tx = Transaction(sender=None, recipient=miner_address, amount=self.mining_reward)
        self.pending_transactions.append(reward_tx)

        # 2. Bundle all pending transactions into a new block
        latest_block = self.get_latest_block()
        new_block = Block(
            index=latest_block.index + 1,
            previous_hash=latest_block.hash,
            transactions=self.pending_transactions
        )

        # 3. Mine the block and append to chain
        new_block.mine_block(self.difficulty)
        self.chain.append(new_block)

        # 4. Clear pending transactions
        self.pending_transactions = []

    def is_chain_valid(self):
        target = "0" * self.difficulty

        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i - 1]

            if current_block.hash != current_block.calculate_hash():
                return False

            if current_block.previous_hash != previous_block.hash:
                return False

            if not current_block.hash.startswith(target):
                return False

        return True
