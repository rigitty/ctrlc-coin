import sys
from blockchain import Blockchain
from wallet import Wallet
from transaction import Transaction

def print_menu():
    print("\n" + "=" * 40)
    print("       CtrlC-Coin Node Client")
    print("=" * 40)
    print("1. Generate New Wallet")
    print("2. Check Balance")
    print("3. Send Transaction")
    print("4. Mine Pending Transactions")
    print("5. View Blockchain")
    print("6. Validate Blockchain")
    print("7. Exit")
    print("=" * 40)

def main():
    blockchain = Blockchain(difficulty=2, mining_reward=50)
    active_wallet = None

    print("Blockchain node started. Genesis block ready.")

    while True:
        print_menu()
        choice = input("Select an option (1-7): ").strip()

        if choice == "1":
            active_wallet = Wallet()
            print("\n[Wallet Created]")
            print(f"Public Key (Address): {active_wallet.public_key}")

        elif choice == "2":
            if not active_wallet:
                print("\nPlease create a wallet first (Option 1).")
                continue
            balance = blockchain.get_balance_of_address(active_wallet.public_key)
            print(f"\nAddress: {active_wallet.public_key}")
            print(f"Current Balance: {balance} CtrlC-Coin")

        elif choice == "3":
            if not active_wallet:
                print("\nPlease create a wallet first (Option 1).")
                continue

            recipient = input("Enter recipient address: ").strip()
            try:
                amount = float(input("Enter amount to send: ").strip())
            except ValueError:
                print("\nInvalid amount format.")
                continue

            tx = Transaction(active_wallet.public_key, recipient, amount)
            try:
                tx.sign_transaction(active_wallet)
                blockchain.add_transaction(tx)
                print("\n[Success] Transaction signed and added to mempool.")
            except Exception as e:
                print(f"\n[Error] {e}")

        elif choice == "4":
            if not active_wallet:
                print("\nPlease create a wallet first (Option 1) to receive mining reward.")
                continue

            print("\nMining pending transactions...")
            blockchain.mine_pending_transactions(miner_address=active_wallet.public_key)
            print(f"[Success] Block mined! Reward awarded to your wallet.")

        elif choice == "5":
            print(f"\nTotal Blocks: {len(blockchain.chain)}")
            for b in blockchain.chain:
                print(f"\n--- Block {b.index} ---")
                print(f"Hash:          {b.hash}")
                print(f"Previous Hash: {b.previous_hash}")
                print(f"Nonce:         {b.nonce}")
                print(f"Transactions:  {len(b.transactions)}")

        elif choice == "6":
            is_valid = blockchain.is_chain_valid()
            print(f"\nBlockchain validity: {'VALID' if is_valid else 'CORRUPTED'}")

        elif choice == "7":
            print("\nExiting CtrlC-Coin node.")
            sys.exit(0)

        else:
            print("\nInvalid choice. Please choose 1-7.")

if __name__ == "__main__":
    main()
