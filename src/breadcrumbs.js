const KEY = 'repprep:repertoires'
const ACTIVE_KEY = 'repprep:activeRepertoire'
const LEGACY_COOKIE = 'repprep:breadcrumbs'

function readLegacyCookie() {
  const match = document.cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${LEGACY_COOKIE}=`))
  if (!match) return []
  try {
    const value = decodeURIComponent(match.slice(LEGACY_COOKIE.length + 1))
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((f) => typeof f === 'string')
  } catch {
    return []
  }
}

function clearLegacyCookie() {
  document.cookie = `${LEGACY_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}

export function defaultRepertoires() {
  return [
    { id: 'main-white', name: 'main', color: 'white', breadcrumbs: [] },
    { id: 'main-black', name: 'main', color: 'black', breadcrumbs: [] },
  ]
}

export function loadRepertoires() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            typeof r.name === 'string' &&
            Array.isArray(r.breadcrumbs),
        )
      ) {
        return parsed.map((r) => {
          if (typeof r.color === 'string') return r
          return {
            ...r,
            color: r.id === 'black-rep' || /black/i.test(r.name) ? 'black' : 'white',
          }
        })
      }
    }
  } catch {
    /* fall through to defaults */
  }
  const reps = defaultRepertoires()
  const legacy = readLegacyCookie()
  if (legacy.length > 0) {
    reps[0] = { ...reps[0], breadcrumbs: legacy }
    clearLegacyCookie()
  }
  return reps
}

export function saveRepertoires(reps) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reps))
  } catch {
    /* storage full or unavailable, ignore */
  }
}

export function loadActiveRepertoireId() {
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveActiveRepertoireId(id) {
  localStorage.setItem(ACTIVE_KEY, id)
}
