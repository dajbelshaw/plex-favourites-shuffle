const IS_TAURI =
  typeof window !== 'undefined' &&
  (!!window.__TAURI__ || !!window.__TAURI_INTERNALS__)

function proxyUrl(serverBase, path) {
  if (IS_TAURI) return `${serverBase}${path}`
  return `/plex-proxy/${encodeURIComponent(serverBase)}${path}`
}

async function plexFetch(fullUrl) {
  const parsed = new URL(fullUrl)
  const base = `${parsed.protocol}//${parsed.host}`
  const path = parsed.pathname + parsed.search
  let res
  try {
    res = await fetch(proxyUrl(base, path), {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new Error('Could not reach the Plex server. Check the URL is correct.')
  }
  if (!res.ok) throw new Error(`Plex server responded with ${res.status}`)
  return res.json()
}

export async function testConnection(serverUrl, token) {
  await plexFetch(`${serverUrl}/?X-Plex-Token=${token}`)
}

export async function findMusicSection(serverUrl, token) {
  const data = await plexFetch(`${serverUrl}/library/sections?X-Plex-Token=${token}`)
  const sections = data.MediaContainer.Directory || []
  const music = sections.find((s) => s.type === 'artist')
  if (!music) throw new Error('No music library found on this Plex server.')
  return music.key
}

export async function fetchFavouriteTracks(serverUrl, token, sectionKey) {
  // Prefer the "❤️ Tracks" smart playlist — contains only individually-hearted tracks
  try {
    const playlists = await plexFetch(`${serverUrl}/playlists?X-Plex-Token=${token}`)
    const liked = (playlists.MediaContainer.Metadata || []).find(
      (p) =>
        p.playlistType === 'audio' &&
        p.smart === true &&
        /❤/.test(p.title) &&
        /track/i.test(p.title)
    )
    if (liked) {
      const items = await plexFetch(
        `${serverUrl}/playlists/${liked.ratingKey}/items?X-Plex-Token=${token}`
      )
      return items.MediaContainer.Metadata || []
    }
  } catch {}
  // Fallback: all rated tracks (may include album-inherited ratings)
  const data = await plexFetch(
    `${serverUrl}/library/sections/${sectionKey}/all?type=10&sort=addedAt%3Adesc&userRating%3E%3E0=1&X-Plex-Token=${token}`
  )
  return data.MediaContainer.Metadata || []
}

export function streamUrl(serverUrl, token, partKey) {
  return proxyUrl(serverUrl, `${partKey}?X-Plex-Token=${token}`)
}

export function thumbUrl(serverUrl, token, thumb, size = 120) {
  if (!thumb) return null
  return proxyUrl(
    serverUrl,
    `/photo/:/transcode?url=${encodeURIComponent(thumb)}&width=${size}&height=${size}&X-Plex-Token=${token}`
  )
}

export async function rateTrack(serverUrl, token, ratingKey, rating) {
  const url = proxyUrl(
    serverUrl,
    `/:/rate?key=${ratingKey}&identifier=com.plexapp.plugins.library&rating=${rating}&X-Plex-Token=${token}`
  )
  await fetch(url, { method: 'PUT', headers: { Accept: 'application/json' } })
}
