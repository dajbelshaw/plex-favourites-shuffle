import { useState, useCallback } from 'react'
import { useConfig } from './hooks/useConfig.js'
import { PlexConfig } from './components/PlexConfig.jsx'
import { FavouritesView } from './components/FavouritesView.jsx'

export default function App() {
  const { config, setConfig, clearConfig, isConfigured } = useConfig()
  const [showSettings, setShowSettings] = useState(false)

  const handleSave = useCallback((next) => {
    setConfig(next)
    setShowSettings(false)
  }, [setConfig])

  const handleOpenSettings = useCallback(() => setShowSettings(true), [])
  const handleCloseSettings = useCallback(() => setShowSettings(false), [])

  // First-run or explicit settings screen
  if (!isConfigured || showSettings) {
    return (
      <PlexConfig
        onSave={handleSave}
        initialUrl={config.serverUrl}
        initialToken={config.token}
        isSettings={showSettings && isConfigured}
        onBack={showSettings ? handleCloseSettings : undefined}
      />
    )
  }

  return (
    <FavouritesView
      config={config}
      onOpenSettings={handleOpenSettings}
    />
  )
}
