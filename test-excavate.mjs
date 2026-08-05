import { Chess } from 'chess.js'

function applyUci(fen, uci) {
  const game = new Chess(fen)
  const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined })
  return { fen: game.fen(), move }
}
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
function fenAfter(moves) {
  const g = new Chess()
  for (const m of moves) g.move(m)
  return g.fen()
}

// VERY comprehensive: user crumbed essentially everything popular within ~10 plies.
const crumbedLines = [
  // Ruy deep mainline + alternatives
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'b7b5'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'f8e7', 'f1e1'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'f7f6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'e7f8'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'b7b5'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'd7d6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f6e4'],
  // all white replies at move 2 crumbed
  ['e2e4', 'e7e5', 'f1c4'],
  ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'c2c3'],
  ['e2e4', 'e7e5', 'f2f4'],
  ['e2e4', 'e7e5', 'b1c3'],
  ['e2e4', 'e7e5', 'd2d3'],
  ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5'],
  ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4'],
  ['e2e4', 'e7e5', 'g1f3', 'f8c5', 'f3e5'],
  ['e2e4', 'e7e5', 'g1f3', 'd7d5', 'f3e5'],
  // all black replies at move 1 crumbed
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g8f6'],
  ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4'],
  ['e2e4', 'c7c5', 'b1c3'],
  ['e2e4', 'c7c5', 'c2c3', 'd7d5', 'e4d5', 'd8d5'],
  ['e2e4', 'c7c5', 'd2d4', 'c5d4', 'c2c3'],
  ['e2e4', 'c7c5', 'f1c4'],
  ['e2e4', 'c7c5', 'f2f4'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4d5'],
  ['e2e4', 'e7e6', 'd2d4', 'c7c5'],
  ['e2e4', 'e7e6', 'e4e5'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5'],
  ['e2e4', 'c7c6', 'b1c3', 'd7d5', 'd2d4'],
  ['e2e4', 'g8f6', 'e4e5', 'f6d5'],
  ['e2e4', 'g8f6', 'b1c3', 'd7d5', 'e4e5'],
  ['e2e4', 'g8f6', 'd2d4', 'd7d5', 'e4e5'],
  ['e2e4', 'd7d5', 'e4d5', 'd8d5'],
  ['e2e4', 'd7d5', 'b1c3'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3'],
  ['e2e4', 'g7g6', 'd2d4', 'f8g7'],
  ['e2e4', 'a7a6', 'd2d4'],
  ['e2e4', 'b7b6', 'd2d4'],
  ['e2e4', 'f7f5', 'e4f5'],
  ['e2e4', 'b8c6', 'd2d4'],
]
function allIntermediateFens(moves) {
  const g = new Chess()
  const fens = []
  for (const m of moves) { g.move(m); fens.push(g.fen()) }
  return fens
}
const crumbs = new Set(crumbedLines.flatMap(allIntermediateFens))

const db = new Map()
function movesAt(moves, sans) {
  const fen = moves.length ? fenAfter(moves) : START
  db.set(fen, sans.map((s, i) => {
    const g = new Chess(fen)
    let mv
    try { mv = g.move(s) } catch { mv = null }
    return mv ? { uci: mv.from + mv.to, san: mv.san, white: 100 - i * 4, draws: 2, black: 50 - i } : null
  }).filter(Boolean))
}
movesAt([], ['e4', 'd4', 'Nf3', 'c4', 'g3', 'c3', 'Nc3', 'b3', 'f4', 'e3'])
movesAt(['e2e4'], ['e5', 'c5', 'e6', 'c6', 'Nf6', 'd5', 'd6', 'g6', 'a6', 'b6', 'f5', 'Nc6', 'e6', 'g6', 'a6', 'b6', 'f5', 'Nc6'])
movesAt(['e2e4', 'e7e5'], ['Nf3', 'Bc4', 'd4', 'f4', 'Nc3', 'd3'])
movesAt(['e2e4', 'e7e5', 'g1f3'], ['Nc6', 'Nf6', 'd6', 'Bc5', 'd5', 'Be7'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6'], ['Bb5', 'Bc4', 'd4', 'Nc3', 'Nxe5'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], ['a6', 'Nf6', 'Bc5', 'd6', 'f6'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'], ['Ba4', 'Bxc6', 'Be2', 'd4'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4'], ['Nf6', 'b5', 'd6', 'Nge7', 'Bc5'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'], ['O-O', 'Nc3', 'd4'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1'], ['Be7', 'b5', 'Nxe4', 'd6', 'Bc5'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'], ['Re1', 'd4', 'Bb3'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1'], ['b5', 'O-O', 'd6'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'b7b5'], ['Bb3', 'd4', 'a4', 'exd5', 'Bg5'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'g8f6'], ['Nxe5', 'd4', 'Nc3'])
movesAt(['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5'], ['d6', 'Nxe4', 'Qe7'])
movesAt(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'], ['Bg4', 'e5', 'Be7'])
movesAt(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6'], ['Bg4', 'a6', 'Bb4'])
movesAt(['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'], ['Bg4', 'e6', 'Be7'])
movesAt(['e2e4', 'g8f6', 'e4e5', 'f6d5'], ['d4', 'c4', 'Nf3'])
movesAt(['e2e4', 'd7d5', 'e4d5', 'd8d5'], ['Nc3', 'Nf3', 'd4'])
movesAt(['e2e4', 'g7g6', 'd2d4', 'f8g7'], ['Nc3', 'Nf3', 'c4'])
movesAt(['e2e4', 'f7f5', 'e4f5'], ['g6', 'Nf6', 'd5'])
movesAt(['e2e4', 'c7c5', 'c2c3', 'd7d5', 'e4d5', 'd8d5'], ['d4', 'Nf3', 'Bd3'])

globalThis.fetch = async (url) => {
  const fen = new URL(url).searchParams.get('fen')
  const reply = db.get(fen)
  if (!reply) return { ok: true, status: 200, json: async () => ({ white: 0, draws: 0, black: 0, moves: [] }) }
  let w = 0, d = 0, b = 0
  for (const m of reply) { w += m.white; d += m.draws; b += m.black }
  return { ok: true, status: 200, json: async () => ({ white: w, draws: d, black: b, moves: reply }) }
}
async function fetchExplorer(fen, token, rating, speed) {
  const params = new URLSearchParams({ fen, moves: '12', topGames: '0', recentGames: '0' })
  const res = await fetch(`https://explorer.lichess.ovh/lichess?${params}`)
  const data = await res.json()
  const total = (data.white || 0) + (data.draws || 0) + (data.black || 0)
  return { total, moves: data?.moves ?? [] }
}
async function excavate(fen, token, restrict, rating, speed, count, crumbs, MAX_DEPTH, MAX_REQUESTS) {
  const repertoire = restrict === 'white' ? 'w' : restrict === 'black' ? 'b' : null
  const TOP_MOVES = 5, MIN_PROB = 0.002
  const crumbsSet = new Set(crumbs)
  const results = new Map()
  const visited = new Set()
  const stack = [{ fen, prob: 1, ucis: [], sans: [], depth: 0 }]
  let requests = 0, rateLimited = false
  while (stack.length > 0 && requests < MAX_REQUESTS) {
    const node = stack.pop()
    if (visited.has(node.fen)) continue
    visited.add(node.fen)
    let data
    try { data = await fetchExplorer(node.fen, token, rating, speed); requests += 1 }
    catch (err) {
      if (err?.message === 'rate-limited') { rateLimited = true; break }
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
      try { child = applyUci(node.fen, m.uci) } catch { continue }
      const crumbed = crumbsSet.has(child.fen)
      const childProb = crumbed && isRepertoireTurn ? node.prob : node.prob * (share / data.total)
      if (childProb < MIN_PROB || node.depth + 1 > MAX_DEPTH) continue
      children.push({ fen: child.fen, prob: childProb, depth: node.depth + 1, rootFen: fen, ucis: [...node.ucis, m.uci], sans: [...node.sans, child.move.san] })
    }
    let follow = children
    if (isRepertoireTurn) {
      const crumbed = children.filter((c) => crumbsSet.has(c.fen))
      if (crumbed.length > 0) follow = crumbed
    }
    for (const c of follow) {
      if (!crumbsSet.has(c.fen)) {
        const prev = results.get(c.fen)
        if (!prev || c.prob > prev.prob) results.set(c.fen, c)
      }
    }
    follow.sort((a, b) => b.prob - a.prob)
    for (const c of follow.slice(0, TOP_MOVES).reverse()) stack.push(c)
  }
  const top = [...results.values()].sort((a, b) => b.prob - a.prob).slice(0, Math.max(0, Math.floor(count) || 0))
  return { results: top, requests, rateLimited }
}

console.log('crumbs:', crumbs.size)
for (const [MAX_DEPTH, MAX_REQUESTS] of [[8, 20], [30, 20], [30, 24]]) {
  const out = await excavate(START, '', 'white', [], [], 5, [...crumbs], MAX_DEPTH, MAX_REQUESTS)
  console.log(`\nMAX_DEPTH=${MAX_DEPTH} MAX_REQUESTS=${MAX_REQUESTS} -> requests=${out.requests} results=${out.results.length}`)
  for (const r of out.results) console.log('   ', r.sans.join(' '), Math.round(r.prob * 1000) / 10 + '%')
}
