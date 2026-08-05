import { Chess } from '/home/alex/Documents/repprep/node_modules/chess.js/dist/esm/chess.js'
import { excavate } from '/tmp/opencode/exc/excavate.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const LINES = [
  // Ruy deep mainline + all replies at each node
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'b5', 'Bb3', 'Bb7'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'd6', 'd4', 'Bd7'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nge7', 'Re1', 'g6', 'd4'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Bc5', 'c3', 'f5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Bc5', 'c3', 'Nf6', 'd4'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'd6', 'd4', 'Bd7', 'O-O'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'f6', 'd3', 'Ne7', 'Nbd2'],
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd4', 'd5'],
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd4', 'Bg4'],
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nxe4', 'd4', 'd5', 'Nc3'],
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nxe4', 'd4', 'Bb4+', 'Nc3'],
  ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
  ['e4', 'e5', 'Nf3', 'Bc5', 'Nxe5', 'Nxe5', 'd4', 'Bb4+', 'c3'],
  ['e4', 'e5', 'Nf3', 'd5', 'Nxe5', 'Nxe5', 'd4', 'Bb4+', 'c3'],
  ['e4', 'e5', 'Nf3', 'Be7', 'Bc4', 'Nf6'],
  // Sicilian
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'e6', 'Nc3', 'a6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'Qb6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'Nf6', 'd4', 'cxd4', 'Nxd4', 'd6', 'Nc3', 'g6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'a6', 'd4', 'cxd4', 'Nxd4', 'd6', 'Nc3', 'g6', 'Be2'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'Nf6', 'Nc3', 'cxd4', 'Nxd4', 'a6', 'Be2'],
  // French
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'h6', 'Bxf6'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'dxe4', 'Nxe4'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Bb4', 'e5'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3'],
  ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3'],
  ['e4', 'e6', 'd4', 'd5', 'exd5', 'exd5', 'c4', 'c6', 'Nc3'],
  ['e4', 'e6', 'd4', 'c5', 'd5', 'exd5', 'c4', 'Nf6', 'Nc3'],
  // Caro
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6', 'h4'],
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nf6', 'Nxf6+', 'exf6'],
  ['e4', 'c6', 'd4', 'd5', 'e5', 'c5', 'dxc5', 'e6', 'Nc3', 'Nc6', 'Nf3'],
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'f4', 'e6'],
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'Nf3', 'e6'],
  // Alekhine
  ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'g6', 'Bg5'],
  ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'c4', 'Nb6', 'Nf3'],
  ['e4', 'Nf6', 'e5', 'Nd5', 'c4', 'Nb6', 'd4', 'd6', 'Nc3'],
  ['e4', 'Nf6', 'Nc3', 'd5', 'e5', 'Nfd7', 'f4', 'e6', 'Nf3'],
  ['e4', 'Nf6', 'd4', 'd5', 'e5', 'Nfd7', 'f4', 'e6', 'Nf3'],
  // rare replies to 1.e4 (crumb presence only)
  ['e4', 'd5', 'exd5', 'Nf6', 'Nc3', 'Nxd5', 'Nf3', 'Nxc3', 'bxc3'],
  ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
  ['e4', 'g6', 'd4', 'Bg7', 'Nc3', 'd6'],
  ['e4', 'a6', 'd4', 'b5'],
  ['e4', 'b6', 'd4', 'Bb7'],
  ['e4', 'f5', 'exf5', 'Nf6', 'Nf3'],
  ['e4', 'Nc6', 'd4', 'e5'],
]

const childrenByFen = new Map()
const crumbs = new Set()

for (const line of LINES) {
  const g = new Chess()
  for (const san of line) {
    const fen = g.fen()
    crumbs.add(fen)
    let mv
    try {
      mv = g.move(san)
    } catch {
      console.error(`Invalid move "${san}" in line:`, line.join(' '))
      break
    }
    if (!mv) {
      console.error(`Illegal move "${san}" in line:`, line.join(' '))
      break
    }
    let list = childrenByFen.get(fen)
    if (!list) { list = []; childrenByFen.set(fen, list) }
    if (!list.find((e) => e.uci === mv.from + mv.to)) {
      const i = list.length
      list.push({ uci: mv.from + mv.to, san: mv.san, white: 100 - i * 4, draws: 2, black: 50 - i })
    }
  }
}

for (const [fen, list] of childrenByFen) {
  const turn = fen.split(' ')[1]
  if (turn === 'b') continue
  if (list.length > 0) continue
  const g = new Chess(fen)
  const legal = g.moves({ verbose: true }).slice(0, 4)
  for (let i = 0; i < legal.length; i++) {
    list.push({ uci: legal[i].from + legal[i].to, san: legal[i].san, white: 20 - i * 4, draws: 1, black: 10 - i })
  }
}

globalThis.fetch = async (url) => {
  const fen = new URL(url).searchParams.get('fen')
  const reply = childrenByFen.get(fen)
  if (!reply) return { ok: true, status: 200, json: async () => ({ white: 0, draws: 0, black: 0, moves: [] }) }
  let w = 0, d = 0, b = 0
  for (const m of reply) { w += m.white; d += m.draws; b += m.black }
  return { ok: true, status: 200, json: async () => ({ white: w, draws: d, black: b, moves: reply }) }
}

console.log('crumbs:', crumbs.size, 'positions:', childrenByFen.size)
const out = await excavate(START, '', 'white', [], [], 5, [...crumbs])
console.log(`\nMAX_DEPTH=8 (current) -> requests=${out.requests} results=${out.results.length} fetchError=${out.fetchError}`)
for (const r of out.results) console.log('   ', r.sans.join(' '), Math.round(r.prob * 1000) / 10 + '%')
