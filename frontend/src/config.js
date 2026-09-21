const PRODUCTION_API_BASE_URL = 'https://maya-support-backend.thankfulsea-70177418.centralindia.azurecontainerapps.io'

const isPlaceholderBase = (value) => value?.includes('example.invalid')

const defaultApiBase = import.meta.env.DEV
  ? ''
  : PRODUCTION_API_BASE_URL

const configuredApiBase = import.meta.env.VITE_API_BASE_URL
const configuredWsBase = import.meta.env.VITE_WS_BASE_URL

const apiBase = (
  configuredApiBase && !isPlaceholderBase(configuredApiBase)
    ? configuredApiBase
    : defaultApiBase
).replace(/\/$/, '')

const defaultWsBase = import.meta.env.DEV
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  : PRODUCTION_API_BASE_URL.replace(/^https/, 'wss')
const wsBase = (
  configuredWsBase && !isPlaceholderBase(configuredWsBase)
    ? configuredWsBase
    : defaultWsBase
).replace(/\/$/, '')

export const API_BASE_URL = apiBase

export const WS_BASE_URL = wsBase

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
