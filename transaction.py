import hashlib
from wallet import Wallet

class Transaction:
    def __init__(self, sender, recipient, amount, signature=None, timestamp=None):
        self.sender = sender
        self.recipient = recipient
        self.amount = amount
        self.signature = signature
        # Unique per-creation marker so two identical transfers never collide.
        # Legacy transactions (loaded from old chaindata) keep timestamp=None,
        # which preserves their original hash exactly.
        self.timestamp = timestamp

    def calculate_hash(self):
        if self.timestamp is not None:
            content = f"{self.sender}{self.recipient}{self.amount}{self.timestamp}"
        else:
            content = f"{self.sender}{self.recipient}{self.amount}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def sign_transaction(self, signing_wallet):
        # Mining reward requires no signature
        if self.sender is None:
            return

        # You cannot sign transactions for other wallets
        if signing_wallet.public_key != self.sender:
            raise ValueError("Cannot sign transactions for other wallets!")

        tx_hash = self.calculate_hash()
        self.signature = signing_wallet.sign(tx_hash)

    def is_valid(self):
        # Mining reward transaction is always valid
        if self.sender is None:
            return True

        # Transaction must have a signature
        if self.signature is None:
            return False

        # Verify signature against sender public key
        tx_hash = self.calculate_hash()
        return Wallet.verify(self.sender, tx_hash, self.signature)

    def to_dict(self):
        d = {
            "sender": self.sender,
            "recipient": self.recipient,
            "amount": self.amount,
            "signature": self.signature
        }
        if self.timestamp is not None:
            d["timestamp"] = self.timestamp
        return d
