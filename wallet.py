import hashlib
import json
import os
import secrets

BIP39_WORDLIST = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
    "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
    "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
    "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
    "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
    "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
    "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
    "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
    "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
    "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
    "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
    "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
    "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake",
    "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon", "badge",
    "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain",
    "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
    "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit",
    "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology",
    "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless",
    "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
    "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss",
    "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread", "breeze",
    "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom",
    "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb", "bulk",
    "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy", "butter"
]

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

def get_deterministic_prime(seed_bytes, counter, min_val=1000, max_val=5000):
    i = counter
    while True:
        h = hashlib.sha256(seed_bytes + i.to_bytes(4, "big")).hexdigest()
        val = (int(h, 16) % (max_val - min_val)) + min_val
        if is_prime(val):
            return val, i + 1
        i += 1

class Wallet:
    def __init__(self, private_key=None, public_key=None, mnemonic=None):
        self.mnemonic = mnemonic
        if private_key is not None and public_key is not None:
            self.private_key = tuple(private_key)
            self.public_key = str(public_key)
            return

        # Generate standard random RSA
        p = get_prime()
        q = get_prime()
        while q == p:
            q = get_prime()

        n = p * q
        phi = (p - 1) * (q - 1)
        e = 65537
        try:
            d = pow(e, -1, phi)
        except ValueError:
            e = 3
            d = pow(e, -1, phi)

        self.private_key = (d, n)
        self.public_key = f"{e}:{n}"

    @classmethod
    def generate_with_mnemonic(cls):
        """Industry Standard: Generate 12-word seed phrase and derive RSA keypair deterministically."""
        words = [secrets.choice(BIP39_WORDLIST) for _ in range(12)]
        mnemonic_str = " ".join(words)
        return cls.from_mnemonic(mnemonic_str)

    @classmethod
    def from_mnemonic(cls, mnemonic_str):
        """Derive the exact same RSA keypair from a 12-word seed phrase."""
        clean_words = mnemonic_str.strip().lower()
        seed = hashlib.sha256(clean_words.encode("utf-8")).digest()
        
        p, next_c = get_deterministic_prime(seed, 0)
        q, _ = get_deterministic_prime(seed, next_c)
        while q == p:
            q, _ = get_deterministic_prime(seed, _ + 1)

        n = p * q
        phi = (p - 1) * (q - 1)
        e = 65537
        try:
            d = pow(e, -1, phi)
        except ValueError:
            e = 3
            d = pow(e, -1, phi)

        return cls(private_key=(d, n), public_key=f"{e}:{n}", mnemonic=clean_words)

    def sign(self, message_hash):
        d, n = self.private_key
        hash_int = int(message_hash, 16) % n
        signature = pow(hash_int, d, n)
        return signature

    @staticmethod
    def verify(public_key_str, message_hash, signature):
        try:
            e_str, n_str = public_key_str.split(":")
            e, n = int(e_str), int(n_str)
            hash_int = int(message_hash, 16) % n
            return pow(signature, e, n) == hash_int
        except Exception:
            return False

    def export_keystore(self, password):
        """Encrypt private key with user password using PBKDF2-SHA256 (Industry standard keystore)."""
        salt = secrets.token_bytes(16)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000, dklen=32)

        payload = json.dumps({
            "private_key": list(self.private_key),
            "mnemonic": self.mnemonic or ""
        }).encode("utf-8")

        # Stream XOR encryption
        keystream = bytearray()
        idx = 0
        while len(keystream) < len(payload):
            keystream.extend(hashlib.sha256(key + idx.to_bytes(4, "big")).digest())
            idx += 1

        ciphertext = bytes(a ^ b for a, b in zip(payload, keystream[:len(payload)]))
        mac = hashlib.sha256(key + ciphertext).hexdigest()

        return {
            "version": 1,
            "address": self.public_key,
            "crypto": {
                "kdf": "pbkdf2-sha256",
                "salt": salt.hex(),
                "iterations": 100000,
                "ciphertext": ciphertext.hex(),
                "mac": mac
            }
        }

    @classmethod
    def import_keystore(cls, keystore_data, password):
        """Decrypt encrypted keystore JSON with password."""
        crypto = keystore_data["crypto"]
        salt = bytes.fromhex(crypto["salt"])
        iterations = crypto.get("iterations", 100000)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)

        ciphertext = bytes.fromhex(crypto["ciphertext"])
        expected_mac = hashlib.sha256(key + ciphertext).hexdigest()
        if expected_mac != crypto["mac"]:
            raise ValueError("Hatalı Parola! Özel anahtar çözülemedi.")

        keystream = bytearray()
        idx = 0
        while len(keystream) < len(ciphertext):
            keystream.extend(hashlib.sha256(key + idx.to_bytes(4, "big")).digest())
            idx += 1

        payload = bytes(a ^ b for a, b in zip(ciphertext, keystream[:len(ciphertext)]))
        data = json.loads(payload.decode("utf-8"))

        return cls(
            private_key=data["private_key"],
            public_key=keystore_data["address"],
            mnemonic=data.get("mnemonic")
        )

    def save_keystore_file(self, filepath, password):
        keystore_dict = self.export_keystore(password)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(keystore_dict, f, indent=2)

    @classmethod
    def load_keystore_file(cls, filepath, password):
        with open(filepath, "r", encoding="utf-8") as f:
            keystore_dict = json.load(f)
        return cls.import_keystore(keystore_dict, password)
