import { useState } from 'react'

const P = 'heartflow.'

export function useConfig() {
  const [config, setConfigState] = useState(() => ({
    serverUrl: localStorage.getItem(P + 'serverUrl') || '',
    token: localStorage.getItem(P + 'token') || '',
    sectionKey: localStorage.getItem(P + 'sectionKey') || '',
  }))

  function setConfig(next) {
    localStorage.setItem(P + 'serverUrl', next.serverUrl || '')
    localStorage.setItem(P + 'token', next.token || '')
    localStorage.setItem(P + 'sectionKey', next.sectionKey || '')
    setConfigState(next)
  }

  function clearConfig() {
    ;[P + 'serverUrl', P + 'token', P + 'sectionKey'].forEach((k) =>
      localStorage.removeItem(k)
    )
    setConfigState({ serverUrl: '', token: '', sectionKey: '' })
  }

  const isConfigured = !!(config.serverUrl && config.token)

  return { config, setConfig, clearConfig, isConfigured }
}
