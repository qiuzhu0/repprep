import { Chess } from 'chess.js'
import { uciToMove } from './uci'

const MAX_REQUESTS = 20
const MAX_DEPTH = 8
const TOP_MOVES = 5
const MIN_PROB = 0.002

const cache = new Map()

function applyUci(fen, uci) {
  const game = new Chess(fen)
  const move = game.move(uciToMove(uci))
  return { fen: game.fen(), move }
}

async function fetchExplorer(fen, token, rating, speed) {
  const key = `${fen}|${rating}|${speed}`
  const cached = cache.get(key)
  if (cached) return cached
  const params = new URLSearchParams({ fen, moves: '12', topGames: '0', recentGames: '0' })
  if (rating) params.set('ratings', rating)
  if (speed) params.set('speeds', speed)
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
  cache.set(key, entry)
  return entry
}

export async function excavate(fen, token, restrict, rating = '', speed = '', count = 5, crumbs = []) {
  const repertoire = restrict === 'white' ? 'w' : restrict === 'black' ? 'b' : null
  const crumbsSet = new Set(crumbs)
  const results = new Map()
  const visited = new Set()
  const stack = [{ fen, prob: 1, ucis: [], sans: [], depth: 0 }]
  let requests = 0
  let rateLimited = false

  while (stack.length > 0 && requests < MAX_REQUESTS) {
    const node = stack.pop()
    if (visited.has(node.fen)) continue
    visited.add(node.fen)

    let data
    try {
      data = await fetchExplorer(node.fen, token, rating, speed)
      requests += 1
    } catch (err) {
      if (err?.message === 'rate-limited') {
        rateLimited = true
        break
      }
      if (err?.message === 'invalid-token') throw err
      continue
    }

    if (data.total <= 0) continue
    const turn = node.fen.split(' ')[1]
    const isRepertoireTurn = repertoire !== null && turn === repertoire
    const children = []
    for (const m of data.moves) {
      const share = (m.white || 0) + (m.draws || 0) + (m.black || 0)
      if (share <= 0) continue
      let child
      try {
        child = applyUci(node.fen, m.uci)
      } catch {
        continue
      }
      let childProb
      if (isRepertoireTurn) {
        if (!crumbsSet.has(child.fen)) continue
        childProb = node.prob
      } else {
        childProb = node.prob * (share / data.total)
      }
      if (childProb < MIN_PROB || node.depth + 1 > MAX_DEPTH) continue
      const entry = {
        fen: child.fen,
        prob: childProb,
        depth: node.depth + 1,
        rootFen: fen,
        ucis: [...node.ucis, m.uci],
        sans: [...node.sans, child.move.san],
      }
      if (!crumbsSet.has(child.fen)) {
        const prev = results.get(child.fen)
        if (!prev || childProb > prev.prob) results.set(child.fen, entry)
      }
      children.push(entry)
    }
    children.sort((a, b) => b.prob - a.prob)
    for (const c of children.slice(0, TOP_MOVES).reverse()) stack.push(c)
  }

  const top = [...results.values()]
    .sort((a, b) => b.prob - a.prob)
    .slice(0, Math.max(0, Math.floor(count) || 0))
  const noRootLine = repertoire !== null && repertoire === fen.split(' ')[1] && results.size === 0
  return { results: top, requests, rateLimited, noRootLine }
}
