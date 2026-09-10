# CtrlC-Coin Central Configuration File

class Config:
    # Mining & Proof of Work
    INITIAL_DIFFICULTY = 5
    MIN_DIFFICULTY = 5               # Difficulty floor; will never drop below this value
    ALLOW_DIFFICULTY_DECREASE = True # Set True to allow auto-decrease, False to prevent drops due to idle time
    ALLOW_DIFFICULTY_INCREASE = False # Set True to allow auto-increase, False to keep difficulty pinned (e.g. for demo stability)
    ADJUSTMENT_INTERVAL = 5          # Re-evaluate difficulty every N blocks
    TARGET_TIME_PER_BLOCK = 10       # Expected seconds per block

    # Monetary Policy & Supply
    INITIAL_REWARD = 50              # Starting block reward
    HALVING_INTERVAL = 5             # Halve block reward every N blocks

    # Network & Peers
    DEFAULT_PORT = 5000
    REQUEST_TIMEOUT = 5              # HTTP timeout in seconds

    # Node Automation
    AUTO_MINING_ENABLED = True       # Can be toggled live via Web UI or API
    AUTO_MINING_INTERVAL_SEC = 2     # Sleep interval between auto-mining cycles
