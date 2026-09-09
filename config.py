# CtrlC-Coin Central Configuration File

class Config:
    # Mining & Proof of Work
    INITIAL_DIFFICULTY = 5
    ADJUSTMENT_INTERVAL = 5          # Re-evaluate difficulty every N blocks
    TARGET_TIME_PER_BLOCK = 2        # Expected seconds per block

    # Monetary Policy & Supply
    INITIAL_REWARD = 50              # Starting block reward
    HALVING_INTERVAL = 5             # Halve block reward every N blocks

    # Network & Peers
    DEFAULT_PORT = 5000
    REQUEST_TIMEOUT = 5              # HTTP timeout in seconds

    # Node Automation
    AUTO_MINING_ENABLED = False      # Can be toggled live via Web UI or API
    AUTO_MINING_INTERVAL_SEC = 2     # Sleep interval between auto-mining cycles
