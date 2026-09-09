import hashlib
import secrets

def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def get_prime(min_val=1000, max_val=5000):
    while True:
        candidate = secrets.randbelow(max_val - min_val) + min_val
        if is_prime(candidate):
            return candidate

class Wallet:
    def __init__(self):
        # Generate asymmetric RSA key pair using pure Python
        p = get_prime()
        q = get_prime()
        while q == p:
            q = get_prime()

        n = p * q
        phi = (p - 1) * (q - 1)
        e = 65537
        # Ensure e and phi are coprime; if not, pick e=3 or redraw
        try:
            d = pow(e, -1, phi)
        except ValueError:
            e = 3
            d = pow(e, -1, phi)

        # Private Key: kept secret by wallet owner
        self.private_key = (d, n)

        # Public Key: shared with everyone as the address
        self.public_key = f"{e}:{n}"

    def sign(self, message_hash):
        # Sign the hash using private key exponent d
        d, n = self.private_key
        hash_int = int(message_hash, 16) % n
        signature = pow(hash_int, d, n)
        return signature

    @staticmethod
    def verify(public_key_str, message_hash, signature):
        # Anyone can verify using public key (e, n) without knowing d
        try:
            e_str, n_str = public_key_str.split(":")
            e, n = int(e_str), int(n_str)
            hash_int = int(message_hash, 16) % n
            return pow(signature, e, n) == hash_int
        except Exception:
            return False
