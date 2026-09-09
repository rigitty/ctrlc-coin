import React, { useState, useEffect, useRef } from 'react'

export default function App() {
  // Get port from query string (?port=5000) or default to 5000
  const urlParams = new URLSearchParams(window.location.search)
  const initialPort = parseInt(urlParams.get('port') || '5000', 10)
  
  const [currentPort, setCurrentPort] = useState(initialPort)
  const [customPortInput, setCustomPortInput] = useState(initialPort.toString())
  
  const [nodeData, setNodeData] = useState({
    online: false,
    wallet: null,
    chain: [],
    pending: [],
    logs: [],
    mining: false,
    difficulty: 5,
    aliases: {}
  })

  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isMiningManual, setIsMiningManual] = useState(false)
  const [statusNotification, setStatusNotification] = useState('')
  const [activeTab, setActiveTab] = useState('chain') // 'chain' | 'mempool'

  const terminalRef = useRef(null)

  // Polling loop for current node
  useEffect(() => {
    let isMounted = true

    const fetchCurrentNode = async () => {
      try {
        const [chainRes, pendingRes, walletRes, logsRes] = await Promise.all([
          fetch(`http://127.0.0.1:${currentPort}/chain`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/pending`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/wallet/current`).catch(() => null),
          fetch(`http://127.0.0.1:${currentPort}/logs`).catch(() => null)
        ])

        if (!chainRes || !chainRes.ok) {
          if (isMounted) {
            setNodeData(prev => ({ ...prev, online: false }))
          }
          return
        }

        const chainJson = await chainRes.json()
        const pendingJson = pendingRes && pendingRes.ok ? await pendingRes.json() : { pending_transactions: [] }
        const walletJson = walletRes && walletRes.ok ? await walletRes.json() : null
        const logsJson = logsRes && logsRes.ok ? await logsRes.json() : { logs: [] }

        // Calculate balance for this node's wallet
        let balance = 0
        if (walletJson && walletJson.public_key && chainJson.chain) {
          const myKey = walletJson.public_key
          for (const block of chainJson.chain) {
            for (const tx of block.transactions) {
              if (tx.recipient === myKey) balance += Number(tx.amount)
              if (tx.sender === myKey) balance -= Number(tx.amount)
            }
          }
        }

        if (isMounted) {
          setNodeData({
            online: true,
            chain: chainJson.chain || [],
            difficulty: chainJson.current_difficulty || 5,
            aliases: chainJson.aliases || {},
            pending: pendingJson.pending_transactions || [],
            wallet: walletJson ? { ...walletJson, balance } : null,
            logs: logsJson.logs || [],
            mining: logsJson.logs && logsJson.logs.some(l => l.includes('Auto-Miner: started'))
          })
        }
      } catch (err) {
        if (isMounted) {
          setNodeData(prev => ({ ...prev, online: false }))
        }
      }
    }

    fetchCurrentNode()
    const timer = setInterval(fetchCurrentNode, 1000)
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
  }, [nodeData.logs])

  const notify = (msg) => {
    setStatusNotification(msg)
    setTimeout(() => setStatusNotification(''), 4500)
  }

  // Actions
  const handleSendTransaction = async (e) => {
    e.preventDefault()
    if (!recipient || !amount || Number(amount) <= 0) {
      alert('Geçerli bir alıcı adresi/ismi ve tutar giriniz.')
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/transactions/sign_and_send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, amount: Number(amount) })
      })
      const data = await res.json()
      if (res.ok) {
        notify(`✅ Transfer Gönderildi: ${amount} Coin ➜ ${recipient}`)
        setRecipient('')
        setAmount('')
      } else {
        alert(`Transfer Reddedildi: ${data.error || 'Bilinmeyen hata'}`)
      }
    } catch (err) {
      alert(`Bağlantı hatası: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  const handleMineBlock = async () => {
    setIsMiningManual(true)
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/mine`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        notify(`⛏️ Blok #${data.block.index} Başarıyla Kazıldı! (Nonce: ${data.block.nonce})`)
      } else {
        alert(data.error || 'Madencilik başarısız')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    } finally {
      setIsMiningManual(false)
    }
  }

  const handleToggleAutoMine = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/miner/toggle`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setNodeData(prev => ({ ...prev, mining: data.miner_running }))
        notify(data.miner_running ? '🚀 Otomatik Madenci Başlatıldı' : '⏹️ Otomatik Madenci Durduruldu')
      }
    } catch (err) {
      alert(`Hata: ${err.message}`)
    }
  }

  const handleResolveConsensus = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${currentPort}/nodes/resolve`)
      const data = await res.json()
      notify(data.message)
    } catch (err) {
      alert(`Mutabakat hatası: ${err.message}`)
    }
  }

  const switchPort = (portNum) => {
    setCurrentPort(portNum)
    setCustomPortInput(portNum.toString())
    // Update window title if electron
    document.title = `CtrlC-Coin Node Client (: ${portNum})`
  }

  const nodeName = nodeData.wallet ? nodeData.wallet.alias : `Node_${currentPort}`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Top Application Header */}
      <header style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Left: Branding & Current Node Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)'
          }}>
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', fontWeight: '700', letterSpacing: '-0.2px' }}>
                CtrlC-Coin Desktop
              </h1>
              <span style={{
                background: nodeData.online ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${nodeData.online ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                color: nodeData.online ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {nodeData.online ? '● ÇEVRİMİÇİ' : '○ ÇEVRİMDIŞI'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Kullanıcı: <strong style={{ color: 'var(--text-main)' }}>{nodeName}</strong> (Port: {currentPort})
            </div>
          </div>
        </div>

        {/* Center: Port Switcher (Allow opening / connecting to any node) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(7, 9, 14, 0.6)',
          border: '1px solid var(--border)',
          padding: '4px 8px',
          borderRadius: '8px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bağlı Port:</span>
          <button
            onClick={() => switchPort(5000)}
            style={{
              background: currentPort === 5000 ? 'var(--accent-blue)' : 'transparent',
              color: currentPort === 5000 ? '#fff' : 'var(--text-muted)',
              border: 'none',
              padding: '3px 10px',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            5000 (Alice)
          </button>
          <button
            onClick={() => switchPort(5001)}
            style={{
              background: currentPort === 5001 ? 'var(--accent-emerald)' : 'transparent',
              color: currentPort === 5001 ? '#000' : 'var(--text-muted)',
              border: 'none',
              padding: '3px 10px',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            5001 (Kevin)
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            <input
              type="number"
              value={customPortInput}
              onChange={e => setCustomPortInput(e.target.value)}
              style={{
                width: '60px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '11px',
                textAlign: 'center'
              }}
            />
            <button
              onClick={() => switchPort(parseInt(customPortInput, 10) || 5000)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            >
              Bağlan
            </button>
          </div>
        </div>

        {/* Right: Chain Stats & Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {statusNotification && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid var(--accent-emerald)',
              color: 'var(--accent-emerald)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {statusNotification}
            </div>
          )}

          <div style={{
            background: 'rgba(7, 9, 14, 0.5)',
            border: '1px solid var(--border)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            display: 'flex',
            gap: '12px'
          }}>
            <span>Zincir: <strong style={{ color: 'var(--accent-cyan)' }}>{nodeData.chain.length} Blok</strong></span>
            <span>Zorluk: <strong style={{ color: 'var(--accent-amber)' }}>{nodeData.difficulty}</strong></span>
            <span>Mempool: <strong style={{ color: 'var(--accent-purple)' }}>{nodeData.pending.length}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Top 3 Control Cards: Wallet, Transfer, Mining */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1fr', gap: '16px' }}>
          
          {/* Card 1: My Wallet */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  CÜZDAN HESABI
                </span>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--accent-blue)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '600'
                }}>
                  {nodeName}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '6px' }}>
                {nodeData.wallet ? `${nodeData.wallet.balance.toFixed(2)} COIN` : '0.00 COIN'}
              </div>
            </div>

            {nodeData.wallet && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Genel Anahtar (Public Key):
                  <div style={{
                    background: 'var(--bg-terminal)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    color: 'var(--accent-cyan)',
                    fontSize: '10px',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} className="terminal-font">
                    {nodeData.wallet.public_key}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {showPrivateKey ? '🙈 Gizli Anahtarı Kapat' : '👁️ Özel Anahtarı (Private Key) Göster'}
                  </button>
                </div>

                {showPrivateKey && (
                  <div style={{
                    background: '#1a0b0b',
                    border: '1px solid #7f1d1d',
                    color: '#fca5a5',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    wordBreak: 'break-all'
                  }} className="terminal-font">
                    {JSON.stringify(nodeData.wallet.private_key)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Send Transaction Form */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  YENİ TRANSFER GÖNDER
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  (Otomatik RSA İmzalı)
                </span>
              </div>

              <form onSubmit={handleSendTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alıcı Adı veya Public Key:</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span
                        onClick={() => setRecipient(currentPort === 5000 ? 'Kevin' : 'Alice')}
                        style={{ fontSize: '10px', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {currentPort === 5000 ? '+ Kevin Seç' : '+ Alice Seç'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Örn: Kevin veya Genel Anahtar"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Miktar (Coin):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={isSending || !nodeData.online}
                      style={{
                        background: 'var(--accent-emerald)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 18px',
                        fontSize: '12px',
                        fontWeight: '700',
                        height: '35px'
                      }}
                    >
                      {isSending ? 'İmzalanıyor...' : 'İmzala & Gönder 💸'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Card 3: Mining & Consensus Controls */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '12px' }}>
                MADENCİLİK & MUTABAKAT
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleMineBlock}
                  disabled={isMiningManual || !nodeData.online}
                  style={{
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {isMiningManual ? '⏳ Nonce Hesaplanıyor...' : '⛏️ 1 Blok Kaz (Manuel PoW)'}
                </button>

                <button
                  onClick={handleToggleAutoMine}
                  disabled={!nodeData.online}
                  style={{
                    background: nodeData.mining ? 'var(--accent-amber)' : 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid var(--accent-amber)',
                    color: nodeData.mining ? '#000' : 'var(--accent-amber)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {nodeData.mining ? '⏹️ Otomatik Madenci: AÇIK' : '▶️ Otomatik Madenci Başlat'}
                </button>

                <button
                  onClick={handleResolveConsensus}
                  disabled={!nodeData.online}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '11px'
                  }}
                >
                  🔄 Eşlerle Zincir Eşitle (Consensus Sync)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Live Terminal Console for Current Node */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700' }}>
                🖥️ {nodeName} Canlı Terminal & PoW Konsolu
              </span>
              <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>
                ● Realtime Stream
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {nodeData.logs.length} Log Girişi
            </span>
          </div>

          <div
            ref={terminalRef}
            style={{
              background: 'var(--bg-terminal)',
              border: '1px solid #1a2234',
              borderRadius: '8px',
              height: '220px',
              overflowY: 'auto',
              padding: '12px',
              fontSize: '11.5px',
              lineHeight: '1.5',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.7)'
            }}
            className="terminal-font"
          >
            {nodeData.logs.length === 0 ? (
              <div style={{ color: '#475569' }}>Terminal akışı başlatılıyor... Node bağlantısı bekleniyor.</div>
            ) : (
              nodeData.logs.map((log, idx) => {
                let color = '#a7f3d0'
                if (log.includes('[MINE]') || log.includes('[Miner]')) color = '#fef08a'
                if (log.includes('[P2P]') || log.includes('[P2P Network]')) color = '#93c5fd'
                if (log.includes('[ERROR]') || log.includes('Exception') || log.includes('[WARN]')) color = '#fca5a5'
                if (log.includes('Mempool:')) color = '#c084fc'
                return (
                  <div key={idx} style={{ color, marginBottom: '2px', wordBreak: 'break-all' }}>
                    {log}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Bottom Section: Tabs for Blockchain Ledger & Mempool */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('chain')}
                style={{
                  background: activeTab === 'chain' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: activeTab === 'chain' ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  color: activeTab === 'chain' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                🔗 Doğrulanmış Blokzincir ({nodeData.chain.length})
              </button>
              <button
                onClick={() => setActiveTab('mempool')}
                style={{
                  background: activeTab === 'mempool' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  border: activeTab === 'mempool' ? '1px solid var(--accent-purple)' : '1px solid transparent',
                  color: activeTab === 'mempool' ? 'var(--accent-purple)' : 'var(--text-muted)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                ⏳ Mempool Havuzu ({nodeData.pending.length})
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bu node'un kabul ettiği güncel yerel defter
            </div>
          </div>

          {/* Tab 1: Blockchain Cards */}
          {activeTab === 'chain' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px'
            }}>
              {nodeData.chain.slice().reverse().map(block => {
                const dateStr = new Date(block.timestamp * 1000).toLocaleTimeString()
                const isGenesis = block.index === 0
                return (
                  <div key={block.index} style={{
                    background: 'rgba(7, 9, 14, 0.5)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontWeight: '700',
                        color: isGenesis ? 'var(--accent-purple)' : 'var(--accent-cyan)',
                        fontSize: '13px'
                      }}>
                        {isGenesis ? '🌟 Genesis Block #0' : `📦 Blok #${block.index}`}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
                    </div>

                    <div style={{ fontSize: '11px', display: 'flex', gap: '10px' }}>
                      <span>Zorluk: <strong>{block.difficulty}</strong></span>
                      <span>Nonce: <strong>{block.nonce}</strong></span>
                    </div>

                    <div style={{ fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Hash:</span>
                      <code style={{ display: 'block', color: 'var(--accent-emerald)', wordBreak: 'break-all', marginTop: '2px' }}>
                        {block.hash}
                      </code>
                    </div>

                    <div style={{ fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Önceki Hash:</span>
                      <code style={{ display: 'block', color: '#64748b', wordBreak: 'break-all', marginTop: '2px' }}>
                        {block.previous_hash}
                      </code>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                        İşlemler ({block.transactions.length}):
                      </span>
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {block.transactions.map((tx, i) => {
                          const isCoinbase = !tx.sender || tx.sender === 'COINBASE'
                          const senderDisplay = isCoinbase ? '⛏️ Madenci Ödülü' : (nodeData.aliases[tx.sender] || `${tx.sender.substring(0, 10)}...`)
                          const recipientDisplay = nodeData.aliases[tx.recipient] || `${tx.recipient.substring(0, 10)}...`
                          return (
                            <div key={i} style={{
                              fontSize: '10.5px',
                              background: isCoinbase ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                              border: `1px solid ${isCoinbase ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}`,
                              padding: '3px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}>
                              <span>{senderDisplay} ➜ {recipientDisplay}</span>
                              <strong style={{ color: isCoinbase ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
                                +{tx.amount} Coin
                              </strong>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab 2: Mempool List */}
          {activeTab === 'mempool' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nodeData.pending.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Mempool havuzunda bekleyen işlem yok. Yeni transfer gönderildiğinde burada listelenir.
                </div>
              ) : (
                nodeData.pending.map((tx, i) => (
                  <div key={i} style={{
                    background: 'rgba(7, 9, 14, 0.5)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600' }}>
                        {nodeData.aliases[tx.sender] || tx.sender.substring(0, 16)} ➜ {nodeData.aliases[tx.recipient] || tx.recipient.substring(0, 16)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Tx Hash: {tx.tx_hash ? tx.tx_hash.substring(0, 24) : 'Hesaplanıyor...'}...
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-amber)' }}>
                      {tx.amount} COIN
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
