import { useState, useRef, useEffect } from 'react'
import { testConnection, findMusicSection } from '../lib/plex.js'

const T = {
  bg: '#08080c',
  surface: '#14141a',
  gold: '#c9a66b',
  goldDark: '#a07d4a',
  goldLight: '#e0c992',
  goldA15: 'rgba(201,166,107,.15)',
  goldA35: 'rgba(201,166,107,.35)',
  text: '#e8e4df',
  textSub: 'rgba(232,228,223,.82)',
  textMeta: 'rgba(232,228,223,.72)',
  textDim: 'rgba(232,228,223,.58)',
  red: '#e07070',
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 13,
  color: T.text,
  outline: 'none',
  transition: 'border-color .15s',
}

export function PlexConfig({ onSave, onBack, initialUrl = '', initialToken = '', isSettings = false }) {
  const [url, setUrl] = useState(initialUrl)
  const [tok, setTok] = useState(initialToken)
  const [status, setStatus] = useState('idle') // idle | connecting | error
  const [error, setError] = useState('')
  const urlRef = useRef(null)

  useEffect(() => { urlRef.current?.focus() }, [])
  useEffect(() => { setUrl(initialUrl) }, [initialUrl])
  useEffect(() => { setTok(initialToken) }, [initialToken])

  async function handleSave() {
    const u = url.trim().replace(/\/$/, '')
    const t = tok.trim()
    if (!u || !t) { setError('Enter both a server URL and token.'); return }

    setStatus('connecting')
    setError('')
    try {
      await testConnection(u, t)
      const sectionKey = await findMusicSection(u, t)
      onSave({ serverUrl: u, token: t, sectionKey })
    } catch (e) {
      setStatus('error')
      setError(e.message || 'Could not connect to Plex server.')
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: 24, gap: 20, overflowY: 'auto',
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={T.gold}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <h2 style={{
            margin: 0,
            fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600,
            color: T.text,
          }}>
            {isSettings ? 'Settings' : 'Connect to Plex'}
          </h2>
        </div>
        <p style={{
          margin: 0,
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.textDim, lineHeight: 1.5,
        }}>
          {isSettings
            ? 'Update your Plex server connection.'
            : 'Enter your Plex server address and token to get started.'}
        </p>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{
            display: 'block', marginBottom: 5,
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMeta,
          }}>
            Server URL
          </label>
          <input
            ref={urlRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={onKey}
            placeholder="http://192.168.0.2:32400"
            style={inputStyle}
          />
          <div style={{
            marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 11,
            color: T.textDim, lineHeight: 1.4,
          }}>
            Your Plex server's local IP and port (default 32400).
          </div>
        </div>

        <div>
          <label style={{
            display: 'block', marginBottom: 5,
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMeta,
          }}>
            X-Plex-Token
          </label>
          <input
            value={tok}
            onChange={e => setTok(e.target.value)}
            onKeyDown={onKey}
            type="password"
            placeholder="Paste your token here"
            style={inputStyle}
          />
          <div style={{
            marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 11,
            color: T.textDim, lineHeight: 1.4,
          }}>
            In Plex Web: sign in, open any media item, click ··· → Get Info → View XML. Copy the{' '}
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.goldLight }}>X-Plex-Token</span>
            {' '}from the URL.
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)',
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.red,
        }}>
          {error}
        </div>
      )}

      {/* Back button (settings mode only) */}
      {isSettings && onBack && (
        <button
          onClick={onBack}
          style={{
            padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
            cursor: 'pointer', background: 'transparent',
            color: T.textMeta, fontFamily: "'DM Sans',sans-serif", fontSize: 14,
            transition: 'color .15s, border-color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'rgba(255,255,255,.25)' }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textMeta; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
        >
          Cancel
        </button>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={status === 'connecting'}
        style={{
          padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg,${T.gold},${T.goldDark})`,
          color: T.bg, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
          opacity: status === 'connecting' ? 0.6 : 1,
          transition: 'opacity .15s, transform .1s',
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(.97)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {status === 'connecting' ? 'Connecting…' : isSettings ? 'Save' : 'Connect'}
      </button>
    </div>
  )
}
