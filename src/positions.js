const STORAGE_KEY = 'repprep:positions'

const store = load()

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return new Map()
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(store)))
  } catch {
    // storage unavailable or full
  }
}

export function getPositionData(fen) {
  return store.get(fen)
}

export function updatePositionData(fen, patch) {
  const next = { ...(store.get(fen) ?? {}), ...patch }
  store.set(fen, next)
  persist()
  return next
}
