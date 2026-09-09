let currentWallet = null;
let isKeyVisible = false;
let knownAliases = {};

async function refreshAll() {
    const res = await fetch("/chain");
    const data = await res.json();
    const pendingRes = await fetch("/pending");
    const pendingData = await pendingRes.json();

    knownAliases = data.aliases || {};

    document.getElementById("stat-blocks").innerText = data.length;
    document.getElementById("stat-diff").innerText = data.chain[data.chain.length - 1].difficulty || 2;
    document.getElementById("stat-pending").innerText = pendingData.pending_transactions.length;
    
    const lastB = data.chain[data.chain.length - 1];
    const rewardVal = lastB.transactions[0] ? lastB.transactions[0].amount : 50;
    document.getElementById("stat-reward").innerText = rewardVal + " Coin";

    updateRecipientDropdown();

    const blocksList = document.getElementById("blocks-list");
    blocksList.innerHTML = "";

    const reversedChain = [...data.chain].reverse();
    reversedChain.forEach(b => {
        const card = document.createElement("div");
        card.className = "block-card";
        let txHtml = b.transactions.length === 0 ? "<div style='color:#64748b; font-size:12px; padding:6px 0;'>No transactions (Genesis Block)</div>" : "";
        b.transactions.forEach(tx => {
            const senderName = tx.sender ? (knownAliases[tx.sender] || tx.sender.substring(0, 10)) : null;
            const recipientName = knownAliases[tx.recipient] || (tx.recipient ? tx.recipient.substring(0, 10) : "");

            const senderBadge = senderName 
                ? `<span class="name-badge">${senderName}</span>` 
                : `<span class="name-badge system">⛏️ COINBASE (System Reward)</span>`;
            const recipientBadge = `<span class="name-badge">${recipientName}</span>`;

            txHtml += `
                <div class="tx-box">
                    <div>
                        ${senderBadge} &nbsp;➜&nbsp; ${recipientBadge}
                    </div>
                    <div style="font-weight:bold; color:var(--green); font-size:15px;">
                        +${tx.amount} Coin
                    </div>
                </div>`;
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:18px; font-weight:bold;">Block #${b.index}</span>
                <div>
                    <span class="tag" style="background:#0284c7; color:#fff;">Diff: ${b.difficulty || 2}</span>
                    <span class="tag">Nonce: ${b.nonce}</span>
                    <span class="tag">${new Date(b.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
            </div>
            <div style="font-size:12px; color:#94a3b8;">Block Hash:</div>
            <div class="hash-badge">${b.hash}</div>
            <div style="font-size:12px; color:#94a3b8; margin-top:6px;">Previous Hash:</div>
            <div class="hash-badge" style="color:#64748b;">${b.previous_hash}</div>
            <div style="margin-top:12px; font-weight:bold; font-size:13px;">Transactions (${b.transactions.length}):</div>
            ${txHtml}
        `;
        blocksList.appendChild(card);
    });

    if (currentWallet) {
        updateWalletBalance(data.chain);
    }
}

function updateRecipientDropdown() {
    const sel = document.getElementById("tx-recipient-select");
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Select Known Contact or Type Below --</option>';
    for (const [addr, name] of Object.entries(knownAliases)) {
        if (!currentWallet || addr !== currentWallet.public_key) {
            const opt = document.createElement("option");
            opt.value = addr;
            opt.innerText = `${name} (${addr.substring(0, 16)}...)`;
            sel.appendChild(opt);
        }
    }
    if (currentVal) sel.value = currentVal;
}

function onRecipientSelect(addr) {
    if (addr) {
        document.getElementById("tx-recipient").value = addr;
    }
}

async function createWallet() {
    const res = await fetch("/wallet/new", { method: "POST" });
    currentWallet = await res.json();
    document.getElementById("wallet-details").style.display = "block";
    document.getElementById("wallet-name").innerText = currentWallet.alias;
    document.getElementById("wallet-address").innerText = currentWallet.public_key;
    isKeyVisible = false;
    updateKeyDisplay();
    refreshAll();
}

function togglePrivateKey() {
    isKeyVisible = !isKeyVisible;
    updateKeyDisplay();
}

function updateKeyDisplay() {
    const btn = document.getElementById("eye-btn");
    const el = document.getElementById("wallet-privkey");
    if (!currentWallet) return;

    if (isKeyVisible) {
        btn.innerText = "🔒 Hide Key";
        el.innerText = `d: ${currentWallet.private_key[0]} | n: ${currentWallet.private_key[1]}`;
    } else {
        btn.innerText = "👁️ Show Key";
        el.innerText = "••••••••••••••••••••••••••••";
    }
}

function updateWalletBalance(chain) {
    let balance = 0;
    chain.forEach(b => {
        b.transactions.forEach(tx => {
            if (tx.sender === currentWallet.public_key) balance -= tx.amount;
            if (tx.recipient === currentWallet.public_key) balance += tx.amount;
        });
    });
    document.getElementById("wallet-balance").innerText = balance + " Coin";
}

async function mineBlock() {
    const badge = document.getElementById("mining-status-badge");
    const consoleBox = document.getElementById("mining-console");
    badge.innerText = "MINING IN PROGRESS...";
    badge.style.background = "#eab308";
    badge.style.color = "#000";

    const minerAddr = currentWallet ? currentWallet.public_key : "WebMiner";
    const minerName = currentWallet ? currentWallet.alias : "WebMiner";

    consoleBox.innerHTML = `<span class="info">[*] Starting Proof-of-Work search for ${minerName}...</span><br>`;

    const res = await fetch("/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miner_address: minerAddr })
    });
    const data = await res.json();
    const stats = data.stats;

    let logHtml = `<span class="info">[*] Target Difficulty: ${stats.difficulty} (Must start with '${stats.target}')</span><br>`;
    stats.samples.forEach(s => {
        logHtml += `<span class="fail">[-] Trying Nonce: ${s.nonce.toString().padEnd(6, ' ')} -> Hash: ${s.hash} (Miss)</span><br>`;
    });

    logHtml += `<span class="success">[+] BINGO! Solved at Nonce: ${stats.winning_nonce} in ${stats.duration}s!</span><br>`;
    logHtml += `<span class="success">[+] Winning Hash: ${stats.winning_hash}</span><br>`;
    logHtml += `<span class="info">[+] Block #${stats.block_index} successfully added and propagated to peers.</span>`;

    consoleBox.innerHTML = logHtml;
    consoleBox.scrollTop = consoleBox.scrollHeight;

    badge.innerText = "SUCCESS";
    badge.style.background = "#22c55e";
    badge.style.color = "#000";

    setTimeout(() => {
        badge.innerText = "IDLE";
        badge.style.background = "#1e293b";
        badge.style.color = "#94a3b8";
    }, 4000);

    refreshAll();
}

async function resolveConsensus() {
    const res = await fetch("/nodes/resolve");
    const data = await res.json();
    alert(data.message + " (Chain length: " + data.chain_length + ")");
    refreshAll();
}

async function sendTransaction() {
    if (!currentWallet) {
        alert("Please generate or connect a wallet first!");
        return;
    }
    const recipient = document.getElementById("tx-recipient").value.trim();
    const amount = parseFloat(document.getElementById("tx-amount").value);
    const msgDiv = document.getElementById("tx-msg");

    if (!recipient || isNaN(amount) || amount <= 0) {
        msgDiv.innerHTML = "<span style='color:#ef4444;'>Invalid recipient or amount.</span>";
        return;
    }

    const res = await fetch("/transactions/sign_and_send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            private_key: currentWallet.private_key,
            sender: currentWallet.public_key,
            recipient: recipient,
            amount: amount
        })
    });

    const respData = await res.json();
    if (res.ok) {
        msgDiv.innerHTML = "<span style='color:#4ade80;'>[Success] Transaction signed and P2P broadcasted!</span>";
        document.getElementById("tx-recipient").value = "";
        document.getElementById("tx-amount").value = "";
        refreshAll();
    } else {
        msgDiv.innerHTML = `<span style='color:#ef4444;'>[Error] ${respData.error}</span>`;
    }
}

window.onload = refreshAll;
setInterval(refreshAll, 3000);
