from blockchain import Blockchain

def test_halving():
    print("=== Testing Halving (Reward Halves Every 5 Blocks) ===")
    bc = Blockchain(initial_difficulty=2)

    miner = "HalvingMiner"

    for i in range(1, 13):
        expected_reward = bc.current_mining_reward
        bc.mine_pending_transactions(miner_address=miner)
        latest = bc.get_latest_block()
        coinbase_tx = latest.transactions[0]
        print(f"Block #{latest.index} Mined | Reward: {coinbase_tx.amount} Coin | Miner Total Balance: {bc.get_balance_of_address(miner)} Coin")

if __name__ == "__main__":
    test_halving()
