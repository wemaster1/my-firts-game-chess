
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { SQUARE_SIZE, COLORS, SQUARE_NAMES } from '../constants';
import Piece3D from './Piece3D';
import { soundService } from '../services/soundService';

interface ChessBoard3DProps {
  chess: Chess;
  onSquareClick: (square: string) => void;
  selectedSquare: string | null;
  validMoves: string[];
  lastMove?: { from: string; to: string };
  onDraggingChange?: (isDragging: boolean) => void;
  interactionEnabled: boolean;
}

interface ManagedPiece {
  id: string;
  type: string;
  color: string;
  square: string;
  visible: boolean;
  isCaptured?: boolean;
  isPromoting?: boolean;
}

const ChessBoard3D: React.FC<ChessBoard3DProps> = ({ 
  chess, 
  onSquareClick, 
  selectedSquare, 
  validMoves,
  lastMove,
  onDraggingChange,
  interactionEnabled
}) => {
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<[number, number, number] | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const [rejectedSquare, setRejectedSquare] = useState<string | null>(null);
  const planeRef = useRef<THREE.Mesh>(null);
  const turn = chess.turn();

  const [managedPieces, setManagedPieces] = useState<ManagedPiece[]>([]);
  const nextPieceId = useRef(0);

  useEffect(() => {
    const board = chess.board();
    const history = chess.history({ verbose: true });
    const currentLastMove = history[history.length - 1];
    const isPromotion = currentLastMove?.flags.includes('p');

    setManagedPieces(prev => {
      const activeCaptures = prev.filter(p => p.isCaptured);
      const pool: ManagedPiece[] = prev.filter(p => !p.isCaptured).map(p => ({ ...p, visible: false, isPromoting: false }));
      const newManaged: ManagedPiece[] = [];

      // Pass 1: Match stationary pieces exactly
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const squareData = board[i][j];
          if (!squareData) continue;
          const squareName = SQUARE_NAMES[i * 8 + j];
          
          const exactMatchIdx = pool.findIndex(p => 
            !p.visible && 
            p.square === squareName && 
            p.type === squareData.type && 
            p.color === squareData.color
          );

          if (exactMatchIdx !== -1) {
            pool[exactMatchIdx].visible = true;
            newManaged.push(pool[exactMatchIdx]);
            board[i][j] = null;
          }
        }
      }

      // Capture detection
      if (currentLastMove && (currentLastMove.flags.includes('c') || currentLastMove.flags.includes('e'))) {
          let victimIdx = -1;
          if (currentLastMove.flags.includes('e')) {
              const toCol = currentLastMove.to[0];
              const victimRank = currentLastMove.color === 'w' ? '5' : '4';
              const victimSquare = `${toCol}${victimRank}`;
              victimIdx = pool.findIndex(p => p.square === victimSquare && p.type === 'p' && p.color !== currentLastMove.color);
          } else {
              victimIdx = pool.findIndex(p => 
                p.square === currentLastMove.to && 
                p.color !== currentLastMove.color &&
                !p.visible
              );
          }

          if (victimIdx !== -1) {
              const victim = pool[victimIdx];
              newManaged.push({ ...victim, visible: true, isCaptured: true });
              pool.splice(victimIdx, 1);
          }
      }

      // Pass 2: Moving pieces/Promotions
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const squareData = board[i][j];
          if (!squareData) continue;
          const squareName = SQUARE_NAMES[i * 8 + j];

          let matchIdx = -1;
          let matchedAsPromotion = false;

          if (lastMove && squareName === lastMove.to) {
            matchIdx = pool.findIndex(p => 
              !p.visible && 
              p.square === lastMove.from && 
              p.color === squareData.color &&
              (p.type === squareData.type || (p.type === 'p' && squareData.type !== 'p'))
            );
            if (matchIdx !== -1 && pool[matchIdx].type === 'p' && squareData.type !== 'p') {
              matchedAsPromotion = true;
            }
          }

          if (matchIdx === -1) {
            matchIdx = pool.findIndex(p => 
              !p.visible && p.type === squareData.type && p.color === squareData.color
            );
          }

          if (matchIdx !== -1) {
            pool[matchIdx].square = squareName;
            pool[matchIdx].type = squareData.type;
            pool[matchIdx].visible = true;
            pool[matchIdx].isPromoting = matchedAsPromotion || (isPromotion && squareName === currentLastMove.to);
            newManaged.push(pool[matchIdx]);
          } else {
            newManaged.push({
              id: `piece-${nextPieceId.current++}`,
              type: squareData.type,
              color: squareData.color,
              square: squareName,
              visible: true,
              isPromoting: isPromotion && squareName === currentLastMove.to
            });
          }
        }
      }

      return [...newManaged, ...activeCaptures];
    });

    const cleanupTimeout = setTimeout(() => {
      setManagedPieces(prev => prev.filter(p => !p.isCaptured).map(p => ({...p, isPromoting: false})));
    }, 800);

    return () => clearTimeout(cleanupTimeout);
  }, [chess.fen(), lastMove]);

  const worldToSquare = useCallback((x: number, z: number): string | null => {
    const colIdx = Math.round(x + 3.5);
    const rowIdx = Math.round(z + 3.5);
    if (colIdx >= 0 && colIdx < 8 && rowIdx >= 0 && rowIdx < 8) {
      return SQUARE_NAMES[rowIdx * 8 + colIdx];
    }
    return null;
  }, []);

  const handlePointerDown = (square: string, e: any) => {
    if (!interactionEnabled) return;
    e.stopPropagation();
    
    const piece = chess.get(square as Square);
    if (piece && piece.color === turn) {
      onSquareClick(square);
      setDraggedPiece(square);
      setDragPosition([e.point.x, 0, e.point.z]);
      onDraggingChange?.(true);
    } else {
      onSquareClick(square);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!draggedPiece || !interactionEnabled) return;
    setDragPosition([e.point.x, 0, e.point.z]);
    const sq = worldToSquare(e.point.x, e.point.z);
    if (sq !== hoveredSquare) {
      setHoveredSquare(sq);
    }
  };

  const handlePointerUp = (e: any) => {
    if (!draggedPiece) return;
    const targetSquare = worldToSquare(e.point.x, e.point.z);
    
    if (targetSquare && targetSquare !== draggedPiece && validMoves.includes(targetSquare)) {
      onSquareClick(targetSquare);
    } else if (targetSquare && targetSquare !== draggedPiece) {
      setRejectedSquare(draggedPiece);
      setTimeout(() => setRejectedSquare(null), 450);
      soundService.playReject();
    }

    setDraggedPiece(null);
    setDragPosition(null);
    setHoveredSquare(null);
    onDraggingChange?.(false);
  };

  const castlingInfo = useMemo(() => {
    if (!selectedSquare) return { kingTargets: [], rookPaths: [] };
    const piece = chess.get(selectedSquare as Square);
    if (!piece || piece.type !== 'k') return { kingTargets: [], rookPaths: [] };
    
    const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
    const kingTargets: string[] = [];
    const rookPaths: string[] = [];
    
    moves.forEach(m => {
      if (m.flags.includes('k')) { 
        kingTargets.push(m.to);
        if (m.color === 'w') rookPaths.push('f1', 'h1');
        else rookPaths.push('f8', 'h8');
      } else if (m.flags.includes('q')) {
        kingTargets.push(m.to);
        if (m.color === 'w') rookPaths.push('d1', 'a1', 'b1');
        else rookPaths.push('d8', 'a8', 'b8');
      }
    });
    
    return { kingTargets, rookPaths };
  }, [selectedSquare, chess]);

  const squares = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const squareName = SQUARE_NAMES[i * 8 + j];
      const isBlack = (i + j) % 2 === 1;
      const isSelected = selectedSquare === squareName;
      const isValidMove = validMoves.includes(squareName);
      const isCastlingKingTarget = castlingInfo.kingTargets.includes(squareName);
      const isCastlingRookPath = castlingInfo.rookPaths.includes(squareName);
      const isFromLast = lastMove?.from === squareName;
      const isToLast = lastMove?.to === squareName;
      const isHoveredTarget = hoveredSquare === squareName && isValidMove;
      const pieceOnTarget = chess.get(squareName as Square);
      
      let color = isBlack ? COLORS.blackSquare : COLORS.whiteSquare;
      if (isSelected) color = COLORS.highlightSelect;

      squares.push(
        <mesh 
          key={squareName} 
          position={[j - 3.5, -0.1, i - 3.5]} 
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDown(squareName, e);
          }}
        >
          <boxGeometry args={[SQUARE_SIZE, 0.2, SQUARE_SIZE]} />
          <meshStandardMaterial 
            color={color} 
            roughness={0.6} 
            metalness={0.1} 
          />
        </mesh>
      );
      
      if (isCastlingRookPath) {
        squares.push(
          <mesh key={`${squareName}-rook-path`} position={[j - 3.5, 0.012, i - 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.85, 0.85]} />
            <meshStandardMaterial 
              color="#f59e0b" 
              transparent 
              opacity={0.15} 
              emissive="#f59e0b"
              emissiveIntensity={0.8}
            />
          </mesh>
        );
      }

      if (isFromLast || isToLast) {
        squares.push(
          <mesh key={`${squareName}-last-move`} position={[j - 3.5, 0.015, i - 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.98, 0.98]} />
            <meshStandardMaterial 
              color="#fbbf24" 
              transparent 
              opacity={isToLast ? 0.35 : 0.2} 
              emissive="#fbbf24"
              emissiveIntensity={0.4}
            />
          </mesh>
        );
      }

      if (isValidMove) {
        const isCapture = !!pieceOnTarget && pieceOnTarget.color !== turn;
        squares.push(
          <mesh key={`${squareName}-valid-hint`} position={[j - 3.5, 0.02, i - 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
            {isCapture ? (
              <ringGeometry args={[0.38, 0.48, 32]} />
            ) : (
              <circleGeometry args={[0.12, 32]} />
            )}
            <meshStandardMaterial 
              color={isCastlingKingTarget ? '#f59e0b' : COLORS.highlightMove} 
              emissive={isCastlingKingTarget ? '#f59e0b' : COLORS.highlightMove} 
              emissiveIntensity={isHoveredTarget ? 4 : 1.5} 
              transparent 
              opacity={0.7} 
            />
          </mesh>
        );
      }
    }
  }

  return (
    <group>
      <mesh 
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {hoveredSquare && draggedPiece && interactionEnabled && (
        <mesh 
          position={[
            hoveredSquare.charCodeAt(0) - 97 - 3.5, 
            0.025, 
            8 - parseInt(hoveredSquare[1]) - 3.5
          ]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.92, 0.92]} />
          <meshStandardMaterial 
            color={validMoves.includes(hoveredSquare) ? "#60a5fa" : "#ef4444"} 
            emissive={validMoves.includes(hoveredSquare) ? "#3b82f6" : "#b91c1c"} 
            emissiveIntensity={2} 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}

      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.4, 8.8]} />
        <meshStandardMaterial color="#0f1724" roughness={0.05} metalness={0.95} />
      </mesh>

      {squares}
      
      {managedPieces.map((p) => {
        const col = p.square.charCodeAt(0) - 97;
        const row = 8 - parseInt(p.square[1]);
        return (
          <Piece3D 
            key={p.id}
            type={p.type as any}
            color={p.color as any}
            position={[col - 3.5, 0, row - 3.5]}
            dragPosition={p.square === draggedPiece ? dragPosition : null}
            isDragging={p.square === draggedPiece}
            isCaptured={p.isCaptured}
            isPromoting={p.isPromoting}
            isSelected={p.square === selectedSquare}
            isRejected={p.square === rejectedSquare}
            isTurn={p.color === turn}
            visible={p.visible}
            onPointerDown={(e) => handlePointerDown(p.square, e)}
          />
        );
      })}
    </group>
  );
};

export default ChessBoard3D;
