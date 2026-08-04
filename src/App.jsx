import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { getEvals, getEvalPhase, evaluate } from './cloudEval'
import {
  loadRepertoires,
  saveRepertoires,
  loadActiveRepertoireId,
  saveActiveRepertoireId,
} from './breadcrumbs'
import { excavate } from './excavate'
import { uciToMove } from './uci'
import './App.css'

const PIECE_GLYPHS = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
}

const PROMOTION_PIECES = [
  { key: 'q', name: 'Queen' },
  { key: 'r', name: 'Rook' },
  { key: 'b', name: 'Bishop' },
  { key: 'n', name: 'Knight' },
]

function formatPgn(sans) {
  const lines = []
  for (let i = 0; i < sans.length; i += 2) {
    const white = sans[i]
    const black = sans[i + 1]
    lines.push(`${i / 2 + 1}. ${white}${black ? ` ${black}` : ''}`)
  }
  return lines.join('\n')
}

function hslToRgb(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c)
  }
  return `rgb(${f(0)}, ${f(8)}, ${f(4)})`
}

function statusFor(fen) {
  const phase = getEvalPhase(fen)
  return phase >= 2 ? 'done' : phase === 1 ? 'secondary' : 'primary'
}

function useCloudEval(fen) {
  const [moves, setMoves] = useState(() => getEvals(fen) ?? [])
  const [status, setStatus] = useState(() => statusFor(fen))

  useEffect(() => {
    setMoves(getEvals(fen) ?? [])
    setStatus(statusFor(fen))
    const unsubscribe = evaluate(fen, (evals, complete) => {
      setMoves(evals)
      setStatus(complete ? 'done' : 'secondary')
    })
    return unsubscribe
  }, [fen])

  return { moves, status }
}

function usePopularMoves(fen, token, rating, speed) {
  const [moves, setMoves] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) {
      setMoves(undefined)
      setError(null)
      return undefined
    }
    const controller = new AbortController()
    setMoves(null)
    setError(null)
    const params = new URLSearchParams({ fen, moves: '12', topGames: '0', recentGames: '0' })
    if (rating) params.set('ratings', rating)
    if (speed) params.set('speeds', speed)
    fetch(`https://explorer.lichess.ovh/lichess?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((res) => {
        if (res.status === 401) throw new Error('invalid-token')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setMoves(data?.moves ?? []))
      .catch((err) => {
        if (err?.message === 'invalid-token') {
          setError('Token rejected by Lichess — check it is correct.')
        } else {
          setMoves([])
        }
      })
    return () => controller.abort()
  }, [fen, token, rating, speed])

  return { moves, error }
}

function App() {
  const [history, setHistory] = useState([])
  const [ply, setPly] = useState(0)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [pendingPromotion, setPendingPromotion] = useState(null)
  const [copied, setCopied] = useState(false)
  const [cpl, setCpl] = useState(50)
  const [arrowLimit, setArrowLimit] = useState(5)
  const [rating, setRating] = useState('')
  const [speed, setSpeed] = useState('')
  const [excavateCount, setExcavateCount] = useState(5)
  const [repertoires, setRepertoires] = useState(loadRepertoires)
  const [activeRepertoireId, setActiveRepertoireId] = useState(() => {
    const id = loadActiveRepertoireId()
    return repertoires.some((r) => r.id === id) ? id : repertoires[0].id
  })
  const [lichessToken, setLichessToken] = useState(
    () => localStorage.getItem('repprep:lichessToken') ?? '',
  )
  const [excavation, setExcavation] = useState(null)
  const excavationRef = useRef(0)
  const boardRef = useRef(null)
  const popularRef = useRef(null)
  const excavateRef = useRef(null)
  const [popularMaxHeight, setPopularMaxHeight] = useState(null)
  const [excavateMaxHeight, setExcavateMaxHeight] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)

  const chess = useMemo(() => {
    const game = new Chess()
    for (const move of history.slice(0, ply)) game.move(move.san)
    return game
  }, [history, ply])

  const fen = chess.fen()
  const lastMove = ply > 0 ? history[ply - 1] : null
  const { moves: cloudEval, status: evalStatus } = useCloudEval(fen)
  const { moves: popularMoves, error: popularError } = usePopularMoves(fen, lichessToken, rating, speed)
  const updateLichessToken = (value) => {
    setLichessToken(value)
    if (value) localStorage.setItem('repprep:lichessToken', value)
    else localStorage.removeItem('repprep:lichessToken')
  }
  const bestEval =
    cloudEval.length > 0 ? Math.max(...cloudEval.map((m) => m.scoreNum)) : null
  const whiteEvalNum =
    bestEval !== null ? (chess.turn() === 'w' ? bestEval : -bestEval) / 100 : null
  const whiteEval =
    whiteEvalNum !== null ? `${whiteEvalNum > 0 ? '+' : ''}${whiteEvalNum.toFixed(2)}` : null
  const legalMoves = useMemo(
    () => (selectedSquare ? chess.moves({ square: selectedSquare, verbose: true }) : []),
    [chess, selectedSquare],
  )

  const arrows = useMemo(() => {
    if (cloudEval.length === 0 || cpl <= 0) return []
    const best = Math.max(...cloudEval.map((m) => m.scoreNum))
    const threshold = best - cpl
    const candidates = cloudEval
      .filter((m) => m.scoreNum >= threshold)
      .sort((a, b) => b.scoreNum - a.scoreNum || a.order - b.order)
      .slice(0, arrowLimit > 0 ? arrowLimit : undefined)
    return candidates.map((m) => {
      const t = (m.scoreNum - threshold) / cpl
      return {
        startSquare: m.move.slice(0, 2),
        endSquare: m.move.slice(2, 4),
        color: hslToRgb(120 * t, 65, 42),
      }
    })
  }, [cloudEval, cpl, arrowLimit])

  const activeRepertoire =
    repertoires.find((r) => r.id === activeRepertoireId) ?? repertoires[0]
  const breadcrumbs = useMemo(
    () => activeRepertoire?.breadcrumbs ?? [],
    [activeRepertoire],
  )

  const updateBreadcrumbs = useCallback(
    (updater) => {
      setRepertoires((reps) =>
        reps.map((r) =>
          r.id === activeRepertoireId ? { ...r, breadcrumbs: updater(r.breadcrumbs) } : r,
        ),
      )
    },
    [activeRepertoireId],
  )

  const replaceBreadcrumbs = useCallback(
    (fens) => {
      if (!Array.isArray(fens)) return false
      const cleaned = fens.filter((f) => typeof f === 'string')
      setRepertoires((reps) =>
        reps.map((r) =>
          r.id === activeRepertoireId ? { ...r, breadcrumbs: cleaned } : r,
        ),
      )
      return true
    },
    [activeRepertoireId],
  )

  useEffect(() => {
    saveRepertoires(repertoires)
  }, [repertoires])

  useEffect(() => {
    saveActiveRepertoireId(activeRepertoireId)
  }, [activeRepertoireId])

  const breadcrumbedLans = useMemo(() => {
    const set = new Set()
    for (const move of chess.moves({ verbose: true })) {
      const clone = new Chess(fen)
      clone.move({ from: move.from, to: move.to, promotion: move.promotion })
      if (breadcrumbs.includes(clone.fen())) set.add(move.lan)
    }
    return set
  }, [chess, fen, breadcrumbs])

  const breadcrumbArrows = useMemo(
    () =>
      chess
        .moves({ verbose: true })
        .filter((m) => breadcrumbedLans.has(m.lan))
        .map((m) => ({ startSquare: m.from, endSquare: m.to, color: '#2563eb' })),
    [chess, breadcrumbedLans],
  )

  const boardArrows = useMemo(() => {
    const map = new Map()
    for (const a of arrows) map.set(`${a.startSquare}-${a.endSquare}`, a)
    for (const a of breadcrumbArrows) map.set(`${a.startSquare}-${a.endSquare}`, a)
    return [...map.values()]
  }, [arrows, breadcrumbArrows])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastMove) {
      const color = 'rgba(155, 199, 0, 0.45)'
      styles[lastMove.from] = { background: color }
      styles[lastMove.to] = { background: color }
    }
    if (selectedSquare) {
      styles[selectedSquare] = { background: 'rgba(155, 199, 0, 0.65)' }
    }
    for (const move of legalMoves) {
      styles[move.to] = {
        background: move.captured
          ? 'radial-gradient(circle, transparent 45%, rgba(20, 85, 30, 0.45) 46%)'
          : 'radial-gradient(circle, rgba(0, 0, 0, 0.22) 24%, transparent 25%)',
      }
    }
    return styles
  }, [lastMove, selectedSquare, legalMoves])

  const pgnText = useMemo(() => formatPgn(history.map((m) => m.san)), [history])

  const pgnChildren = useMemo(() => {
    const children = []
    const game = new Chess()
    history.forEach((move, i) => {
      if (i % 2 === 0) children.push(`${i / 2 + 1}. `)
      game.move(move.san)
      const classes = []
      if (i === ply - 1) classes.push('current')
      if (breadcrumbs.includes(game.fen())) classes.push('crumbed')
      children.push(
        <span
          className={classes.join(' ')}
          key={i}
          onClick={() => {
            setPly(i + 1)
            setSelectedSquare(null)
            setPendingPromotion(null)
          }}
        >
          {move.san}
        </span>,
      )
      if (i < history.length - 1) children.push(i % 2 === 0 ? ' ' : '\n')
    })
    return children
  }, [history, ply, breadcrumbs])

  const copyPgn = async () => {
    await navigator.clipboard.writeText(pgnText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const exportBreadcrumbs = () => {
    const blob = new Blob([JSON.stringify(breadcrumbs, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'breadcrumbs.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importRef = useRef(null)
  const importBreadcrumbs = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replaceBreadcrumbs(JSON.parse(reader.result))
      } catch {
        /* invalid JSON, ignore */
      }
    }
    reader.readAsText(file)
  }

  const [addingRepertoire, setAddingRepertoire] = useState(false)
  const [newRepName, setNewRepName] = useState('')
  const [newRepColor, setNewRepColor] = useState('white')
  const repPopRef = useRef(null)

  const submitNewRepertoire = () => {
    const name = newRepName.trim()
    if (!name) return
    const id = `rep-${Date.now()}`
    setRepertoires((reps) => [...reps, { id, name, color: newRepColor, breadcrumbs: [] }])
    setActiveRepertoireId(id)
    setAddingRepertoire(false)
    setNewRepName('')
    setNewRepColor('white')
  }

  const cancelNewRepertoire = () => {
    setAddingRepertoire(false)
    setNewRepName('')
    setNewRepColor('white')
  }

  const runExcavation = async () => {
    const id = ++excavationRef.current
    setExcavation({ status: 'loading' })
    try {
      const outcome = await excavate(fen, lichessToken, activeRepertoire?.color ?? 'none', rating, speed, excavateCount, breadcrumbs)
      if (excavationRef.current === id) setExcavation({ status: 'done', ...outcome })
    } catch (err) {
      if (excavationRef.current === id) {
        setExcavation({
          status: 'error',
          error: err?.message === 'invalid-token' ? 'Token rejected by Lichess.' : 'Excavation failed.',
        })
      }
    }
  }

  const gotoExcavated = (entry) => {
    const probe = new Chess()
    let rootPly = -1
    for (let i = 0; i < history.length; i++) {
      if (probe.fen() === entry.rootFen) {
        rootPly = i
        break
      }
      try {
        probe.move(history[i].san)
      } catch {
        break
      }
    }
    if (rootPly === -1) return
    const game = new Chess(entry.rootFen)
    const moves = []
    for (const uci of entry.ucis) {
      try {
        moves.push(game.move(uciToMove(uci)))
      } catch {
        return
      }
    }
    setHistory((prev) => [...prev.slice(0, rootPly), ...moves])
    setPly(rootPly + moves.length)
    setSelectedSquare(null)
    setPendingPromotion(null)
  }

  const visibleExcavationResults =
    excavation?.status === 'done'
      ? excavation.results.filter((r) => !breadcrumbs.includes(r.fen))
      : null

  const measure = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const boardBottom = board.getBoundingClientRect().top + board.offsetHeight
    if (popularRef.current) {
      const popularTop = popularRef.current.getBoundingClientRect().top
      setPopularMaxHeight(Math.max(0, boardBottom - popularTop))
    }
    if (excavateRef.current) {
      const excavateTop = excavateRef.current.getBoundingClientRect().top
      setExcavateMaxHeight(Math.max(0, boardBottom - excavateTop))
    }
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (boardRef.current) ro.observe(boardRef.current)
    if (popularRef.current) ro.observe(popularRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  useEffect(() => {
    measure()
  }, [excavation, measure])

  const applyMove = useCallback(
    (move) => {
      try {
        const result = chess.move(move)
        setHistory((prev) => [...prev.slice(0, ply), result])
        setPly(ply + 1)
        setSelectedSquare(null)
        setPendingPromotion(null)
        return true
      } catch {
        return false
      }
    },
    [chess, ply],
  )

  const playBestMove = useCallback(() => {
    if (cloudEval.length === 0) return
    const sorted = [...cloudEval].sort((a, b) => b.scoreNum - a.scoreNum || a.order - b.order)
    const best = sorted.find((m) => breadcrumbedLans.has(m.move)) ?? sorted[0]
    const move = { from: best.move.slice(0, 2), to: best.move.slice(2, 4) }
    if (best.move.length === 5) move.promotion = best.move[4]
    applyMove(move)
  }, [cloudEval, breadcrumbedLans, applyMove])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPly((p) => Math.max(0, p - 1))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (ply < history.length) {
          setPly((p) => Math.min(history.length, p + 1))
        } else {
          playBestMove()
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setPly(0)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setPly(history.length)
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setCpl((c) => Math.min(500, c + 5))
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setCpl((c) => Math.max(0, c - 5))
      } else if (event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        setHistory((prev) => prev.slice(0, ply))
      } else if (event.key === ' ') {
        event.preventDefault()
        if (breadcrumbs.includes(fen)) {
          const descendants = []
          const game = new Chess()
          for (let i = 0; i < history.length; i++) {
            game.move(history[i].san)
            if (i >= ply) descendants.push(game.fen())
          }
          updateBreadcrumbs((b) => b.filter((f) => f !== fen && !descendants.includes(f)))
        } else {
          const line = []
          const game = new Chess()
          for (let i = 0; i < ply; i++) {
            game.move(history[i].san)
            line.push(game.fen())
          }
          line.push(fen)
          updateBreadcrumbs((b) => [...b, ...line.filter((f) => !b.includes(f))])
        }
      } else {
        return
      }
      setSelectedSquare(null)
      setPendingPromotion(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history.length, history, ply, playBestMove, fen, breadcrumbs, updateBreadcrumbs])

  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!targetSquare) return false
    const legal = chess.moves({ square: sourceSquare, verbose: true })
    const move = legal.find((m) => m.to === targetSquare)
    if (!move) return false
    if (move.promotion) {
      setPendingPromotion({ sourceSquare, targetSquare })
      return false
    }
    return applyMove({ from: sourceSquare, to: targetSquare })
  }

  const onSquareClick = ({ square }) => {
    if (pendingPromotion) return
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }
    if (chess.moves({ square, verbose: true }).length > 0) {
      setSelectedSquare(square)
      return
    }
    if (selectedSquare) {
      const move = legalMoves.find((m) => m.to === square)
      if (move) {
        if (move.promotion) {
          setPendingPromotion({ sourceSquare: selectedSquare, targetSquare: square })
        } else {
          applyMove({ from: selectedSquare, to: square })
        }
        return
      }
    }
    setSelectedSquare(null)
  }

  useEffect(() => {
    if (!settingsOpen && !addingRepertoire) return
    const onDown = (e) => {
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
      if (addingRepertoire && repPopRef.current && !repPopRef.current.contains(e.target)) {
        cancelNewRepertoire()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [settingsOpen, addingRepertoire])

  return (
    <div className="app">
      <header className="header">
        <h1>RepPrep</h1>
      </header>

      <main className="main">
        <aside className="left-col">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importBreadcrumbs(file)
              e.target.value = ''
            }}
          />
          <div className="left-col-actions">
            <div className="settings" ref={settingsRef}>
              <button
                type="button"
                className="settings-btn"
                aria-label="Settings"
                title="Settings"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="settings-pop">
                  <label>
                    CPL limit
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={cpl}
                      onChange={(e) => setCpl(Math.min(500, Math.max(0, Number(e.target.value) || 0)))}
                    />
                  </label>
                  <label>
                    Arrow limit
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={arrowLimit}
                      onChange={(e) =>
                        setArrowLimit(Math.min(20, Math.max(0, Number(e.target.value) || 0)))
                      }
                    />
                  </label>
                  <label>
                    Rating
                    <select value={rating} onChange={(e) => setRating(e.target.value)}>
                      <option value="">Any</option>
                      <option value="1000">≤ 1000</option>
                      <option value="1200">1000–1200</option>
                      <option value="1400">1200–1400</option>
                      <option value="1600">1400–1600</option>
                      <option value="1800">1600–1800</option>
                      <option value="2000">1800–2000</option>
                      <option value="2200">2000–2200</option>
                      <option value="2500">2200–2500</option>
                      <option value="9999">2500+</option>
                    </select>
                  </label>
                  <label>
                    Time control
                    <select value={speed} onChange={(e) => setSpeed(e.target.value)}>
                      <option value="">Any</option>
                      <option value="ultraBullet">UltraBullet</option>
                      <option value="bullet">Bullet</option>
                      <option value="blitz">Blitz</option>
                      <option value="rapid">Rapid</option>
                      <option value="classical">Classical</option>
                      <option value="correspondence">Correspondence</option>
                    </select>
                  </label>
                  <label>
                    Excavated positions
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={excavateCount}
                      onChange={(e) =>
                        setExcavateCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
            <button type="button" className="copy" onClick={exportBreadcrumbs}>
              Export
            </button>
            <button type="button" className="copy" onClick={() => importRef.current?.click()}>
              Import
            </button>
          </div>
            <div className="repertoire-row">
              <select
                className="repertoire-select"
                value={activeRepertoireId}
                onChange={(e) => setActiveRepertoireId(e.target.value)}
                title="Repertoire"
              >
                {repertoires.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.color})
                  </option>
                ))}
              </select>
              <div className="repertoire-add" ref={repPopRef}>
                <button
                  type="button"
                  className="copy add-rep"
                  onClick={() => setAddingRepertoire((o) => !o)}
                  title="Add repertoire"
                >
                  +
                </button>
                {addingRepertoire && (
                  <div className="rep-pop">
                    <input
                      className="rep-name"
                      type="text"
                      placeholder="Repertoire name"
                      value={newRepName}
                      autoFocus
                      onChange={(e) => setNewRepName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitNewRepertoire()
                        if (e.key === 'Escape') cancelNewRepertoire()
                      }}
                    />
                    <div className="rep-color-seg">
                      <button
                        type="button"
                        className={newRepColor === 'white' ? 'active' : ''}
                        onClick={() => setNewRepColor('white')}
                      >
                        white
                      </button>
                      <button
                        type="button"
                        className={newRepColor === 'black' ? 'active' : ''}
                        onClick={() => setNewRepColor('black')}
                      >
                        black
                      </button>
                    </div>
                    <div className="rep-form-actions">
                      <button type="button" className="copy" onClick={submitNewRepertoire}>
                        Add
                      </button>
                      <button type="button" className="copy" onClick={cancelNewRepertoire}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          <button
            type="button"
            className="copy excavate-btn"
            onClick={runExcavation}
            disabled={!lichessToken || excavation?.status === 'loading'}
            title={lichessToken ? 'Find the top 5 most popular unbreadcrumbed positions' : 'Set a Lichess token first'}
          >
            {excavation?.status === 'loading' ? 'Excavating…' : 'Excavate'}
          </button>

          {excavation && (
            <div
              className="excavate"
              ref={(el) => {
                excavateRef.current = el
                if (el) measure()
              }}
              style={{ maxHeight: excavateMaxHeight ?? undefined }}
            >
              <div className="excavate-scroll">
                {excavation.status === 'loading' && <p className="empty">Excavating…</p>}
                {excavation.status === 'error' && <p className="empty error">{excavation.error}</p>}
                {excavation.status === 'done' && (
                  <>
                    {excavation.rateLimited && (
                      <p className="empty error">Hit Lichess rate limit. Try again in 1 min.</p>
                    )}
                    {excavation.results.length === 0 ? (
                      excavation.noRootLine ? (
                        <p className="empty">
                          The breadcrumb player has no breadcrumbed moves from the current position.
                        </p>
                      ) : (
                        <p className="empty">No unbreadcrumbed positions found.</p>
                      )
                    ) : visibleExcavationResults.length === 0 ? (
                      <p className="empty">All excavated positions are breadcrumbed.</p>
                    ) : (
                      <ol className="excavate-list">
                        {visibleExcavationResults.map((r, i) => (
                          <li key={i} onClick={() => gotoExcavated(r)}>
                            <span className="exc-prob">{Math.round(r.prob * 1000) / 10}%</span>
                            <span className="exc-line">{r.sans.join(' ')}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </aside>

        <div className="middle-col" ref={boardRef}>
          <Chessboard
            options={{
              position: fen,
              boardOrientation: 'white',
              animationDurationInMs: 200,
              allowDragging: !chess.isGameOver(),
              onPieceDrop,
              onSquareClick,
              squareStyles,
              arrows: boardArrows,
              onPieceDrag: () => setSelectedSquare(null),
            }}
          />
        </div>

        <aside className="right-col">
          <div className={`eval-status ${evalStatus}`}>
            <div className="eval-bar">
              <span className="bar-segment primary" />
              <span className="bar-segment secondary" />
              <span className="bar-segment done" />
            </div>
          </div>
          <div className="cpl-control">
            <span>eval: {whiteEval ?? '…'}</span>
          </div>
          <div className="moves">
            <button
              type="button"
              className="copy-icon"
              onClick={copyPgn}
              title={copied ? 'Copied!' : 'Copy PGN'}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>
            {history.length === 0 ? (
              <p className="empty">No moves yet</p>
            ) : (
              <pre className="pgn">{pgnChildren}</pre>
            )}
          </div>

          <div className="popular" ref={popularRef} style={{ maxHeight: popularMaxHeight ?? undefined }}>
            <div className="token-row">
              <input
                type="password"
                value={lichessToken}
                placeholder="Lichess API token"
                onChange={(e) => updateLichessToken(e.target.value)}
              />
              <a href="https://lichess.org/account/oauth/token" target="_blank" rel="noreferrer">
                Get a free token
              </a>
            </div>
            {popularError ? (
              <p className="empty error">{popularError}</p>
            ) : popularMoves === undefined ? (
              <p className="empty">Enter your token above to load player DB stats.</p>
            ) : popularMoves === null ? (
              <p className="empty">Loading…</p>
            ) : popularMoves.length === 0 ? (
              <p className="empty">No data</p>
            ) : (
              <div className="popular-scroll">
                <table className="popular-table">
                  <thead>
                    <tr>
                      <th>Move</th>
                      <th>Games</th>
                      <th>W/D/L %</th>
                      <th>Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularMoves.map((m) => {
                      const total = m.white + m.draws + m.black
                      const play = () => applyMove(uciToMove(m.uci))
                      return (
                        <tr key={m.uci} onClick={play}>
                          <td>{m.san}</td>
                          <td>{m.games ?? total}</td>
                          <td>
                            {total
                              ? `${Math.round((m.white / total) * 100)}/${Math.round((m.draws / total) * 100)}/${Math.round((m.black / total) * 100)}`
                              : '–'}
                          </td>
                          <td>{m.averageRating ?? '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </aside>
      </main>

      {pendingPromotion && (
        <div className="overlay" onClick={() => setPendingPromotion(null)}>
          <div className="promotion" onClick={(e) => e.stopPropagation()}>
            <h2>Promote to</h2>
            <div className="promotion-options">
              {PROMOTION_PIECES.map(({ key, name }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() =>
                    applyMove({
                      from: pendingPromotion.sourceSquare,
                      to: pendingPromotion.targetSquare,
                      promotion: key,
                    })
                  }
                >
                  <span className="piece-glyph">{PIECE_GLYPHS[`${chess.turn()}${key.toUpperCase()}`]}</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
