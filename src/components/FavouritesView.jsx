import { useMemo, useRef, useState, useEffect, memo } from 'react'
import { List as VirtualList } from 'react-window'
import { usePlexFavourites } from '../hooks/usePlexFavourites.js'
import { usePlayback } from '../hooks/usePlayback.js'
import { fmtTime, fmtDuration } from '../lib/format.js'

/* ── design tokens ────────────────────────────────────────────────────────── */
const T = {
  bg: '#08080c',
  surface: '#14141a',
  gold: '#c9a66b',
  goldDark: '#a07d4a',
  goldA7: 'rgba(201,166,107,.07)',
  goldA15: 'rgba(201,166,107,.15)',
  goldA18: 'rgba(201,166,107,.18)',
  goldA20: 'rgba(201,166,107,.20)',
  goldA25: 'rgba(201,166,107,.25)',
  goldA35: 'rgba(201,166,107,.35)',
  text: '#e8e4df',
  textSub: 'rgba(232,228,223,.82)',
  textMeta: 'rgba(232,228,223,.72)',
  textFaint: 'rgba(232,228,223,.65)',
  textDim: 'rgba(232,228,223,.58)',
  red: '#e07070',
}

const ROW_H = 60

/* ── animated equalizer ───────────────────────────────────────────────────── */
function Equalizer() {
  return (
    <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: 'block', width: 3, borderRadius: 2,
          background: T.gold,
          animation: `hfEq${i + 1} .9s ease-in-out infinite alternate`,
        }} />
      ))}
    </span>
  )
}

/* ── album art fallback ───────────────────────────────────────────────────── */
function ArtFallback({ title, size }) {
  const letter = (title || '?')[0].toUpperCase()
  const hue = [...(title || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `hsl(${hue},18%,18%)`,
      fontFamily: "'Playfair Display',serif", fontSize: size * 0.4, color: T.textFaint,
    }}>
      {letter}
    </div>
  )
}

/* ── track row (virtualised) ─────────────────────────────────────────────── */
const TrackRow = memo(function TrackRow({ index, style, tracks, onPlay, currentRatingKey }) {
  const t = tracks[index]
  const isPlaying = t.ratingKey === currentRatingKey

  return (
    <div style={style}>
      <button
        onClick={() => onPlay(t, tracks)}
        aria-label={`Play ${t.title} by ${t.artist}`}
        style={{
          all: 'unset', display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', cursor: 'pointer',
          width: '100%', height: '100%', boxSizing: 'border-box',
          borderLeft: `2px solid ${isPlaying ? T.gold : 'transparent'}`,
          background: isPlaying ? T.goldA7 : 'transparent',
          transition: 'background .08s, border-left-color .1s',
        }}
        onMouseEnter={e => {
          if (!isPlaying) {
            e.currentTarget.style.background = T.goldA7
            e.currentTarget.style.borderLeftColor = T.gold
          }
        }}
        onMouseLeave={e => {
          if (!isPlaying) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderLeftColor = 'transparent'
          }
        }}
      >
        {/* Playing indicator */}
        <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {isPlaying && <Equalizer />}
        </div>

        {/* Album art */}
        <div style={{ width: 40, height: 40, borderRadius: 5, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
          {t.thumbUrl
            ? <img src={t.thumbUrl} alt="" width={40} height={40} loading="lazy"
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
            : <ArtFallback title={t.albumTitle} size={40} />
          }
        </div>

        {/* Track info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            color: isPlaying ? T.gold : T.text,
            fontWeight: isPlaying ? 600 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color .15s',
          }}>
            {t.title}
          </div>
          <div style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ color: T.textMeta }}>{t.artist}</span>
            {t.albumTitle && <span style={{ color: T.textFaint }}> · {t.albumTitle}</span>}
          </div>
        </div>

        {/* Duration */}
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: T.textDim, flexShrink: 0 }}>
          {fmtDuration(t.duration)}
        </div>
      </button>
    </div>
  )
})

/* ── sort pills ──────────────────────────────────────────────────────────── */
const SORT_OPTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'artist', label: 'Artist' },
]

/* ── now playing bar ─────────────────────────────────────────────────────── */
function NowPlayingBar({ track, playing, progress, audioTime, onToggle, onPrev, onNext, onSeek }) {
  const btnBase = {
    background: 'none', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.textSub, transition: 'color .15s, border-color .15s',
  }

  return (
    <div style={{
      flexShrink: 0, padding: '14px 16px 16px',
      borderBottom: '1px solid rgba(255,255,255,.07)',
      display: 'flex', gap: 14, alignItems: 'center',
      background: 'rgba(255,255,255,.02)',
    }}>
      {/* Album art */}
      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,.6)' }}>
        {track?.thumbUrl
          ? <img src={track.thumbUrl} alt="" width={72} height={72} loading="lazy"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          : <ArtFallback title={track?.albumTitle} size={72} />
        }
      </div>

      {/* Info + controls */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, lineHeight: 1.2,
          color: track ? T.text : T.textDim,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track?.title || 'Nothing playing'}
        </div>
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textMeta,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track
            ? [track.artist, track.albumTitle].filter(Boolean).join(' · ')
            : 'Pick a track or shuffle'}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textDim, width: 28, textAlign: 'right', flexShrink: 0 }}>
            {fmtTime(audioTime?.current)}
          </span>
          <input
            type="range" min="0" max="100" step="0.1"
            value={progress}
            onChange={e => onSeek(Number(e.target.value))}
            className="seek-bar"
            aria-label="Playback position"
            style={{
              flex: 1,
              background: `linear-gradient(to right,${T.gold} ${progress}%,rgba(255,255,255,.08) ${progress}%)`,
            }}
          />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textDim, width: 28, flexShrink: 0 }}>
            {fmtTime(audioTime?.duration)}
          </span>
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onPrev}
            aria-label="Previous"
            style={{ ...btnBase, width: 32, height: 32 }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>

          <button
            onClick={onToggle}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg,${T.gold},${T.goldDark})`,
              color: T.bg, cursor: 'pointer',
              boxShadow: `0 2px 12px rgba(201,166,107,.35)`,
              transition: 'transform .1s',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(.93)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {playing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>

          <button
            onClick={onNext}
            aria-label="Next"
            style={{ ...btnBase, width: 32, height: 32 }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── main view ───────────────────────────────────────────────────────────── */
export function FavouritesView({ config, onOpenSettings }) {
  const { serverUrl, token, sectionKey } = config
  const { tracks, loading, error, refetch, sort, setSort } = usePlexFavourites(serverUrl, token, sectionKey)
  const pb = usePlayback(serverUrl, token)

  const [shuffling, setShuffling] = useState(false)
  const listContainerRef = useRef(null)
  const [listHeight, setListHeight] = useState(300)

  // Measure the list container for react-window
  useEffect(() => {
    if (!listContainerRef.current) return
    const ro = new ResizeObserver(([entry]) => setListHeight(entry.contentRect.height))
    ro.observe(listContainerRef.current)
    return () => ro.disconnect()
  }, [])

  const rowProps = useMemo(
    () => ({ tracks, onPlay: pb.play, currentRatingKey: pb.currentRatingKey }),
    [tracks, pb.play, pb.currentRatingKey]
  )

  function shufflePlay() {
    if (!tracks.length) return
    setShuffling(true)
    setTimeout(() => setShuffling(false), 600)
    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
    pb.play(shuffled[0], shuffled)
  }

  // Keyboard shortcuts: space = toggle, , = prev, . = next
  useEffect(() => {
    function onKey(e) {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.metaKey || e.ctrlKey) return
      if (e.key === ' ') { e.preventDefault(); pb.toggle() }
      if (e.key === ',') pb.prev()
      if (e.key === '.') pb.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pb.toggle, pb.prev, pb.next])

  // Listen for reload / settings events from the Tauri tray menu
  useEffect(() => {
    let unlisten1, unlisten2
    ;(async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        unlisten1 = await listen('heartflow://reload', () => refetch())
        unlisten2 = await listen('heartflow://settings', () => onOpenSettings())
      } catch {}
    })()
    return () => {
      unlisten1?.()
      unlisten2?.()
    }
  }, [refetch, onOpenSettings])

  return (
    <>
      <style>{`
        @keyframes hfEq1 { from { height: 4px } to { height: 14px } }
        @keyframes hfEq2 { from { height: 8px } to { height: 4px } }
        @keyframes hfEq3 { from { height: 12px } to { height: 6px } }
        @keyframes hfShuffleSpin {
          0%   { transform: scale(1) rotate(0deg) }
          40%  { transform: scale(1.25) rotate(-20deg) }
          100% { transform: scale(1) rotate(0deg) }
        }
        @keyframes hfFadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'hfFadeIn .2s ease-out both',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 8px',
          borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0,
        }}>
          {/* Heart icon + count */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill={T.gold} style={{ flexShrink: 0 }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600,
            letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMeta, flexShrink: 0,
          }}>
            {loading ? 'Heartflow' : `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`}
          </span>

          <div style={{ flex: 1 }} />

          {/* Sort pills */}
          {!loading && !error && tracks.length > 0 && (
            <div style={{ display: 'flex', gap: 3 }}>
              {SORT_OPTS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  style={{
                    background: sort === opt.key ? T.goldA18 : 'transparent',
                    border: sort === opt.key ? `1px solid ${T.goldA35}` : '1px solid rgba(255,255,255,.08)',
                    borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 500,
                    color: sort === opt.key ? T.gold : T.textDim,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (sort !== opt.key) e.currentTarget.style.color = T.text }}
                  onMouseLeave={e => { if (sort !== opt.key) e.currentTarget.style.color = T.textDim }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Shuffle */}
          {!loading && !error && tracks.length > 0 && (
            <button
              onClick={shufflePlay}
              title="Shuffle play"
              aria-label="Shuffle play"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.textDim, padding: '3px 6px', lineHeight: 1,
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: "'DM Sans',sans-serif", fontSize: 11,
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = T.gold}
              onMouseLeave={e => e.currentTarget.style.color = T.textDim}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                style={{ animation: shuffling ? 'hfShuffleSpin .6s ease-out' : 'none' }}
              >
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
              Shuffle
            </button>
          )}

          {/* Settings gear */}
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.textDim, padding: '3px 4px', lineHeight: 1,
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textDim}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>
        </div>

        {/* Now Playing */}
        <NowPlayingBar
          track={pb.currentTrack}
          playing={pb.playing}
          progress={pb.progress}
          audioTime={pb.audioTime}
          onToggle={pb.toggle}
          onPrev={pb.prev}
          onNext={pb.next}
          onSeek={pb.seek}
        />

        {/* States */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: T.textDim, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={T.gold} style={{ marginBottom: 10, opacity: .5, display: 'block', margin: '0 auto 10px' }}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Loading your favourites…
            </div>
          </div>
        )}

        {error && !loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: '0 24px', textAlign: 'center', color: T.red, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
              {error}
              <button
                onClick={refetch}
                style={{
                  display: 'block', margin: '10px auto 0', background: 'none',
                  border: '1px solid rgba(224,112,112,.3)', borderRadius: 6,
                  padding: '5px 14px', cursor: 'pointer',
                  color: T.red, fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && tracks.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: T.textDim, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
              No hearted tracks yet.
              <div style={{ fontSize: 11, marginTop: 6, opacity: .6 }}>
                Heart tracks in Plex or Plexamp to see them here.
              </div>
            </div>
          </div>
        )}

        {/* Virtualised track list */}
        <div ref={listContainerRef} style={{ flex: 1, overflow: 'hidden' }}>
          {!loading && !error && tracks.length > 0 && (
            <VirtualList
              height={listHeight}
              rowCount={tracks.length}
              rowHeight={ROW_H}
              width="100%"
              rowComponent={TrackRow}
              rowProps={rowProps}
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.1) transparent' }}
            />
          )}
        </div>
      </div>
    </>
  )
}
