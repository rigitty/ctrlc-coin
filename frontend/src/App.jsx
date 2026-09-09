import React, { useState, useEffect, useRef } from 'react'

export default function App() {
  const urlParams = new URLSearchParams(window.location.search)
  const currentPort = parseInt(urlParams.get('port') || '5000', 10)

  // Node & Wallet States
  const [walletStatus, setWalletStatus] = useState('loading') // 'no_wallet' | 'locked' | 'unlocked' | 'offline'
  const [walletData, setWalletData] = useState(null)
  const [chainData, setChainData] = useState([])
  const [pendingTxs, setPendingTxs] = useState([])
  const [logs, setLogs] = useState([])
  const [difficulty, setDifficulty] = useState(5)
  const [peersCount, setPeersCount] = useState(0)
  const [isMining, setIsMining] = useState(false)

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
      notify('Cüzdan Adresi Kopyalandı! 📋')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const terminalRef = useRef(null)

  // Polling loop
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

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  const notify = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 4000)
  }

  // Wallet Actions
  const handleCreateWallet = async (e) => {
    e.preventDefault()
    if (!createPassword || createPassword.length < 4) {
      alert('Parola en az 4 karakter olmalıdır!')
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
        notify('12 Kelimelik Tohum Başarıyla Üretildi!')
      } else {
        alert(data.error || 'Cüzdan oluşturulamadı')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleImportWallet = async (e) => {
    e.preventDefault()
    const words = importMnemonic.trim().split(/\s+/)
    if (words.length !== 12) {
      alert('Lütfen tam olarak 12 kelime giriniz!')
      return
    }
    if (!importPassword || importPassword.length < 4) {
      alert('Parola en az 4 karakter olmalıdır!')
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
        notify('Cüzdan Başarıyla İçe Aktarıldı!')
      } else {
        alert(data.error || 'İçe aktarma başarısız')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
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
        notify('Cüzdan Kilidi Açıldı!')
      } else {
        alert(data.error || 'Hatalı parola!')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleLockWallet = async () => {
    try {
      await fetch(`http://127.0.0.1:${currentPort}/wallet/lock`, { method: 'POST' })
      notify('Cüzdan Kilitlendi.')
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleResetWallet = async () => {
    if (window.confirm('Cüzdandan çıkmak veya farklı bir cüzdana geçmek istediğinize emin misiniz? (12 kelimelik tohum yedeğinizi aldığınızdan emin olun!)')) {
      try {
        await fetch(`http://127.0.0.1:${currentPort}/wallet/reset`, { method: 'POST' })
        setWalletStatus('no_wallet')
        setWalletData(null)
        notify('Cüzdan sıfırlandı. Yeni cüzdan oluşturabilir veya içe aktarabilirsiniz.')
      } catch (err) {
        alert(`Hata: ${err.message}`)
      }
    }
  }

  // Transfer & Mining
  const handleSendTx = async (e) => {
    e.preventDefault()
    if (!recipient || !amount || Number(amount) <= 0) {
      alert('Geçerli alıcı adresi ve miktar giriniz!')
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
        notify(`💸 ${amount} Coin transferi ağa yayınlandı!`)
        setRecipient('')
        setAmount('')
      } else {
        alert(data.error || 'Transfer reddedildi')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMineBlock = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/mine`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        notify(`⛏️ Blok #${data.block.index} Kazıldı! Nonce: ${data.block.nonce}`)
      } else {
        alert(data.error || 'Madencilik başarısız')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleToggleAutoMine = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/miner/toggle`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setIsMining(data.auto_mining)
        notify(data.auto_mining ? 'Otomatik Madenci Aktif' : 'Otomatik Madenci Durduruldu')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleConsensusSync = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/nodes/resolve`)
      const data = await res.json()
      notify(data.message)
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

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
            {walletStatus === 'offline' ? '○ ÇEVRİMDIŞI' : '● ÇEVRİMİÇİ'}
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
          <span style={{ color: 'var(--text-muted)' }}>P2P Ağ:</span>
          <strong style={{ color: peersCount > 0 ? 'var(--accent-blue-light)' : 'var(--text-muted)' }}>
            {peersCount > 0 ? `${peersCount} Eş Bağlı` : 'Eş Aranıyor...'}
          </strong>
        </div>

        {/* Right: Quick Actions & Window Controls */}
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

          {walletStatus === 'unlocked' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setShowBackupMnemonic(!showBackupMnemonic)}
                title="12 Kelimelik Kurtarma İfadesi"
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
                🔑 12 Kelime
              </button>
              <button
                onClick={handleLockWallet}
                title="Cüzdanı Kilitle"
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
                🔒 Kilitle
              </button>
              <button
                onClick={handleResetWallet}
                title="Cüzdan Değiştir / Sıfırla"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '10.5px'
                }}
              >
                🔄 Değiştir
              </button>
            </div>
          )}

          {/* Window Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
            <button
              className="window-control-btn"
              title="Simge Durumuna Küçült"
              onClick={() => window.electronAPI?.minimize()}
            >
              &#8212;
            </button>
            <button
              className="window-control-btn"
              title="Büyüt / Geri Yükle"
              onClick={() => window.electronAPI?.maximize()}
            >
              &#9634;
            </button>
            <button
              className="window-control-btn close"
              title="Kapat"
              onClick={() => window.electronAPI?.close()}
            >
              &#10005;
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

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
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📡</div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: 'var(--accent-blue-light)' }}>
              Node Bağlantısı Bekleniyor (Port {currentPort})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.6' }}>
              Port {currentPort} üzerindeki Python blockchain sunucusuna erişilemiyor.<br />
              Başlatmak için terminalde şu komutu çalıştırabilirsiniz:
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
              Bağlantıyı Yeniden Dene 🔄
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
              Kriptografik Cüzdan Kurulumu
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Merkezi hesap yoktur. Cüzdanınız yerel olarak 12 kelimelik tohumla şifrelenir.
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
                ⚡ Yeni Cüzdan Oluştur
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
                📥 12 Kelime ile İçe Aktar
              </button>
            </div>

            {authTab === 'create' ? (
              <form onSubmit={handleCreateWallet} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                    Cüzdanı Şifreleyecek Güvenli Parola Belirleyin:
                  </label>
                  <input
                    type="password"
                    placeholder="En az 4 karakter"
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
                  Cüzdanı Oluştur & 12 Kelimeyi Üret
                </button>
              </form>
            ) : (
              <form onSubmit={handleImportWallet} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                    12 Kelimelik Tohum İfadesi (Seed Phrase):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="12 kelimeyi boşluklarla girin..."
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
                    Yeni Yerel Parola Belirleyin:
                  </label>
                  <input
                    type="password"
                    placeholder="Cüzdan kilidini açacak şifre"
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
                  Cüzdanı Geri Yükle & Aç
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
              Cüzdan Kilitli (Port {currentPort})
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Cüzdanınızı açmak için parolanızı girin.
            </p>

            <form onSubmit={handleUnlockWallet} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder="Parolanızı Girin"
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
                Cüzdanı Aç 🔓
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
                Farklı Cüzdana Geç / Sıfırla 🔄
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
                    🔑 12 Kelimelik Tohum İfadeniz (BIP-39 Mnemonic Backup)
                  </span>
                  <button
                    onClick={() => setShowBackupMnemonic(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Bu 12 kelime özel anahtarınızı oluşturur. Asla kimseyle paylaşmayın; cihazınızı kaybetseniz bile paranızı bu kelimelerle geri alabilirsiniz.
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: '12px' }}>

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
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>CÜZDAN BAKİYESİ</span>
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
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Genel Adres:</span>
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
                      {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
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
                      TRANSFER GÖNDER
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue-light)' }}>
                      🔒 Otomatik RSA İmzalı
                    </span>
                  </div>

                  <form onSubmit={handleSendTx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Alıcı Adresi veya 4 Harfli İsmi (Örn: LUNA)"
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
                        placeholder="Miktar (Coin)"
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
                        {isSubmitting ? '...' : 'Gönder 💸'}
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
                      KONSENSÜS & POI
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-blue-light)', fontFamily: 'monospace' }}>
                      Zorluk: {difficulty}
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
                      ⛏️ 1 Blok Kaz (+50 Coin)
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
                        {isMining ? '⏹️ Oto-Madenci: Açık' : '▶️ Oto-Madenci'}
                      </button>

                      <button
                        onClick={handleConsensusSync}
                        title="Eşlerle Zinciri Senkronize Et"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          borderRadius: '5px',
                          padding: '5px 8px',
                          fontSize: '10.5px'
                        }}
                      >
                        🔄 Senk
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lower Row: 2-Column Balanced Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px', alignItems: 'stretch' }}>

              {/* Left Column: Live Terminal */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)' }}>
                      Canlı Düğüm Konsolu
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {logs.length} Kayıt
                  </span>
                </div>
                <div
                  ref={terminalRef}
                  style={{
                    background: 'var(--bg-terminal)',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    height: '270px',
                    overflowY: 'auto',
                    padding: '8px 10px',
                    fontSize: '10.5px',
                    lineHeight: '1.45',
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
                    🔗 Blokzincir ({chainData.length})
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
                    ⏳ Mempool ({pendingTxs.length})
                  </button>
                </div>

                <div style={{ height: '270px', overflowY: 'auto', paddingRight: '4px' }}>
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
                              {block.index === 0 ? '🌟 Genesis Block #0' : `📦 Blok #${block.index}`}
                            </span>
                            <span style={{
                              color: '#fff',
                              fontWeight: '700',
                              background: 'rgba(37,99,235,0.2)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '10px'
                            }}>
                              ⛏️ {block.miner_alias || (block.index === 0 ? 'GENESIS' : 'BİLİNMİYOR')}
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
                                      🎁 Blok Ödülü ➜ [{tx.recipient_alias || 'MADENCİ'}]
                                    </span>
                                  ) : (
                                    <span>
                                      <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.sender_alias || 'GÖNDEREN'}]</strong> ➜ <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.recipient_alias || 'ALICI'}]</strong>
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
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                          Mempool boş. Bekleyen transfer bulunmuyor.
                        </div>
                      ) : (
                        pendingTxs.map((tx, i) => (
                          <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '5px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px' }}>
                              <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.sender_alias || '...'}]</strong> ➜ <strong style={{ color: 'var(--accent-blue-light)' }}>[{tx.recipient_alias || '...'}]</strong>
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
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
              <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '6px', color: 'var(--accent-blue-light)' }}>
                12 Kelimelik Tohum İfadenizi Kaydedin
              </h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                Bu kelimeler cüzdanınızın tek yedeğidir. Bir yere not edin.
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
                Kelimeleri Güvenle Kaydettim, Devam Et
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
