
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState, GeminiMoveResponse, PieceType, GameMode, AiDifficulty } from '../types';
import { 
  RotateCcw, Brain, ChevronRight, Trophy, AlertTriangle, 
  ChevronDown, ChevronUp, Swords, User, Users, Castle, 
  Clock, Timer, Eye, EyeOff, Layout, Gauge, X, Undo2, Crown, Zap, Handshake, TrendingUp, TrendingDown,
  Sparkles, Loader2, Lightbulb, Target, ChevronLeft, ShieldCheck
} from 'lucide-react';
import { Chess } from 'chess.js';
import { TIME_CONTROLS, RATING_TIERS, CHESS_PUZZLES } from '../constants';

interface GameUIProps {
  gameState: GameState;
  gameMode: GameMode;
  aiDifficulty: AiDifficulty;
  setAiDifficulty: (d: AiDifficulty) => void;
  chess: Chess;
  onAiMove: () => void;
  onReset: () => void;
  onUndo: () => void;
  onToggleMode: () => void;
  onSetTime: (seconds: number) => void;
  onOfferDraw: () => void;
  onRespondToDraw: (accepted: boolean) => void;
  isAiThinking: boolean;
  aiAnalysis: GeminiMoveResponse | null;
  pendingPromotion: { from: string; to: string } | null;
  onPromote: (piece: PieceType) => void;
  
  // Puzzle props
  puzzleIndex?: number;
  puzzleAttempts?: number;
  isPuzzleSolved?: boolean;
  onNextPuzzle?: () => void;
  onPrevPuzzle?: () => void;
  onRestartPuzzle?: () => void;
  onTogglePuzzleMode?: () => void;
}

const AI_PANEL_STORAGE_KEY = 'grandmaster-ai-panel-collapsed';

const ChessClock: React.FC<{ 
  time: number; 
  initialTime: number; 
  isActive: boolean; 
  color: 'w' | 'b'; 
  label: string; 
  isAi?: boolean; 
  isThinking?: boolean 
}> = ({ time, initialTime, isActive, color, label, isAi, isThinking }) => {
  const percentage = (time / initialTime) * 100;
  const isLowTime = time < 30;
  const isWhite = color === 'w';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`
      relative group flex flex-col min-w-[180px] p-3 rounded-2xl border transition-all duration-500 overflow-hidden
      ${isActive 
        ? (isWhite ? 'bg-white text-slate-900 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-slate-800 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]') 
        : 'bg-slate-900/40 text-slate-500 border-slate-800 opacity-60'
      }
    `}>
      {/* Background Progress Bar */}
      <div 
        className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${isLowTime ? 'bg-red-500' : (isWhite ? 'bg-blue-600' : 'bg-blue-400')}`}
        style={{ width: `${percentage}%` }}
      />
      
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-black uppercase tracking-tighter opacity-60 flex items-center gap-1">
          {isAi ? <Brain size={10} className={isThinking ? 'animate-pulse' : ''} /> : <User size={10} />}
          {label}
        </span>
        {isActive && <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLowTime ? 'bg-red-500' : 'bg-blue-500'}`} />}
      </div>

      <div className="flex items-baseline justify-between">
        <span className={`font-mono text-2xl font-black tabular-nums tracking-tighter ${isLowTime && isActive ? 'text-red-500 animate-pulse' : ''}`}>
          {formatTime(time)}
        </span>
        {isActive && isThinking && (
          <div className="flex gap-0.5">
            <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
};

const GameUI: React.FC<GameUIProps> = ({ 
  gameState, gameMode, aiDifficulty, setAiDifficulty, chess, onAiMove, onReset, onUndo, onToggleMode, onSetTime, onOfferDraw, onRespondToDraw, isAiThinking, aiAnalysis, pendingPromotion, onPromote,
  puzzleIndex = 0, puzzleAttempts = 0, isPuzzleSolved = false, onNextPuzzle, onPrevPuzzle, onRestartPuzzle, onTogglePuzzleMode
}) => {
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(false);
  const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(() => localStorage.getItem(AI_PANEL_STORAGE_KEY) === 'true');
  const [hidePanels, setHidePanels] = useState(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  const stopProp = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  useEffect(() => {
    localStorage.setItem(AI_PANEL_STORAGE_KEY, isAiPanelCollapsed.toString());
  }, [isAiPanelCollapsed]);

  const currentPuzzle = CHESS_PUZZLES[puzzleIndex % CHESS_PUZZLES.length];
  const isPuzzleMode = gameMode === 'puzzle';

  const isWhiteTurn = gameState.turn === 'w';
  const isPvp = gameMode === 'pvp';
  const isGameOver = gameState.isCheckmate || gameState.isDraw || gameState.isTimeout || gameState.isStalemate;
  const gameStarted = gameState.history.length > 0;
  const isAiTurn = !isPvp && !isWhiteTurn && !isGameOver && !isPuzzleMode;

  useEffect(() => {
    if (isGameOver) setShowGameOverOverlay(true);
    else setShowGameOverOverlay(false);
  }, [isGameOver]);

  const canOfferDraw = !isGameOver && !isAiThinking && !isAiTurn && !gameState.drawOfferBy && !isPuzzleMode;
  const isDrawOfferVisible = isPvp && gameState.drawOfferBy && gameState.drawOfferBy !== gameState.turn;

  const groupedHistory = useMemo(() => {
    const groups = [];
    for (let i = 0; i < gameState.history.length; i += 2) {
      groups.push({ turnNum: Math.floor(i / 2) + 1, white: gameState.history[i], black: gameState.history[i + 1] || null });
    }
    return groups;
  }, [gameState.history]);

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [gameState.history]);

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
      {/* Game Over Overlay */}
      {isGameOver && showGameOverOverlay && !isPuzzleMode && (
        <div className="absolute inset-0 pointer-events-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] animate-in fade-in duration-500" onPointerDown={stopProp}>
          <div className="bg-slate-900 border border-slate-700/50 p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full relative overflow-hidden text-center">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />
            
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-amber-900/40 rotate-12">
              <Trophy size={48} className="text-white -rotate-12" />
            </div>

            <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tighter">
              {gameState.isCheckmate ? 'Checkmate!' : gameState.isTimeout ? 'Time Out!' : 'Draw!'}
            </h2>
            
            <p className="text-xl text-slate-400 mb-10">
              {gameState.isDraw ? "The battle ends in a stalemate." : `${gameState.winner === 'w' ? 'White' : 'Black'} claims the victory.`}
            </p>

            <button onClick={onReset} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-xl shadow-blue-900/40 flex items-center justify-center gap-3">
              <RotateCcw size={24} /> New Match
            </button>
          </div>
        </div>
      )}

      {/* Promotion Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 pointer-events-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[90] animate-in fade-in duration-300" onPointerDown={stopProp}>
          <div className="bg-slate-900 border border-slate-700/50 p-8 rounded-[3rem] shadow-2xl max-w-md w-full text-center">
            <h3 className="text-2xl font-black text-white mb-8 tracking-tighter">Choose Promotion</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { type: 'q', label: 'Queen', icon: <Crown size={32} /> },
                { type: 'r', label: 'Rook', icon: <Castle size={32} /> },
                { type: 'b', label: 'Bishop', icon: <ShieldCheck size={32} /> },
                { type: 'n', label: 'Knight', icon: <Swords size={32} /> }
              ].map((p) => (
                <button
                  key={p.type}
                  onClick={() => onPromote(p.type as PieceType)}
                  className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-400 p-8 rounded-[2rem] flex flex-col items-center gap-4 transition-all group active:scale-90"
                >
                  <div className="text-slate-400 group-hover:text-white transition-colors group-hover:scale-110 duration-300">{p.icon}</div>
                  <span className="text-white font-bold tracking-tight">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main UI Layout */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-4 pointer-events-auto" onPointerDown={stopProp}>
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-5 rounded-2xl shadow-2xl min-w-[260px]">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-1 tracking-tighter">Grandmaster 3D</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-4">Ultimate Chess Engine</p>
            
            {isPuzzleMode ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Target size={14} /> Puzzle #{puzzleIndex + 1}
                  </span>
                  <span className="text-slate-500 text-[10px] font-bold">{puzzleAttempts} attempts</span>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                   <h3 className="font-bold text-white text-sm">{currentPuzzle.title}</h3>
                   <p className="text-xs text-slate-400 mt-1 leading-relaxed">{currentPuzzle.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={onPrevPuzzle} className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-all active:scale-95"><ChevronLeft size={18} className="mx-auto" /></button>
                  <button onClick={onRestartPuzzle} className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-all active:scale-95"><RotateCcw size={18} className="mx-auto" /></button>
                  <button onClick={onNextPuzzle} className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-all active:scale-95"><ChevronRight size={18} className="mx-auto" /></button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {gameState.isCheck && <div className="text-red-400 text-xs font-black animate-pulse mb-2 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-lg border border-red-500/20"><AlertTriangle size={14} /> CHECK!</div>}
                {!gameStarted && (
                  <div className="flex flex-col gap-4 mt-2 animate-in fade-in slide-in-from-left-2 duration-500">
                    <div className="flex flex-col gap-2">
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-1"><Clock size={12} /> Format</span>
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_CONTROLS.map(tc => (
                          <button 
                            key={tc.label} 
                            onClick={() => onSetTime(tc.seconds)} 
                            className={`px-3 py-2 text-[10px] font-bold rounded-lg border transition-all ${gameState.initialTime === tc.seconds ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40 scale-105 z-10' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
                          >
                            {tc.label} {tc.type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {gameState.drawOfferBy && (
                  <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-2 mt-4 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                    <Handshake size={14} /> Draw Proposed
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPuzzleMode && (
            <div className="flex flex-col gap-3">
              <ChessClock 
                time={gameState.whiteTime} 
                initialTime={gameState.initialTime} 
                isActive={isWhiteTurn && !isGameOver && gameStarted} 
                color="w" 
                label="Player White" 
              />
              <ChessClock 
                time={gameState.blackTime} 
                initialTime={gameState.initialTime} 
                isActive={!isWhiteTurn && !isGameOver && gameStarted} 
                color="b" 
                label={isPvp ? "Player Black" : "AI Opponent"} 
                isAi={!isPvp}
                isThinking={isAiThinking}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pointer-events-auto items-end" onPointerDown={stopProp}>
          <div className="flex gap-2 flex-wrap justify-end">
            <button 
              onClick={() => setHidePanels(!hidePanels)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${hidePanels ? 'bg-amber-600/80 border-amber-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
            >
              {hidePanels ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
            <button 
              onClick={onOfferDraw} 
              disabled={!canOfferDraw}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${!canOfferDraw ? 'opacity-30 cursor-not-allowed' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
            >
              <Handshake size={20} />
            </button>
            <button onClick={onUndo} disabled={!gameStarted || isGameOver} className={`flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${(!gameStarted || isGameOver) ? 'opacity-30 cursor-not-allowed' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}>
              <Undo2 size={20} />
            </button>
            <button onClick={onTogglePuzzleMode} className={`flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${isPuzzleMode ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}>
              <Lightbulb size={20} />
            </button>
            <button onClick={onToggleMode} disabled={gameStarted} className={`flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${isPvp ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}>
              {isPvp ? <Users size={20} /> : <Brain size={20} />}
            </button>
            <button onClick={onReset} className="flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md bg-slate-800/80 text-slate-300 shadow-xl hover:bg-slate-700 transition-colors active:scale-90"><RotateCcw size={20} /></button>
          </div>
        </div>
      </div>

      {!hidePanels && (
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 pointer-events-auto animate-in slide-in-from-bottom-4 duration-300" onPointerDown={stopProp}>
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-all duration-300">
             <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/40 transition-colors" onClick={() => setIsStatusCollapsed(!isStatusCollapsed)}>
               <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                 <Layout size={14} /> Move History
               </h2>
               {isStatusCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             </div>
             {!isStatusCollapsed && (
               <div ref={historyScrollRef} className="h-32 overflow-y-auto px-4 pb-4 text-slate-300 text-sm custom-scrollbar font-mono">
                 {groupedHistory.length === 0 ? (
                   <div className="text-slate-500 italic text-center py-6 text-xs flex flex-col items-center gap-2 opacity-50">
                     <Clock size={20} />
                     Match hasn't started
                   </div>
                 ) : (
                   groupedHistory.map(g => (
                    <div key={g.turnNum} className="grid grid-cols-[40px_1fr_1fr] gap-2 py-1.5 px-3 rounded-lg hover:bg-slate-700/30 transition-colors group">
                      <span className="text-slate-600 font-bold text-xs">{g.turnNum}.</span>
                      <span className="group-hover:text-blue-400 transition-colors">{g.white}</span>
                      <span className="group-hover:text-emerald-400 transition-colors">{g.black || '...'}</span>
                    </div>
                   ))
                 )}
               </div>
             )}
          </div>
          
          {!isPuzzleMode && !isAiPanelCollapsed && (
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 relative group/panel">
               <div className="absolute top-4 right-4 text-slate-700 hover:text-white cursor-pointer transition-colors" onClick={() => setIsAiPanelCollapsed(true)}>
                  <ChevronDown size={20} />
               </div>
               
               <div className="flex items-center gap-4 mb-6">
                 <div className={`w-14 h-14 rounded-2xl transition-all duration-500 flex items-center justify-center ${isAiThinking ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/40 scale-110' : 'bg-slate-700'}`}>
                    <Brain className="text-white" size={28} />
                 </div>
                 <div>
                    <h3 className="font-black text-white tracking-tight">GEMINI 3 PRO</h3>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isAiThinking ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'}`} />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isAiThinking ? 'Analyzing Position' : 'Standing By'}</p>
                    </div>
                 </div>
               </div>

               {aiAnalysis ? (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                   <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-1 bg-blue-500/10 text-blue-400 rounded-bl-xl"><Zap size={12} /></div>
                     <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Recommended Move</span>
                     <p className="text-2xl font-mono font-black text-white mt-1 tracking-tight">{aiAnalysis.move}</p>
                   </div>
                   <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evaluation</span>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1 italic">"{aiAnalysis.explanation}"</p>
                   </div>
                 </div>
               ) : (
                 <div className="py-10 border border-dashed border-slate-700 rounded-2xl text-center text-slate-600 italic text-xs flex flex-col items-center gap-3">
                    <Sparkles size={24} className="opacity-20" />
                    AI is watching the match...
                 </div>
               )}
            </div>
          )}
          
          {isAiPanelCollapsed && !isPuzzleMode && (
            <button 
              onClick={() => setIsAiPanelCollapsed(false)}
              className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-slate-300 hover:text-white transition-all hover:bg-slate-700"
            >
              <Brain size={20} className={isAiThinking ? 'animate-pulse text-blue-400' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest">AI Analysis</span>
              <ChevronUp size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameUI;
