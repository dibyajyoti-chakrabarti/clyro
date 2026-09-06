import { useEffect, useState } from 'react'
import ServerDown from '../../pages/infrastructure/ServerDown'
import CheckingServerStatus from './CheckingServerStatus'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const POLL_INTERVAL_MS = 15000
const HEALTH_CHECK_TIMEOUT_MS = 7000

export default function HealthGate({ children }) {
  const [backendHealthy, setBackendHealthy] = useState(false)
  const [healthReady, setHealthReady] = useState(false)

  useEffect(() => {
    // ServerDown is a prod-only page: against a local docker-compose backend a
    // transient DB hiccup shouldn't blank the app behind an outage screen.
    // Skip the gate entirely in dev.
    if (import.meta.env.DEV) {
      setBackendHealthy(true)
      setHealthReady(true)
      return
    }

    let cancelled = false

    const checkBackendHealth = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
      try {
        const response = await fetch(`${BASE_URL}/api/health/`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!cancelled) setBackendHealthy(response.ok)
      } catch {
        if (!cancelled) setBackendHealthy(false)
      } finally {
        clearTimeout(timeoutId)
        if (!cancelled) setHealthReady(true)
      }
    }

    checkBackendHealth()
    const intervalId = setInterval(checkBackendHealth, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  if (!healthReady) return <CheckingServerStatus />
  if (!backendHealthy) return <ServerDown />
  return children
}
