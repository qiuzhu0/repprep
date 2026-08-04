const CASTLE = {
  e1h1: { from: 'e1', to: 'g1' },
  e8h8: { from: 'e8', to: 'g8' },
  e1a1: { from: 'e1', to: 'c1' },
  e8a8: { from: 'e8', to: 'c8' },
}

export function uciToMove(uci) {
  const castle = CASTLE[uci]
  if (castle) return castle
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  }
}
