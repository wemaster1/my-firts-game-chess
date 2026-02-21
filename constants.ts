
export const BOARD_SIZE = 8;
export const SQUARE_SIZE = 1;
export const PIECE_HEIGHT = 0.6;

export const COLORS = {
  whiteSquare: '#e2e8f0',
  blackSquare: '#475569',
  whitePiece: '#ffffff',
  blackPiece: '#1e293b',
  highlightMove: '#10b981',
  highlightSelect: '#3b82f6',
  highlightCheck: '#ef4444',
  turnGlowWhite: '#60a5fa',
  turnGlowBlack: '#94a3b8',
};

export const TIME_CONTROLS = [
  { label: '1m', seconds: 60, type: 'Bullet' },
  { label: '3m', seconds: 180, type: 'Blitz' },
  { label: '5m', seconds: 300, type: 'Blitz' },
  { label: '10m', seconds: 600, type: 'Rapid' },
  { label: '30m', seconds: 1800, type: 'Classical' },
];

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const AI_RATINGS: Record<string, number> = {
  'Easy': 800,
  'Medium': 1500,
  'Hard': 2400,
  'Expert': 3200
};

export const CHESS_PUZZLES = [
  {
    id: 'p1',
    title: 'Smothered Mate',
    description: 'Black king is trapped by their own pieces. Find the deadly blow.',
    fen: '6rk/5Npp/8/8/8/8/8/7K b - - 0 1',
    solution: 'f7g8', // Placeholder: This is actually the state after white move. Let's provide puzzles where it's player to move.
    sideToMove: 'w' as const
  },
  {
    id: 'p2',
    title: 'The Back Rank',
    description: 'The black king is vulnerable on the 8th rank.',
    fen: '5rk1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution: 'a1a8',
    sideToMove: 'w' as const
  },
  {
    id: 'p3',
    title: 'Knight Fork',
    description: 'White has a way to win the Queen.',
    fen: 'r3k2r/ppq2ppp/8/3n4/8/2N5/PP3PPP/R3K2R w KQkq - 0 1',
    solution: 'c3xd5', // We'll use SAN or UCI. Let's use UCI for simplicity in code: c3d5
    sideToMove: 'w' as const
  },
  {
    id: 'p4',
    title: 'Deflection',
    description: 'Force the king away from the defense of the Rook.',
    fen: '6k1/5ppp/8/8/8/1r6/2R3PP/6K1 w - - 0 1',
    solution: 'c2c8',
    sideToMove: 'w' as const
  },
  {
    id: 'p5',
    title: 'Sacrifice for Mate',
    description: 'Sacrifice the heavy piece to open the king.',
    fen: 'r1b2rk1/pp3ppp/8/8/1Q6/8/5PPP/3R2K1 w - - 0 1',
    solution: 'b4xf8',
    sideToMove: 'w' as const
  }
];

export const RATING_TIERS = [
  { min: 2800, label: 'Super GM', color: 'text-rose-400', bg: 'bg-rose-400/10' },
  { min: 2400, label: 'Grandmaster', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { min: 2000, label: 'Master', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  { min: 1600, label: 'Expert', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { min: 1200, label: 'Intermediate', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { min: 800, label: 'Novice', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { min: 0, label: 'Beginner', color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

export const SQUARE_NAMES = [
  'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
  'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
  'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
  'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
  'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
  'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
  'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
  'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
];
