import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchFavouriteTracks, thumbUrl } from '../lib/plex.js'

export function usePlexFavourites(serverUrl, token, sectionKey) {
  const [rawTracks, setRawTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState(
    () => localStorage.getItem('heartflow.sort') || 'recent'
  )

  const load = useCallback(async () => {
    if (!serverUrl || !token) return
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchFavouriteTracks(serverUrl, token, sectionKey)
      setRawTracks(
        raw.map((t) => ({
          ratingKey: t.ratingKey,
          title: t.title,
          albumTitle: t.parentTitle || '',
          artist: t.grandparentTitle || '',
          albumId: t.parentRatingKey,
          thumbUrl: thumbUrl(serverUrl, token, t.parentThumb),
          duration: t.duration || 0,
          addedAt: t.addedAt || 0,
          partKey: t.Media?.[0]?.Part?.[0]?.key || null,
        }))
      )
    } catch (e) {
      setError(e.message || 'Could not load favourites.')
    }
    setLoading(false)
  }, [serverUrl, token, sectionKey])

  useEffect(() => {
    load()
  }, [load])

  const tracks = useMemo(() => {
    if (sort === 'alpha')
      return [...rawTracks].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'artist')
      return [...rawTracks].sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
      )
    return rawTracks // 'recent' — API order (addedAt desc)
  }, [rawTracks, sort])

  function changeSort(s) {
    setSort(s)
    localStorage.setItem('heartflow.sort', s)
  }

  return { tracks, loading, error, refetch: load, sort, setSort: changeSort }
}
