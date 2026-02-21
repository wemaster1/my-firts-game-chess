
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Brain, Sparkles, TrendingUp, TrendingDown, X, ChevronRight, Zap, Trophy, Lightbulb, ChevronLeft } from 'lucide-react';
import ChessBoard3D from './components/ChessBoard3D';
import GameUI from './components/GameUI';
import { GameState, GeminiMoveResponse, PieceType, GameMode, AiDifficulty, Puzzle } from './types';
import { INITIAL_FEN, AI_RATINGS, CHESS_PUZZLES } from './constants';
import { getGeminiMove, evaluateAiDrawOffer } from './services/geminiService';
import { soundService } from './services/soundService';

const RATING_KEY = 'grandmaster-3d-chess-rating';
const STREAK_KEY = 'grandmaster-3d-chess-streak';
const PUZZLE_INDEX_KEY = 'grandmaster-3d-chess-puzzle-idx';

const App: React.FC = () => {
  const [chess, setChess] = useState(new Chess(INITIAL_FEN));
  const [gameMode, setGameMode] = useState<GameMode>('pve');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('Medium');
  const [initialTime, setInitialTime] = useState(600);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [isTimeout, setIsTimeout] = useState(false);
  const [winner, setWinner] = useState<'w' | 'b' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isForcedDraw, setIsForcedDraw] = useState(false);
  const [drawOfferBy, setDrawOfferBy] = useState<'w' | 'b' | null>(null);
  const [drawDeclined, setDrawDeclined] = useState(false);
  const [ratingChange, setRatingChange] = useState<number | undefined>(undefined);
  
  // Puzzle State
  const [puzzleIndex, setPuzzleIndex] = useState(() => {
    const saved = localStorage.getItem(PUZZLE_INDEX_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [puzzleAttempts, setPuzzleAttempts] = useState(0);
  const [isPuzzleSolved, setIsPuzzleSolved] = useState(false);
  const [rejectedSquare, setRejectedSquare] = useState<string | null>(null);

  // Performance Suggestion State
  const [difficultySuggestion, setDifficultySuggestion] = useState<AiDifficulty | null>(null);

  const [playerRating, setPlayerRating] = useState(() => {
    const saved = localStorage.getItem(RATING_KEY);
    return saved ? parseInt(saved, 10) : 1200;
  });

  const [performanceStreak, setPerformanceStreak] = useState(() => {
    const saved = localStorage.getItem(STREAK_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [gameState, setGameState] = useState<GameState>({
    fen: chess.fen(),
    turn: chess.turn(),
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isTimeout: false,
    winner: null,
    history: chess.history(),
    whiteTime: 600,
    blackTime: 600,
    initialTime: 600,
    drawOfferBy: null,
    playerRating: playerRating,
    opponentRating: AI_RATINGS['Medium'],
  });
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<GeminiMoveResponse | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const isGameOver = gameState.isCheckmate || gameState.isDraw || isTimeout || isForcedDraw || gameState.isStalemate;
  
  const isHumanTurn = 
    gameMode === 'pvp' || 
    (gameMode === 'pve' && chess.turn() === 'w') || 
    (gameMode === 'puzzle' && !isPuzzleSolved);

  const canInteract = isHumanTurn && !isGameOver && !isAiThinking && !pendingPromotion;

  const calculateElo = useCallback((playerElo: number, opponentElo: number, score: number) => {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    return Math.round(K * (score - expectedScore));
  }, []);

  const checkDifficultyAdjustment = useCallback((newRating: number, newStreak: number) => {
    if (gameMode !== 'pve') return;
    const diffs: AiDifficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];
    const currentIdx = diffs.indexOf(aiDifficulty);
    if (newStreak >= 2 && currentIdx < diffs.length - 1) setDifficultySuggestion(diffs[currentIdx + 1]);
    else if (newStreak <= -3 && currentIdx > 0) setDifficultySuggestion(diffs[currentIdx - 1]);
  }, [gameMode, aiDifficulty]);

  const handleGameOver = useCallback((winState: 'w' | 'b' | 'draw') => {
    if (gameState.ratingChange !== undefined || gameMode === 'puzzle') return;
    const opponentRating = gameMode === 'pvp' ? playerRating : AI_RATINGS[aiDifficulty];
    const score = winState === 'w' ? 1 : winState === 'b' ? 0 : 0.5;
    const change = calculateElo(playerRating, opponentRating, score);
    const newRating = playerRating + change;
    let newStreak = performanceStreak;
    if (gameMode === 'pve') {
      newStreak = winState === 'w' ? (performanceStreak > 0 ? performanceStreak + 1 : 1) : winState === 'b' ? (performanceStreak < 0 ? performanceStreak - 1 : -1) : 0;
      setPerformanceStreak(newStreak);
      localStorage.setItem(STREAK_KEY, newStreak.toString());
      checkDifficultyAdjustment(newRating, newStreak);
    }
    setRatingChange(change);
    setPlayerRating(newRating);
    localStorage.setItem(RATING_KEY, newRating.toString());
    setGameState(prev => ({ ...prev, playerRating: newRating, ratingChange: change }));
  }, [gameMode, aiDifficulty, playerRating, performanceStreak, calculateElo, checkDifficultyAdjustment, gameState.ratingChange]);

  const updateGameState = useCallback((lastMoveResult?: any) => {
    const newChess = new Chess(chess.fen());
    setChess(newChess);

    const isCheckmate = newChess.isCheckmate();
    const isStalemate = newChess.isStalemate();
    const isDraw = newChess.isDraw() || isForcedDraw || isStalemate;
    const inCheck = newChess.inCheck();
    
    let currentWinner: 'w' | 'b' | null = null;
    if (isCheckmate) {
      currentWinner = newChess.turn() === 'w' ? 'b' : 'w';
      setWinner(currentWinner);
      soundService.playGameOver();
      handleGameOver(currentWinner);
    } else if (isDraw) {
      soundService.playGameOver();
      handleGameOver('draw');
    } else if (inCheck) {
      soundService.playCheck();
    } else if (lastMoveResult) {
      if (lastMoveResult.flags.includes('c') || lastMoveResult.flags.includes('e')) soundService.playCapture();
      else if (lastMoveResult.flags.includes('p')) soundService.playPromote();
      else soundService.playMove();
    }

    setGameState(prev => ({
      ...prev,
      fen: newChess.fen(),
      turn: newChess.turn(),
      isCheck: inCheck,
      isCheckmate,
      isStalemate,
      isDraw,
      isTimeout: isTimeout,
      winner: currentWinner || (isTimeout ? winner : null),
      history: newChess.history(),
      lastMove: newChess.history({ verbose: true }).pop() || undefined,
      whiteTime,
      blackTime,
      drawOfferBy,
      opponentRating: gameMode === 'pvp' ? playerRating : AI_RATINGS[aiDifficulty],
    }));
    setSelectedSquare(null);
    setValidMoves([]);
    setPendingPromotion(null);
  }, [chess, isTimeout, winner, whiteTime, blackTime, isForcedDraw, drawOfferBy, gameMode, aiDifficulty, playerRating, handleGameOver]);

  const onSquareClick = useCallback((square: string) => {
    if (!canInteract) return;

    if (selectedSquare) {
      const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
      const move = moves.find(m => m.to === square);

      if (move) {
        if (gameMode === 'puzzle') {
          const currentPuzzle = CHESS_PUZZLES[puzzleIndex % CHESS_PUZZLES.length];
          const moveUci = `${move.from}${move.to}`;
          const isCorrect = moveUci === currentPuzzle.solution || move.san === currentPuzzle.solution;
          
          if (isCorrect) {
            const moveResult = chess.move(move);
            setIsPuzzleSolved(true);
            soundService.playPromote();
            updateGameState(moveResult);
          } else {
            setPuzzleAttempts(a => a + 1);
            setRejectedSquare(selectedSquare);
            setTimeout(() => setRejectedSquare(null), 450);
            soundService.playReject();
          }
          return;
        }

        if (move.flags.includes('p')) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        try {
          const moveResult = chess.move({ from: selectedSquare, to: square });
          updateGameState(moveResult);
          return;
        } catch (e) { console.error("Move failed", e); }
      }
    }

    const piece = chess.get(square as Square);
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      const moves = chess.moves({ square: square as Square, verbose: true });
      setValidMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  }, [chess, canInteract, selectedSquare, updateGameState, gameMode, puzzleIndex]);

  const handleAiMove = useCallback(async () => {
    if (isGameOver || isAiThinking || pendingPromotion || gameMode === 'puzzle') return;
    setIsAiThinking(true);
    setAiAnalysis(null);
    try {
      const result = await getGeminiMove(chess.fen(), chess.history(), aiDifficulty);
      setAiAnalysis(result);
      try {
        const moveResult = chess.move(result.move);
        updateGameState(moveResult);
      } catch (e) {
        // Fallback move if Gemini suggests invalid
        const moves = chess.moves({ verbose: true });
        if (moves.length > 0) {
          const fallbackMove = moves[Math.floor(Math.random() * moves.length)];
          const moveResult = chess.move(fallbackMove);
          updateGameState(moveResult);
        }
      }
    } catch (error) { 
      console.error("AI turn error:", error); 
      const moves = chess.moves({ verbose: true });
      if (moves.length > 0) {
        const moveResult = chess.move(moves[0]);
        updateGameState(moveResult);
      }
    } finally { 
      setIsAiThinking(false); 
    }
  }, [chess, isGameOver, isAiThinking, pendingPromotion, gameMode, aiDifficulty, updateGameState]);

  useEffect(() => {
    if (gameMode === 'pve' && chess.turn() === 'b' && !isGameOver && !isAiThinking) {
      const aiTimer = setTimeout(() => {
        handleAiMove();
      }, 500);
      return () => clearTimeout(aiTimer);
    }
  }, [chess.turn(), gameMode, isGameOver, isAiThinking, handleAiMove]);

  const loadPuzzle = useCallback((idx: number) => {
    const p = CHESS_PUZZLES[idx % CHESS_PUZZLES.length];
    const newChess = new Chess(p.fen);
    setChess(newChess);
    setPuzzleIndex(idx);
    setPuzzleAttempts(0);
    setIsPuzzleSolved(false);
    localStorage.setItem(PUZZLE_INDEX_KEY, idx.toString());
    
    setGameState(prev => ({
      ...prev,
      fen: newChess.fen(),
      turn: newChess.turn(),
      history: [],
      lastMove: undefined,
      isCheckmate: false,
      isDraw: false,
      isCheck: newChess.inCheck(),
    }));
    setAiAnalysis(null);
    soundService.playMove();
  }, []);

  const handleNextPuzzle = () => loadPuzzle(puzzleIndex + 1);
  const handlePrevPuzzle = () => loadPuzzle(puzzleIndex > 0 ? puzzleIndex - 1 : 0);
  const handleRestartPuzzle = () => loadPuzzle(puzzleIndex);

  const togglePuzzleMode = () => {
    if (gameMode === 'puzzle') {
      const c = new Chess(INITIAL_FEN);
      setChess(c);
      setGameMode('pve');
      updateGameState();
    } else {
      setGameMode('puzzle');
      loadPuzzle(puzzleIndex);
    }
  };

  const completePromotion = (piece: PieceType) => {
    if (!pendingPromotion) return;
    try {
      const moveResult = chess.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
      updateGameState(moveResult);
    } catch (e) {
      setPendingPromotion(null);
    }
  };

  const handleUndo = useCallback(() => {
    if (isAiThinking || isGameOver) return;
    chess.undo();
    if (gameMode === 'pve' && chess.turn() === 'b') {
      chess.undo();
    }
    updateGameState();
  }, [chess, isAiThinking, isGameOver, gameMode, updateGameState]);

  const resetGame = useCallback(() => {
    const newChess = new Chess(INITIAL_FEN);
    setChess(newChess);
    setWhiteTime(initialTime);
    setBlackTime(initialTime);
    setIsTimeout(false);
    setWinner(null);
    setIsForcedDraw(false);
    setDrawOfferBy(null);
    setDrawDeclined(false);
    setRatingChange(undefined);
    setAiAnalysis(null);
    setGameState({
      fen: newChess.fen(),
      turn: newChess.turn(),
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      isTimeout: false,
      winner: null,
      history: [],
      whiteTime: initialTime,
      blackTime: initialTime,
      initialTime: initialTime,
      drawOfferBy: null,
      playerRating: playerRating,
      opponentRating: gameMode === 'pvp' ? playerRating : AI_RATINGS[aiDifficulty],
    });
    soundService.playMove();
  }, [initialTime, playerRating, aiDifficulty, gameMode]);

  const toggleGameMode = useCallback(() => {
    if (chess.history().length > 0) return;
    setGameMode(prev => prev === 'pve' ? 'pvp' : 'pve');
  }, [chess]);

  const setTimeLimit = useCallback((seconds: number) => {
    setInitialTime(seconds);
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setGameState(prev => ({ ...prev, initialTime: seconds, whiteTime: seconds, blackTime: seconds }));
  }, []);

  const handleOfferDraw = useCallback(async () => {
    if (isGameOver || drawOfferBy) return;
    const currentTurn = chess.turn() as 'w' | 'b';
    setDrawOfferBy(currentTurn);
    setDrawDeclined(false);
    
    if (gameMode === 'pve' && currentTurn === 'w') {
      setIsAiThinking(true);
      try {
        const accepted = await evaluateAiDrawOffer(chess.fen(), chess.history(), aiDifficulty);
        if (accepted) {
          setIsForcedDraw(true);
          setDrawOfferBy(null);
          updateGameState();
        } else {
          setDrawOfferBy(null);
          setDrawDeclined(true);
          soundService.playReject();
          setTimeout(() => setDrawDeclined(false), 3000);
        }
      } catch (e) {
        setDrawOfferBy(null);
      } finally {
        setIsAiThinking(false);
      }
    }
  }, [chess, gameMode, aiDifficulty, isGameOver, drawOfferBy, updateGameState]);

  const handleRespondToDraw = useCallback((accepted: boolean) => {
    if (accepted) {
      setIsForcedDraw(true);
      setDrawOfferBy(null);
      updateGameState();
    } else {
      setDrawOfferBy(null);
      setDrawDeclined(true);
      soundService.playReject();
      setTimeout(() => setDrawDeclined(false), 3000);
    }
  }, [updateGameState]);

  const acceptDifficultySuggestion = useCallback(() => {
    if (difficultySuggestion) {
      setAiDifficulty(difficultySuggestion);
      setDifficultySuggestion(null);
      setPerformanceStreak(0);
      localStorage.setItem(STREAK_KEY, '0');
    }
  }, [difficultySuggestion]);

  useEffect(() => {
    if (isGameOver || gameState.history.length === 0) return;
    const interval = setInterval(() => {
      const turn = chess.turn();
      if (turn === 'w') {
        setWhiteTime(t => {
          if (t <= 0) {
            setIsTimeout(true);
            setWinner('b');
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 0) {
            setIsTimeout(true);
            setWinner('w');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [chess, isGameOver, gameState.history.length]);

  useEffect(() => {
    setGameState(prev => ({ ...prev, whiteTime, blackTime, isTimeout, winner: isTimeout ? winner : prev.winner, drawOfferBy }));
    if (isTimeout && !gameState.ratingChange && gameMode !== 'puzzle') {
      handleGameOver(winner === 'w' ? 'w' : 'b');
    }
  }, [whiteTime, blackTime, isTimeout, winner, handleGameOver, gameState.ratingChange, gameMode, drawOfferBy]);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* Draw Declined Feedback */}
      {drawDeclined && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-none">
          <div className="bg-rose-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-rose-400/30 flex items-center gap-2">
            <X size={14} /> Draw offer declined
          </div>
        </div>
      )}

      {/* Puzzle Success Overlay */}
      {gameMode === 'puzzle' && isPuzzleSolved && (
        <div className="absolute inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={40} className="text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2">Solved!</h2>
              <p className="text-slate-400 mb-8">You found the best move in {puzzleAttempts + 1} attempt{puzzleAttempts !== 0 ? 's' : ''}.</p>
              <button 
                onClick={handleNextPuzzle}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-900/20"
              >
                Next Challenge <ChevronRight size={20} />
              </button>
           </div>
        </div>
      )}

      {/* Performance Suggestion Toast */}
      {difficultySuggestion && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-500 pointer-events-auto">
          <div className="bg-slate-800/90 backdrop-blur-xl border border-blue-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[320px]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${performanceStreak > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {performanceStreak > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-blue-400" />
                Adaptive AI Skill
              </h4>
              <p className="text-xs text-slate-400">
                {performanceStreak >= 2 ? `You're crushing it! Try ${difficultySuggestion}?` : `Tough match! Scale to ${difficultySuggestion}?`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={acceptDifficultySuggestion} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1">Accept <ChevronRight size={14} /></button>
              <button onClick={() => setDifficultySuggestion(null)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-2 rounded-lg transition-all"><X size={14} /></button>
            </div>
          </div>
        </div>
      )}

      <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} gl={{ antialias: true, stencil: false, depth: true }}>
        <PerspectiveCamera makeDefault position={[0, 8, 8]} fov={45} />
        <OrbitControls enabled={!isDragging} enablePan={false} maxPolarAngle={Math.PI / 2.2} minDistance={5} maxDistance={15} enableDamping={true} dampingFactor={0.05} rotateSpeed={0.6} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="night" />
        <ambientLight intensity={0.5} />
        <spotLight position={[5, 12, 5]} angle={0.4} penumbra={0.6} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
        <pointLight position={[-8, 4, -8]} intensity={0.6} color="#3b82f6" />
        <ChessBoard3D chess={chess} onSquareClick={onSquareClick} selectedSquare={selectedSquare} validMoves={validMoves} lastMove={gameState.lastMove} onDraggingChange={setIsDragging} interactionEnabled={canInteract} />
      </Canvas>

      <GameUI 
        gameState={gameState} gameMode={gameMode} aiDifficulty={aiDifficulty} setAiDifficulty={setAiDifficulty} chess={chess} onAiMove={handleAiMove} onReset={resetGame} onUndo={handleUndo} onToggleMode={toggleGameMode} onSetTime={setTimeLimit} onOfferDraw={handleOfferDraw} onRespondToDraw={handleRespondToDraw} isAiThinking={isAiThinking} aiAnalysis={aiAnalysis} pendingPromotion={pendingPromotion} onPromote={completePromotion}
        puzzleIndex={puzzleIndex} puzzleAttempts={puzzleAttempts} isPuzzleSolved={isPuzzleSolved} onNextPuzzle={handleNextPuzzle} onPrevPuzzle={handlePrevPuzzle} onRestartPuzzle={handleRestartPuzzle} onTogglePuzzleMode={togglePuzzleMode}
      />
    </div>
  );
};

export default App;
