import { useState, useRef, useEffect, useCallback } from 'react'
import { streamUrl } from '../lib/plex.js'

export function usePlayback(serverUrl, token) {
  const audioRef = useRef(null)
  const fadeTimerRef = useRef(null)
  const favQueueRef = useRef(null)
  const playRef = useRef(null) // always-current ref to avoid stale closures in audio events

  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audioTime, setAudioTime] = useState({ current: 0, duration: 0 })

  function clearFade() {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
    if (audioRef.current) audioRef.current.volume = 1
  }

  const fadeAndPause = useCallback((audio) => {
    if (!audio || audio.paused) return
    clearFade()
    const steps = 10
    const interval = 15
    const startVol = audio.volume
    const decrement = startVol / steps
    let remaining = steps
    fadeTimerRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(fadeTimerRef.current)
        fadeTimerRef.current = null
        audio.pause()
        audio.volume = startVol
      } else {
        audio.volume = Math.max(0, audio.volume - decrement)
      }
    }, interval)
  }, [])

  const updateMetadata = useCallback((track) => {
    if (!('mediaSession' in navigator) || !track) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || '',
      artist: track.artist || '',
      album: track.albumTitle || '',
      artwork: track.thumbUrl ? [{ src: track.thumbUrl }] : [],
    })
  }, [])

  const playTrack = useCallback(
    (track, allTracks) => {
      const audio = audioRef.current
      if (!audio || !track?.partKey) return

      // Update queue before playing so onended sees the new position immediately
      if (allTracks) {
        const idx = Math.max(
          0,
          allTracks.findIndex((t) => t.ratingKey === track.ratingKey)
        )
        favQueueRef.current = { tracks: allTracks, idx }
      }

      const src = streamUrl(serverUrl, token, track.partKey)

      clearFade()
      audio.src = src
      audio.currentTime = 0
      setProgress(0)
      setAudioTime({ current: 0, duration: 0 })

      audio.volume = 1
      audio.play().catch(() => {})
      setCurrentTrack(track)
      setPlaying(true)
      updateMetadata(track)
    },
    [serverUrl, token, updateMetadata]
  )

  // Keep ref current so audio event handlers always have the latest version
  useEffect(() => {
    playRef.current = playTrack
  }, [playTrack])

  // Initialise audio element once
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
        setAudioTime({ current: audio.currentTime, duration: audio.duration })
      }
    }

    // Uses refs so this handler never goes stale
    audio.onended = () => {
      const q = favQueueRef.current
      if (q) {
        const nextIdx = q.idx + 1
        if (nextIdx < q.tracks.length) {
          playRef.current?.(q.tracks[nextIdx], q.tracks)
        } else {
          setPlaying(false)
        }
      } else {
        setPlaying(false)
      }
    }

    return () => {
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // MediaSession action handlers — use refs so closures never go stale
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', () => {
      const audio = audioRef.current
      if (!audio) return
      clearFade()
      audio.volume = 1
      audio.play().catch(() => {})
      setPlaying(true)
    })

    navigator.mediaSession.setActionHandler('pause', () => {
      fadeAndPause(audioRef.current)
      setPlaying(false)
    })

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const q = favQueueRef.current
      if (q && q.idx + 1 < q.tracks.length) {
        playRef.current?.(q.tracks[q.idx + 1], q.tracks)
      }
    })

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const q = favQueueRef.current
      if (q && q.idx > 0) {
        playRef.current?.(q.tracks[q.idx - 1], q.tracks)
      }
    })

    return () => {
      ;['play', 'pause', 'nexttrack', 'previoustrack'].forEach((a) =>
        navigator.mediaSession.setActionHandler(a, null)
      )
    }
  }, [fadeAndPause])

  // Sync MediaSession playbackState
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      fadeAndPause(audio)
      setPlaying(false)
    } else {
      clearFade()
      audio.volume = 1
      audio.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing, fadeAndPause])

  const next = useCallback(() => {
    const q = favQueueRef.current
    if (q && q.idx + 1 < q.tracks.length) {
      playTrack(q.tracks[q.idx + 1], q.tracks)
    }
  }, [playTrack])

  const prev = useCallback(() => {
    const q = favQueueRef.current
    if (q && q.idx > 0) {
      playTrack(q.tracks[q.idx - 1], q.tracks)
    }
  }, [playTrack])

  const seek = useCallback((pct) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = (pct / 100) * audio.duration
    setProgress(pct)
  }, [])

  return {
    currentTrack,
    playing,
    progress,
    audioTime,
    play: playTrack,
    toggle,
    next,
    prev,
    seek,
    currentRatingKey: currentTrack?.ratingKey ?? null,
  }
}
