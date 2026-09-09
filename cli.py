import sys
from blockchain import Blockchain
from wallet import Wallet
from transaction import Transaction

def print_menu():
    print("\n" + "=" * 40)
    print("       CtrlC-Coin Node Client")
    print("=" * 40)
    print("1. Generate New Wallet")
    print("2. List Wallets & Switch Active Wallet")
    print("3. Check Balance of Active Wallet")
    print("4. Send Transaction from Active Wallet")
    print("5. Mine Pending Transactions")
    print("6. View Blockchain")
    print("7. Validate Blockchain")
    print("8. Exit")
    print("=" * 40)

def main():
    blockchain = Blockchain(difficulty=2, mining_reward=50)
    wallets = []
    active_wallet = None

    print("Blockchain node started. Genesis block ready.")

    while True:
        print_menu()
        choice = input("Select an option (1-8): ").strip()

        if choice == "1":
            w = Wallet()
            wallets.append(w)
            active_wallet = w
            print(f"\n[Wallet Created & Activated - Wallet #{len(wallets)}]")
            print(f"Address: {w.public_key}")

        elif choice == "2":
            if not wallets:
                print("\nNo wallets available. Please create one (Option 1).")
                continue
            print("\nAvailable Wallets:")
            for idx, w in enumerate(wallets, 1):
                is_active = " (ACTIVE)" if w == active_wallet else ""
                balance = blockchain.get_balance_of_address(w.public_key)
                print(f"[{idx}] {w.public_key} | Balance: {balance} Coin{is_active}")

            sel = input("\nEnter wallet number to switch (or press Enter to keep current): ").strip()
            if sel.isdigit() and 1 <= int(sel) <= len(wallets):
                active_wallet = wallets[int(sel) - 1]
                print(f"\nSwitched to Wallet #{sel} ({active_wallet.public_key})")

        elif choice == "3":
            if not active_wallet:
                print("\nPlease create a wallet first (Option 1).")
                continue
            balance = blockchain.get_balance_of_address(active_wallet.public_key)
            print(f"\nActive Wallet: {active_wallet.public_key}")
            print(f"Current Balance: {balance} CtrlC-Coin")

        elif choice == "4":
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

        elif choice == "5":
            if not active_wallet:
                print("\nPlease create a wallet first (Option 1) to receive mining reward.")
                continue

            print("\nMining pending transactions...")
            blockchain.mine_pending_transactions(miner_address=active_wallet.public_key)
            print("[Success] Block mined! Reward awarded to active wallet.")

        elif choice == "6":
            print(f"\nTotal Blocks: {len(blockchain.chain)}")
            for b in blockchain.chain:
                print(f"\n--- Block {b.index} ---")
                print(f"Hash:          {b.hash}")
                print(f"Previous Hash: {b.previous_hash}")
                print(f"Nonce:         {b.nonce}")
                print(f"Transactions:  {len(b.transactions)}")

        elif choice == "7":
            is_valid = blockchain.is_chain_valid()
            print(f"\nBlockchain validity: {'VALID' if is_valid else 'CORRUPTED'}")

        elif choice == "8":
            print("\nExiting CtrlC-Coin node.")
            sys.exit(0)

        else:
            print("\nInvalid choice. Please choose 1-8.")

if __name__ == "__main__":
    main()
