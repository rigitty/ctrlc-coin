from block import Block

class Blockchain:
    def __init__(self):
        self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        return Block(index=0, previous_hash="0", data="Genesis Block")

    def get_latest_block(self):
        return self.chain[-1]

    def add_block(self, data):
        latest_block = self.get_latest_block()
        new_block = Block(
            index=latest_block.index + 1,
            previous_hash=latest_block.hash,
            data=data
        )
        self.chain.append(new_block)

    def is_chain_valid(self):
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i - 1]

            # 1. Has the current block data been tampered with?
            if current_block.hash != current_block.calculate_hash():
                return False

            # 2. Does the link between blocks break?
            if current_block.previous_hash != previous_block.hash:
                return False

        return True
