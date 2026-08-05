import { Chess } from 'chess.js'
import { uciToMove } from './uci'

const MAX_REQUESTS = 200
const MAX_DEPTH = 16
const MIN_PROB = 0.002
const REQUEST_DELAY_MS = 250
const CACHE_KEY = 'repprep:excavateCache'
const CACHE_LIMIT = 600

const cache = loadCache()
let cacheWrites = 0

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return new Map()
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

function persistCache() {
  try {
    if (cache.size === 0) return
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)))
  } catch {
    /* storage unavailable or full */
  }
}

function cacheSet(key, entry) {
  cache.set(key, entry)
  if (cache.size > CACHE_LIMIT) {
    for (const k of cache.keys()) {
      cache.delete(k)
      if (cache.size <= CACHE_LIMIT) break
    }
  }
  if (++cacheWrites % 25 === 0) persistCache()
}

function normalizeFen(fen) {
  // the explorer ignores halfmove/fullmove clocks; treat them as equal
  return fen.split(' ').slice(0, 4).join(' ')
}

function cacheKey(fen, rating, speed) {
  return `${normalizeFen(fen)}|${rating}|${speed}`
}

function applyUci(fen, uci) {
  const game = new Chess(fen)
  const move = game.move(uciToMove(uci))
  return { fen: game.fen(), move }
}

async function fetchExplorer(fen, token, rating, speed) {
  const key = cacheKey(fen, rating, speed)
  const cached = cache.get(key)
  if (cached) return { data: cached, cached: true }
  const params = new URLSearchParams({ fen: normalizeFen(fen), moves: '12', topGames: '0', recentGames: '0' })
  if (rating.length) params.set('ratings', rating.join(','))
  if (speed.length) params.set('speeds', speed.join(','))
  const res = await fetch(`https://explorer.lichess.ovh/lichess?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 401) throw new Error('invalid-token')
  if (res.status === 429) throw new Error('rate-limited')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const total = (data.white || 0) + (data.draws || 0) + (data.black || 0)
  const entry = { total, moves: data?.moves ?? [] }
  cacheSet(key, entry)
  return { data: entry, cached: false }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// max-heap keyed on node.prob
class MaxHeap {
  constructor() {
    this.arr = []
  }
  get size() {
    return this.arr.length
  }
  peek() {
    return this.arr[0]
  }
  push(node) {
    const a = this.arr
    a.push(node)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].prob >= node.prob) break
      a[i] = a[p]
      i = p
    }
    a[i] = node
  }
  pop() {
    const a = this.arr
    const top = a[0]
    const last = a.pop()
    if (a.length > 0) {
      const n = a.length
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < n && a[l].prob > last.prob) m = l
        if (r < n && a[r].prob > a[m].prob) m = r
        if (m === i) break
        a[i] = a[m]
        i = m
      }
      a[i] = last
    }
    return top
  }
}

export async function excavate(fen, token, restrict, rating = '', speed = '', count = 5, crumbs = []) {
  const need = Math.max(0, Math.floor(count) || 0)
  if (need === 0) return { results: [], requests: 0, rateLimited: false, fetchError: null }

  const repertoire = restrict === 'white' ? 'w' : restrict === 'black' ? 'b' : null
  const crumbsSet = new Set(crumbs)
  const results = new Map()
  const visited = new Set()
  const heap = new MaxHeap()
  heap.push({ fen, key: normalizeFen(fen), prob: 1, ucis: [], sans: [], depth: 0 })
  let requests = 0
  let rateLimited = false
  let fetchError = null
  let rootEmpty = false
  let stopped = false

  while (heap.size > 0 && requests < MAX_REQUESTS && !stopped) {
    const node = heap.pop()
    if (visited.has(node.key)) continue
    visited.add(node.key)

    let data
    let cached = false
    try {
      const res = await fetchExplorer(node.fen, token, rating, speed)
      data = res.data
      cached = res.cached
      if (!cached) {
        requests += 1
        if (requests > 1) await sleep(REQUEST_DELAY_MS)
      }
    } catch (err) {
      if (err?.message === 'rate-limited') {
        rateLimited = true
        break
      }
      if (err?.message === 'invalid-token') throw err
      if (!fetchError) {
        fetchError =
          err?.name === 'TimeoutError' ? 'a request timed out' : err?.message || 'a request failed'
      }
      continue
    }

    if (data.total <= 0) {
      if (node.depth === 0) rootEmpty = true
      continue
    }

    const turn = node.fen.split(' ')[1]
    const isRepertoireTurn = repertoire !== null && turn === repertoire

    for (const m of data.moves) {
      const share = (m.white || 0) + (m.draws || 0) + (m.black || 0)
      if (share <= 0) continue
      let child
      try {
        child = applyUci(node.fen, m.uci)
      } catch {
        continue
      }
      const isCrumb = crumbsSet.has(child.fen)

      // The repertoire color only ever plays breadcrumb moves; skip anything
      // else it could legally play. The opponent may play any move, so every
      // one of their replies is explored and recorded.
      if (isRepertoireTurn && !isCrumb) continue

      // A forced breadcrumb reply is reached with certainty, so it keeps the
      // full probability; an opponent reply is weighted by its popularity.
      const childProb = isCrumb && isRepertoireTurn ? node.prob : node.prob * (share / data.total)
      if (childProb < MIN_PROB) continue

      const entry = {
        fen: child.fen,
        key: normalizeFen(child.fen),
        prob: childProb,
        depth: node.depth + 1,
        rootFen: fen,
        ucis: [...node.ucis, m.uci],
        sans: [...node.sans, child.move.san],
      }

      if (!isCrumb) {
        const prev = results.get(child.fen)
        if (!prev || entry.prob > prev.prob) results.set(child.fen, entry)
      }

      if (node.depth + 1 < MAX_DEPTH) heap.push(entry)
    }

    // prob never increases along a path, so once the frontier's best node
    // can't beat the current need-th best result, no deeper position can rank
    // higher — stop. This provably returns the true top-N most popular
    // positions while expanding the minimum number of nodes.
    if (results.size >= need) {
      const sorted = [...results.values()].sort((a, b) => b.prob - a.prob)
      const kth = sorted[need - 1].prob
      if (heap.size === 0 || heap.peek().prob <= kth) stopped = true
    }
  }

  persistCache()

  const top = [...results.values()]
    .sort((a, b) => b.prob - a.prob)
    .slice(0, need)
  const noGames = top.length === 0 && !fetchError && rootEmpty
  return {
    results: top,
    requests,
    rateLimited,
    fetchError: noGames ? 'no games match the selected filters' : fetchError,
  }
}
