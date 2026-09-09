import React, { useState, useEffect, useRef } from 'react'

const I18N = {
  en: {
    online: 'ONLINE',
    offline: 'OFFLINE',
    p2p_network: 'P2P Network:',
    peers_connected: 'Peers Connected',
    peer_connected: 'Peer Connected',
    searching_peers: 'Searching Peers...',
    btn_12words: '12 Words',
    btn_lock: 'Lock',
    btn_switch: 'Switch',
    minimize: 'Minimize',
    maximize: 'Maximize / Restore',
    close: 'Close',

    // Offline view
    awaiting_node: 'Awaiting Node Connection (Port {port})',
    node_unreachable: 'Python blockchain server on port {port} is unreachable.\nRun the following command in your terminal to launch:',
    retry_conn: 'Retry Connection',

    // Auth / Onboarding
    wallet_setup_title: 'Cryptographic Wallet Setup',
    wallet_setup_desc: 'Zero centralized custody. Your wallet is locally generated and encrypted using a 12-word BIP-39 seed phrase.',
    tab_create_wallet: 'Create New Wallet',
    tab_import_wallet: 'Import via 12 Words',
    create_pwd_label: 'Set a secure password to encrypt local keystore:',
    pwd_placeholder: 'At least 4 characters',
    btn_create_wallet: 'Generate Wallet & 12 Words',
    seed_phrase_label: '12-Word Recovery Seed Phrase:',
    seed_phrase_placeholder: 'Enter 12 words separated by spaces...',
    import_pwd_label: 'Set new local encryption password:',
    btn_import_wallet: 'Restore & Unlock Wallet',
    pwd_min_length_err: 'Password must be at least 4 characters long!',
    seed_12words_err: 'Please enter exactly 12 words!',

    // Locked view
    wallet_locked_title: 'Wallet Locked (Port {port})',
    wallet_locked_desc: 'Enter your password to unlock your private key.',
    unlock_pwd_placeholder: 'Enter Keystore Password',
    btn_unlock_wallet: 'Unlock Wallet',
    btn_switch_or_reset: 'Switch to Another Wallet / Reset',
    confirm_reset: 'Are you sure you want to switch or reset this wallet? (Ensure you have backed up your 12-word seed phrase!)',
    wallet_reset_notif: 'Wallet reset. Ready to create or import a new wallet.',

    // Seed Drawer & Modal
    seed_drawer_title: 'Your 12-Word Recovery Phrase (BIP-39 Mnemonic)',
    seed_drawer_desc: 'These 12 words derive your private key. Never share them; even if your computer is lost, your funds can be completely recovered using these words.',
    seed_modal_title: 'Save Your 12-Word Recovery Phrase',
    seed_modal_desc: 'This seed phrase is the ONLY backup of your wallet. Store it safely offline.',
    btn_seed_saved: 'I Have Safely Saved The Words, Proceed',

    // Cards
    card_balance_title: 'WALLET BALANCE',
    public_address_label: 'Public Address:',
    btn_copy: 'Copy',
    btn_copied: 'Copied',
    address_copied_notif: 'Wallet Address Copied',

    card_transfer_title: 'SEND TRANSFER',
    rsa_signed_badge: 'RSA-Signed',
    recipient_placeholder: 'Recipient Address or 4-Letter Alias (e.g. LUNA)',
    amount_placeholder: 'Amount (Coin)',
    btn_send: 'Send',
    transfer_sent_notif: '{amount} Coin transfer broadcasted to network',
    invalid_transfer_err: 'Please enter a valid recipient and positive amount!',

    card_mining_title: 'CONSENSUS & POW',
    difficulty_label: 'Difficulty:',
    btn_mine_block: 'Mine Block',
    btn_auto_mine_on: 'Auto-Miner: ON',
    btn_auto_mine_off: 'Auto-Miner: OFF',
    auto_mine_active_notif: 'Auto-Miner Activated',
    auto_mine_stopped_notif: 'Auto-Miner Stopped',
    btn_sync: 'Sync',
    sync_tooltip: 'Synchronize Chain with Peers',

    // Bottom sections
    console_title: 'Live Node Console',
    logs_count: 'Logs',
    tab_chain: 'Blockchain',
    tab_mempool: 'Mempool',
    genesis_block: 'Genesis Block #0',
    block_prefix: 'Block #',
    sealed_by: 'Miner:',
    block_reward: 'Block Reward ->',
    miner_alias_fallback: 'MINER',
    sender_fallback: 'SENDER',
    recipient_fallback: 'RECIPIENT',
    mempool_empty: 'Mempool is empty. No pending transactions.',

    // PoW Mining & Nonce Stream Console
    mining_console_title: 'Live PoW Mining & Nonce Stream',
    mining_status_title: 'Current Miner Status',
    mining_hashrate: 'Hash Rate:',
    mining_target: 'Target:',
    mining_empty_notice: 'Miner standing by. Launch Auto-Miner or trigger manual mine to stream nonces.',

    // Metrics Footer Bar
    footer_consensus: 'Nakamoto PoW (SHA-256)',
    footer_target: 'Target: 10.0s',
    footer_supply: 'Circulating Supply:',
    footer_halving: 'Next Halving: Block #{n}',
    footer_tip: 'Chain Tip:'
  },
  tr: {
    online: 'ÇEVRİMİÇİ',
    offline: 'ÇEVRİMDIŞI',
    p2p_network: 'P2P Ağ:',
    peers_connected: 'Eş Bağlı',
    peer_connected: 'Eş Bağlı',
    searching_peers: 'Eş Aranıyor...',
    btn_12words: '12 Kelime',
    btn_lock: 'Kilitle',
    btn_switch: 'Değiştir',
    minimize: 'Simge Durumuna Küçült',
    maximize: 'Büyüt / Geri Yükle',
    close: 'Kapat',

    // Offline view
    awaiting_node: 'Node Bağlantısı Bekleniyor (Port {port})',
    node_unreachable: 'Port {port} üzerindeki Python blockchain sunucusuna erişilemiyor.\nBaşlatmak için terminalde şu komutu çalıştırabilirsiniz:',
    retry_conn: 'Bağlantıyı Yeniden Dene',

    // Auth / Onboarding
    wallet_setup_title: 'Kriptografik Cüzdan Kurulumu',
    wallet_setup_desc: 'Merkezi hesap yoktur. Cüzdanınız yerel olarak 12 kelimelik BIP-39 tohumla şifrelenir.',
    tab_create_wallet: 'Yeni Cüzdan Oluştur',
    tab_import_wallet: '12 Kelime ile İçe Aktar',
    create_pwd_label: 'Cüzdanı Şifreleyecek Güvenli Parola Belirleyin:',
    pwd_placeholder: 'En az 4 karakter',
    btn_create_wallet: 'Cüzdanı Oluştur & 12 Kelimeyi Üret',
    seed_phrase_label: '12 Kelimelik Tohum İfadesi (Seed Phrase):',
    seed_phrase_placeholder: '12 kelimeyi boşluklarla girin...',
    import_pwd_label: 'Yeni Yerel Parola Belirleyin:',
    btn_import_wallet: 'Cüzdanı Geri Yükle & Aç',
    pwd_min_length_err: 'Parola en az 4 karakter olmalıdır!',
    seed_12words_err: 'Lütfen tam olarak 12 kelime giriniz!',

    // Locked view
    wallet_locked_title: 'Cüzdan Kilitli (Port {port})',
    wallet_locked_desc: 'Cüzdanınızı açmak için parolanızı girin.',
    unlock_pwd_placeholder: 'Parolanızı Girin',
    btn_unlock_wallet: 'Cüzdanı Aç',
    btn_switch_or_reset: 'Farklı Cüzdana Geç / Sıfırla',
    confirm_reset: 'Cüzdandan çıkmak veya farklı bir cüzdana geçmek istediğinize emin misiniz? (12 kelimelik tohum yedeğinizi aldığınızdan emin olun!)',
    wallet_reset_notif: 'Cüzdan sıfırlandı. Yeni cüzdan oluşturabilir veya içe aktarabilirsiniz.',

    // Seed Drawer & Modal
    seed_drawer_title: '12 Kelimelik Tohum İfadeniz (BIP-39 Mnemonic Backup)',
    seed_drawer_desc: 'Bu 12 kelime özel anahtarınızı oluşturur. Asla kimseyle paylaşmayın; cihazınızı kaybetseniz bile paranızı bu kelimelerle geri alabilirsiniz.',
    seed_modal_title: '12 Kelimelik Tohum İfadenizi Kaydedin',
    seed_modal_desc: 'Bu kelimeler cüzdanınızın tek yedeğidir. Bir yere not edin.',
    btn_seed_saved: 'Kelimeleri Güvenle Kaydettim, Devam Et',

    // Cards
    card_balance_title: 'CÜZDAN BAKİYESİ',
    public_address_label: 'Genel Adres:',
    btn_copy: 'Kopyala',
    btn_copied: 'Kopyalandı',
    address_copied_notif: 'Cüzdan Adresi Kopyalandı',

    card_transfer_title: 'TRANSFER GÖNDER',
    rsa_signed_badge: 'RSA İmzalı',
    recipient_placeholder: 'Alıcı Adresi veya 4 Harfli İsmi (Örn: LUNA)',
    amount_placeholder: 'Miktar (Coin)',
    btn_send: 'Gönder',
    transfer_sent_notif: '{amount} Coin transferi ağa yayınlandı',
    invalid_transfer_err: 'Geçerli alıcı adresi ve miktar giriniz!',

    card_mining_title: 'KONSENSÜS & POW',
    difficulty_label: 'Zorluk:',
    btn_mine_block: 'Mine Block',
    btn_auto_mine_on: 'Oto-Madenci: Açık',
    btn_auto_mine_off: 'Oto-Madenci: Kapalı',
    auto_mine_active_notif: 'Otomatik Madenci Aktif',
    auto_mine_stopped_notif: 'Otomatik Madenci Durduruldu',
    btn_sync: 'Senk',
    sync_tooltip: 'Eşlerle Zinciri Senkronize Et',

    // Bottom sections
    console_title: 'Canlı Düğüm Konsolu',
    logs_count: 'Kayıt',
    tab_chain: 'Blokzincir',
    tab_mempool: 'Mempool',
    genesis_block: 'Genesis Block #0',
    block_prefix: 'Blok #',
    sealed_by: 'Mühürleyen:',
    block_reward: 'Blok Ödülü ->',
    miner_alias_fallback: 'MADENCİ',
    sender_fallback: 'GÖNDEREN',
    recipient_fallback: 'ALICI',
    mempool_empty: 'Mempool boş. Bekleyen transfer bulunmuyor.',

    // PoW Mining & Nonce Stream Console
    mining_console_title: 'Canlı Nonce & Madencilik Akışı',
    mining_status_title: 'Mevcut Madenci Durumu',
    mining_hashrate: 'Kazım Gücü:',
    mining_target: 'Hedef:',
    mining_empty_notice: 'Madenci beklemede. Nonceleri görmek için Oto-Madenciyi açın veya blok kazın.',

    // Metrics Footer Bar
    footer_consensus: 'Nakamoto PoW (SHA-256)',
    footer_target: 'Hedef: 10.0sn',
    footer_supply: 'Dolaşımdaki Arz:',
    footer_halving: 'Sonraki Yarılanma: Blok #{n}',
    footer_tip: 'Son Blok:'
  }
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search)
  const currentPort = parseInt(urlParams.get('port') || '5000', 10)

  // Language state: Default English ('en'), persists in localStorage
  const [lang, setLang] = useState(() => localStorage.getItem('ctrlc_coin_lang') || 'en')
  const t = I18N[lang] || I18N.en

  const toggleLanguage = (selectedLang) => {
    setLang(selectedLang)
    localStorage.setItem('ctrlc_coin_lang', selectedLang)
  }

  // Node & Wallet States
  const [walletStatus, setWalletStatus] = useState('loading') // 'no_wallet' | 'locked' | 'unlocked' | 'offline'
  const [walletData, setWalletData] = useState(null)
  const [chainData, setChainData] = useState([])
  const [pendingTxs, setPendingTxs] = useState([])
  const [logs, setLogs] = useState([])
  const [difficulty, setDifficulty] = useState(6)
  const [peersCount, setPeersCount] = useState(0)
  const [isMining, setIsMining] = useState(true) // Default ON

  // Keystore Auth States
  const [createPassword, setCreatePassword] = useState('')
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [importMnemonic, setImportMnemonic] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [showMnemonicModal, setShowMnemonicModal] = useState(false)
  const [showBackupMnemonic, setShowBackupMnemonic] = useState(false)
  const [authTab, setAuthTab] = useState('create')

  // Forms
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState('')
  const [activeTab, setActiveTab] = useState('chain')
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address)
      setCopied(true)
      notify(t.address_copied_notif)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const terminalRef = useRef(null)
  const nonceTerminalRef = useRef(null)

  const [miningTelemetry, setMiningTelemetry] = useState({
    is_mining: false,
    status: 'idle',
    status_text_tr: 'Beklemede (Madenci beklemede...)',
    status_text_en: 'Idle (Awaiting miner activation...)',
    block_index: 0,
    difficulty: 6,
    target: '000000',
    current_nonce: 0,
    last_hash: '',
    hash_rate: 0,
    recent_nonces: [],
    logs: []
  })

  // Polling loop for general status
  useEffect(() => {
    let isMounted = true

    const fetchStatus = async () => {
      try {
        const [statusRes, chainRes, pendingRes, logsRes] = await Promise.all([
          fetch(`http://127.0.0.1:${currentPort}/wallet/status`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/chain`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/pending`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/logs`).catch(() => null)
        ])

        if (!statusRes || !statusRes.ok) {
          if (isMounted) setWalletStatus('offline')
          return
        }

        const statusJson = await statusRes.json()
        const chainJson = chainRes && chainRes.ok ? await chainRes.json() : { chain: [], total_peers: 0 }
        const pendingJson = pendingRes && pendingRes.ok ? await pendingRes.json() : { pending_transactions: [] }
        const logsJson = logsRes && logsRes.ok ? await logsRes.json() : { logs: [] }

        let currentWallet = null
        if (statusJson.status === 'unlocked') {
          const curRes = await fetch(`http://127.0.0.1:${currentPort}/wallet/current`).catch(() => null)
          if (curRes && curRes.ok) {
            currentWallet = await curRes.json()
          }
        }

        // Calculate balance
        let balance = 0
        const activeAddr = currentWallet ? currentWallet.public_key : statusJson.address
        if (activeAddr && chainJson.chain) {
          for (const block of chainJson.chain) {
            for (const tx of block.transactions) {
              if (tx.recipient === activeAddr) balance += Number(tx.amount)
              if (tx.sender === activeAddr) balance -= Number(tx.amount)
            }
          }
        }

        if (isMounted) {
          setWalletStatus(statusJson.status)
          setWalletData({
            address: activeAddr,
            alias: currentWallet?.alias || statusJson.alias || chainJson.node_name || '',
            balance,
            mnemonic: currentWallet ? currentWallet.mnemonic : ''
          })
          setChainData(chainJson.chain || [])
          setDifficulty(chainJson.difficulty || 5)
          setPeersCount(chainJson.total_peers || 0)
          if (typeof chainJson.auto_mining === 'boolean') {
            setIsMining(chainJson.auto_mining)
          }
          setPendingTxs(pendingJson.pending_transactions || [])
          setLogs(logsJson.logs || [])
        }
      } catch (err) {
        if (isMounted) setWalletStatus('offline')
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1200)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [currentPort])

  // Real-time PoW Nonce & Mining Telemetry Polling (High Frequency ~350ms)
  useEffect(() => {
    let isMounted = true
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${currentPort}/mining/telemetry`).catch(() => null)
        if (res && res.ok && isMounted) {
          const data = await res.json()
          setMiningTelemetry(data)
        }
      } catch (err) {}
    }

    fetchTelemetry()
    const timer = setInterval(fetchTelemetry, 350)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [currentPort])

  // Auto-scroll general node terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  // Auto-scroll live mining & nonce stream terminal
  useEffect(() => {
    if (nonceTerminalRef.current) {
      nonceTerminalRef.current.scrollTop = nonceTerminalRef.current.scrollHeight
    }
  }, [miningTelemetry.logs, miningTelemetry.recent_nonces, miningTelemetry.current_nonce])

  const notify = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 4000)
  }

  // Wallet Actions
  const handleCreateWallet = async (e) => {
    e.preventDefault()
    if (!createPassword || createPassword.length < 4) {
      alert(t.pwd_min_length_err)
      return
    }

    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/wallet/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: createPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setGeneratedMnemonic(data.mnemonic)
        setShowMnemonicModal(true)
        setCreatePassword('')
        notify(lang === 'en' ? '12-Word Seed Generated Successfully!' : '12 Kelimelik Tohum Başarıyla Üretildi!')
      } else {
        alert(data.error || 'Failed to create wallet')
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleImportWallet = async (e) => {
    e.preventDefault()
    const words = importMnemonic.trim().split(/\s+/)
    if (words.length !== 12) {
      alert(t.seed_12words_err)
      return
    }
    if (!importPassword || importPassword.length < 4) {
      alert(t.pwd_min_length_err)
      return
    }

    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/wallet/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic: importMnemonic.trim(), password: importPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setImportMnemonic('')
        setImportPassword('')
        notify(lang === 'en' ? 'Wallet Imported Successfully!' : 'Cüzdan Başarıyla İçe Aktarıldı!')
      } else {
        alert(data.error || 'Import failed')
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleUnlockWallet = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/wallet/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setUnlockPassword('')
        notify(lang === 'en' ? 'Wallet Unlocked!' : 'Cüzdan Kilidi Açıldı!')
      } else {
        alert(data.error || (lang === 'en' ? 'Incorrect password!' : 'Hatalı parola!'))
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleLockWallet = async () => {
    try {
      await fetch(`http://127.0.0.1:${currentPort}/wallet/lock`, { method: 'POST' })
      notify(lang === 'en' ? 'Wallet Locked.' : 'Cüzdan Kilitlendi.')
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleResetWallet = async () => {
    if (window.confirm(t.confirm_reset)) {
      try {
        await fetch(`http://127.0.0.1:${currentPort}/wallet/reset`, { method: 'POST' })
        setWalletStatus('no_wallet')
        setWalletData(null)
        notify(t.wallet_reset_notif)
      } catch (err) {
        alert(`Error: ${err.message}`)
      }
    }
  }

  // Transfer & Mining
  const handleSendTx = async (e) => {
    e.preventDefault()
    if (!recipient || !amount || Number(amount) <= 0) {
      alert(t.invalid_transfer_err)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/transactions/sign_and_send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, amount: Number(amount) })
      })
      const data = await res.json()
      if (res.ok) {
        notify(t.transfer_sent_notif.replace('{amount}', amount))
        setRecipient('')
        setAmount('')
      } else {
        alert(data.error || 'Transfer rejected')
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMineBlock = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/mine`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (data.block) {
          notify(lang === 'en' ? `Block #${data.block.index} Mined! Nonce: ${data.block.nonce}` : `Blok #${data.block.index} Kazıldı! Nonce: ${data.block.nonce}`)
        } else {
          notify(lang === 'en' ? 'Race lost: Peer solved block first.' : 'Yarış kaybedildi: Eş bloğu önce çözdü.')
        }
      } else {
        alert(data.error || (lang === 'en' ? 'Mining failed' : 'Madencilik başarısız'))
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleToggleAutoMine = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/miner/toggle`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setIsMining(data.auto_mining)
        notify(data.auto_mining ? t.auto_mine_active_notif : t.auto_mine_stopped_notif)
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleConsensusSync = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/nodes/resolve`)
      const data = await res.json()
      notify(data.message)
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  // Calculate actual circulating supply dynamically from real coinbase transactions (respects halving)
  let totalMinedCoins = 0
  if (chainData && chainData.length > 0) {
    for (const b of chainData) {
      if (b.transactions && b.transactions.length > 0) {
        for (const tx of b.transactions) {
          if (!tx.sender || tx.sender === 'COINBASE') {
            totalMinedCoins += Number(tx.amount || 0)
          }
        }
      }
    }
  }

  const nextHalvingBlock = chainData.length > 0 ? (Math.floor(chainData.length / 5) + 1) * 5 : 5
  const latestBlock = chainData.length > 0 ? chainData[chainData.length - 1] : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Custom Frameless Windows Titlebar */}
      <div className="custom-titlebar">
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/logo.png"
            alt="CtrlC-Coin"
            style={{ height: '18px', width: 'auto', objectFit: 'contain' }}
          />
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
            CtrlC-Coin
          </span>
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            padding: '1px 5px',
            borderRadius: '3px',
            fontFamily: 'monospace'
          }}>
            :{currentPort}
          </span>
          {walletData?.alias && (
            <span style={{
              background: 'rgba(37,99,235,0.2)',
              color: 'var(--accent-blue-light)',
              border: '1px solid rgba(37,99,235,0.35)',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.8px'
            }}>
              [{walletData.alias}]
            </span>
          )}
          <span style={{
            fontSize: '9.5px',
            padding: '1px 6px',
            borderRadius: '3px',
            fontWeight: '600',
            background: walletStatus === 'offline' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: walletStatus === 'offline' ? 'var(--accent-rose)' : '#10b981',
            border: `1px solid ${walletStatus === 'offline' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
          }}>
            {walletStatus === 'offline' ? t.offline : t.online}
          </span>
        </div>

        {/* Center: P2P Network Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: peersCount > 0 ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${peersCount > 0 ? 'rgba(37, 99, 235, 0.3)' : 'var(--border)'}`,
          padding: '2px 9px',
          borderRadius: '12px',
          fontSize: '10.5px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: peersCount > 0 ? '#10b981' : '#f59e0b',
            boxShadow: peersCount > 0 ? '0 0 6px #10b981' : '0 0 4px #f59e0b',
            display: 'inline-block'
          }} />
          <span style={{ color: 'var(--text-muted)' }}>{t.p2p_network}</span>
          <strong style={{ color: peersCount > 0 ? 'var(--accent-blue-light)' : 'var(--text-muted)' }}>
            {peersCount > 0 ? `${peersCount} ${peersCount === 1 ? t.peer_connected : t.peers_connected}` : t.searching_peers}
          </strong>
        </div>

        {/* Right: Language Switcher, Quick Actions & Window Controls */}
        <div className="titlebar-nodrag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {notification && (
            <span style={{
              background: 'rgba(37,99,235,0.15)',
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue-light)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: '500'
            }}>
              {notification}
            </span>
          )}

          {/* Language Switcher Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1px'
          }}>
            <button
              onClick={() => toggleLanguage('en')}
              style={{
                background: lang === 'en' ? 'var(--accent-blue)' : 'transparent',
                color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9.5px',
                fontWeight: '700'
              }}
            >
              EN
            </button>
            <button
              onClick={() => toggleLanguage('tr')}
              style={{
                background: lang === 'tr' ? 'var(--accent-blue)' : 'transparent',
                color: lang === 'tr' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9.5px',
                fontWeight: '700'
              }}
            >
              TR
            </button>
          </div>

          {walletStatus === 'unlocked' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setShowBackupMnemonic(!showBackupMnemonic)}
                title={t.seed_drawer_title}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  fontWeight: '600'
                }}
              >
                {t.btn_12words}
              </button>
              <button
                onClick={handleLockWallet}
                title={t.btn_lock}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  fontWeight: '600'
                }}
              >
                {t.btn_lock}
              </button>
              <button
                onClick={handleResetWallet}
                title={t.btn_switch_or_reset}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '10.5px'
                }}
              >
                {t.btn_switch}
              </button>
            </div>
          )}

          {/* Window Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
            <button
              className="window-control-btn"
              title={t.minimize}
              onClick={() => window.electronAPI?.minimize()}
            >
              &#8212;
            </button>
            <button
              className="window-control-btn"
              title={t.maximize}
              onClick={() => window.electronAPI?.maximize()}
            >
              &#9634;
            </button>
            <button
              className="window-control-btn close"
              title={t.close}
              onClick={() => window.electronAPI?.close()}
            >
              &#10005;
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* STATE 0: OFFLINE */}
        {walletStatus === 'offline' && (
          <div style={{
            maxWidth: '480px',
            margin: '60px auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: 'var(--accent-blue-light)' }}>
              {t.awaiting_node.replace('{port}', currentPort)}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {t.node_unreachable.replace('{port}', currentPort)}
            </p>
            <div style={{
              background: 'var(--bg-terminal)',
              padding: '10px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'var(--accent-blue-light)',
              marginBottom: '20px',
              border: '1px solid var(--border)'
            }}>
              python node.py {currentPort}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--accent-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 20px',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              {t.retry_conn}
            </button>
          </div>
        )}

        {/* STATE 1: NO WALLET (ONBOARDING) */}
        {walletStatus === 'no_wallet' && (
          <div style={{
            maxWidth: '540px',
            margin: '40px auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)'
          }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{ height: '56px', width: 'auto', margin: '0 auto 14px', display: 'block' }}
            />
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
              {t.wallet_setup_title}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {t.wallet_setup_desc}
            </p>

            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-terminal)', padding: '4px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setAuthTab('create')}
                style={{
                  flex: 1,
                  background: authTab === 'create' ? 'var(--accent-blue)' : 'transparent',
                  color: authTab === 'create' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {t.tab_create_wallet}
              </button>
              <button
                onClick={() => setAuthTab('import')}
                style={{
                  flex: 1,
                  background: authTab === 'import' ? 'var(--accent-blue)' : 'transparent',
                  color: authTab === 'import' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {t.tab_import_wallet}
              </button>
            </div>

            {authTab === 'create' ? (
              <form onSubmit={handleCreateWallet} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                    {t.create_pwd_label}
                  </label>
                  <input
                    type="password"
                    placeholder={t.pwd_placeholder}
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '11px',
                    fontWeight: '700',
                    fontSize: '13px',
                    marginTop: '6px'
                  }}
                >
                  {t.btn_create_wallet}
                </button>
              </form>
            ) : (
              <form onSubmit={handleImportWallet} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                    {t.seed_phrase_label}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t.seed_phrase_placeholder}
                    value={importMnemonic}
                    onChange={e => setImportMnemonic(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                    {t.import_pwd_label}
                  </label>
                  <input
                    type="password"
                    placeholder={t.pwd_placeholder}
                    value={importPassword}
                    onChange={e => setImportPassword(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '11px',
                    fontWeight: '700',
                    fontSize: '13px',
                    marginTop: '6px'
                  }}
                >
                  {t.btn_import_wallet}
                </button>
              </form>
            )}
          </div>
        )}

        {/* STATE 2: LOCKED */}
        {walletStatus === 'locked' && (
          <div style={{
            maxWidth: '400px',
            margin: '60px auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)'
          }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{ height: '48px', width: 'auto', margin: '0 auto 12px', display: 'block' }}
            />
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '6px' }}>
              {t.wallet_locked_title.replace('{port}', currentPort)}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
              {t.wallet_locked_desc}
            </p>

            <form onSubmit={handleUnlockWallet} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder={t.unlock_pwd_placeholder}
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '11px',
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '11px',
                  fontWeight: '700',
                  fontSize: '13px'
                }}
              >
                {t.btn_unlock_wallet}
              </button>
              <button
                type="button"
                onClick={handleResetWallet}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginTop: '8px',
                  textDecoration: 'underline'
                }}
              >
                {t.btn_switch_or_reset}
              </button>
            </form>
          </div>
        )}

        {/* STATE 3: UNLOCKED (ACTIVE FULL CLIENT) */}
        {walletStatus === 'unlocked' && walletData && (
          <>
            {/* Seed Phrase Backup Drawer */}
            {showBackupMnemonic && walletData.mnemonic && (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-blue)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--accent-blue-light)' }}>
                    {t.seed_drawer_title}
                  </span>
                  <button
                    onClick={() => setShowBackupMnemonic(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                  >
                    X
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t.seed_drawer_desc}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '4px' }}>
                  {walletData.mnemonic.split(' ').map((word, idx) => (
                    <div key={idx} style={{
                      background: 'var(--bg-terminal)',
                      border: '1px solid var(--border)',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontFamily: 'monospace'
                    }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{idx + 1}.</span>
                      <strong style={{ color: 'var(--text-main)' }}>{word}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Row: Compact 3 Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: '10px' }}>

              {/* Card 1: Wallet Balance & ID */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.card_balance_title}</span>
                    {walletData.alias && (
                      <span style={{
                        background: 'rgba(37,99,235,0.2)',
                        border: '1px solid rgba(37,99,235,0.4)',
                        color: 'var(--accent-blue-light)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        letterSpacing: '0.8px'
                      }}>
                        [{walletData.alias}]
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-blue-light)', marginTop: '4px', letterSpacing: '-0.5px' }}>
                    {walletData.balance.toFixed(2)} COIN
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.public_address_label}</span>
                    <button
                      onClick={copyAddress}
                      style={{
                        background: copied ? 'rgba(16,185,129,0.15)' : 'transparent',
                        border: 'none',
                        color: copied ? '#10b981' : 'var(--accent-blue-light)',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '1px 4px'
                      }}
                    >
                      {copied ? t.btn_copied : t.btn_copy}
                    </button>
                  </div>
                  <div style={{
                    background: 'var(--bg-terminal)',
                    border: '1px solid var(--border)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    fontSize: '9.5px',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {walletData.address}
                  </div>
                </div>
              </div>

              {/* Card 2: Quick Transfer Form */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {t.card_transfer_title}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue-light)' }}>
                      {t.rsa_signed_badge}
                    </span>
                  </div>

                  <form onSubmit={handleSendTx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder={t.recipient_placeholder}
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        padding: '6px 8px',
                        fontSize: '11px'
                      }}
                    />

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder={t.amount_placeholder}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          padding: '6px 8px',
                          fontSize: '11px'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                          background: 'var(--accent-blue)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '5px',
                          padding: '6px 14px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}
                      >
                        {isSubmitting ? '...' : t.btn_send}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Card 3: Mining & Consensus Controls */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {t.card_mining_title}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue-light)', fontFamily: 'monospace' }}>
                      {t.difficulty_label} {difficulty}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={handleMineBlock}
                      style={{
                        background: 'var(--accent-blue)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}
                    >
                      {t.btn_mine_block}
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={handleToggleAutoMine}
                        style={{
                          flex: 1,
                          background: isMining ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isMining ? 'var(--accent-blue)' : 'var(--border)'}`,
                          color: isMining ? 'var(--accent-blue-light)' : 'var(--text-main)',
                          borderRadius: '5px',
                          padding: '5px 8px',
                          fontSize: '10.5px',
                          fontWeight: '600'
                        }}
                      >
                        {isMining ? t.btn_auto_mine_on : t.btn_auto_mine_off}
                      </button>

                      <button
                        onClick={handleConsensusSync}
                        title={t.sync_tooltip}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          borderRadius: '5px',
                          padding: '5px 8px',
                          fontSize: '10.5px'
                        }}
                      >
                        {t.btn_sync}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lower Row: 2-Column Balanced Dashboard */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', minHeight: '300px' }}>

              {/* Left Column: Stacked Console and PoW Mining Stream */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Upper Panel: Live Node Console */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {t.console_title}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {logs.length} {t.logs_count}
                    </span>
                  </div>
                  <div
                    ref={terminalRef}
                    style={{
                      height: '140px',
                      background: 'var(--bg-terminal)',
                      border: '1px solid var(--border)',
                      borderRadius: '5px',
                      overflowY: 'auto',
                      padding: '6px 8px',
                      fontSize: '10px',
                      lineHeight: '1.4',
                      fontFamily: 'monospace'
                    }}
                  >
                    {logs.map((log, idx) => {
                      let color = '#9ca3af'
                      if (log.includes('[MINE]') || log.includes('[Miner]')) color = 'var(--accent-blue-light)'
                      if (log.includes('[P2P]')) color = '#e5e7eb'
                      if (log.includes('[ERROR]') || log.includes('[WARN]')) color = 'var(--accent-rose)'
                      if (log.includes('[WALLET]')) color = '#93c5fd'
                      return (
                        <div key={idx} style={{ color, marginBottom: '2px', wordBreak: 'break-all' }}>
                          {log}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Lower Panel: Live PoW Mining & Nonce Stream Terminal */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flex: 1
                }}>
                  {/* Mining Console Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        filter: miningTelemetry.is_mining ? 'drop-shadow(0 0 6px rgba(59,130,246,0.8))' : 'none'
                      }}>
                        ⛏️
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {t.mining_console_title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Live Hashrate Badge */}
                      <span style={{
                        background: 'rgba(37,99,235,0.18)',
                        border: '1px solid rgba(37,99,235,0.35)',
                        color: 'var(--accent-blue-light)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '9.5px',
                        fontWeight: '700',
                        fontFamily: 'monospace'
                      }}>
                        ⚡ {miningTelemetry.hash_rate > 1000 ? `${(miningTelemetry.hash_rate / 1000).toFixed(1)} kH/s` : `${miningTelemetry.hash_rate} H/s`}
                      </span>

                      {/* Difficulty / Target Badge */}
                      <span style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '9.5px',
                        fontFamily: 'monospace'
                      }}>
                        {t.mining_target} {miningTelemetry.difficulty} ({(miningTelemetry.target || '000000').slice(0, 6)}...)
                      </span>
                    </div>
                  </div>

                  {/* En Sonki Durum Çubuğu (Dynamic Status Bar) */}
                  {(() => {
                    let statusBg = 'rgba(255,255,255,0.02)'
                    let statusBorder = 'var(--border)'
                    let statusColor = 'var(--text-main)'
                    let statusIcon = '💤'
                    let statusText = lang === 'tr' ? miningTelemetry.status_text_tr : miningTelemetry.status_text_en

                    if (miningTelemetry.status === 'nonce_found') {
                      statusBg = 'rgba(245, 158, 11, 0.18)'
                      statusBorder = 'rgba(245, 158, 11, 0.5)'
                      statusColor = '#fbbf24'
                      statusIcon = '🎯'
                    } else if (miningTelemetry.status === 'block_propagated') {
                      statusBg = 'rgba(16, 185, 129, 0.18)'
                      statusBorder = 'rgba(16, 185, 129, 0.5)'
                      statusColor = '#34d399'
                      statusIcon = '✅'
                    } else if (miningTelemetry.status === 'peer_checking') {
                      statusBg = 'rgba(139, 92, 246, 0.18)'
                      statusBorder = 'rgba(139, 92, 246, 0.5)'
                      statusColor = '#c084fc'
                      statusIcon = '⚡'
                    } else if (miningTelemetry.status === 'peer_accepted') {
                      statusBg = 'rgba(16, 185, 129, 0.18)'
                      statusBorder = 'rgba(16, 185, 129, 0.5)'
                      statusColor = '#10b981'
                      statusIcon = '🔍'
                    } else if (miningTelemetry.status === 'race_lost') {
                      statusBg = 'rgba(249, 115, 22, 0.18)'
                      statusBorder = 'rgba(249, 115, 22, 0.5)'
                      statusColor = '#fb923c'
                      statusIcon = '🔄'
                    } else if (miningTelemetry.status === 'peer_rejected') {
                      statusBg = 'rgba(239, 68, 68, 0.18)'
                      statusBorder = 'rgba(239, 68, 68, 0.5)'
                      statusColor = '#f87171'
                      statusIcon = '❌'
                    } else if (miningTelemetry.status === 'mining') {
                      statusBg = 'rgba(37, 99, 235, 0.15)'
                      statusBorder = 'rgba(37, 99, 235, 0.4)'
                      statusColor = 'var(--accent-blue-light)'
                      statusIcon = '⛏️'
                    }

                    return (
                      <div style={{
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                        borderRadius: '6px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '10.5px',
                        color: statusColor,
                        fontWeight: '600'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '12px' }}>{statusIcon}</span>
                          <span>{statusText}</span>
                        </div>
                        {miningTelemetry.current_nonce > 0 && (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '9.5px',
                            color: 'var(--text-muted)',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap'
                          }}>
                            Nonce #{miningTelemetry.current_nonce.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* Kayan Nonce & Madencilik Terminal Logları */}
                  <div
                    ref={nonceTerminalRef}
                    style={{
                      height: '180px',
                      background: 'var(--bg-terminal)',
                      border: '1px solid var(--border)',
                      borderRadius: '5px',
                      overflowY: 'auto',
                      padding: '6px 8px',
                      fontSize: '10px',
                      lineHeight: '1.42',
                      fontFamily: 'monospace'
                    }}
                  >
                    {miningTelemetry.logs.length === 0 && miningTelemetry.recent_nonces.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '45px 0', fontSize: '10.5px' }}>
                        {t.mining_empty_notice}
                      </div>
                    ) : (
                      <>
                        {miningTelemetry.logs.map((item, idx) => {
                          let textColor = '#9ca3af'
                          if (item.type === 'win') textColor = '#facc15'
                          else if (item.type === 'network') textColor = '#34d399'
                          else if (item.type === 'peer') textColor = '#c084fc'
                          else if (item.type === 'accepted') textColor = '#10b981'
                          else if (item.type === 'race') textColor = '#fb923c'
                          else if (item.type === 'warn') textColor = 'var(--accent-rose)'
                          else if (item.type === 'start') textColor = 'var(--accent-blue-light)'
                          else if (item.text.includes('Sıfır Yakalandı')) textColor = '#38bdf8'

                          return (
                            <div key={idx} style={{ color: textColor, marginBottom: '2px', wordBreak: 'break-all' }}>
                              <span style={{ color: 'var(--text-dim)', marginRight: '5px' }}>[{item.time}]</span>
                              {item.text}
                            </div>
                          )
                        })}

                        {miningTelemetry.is_mining && miningTelemetry.current_nonce > 0 && (
                          <div style={{
                            color: '#38bdf8',
                            fontWeight: '700',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '1px 0'
                          }}>
                            <span style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: '#38bdf8',
                              boxShadow: '0 0 6px #38bdf8',
                              display: 'inline-block'
                            }} />
                            <span>[POW RUNNING] Nonce: #{miningTelemetry.current_nonce.toLocaleString()} {'->'} Hash: {miningTelemetry.last_hash.slice(0, 18)}...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Explorer & Mempool Tabs */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <button
                    onClick={() => setActiveTab('chain')}
                    style={{
                      background: activeTab === 'chain' ? 'rgba(37,99,235,0.15)' : 'transparent',
                      border: activeTab === 'chain' ? '1px solid var(--accent-blue)' : 'none',
                      color: activeTab === 'chain' ? 'var(--accent-blue-light)' : 'var(--text-muted)',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    {t.tab_chain} ({chainData.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('mempool')}
                    style={{
                      background: activeTab === 'mempool' ? 'rgba(37,99,235,0.15)' : 'transparent',
                      border: activeTab === 'mempool' ? '1px solid var(--accent-blue)' : 'none',
                      color: activeTab === 'mempool' ? 'var(--accent-blue-light)' : 'var(--text-muted)',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    {t.tab_mempool} ({pendingTxs.length})
                  </button>
                </div>

                <div style={{ flex: 1, minHeight: '380px', maxHeight: '425px', overflowY: 'auto', paddingRight: '4px' }}>
                  {activeTab === 'chain' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {chainData.slice().reverse().map(block => (
                        <div key={block.index} style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', color: 'var(--accent-blue-light)', fontSize: '11.5px' }}>
                              {block.index === 0 ? t.genesis_block : `${t.block_prefix}${block.index}`}
                            </span>
                            <span style={{
                              color: '#fff',
                              fontWeight: '700',
                              background: 'rgba(37,99,235,0.2)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '10px'
                            }}>
                              {t.sealed_by} {block.miner_alias || (block.index === 0 ? 'GENESIS' : 'UNKNOWN')}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {new Date(block.timestamp * 1000).toLocaleTimeString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Hash: {block.hash}
                          </div>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', fontSize: '10.5px' }}>
                            {block.transactions.map((tx, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0' }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {tx.sender === null || tx.sender === 'COINBASE' ? (
                                    <span style={{ color: '#10b981', fontWeight: '600' }}>
                                      {t.block_reward} [{tx.recipient_alias || t.miner_alias_fallback}]
                                    </span>
                                  ) : (
                                    <span>
                                      <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.sender_alias || t.sender_fallback}]</strong> {'->'} <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.recipient_alias || t.recipient_fallback}]</strong>
                                    </span>
                                  )}
                                </span>
                                <strong style={{ color: '#fff' }}>+{tx.amount} Coin</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {pendingTxs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                          {t.mempool_empty}
                        </div>
                      ) : (
                        pendingTxs.map((tx, i) => (
                          <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '5px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px' }}>
                              <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.sender_alias || '...'}]</strong> {'->'} <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.recipient_alias || '...'}]</strong>
                            </span>
                            <strong style={{ color: 'var(--accent-blue-light)', fontSize: '11px' }}>{tx.amount} Coin</strong>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Engine Metrics Footer Strip */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{t.footer_consensus}</strong>
                  <span style={{ color: 'var(--text-dim)' }}>({t.footer_target})</span>
                </span>
                <span style={{ color: 'var(--border)' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{t.footer_supply}</span>
                  <strong style={{ color: '#10b981' }}>{totalMinedCoins} COIN</strong>
                  <span style={{ color: 'var(--text-dim)', fontSize: '9.5px' }}>({t.footer_halving.replace('{n}', nextHalvingBlock)})</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{t.footer_tip}</span>
                  <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    #{latestBlock ? latestBlock.index : 0}
                  </strong>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '9.5px' }}>
                    ({latestBlock ? `${latestBlock.hash.slice(0, 10)}...` : '0000...'})
                  </span>
                </span>
              </div>
            </div>
          </>
        )}

        {/* Modal: 12-Word Mnemonic Display */}
        {showMnemonicModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-blue)',
              borderRadius: '14px',
              padding: '28px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8)'
            }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '6px', color: 'var(--accent-blue-light)' }}>
                {t.seed_modal_title}
              </h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                {t.seed_modal_desc}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'var(--bg-terminal)',
                border: '1px solid var(--border)',
                padding: '14px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                {generatedMnemonic.split(' ').map((word, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    textAlign: 'left'
                  }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{idx + 1}.</span>
                    <strong style={{ color: 'var(--text-main)' }}>{word}</strong>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowMnemonicModal(false)
                  setWalletStatus('unlocked')
                }}
                style={{
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '11px 24px',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {t.btn_seed_saved}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
