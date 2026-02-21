
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type PieceColor = 'w' | 'b';
export type GameMode = 'pve' | 'pvp' | 'puzzle';
export type AiDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  square: string;
}

export interface Puzzle {
  id: string;
  fen: string;
  solution: string; // UCI format e.g. "e2e4"
  description: string;
  title: string;
  sideToMove: PieceColor;
}

export interface GameState {
  fen: string;
  turn: PieceColor;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isTimeout: boolean;
  winner: PieceColor | null;
  history: string[];
  lastMove?: { from: string; to: string };
  whiteTime: number;
  blackTime: number;
  initialTime: number;
  drawOfferBy: PieceColor | null;
  playerRating: number;
  opponentRating: number;
  ratingChange?: number;
}

export interface GeminiMoveResponse {
  move: string;
  explanation: string;
  evaluation: string;
}
