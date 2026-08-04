import { Chess } from 'chess.js'
import { getPositionData, updatePositionData } from './positions'

const API = 'https://www.chessdb.cn/cdb.php'
const CONCURRENCY = 6

function parseQueryAll(text) {
  return text
    .split('|')
    .map((entry) => {
      const fields = {}
      for (const part of entry.split(',')) {
        const idx = part.indexOf(':')
        if (idx !== -1) fields[part.slice(0, idx)] = part.slice(idx + 1)
      }
      return fields
    })
    .filter((f) => f.move && f.score !== '??')
}

async function fetchText(url, signal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  return (await response.text()).replaceAll('\u0000', '')
}

async function run(fen, notify, signal) {
  const game = new Chess(fen)
  const legal = game.moves({ verbose: true })
  const results = new Map()

  if (legal.length > 0) {
    const board = encodeURIComponent(fen)
    try {
      const text = await fetchText(`${API}?action=queryall&board=${board}&learn=0`, signal)
      for (const m of parseQueryAll(text)) {
        if (!results.has(m.move)) {
          results.set(m.move, { move: m.move, scoreNum: Number(m.score), order: Infinity })
        }
      }
    } catch {
      return
    }
    const phase1 = [...results.values()]
    updatePositionData(fen, { evals: phase1, phase: 1 })
    notify(phase1, false)

    let next = 0
    const worker = async () => {
      while (next < legal.length) {
        const i = next++
        const mv = legal[i]
        const clone = new Chess(fen)
        clone.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
        const url = `${API}?action=queryscore&board=${encodeURIComponent(clone.fen())}&learn=0`
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const text = await fetchText(url, signal)
            if (text.startsWith('eval:')) {
              const scoreNum = -parseFloat(text.slice(5))
              if (!Number.isNaN(scoreNum)) {
                results.set(mv.lan, { move: mv.lan, scoreNum, order: i })
              }
            }
            break
          } catch (error) {
            if (error?.name === 'AbortError' || attempt >= 2) return
            await new Promise((resolve) => setTimeout(resolve, 300))
          }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (signal.aborted) return
  }

  const evals = [...results.values()]
  updatePositionData(fen, { evals, phase: 2 })
  notify(evals, true)
}

export function getEvals(fen) {
  return getPositionData(fen)?.evals
}

export function getEvalPhase(fen) {
  return getPositionData(fen)?.phase ?? 0
}

export function evaluate(fen, onUpdate) {
  const cached = getPositionData(fen)
  if (cached?.phase === 2) {
    onUpdate(cached.evals, true)
    return () => {}
  }
  if (cached) onUpdate(cached.evals, false)
  const controller = new AbortController()
  run(fen, onUpdate, controller.signal).catch(() => {})
  return () => controller.abort()
}
