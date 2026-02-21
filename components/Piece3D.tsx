
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PieceType, PieceColor } from '../types';
import { COLORS } from '../constants';

interface Piece3DProps {
  type: PieceType;
  color: PieceColor;
  position: [number, number, number];
  dragPosition?: [number, number, number] | null;
  isDragging?: boolean;
  isCaptured?: boolean;
  isPromoting?: boolean;
  isSelected?: boolean;
  isRejected?: boolean;
  isTurn?: boolean;
  visible: boolean;
  onPointerDown: (e: any) => void;
}

const createShadowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.2, 'rgba(0,0,0,0.8)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

const SHADOW_TEXTURE = createShadowTexture();

const Piece3D: React.FC<Piece3DProps> = ({ 
  type, 
  color, 
  position, 
  dragPosition,
  isDragging,
  isCaptured,
  isPromoting,
  isSelected,
  isRejected,
  isTurn,
  visible, 
  onPointerDown 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shadowGroupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloOuterRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const captureStartTime = useRef<number | null>(null);
  const promotionStartTime = useRef<number | null>(null);
  const prevType = useRef<string>(type);
  
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const currentPos = useRef(new THREE.Vector3(...position));
  const smoothedVelocity = useRef(new THREE.Vector3(0, 0, 0));
  
  const LIGHT_POS = useMemo(() => new THREE.Vector3(5, 12, 5), []);
  
  const pieceColor = color === 'w' ? COLORS.whitePiece : COLORS.blackPiece;
  const glowColor = color === 'w' ? COLORS.turnGlowWhite : COLORS.turnGlowBlack;

  useEffect(() => {
    if (isPromoting || prevType.current !== type) {
      promotionStartTime.current = performance.now() / 1000;
      prevType.current = type;
      if (groupRef.current) groupRef.current.scale.set(0, 0, 0);
    }
  }, [type, isPromoting]);

  const material = (
    <meshStandardMaterial 
      ref={materialRef}
      color={pieceColor} 
      roughness={0.05} 
      metalness={0.9} 
      envMapIntensity={1.5}
      emissive={glowColor}
      emissiveIntensity={0}
      transparent
      opacity={1}
    />
  );

  const meshProps = {
    castShadow: !isCaptured,
    receiveShadow: !isCaptured,
  };

  useFrame((state, delta) => {
    if (!groupRef.current || !meshGroupRef.current || !materialRef.current) return;

    if (isCaptured && captureStartTime.current === null) {
      captureStartTime.current = state.clock.elapsedTime;
    }

    const prevPos = currentPos.current.clone();
    const lerpSpeed = isDragging ? 60 : 15; 
    
    if (isDragging && dragPosition) {
      const dp = new THREE.Vector3(...dragPosition);
      currentPos.current.lerp(dp, Math.min(delta * lerpSpeed, 1));
    } else if (!isCaptured) {
      currentPos.current.lerp(targetPos, Math.min(delta * lerpSpeed, 1));
    }
    
    const rawVel = currentPos.current.clone().sub(prevPos).divideScalar(Math.max(delta, 0.001));
    smoothedVelocity.current.lerp(rawVel, Math.min(delta * 10, 1));

    let yOffset = 0;
    let pieceScale = 1;
    let opacity = 1;

    if (isCaptured && captureStartTime.current !== null) {
      const elapsed = state.clock.elapsedTime - captureStartTime.current;
      const duration = 0.8; 
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 0.25) {
        const p = progress / 0.25;
        pieceScale = 1 + Math.sin(p * Math.PI / 2) * 0.4;
        yOffset = p * 0.7;
        opacity = 1;
        materialRef.current.emissiveIntensity = p * 2.5;
      } else {
        const p = (progress - 0.25) / 0.75;
        pieceScale = 1.4 * (1 - p);
        yOffset = 0.7 + p * 1.5;
        opacity = Math.pow(1 - p, 1.8);
        materialRef.current.emissiveIntensity = 2.5 * (1 - p);
      }
      materialRef.current.opacity = opacity;
    } else if (promotionStartTime.current !== null) {
      const elapsed = state.clock.elapsedTime - promotionStartTime.current;
      const duration = 0.6;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutBack = (x: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };
      
      pieceScale = easeOutBack(progress);
      opacity = progress;
      materialRef.current.opacity = opacity;
      materialRef.current.emissiveIntensity = (1 - progress) * 3.0;
      
      if (progress >= 1) promotionStartTime.current = null;
    } else if (isDragging) {
      yOffset = THREE.MathUtils.lerp(meshGroupRef.current.position.y, 0.65, Math.min(delta * 20, 1));
      materialRef.current.opacity = 1;
      materialRef.current.emissiveIntensity = 1.6;
    } else {
      const distanceToTarget = currentPos.current.distanceTo(targetPos);
      const totalMoveDistance = prevPos.distanceTo(targetPos);
      
      if (totalMoveDistance > 0.01) {
        const progress = 1 - (distanceToTarget / totalMoveDistance);
        if (progress > 0 && progress < 1) {
          yOffset = Math.sin(progress * Math.PI) * 0.45;
        } else {
          yOffset = THREE.MathUtils.lerp(meshGroupRef.current.position.y, 0, Math.min(delta * 15, 1));
        }
      } else {
        yOffset = THREE.MathUtils.lerp(meshGroupRef.current.position.y, 0, Math.min(delta * 15, 1));
      }
      materialRef.current.opacity = 1;
    }
    
    groupRef.current.position.set(currentPos.current.x, currentPos.current.y, currentPos.current.z);
    meshGroupRef.current.position.y = yOffset;

    if (isRejected) {
      const shakeTime = state.clock.elapsedTime * 45;
      const shakeAmount = 0.06;
      meshGroupRef.current.position.x += Math.sin(shakeTime) * shakeAmount;
      meshGroupRef.current.position.z += Math.cos(shakeTime * 0.8) * shakeAmount;
    }

    const tiltAmount = isDragging ? 0.4 : 0.22;
    const maxTilt = isDragging ? 0.6 : 0.45;
    const targetTiltX = THREE.MathUtils.clamp(smoothedVelocity.current.z * tiltAmount, -maxTilt, maxTilt);
    const targetTiltZ = THREE.MathUtils.clamp(-smoothedVelocity.current.x * tiltAmount, -maxTilt, maxTilt);
    
    meshGroupRef.current.rotation.x = THREE.MathUtils.lerp(meshGroupRef.current.rotation.x, isDragging ? targetTiltX : 0, delta * 12);
    meshGroupRef.current.rotation.z = THREE.MathUtils.lerp(meshGroupRef.current.rotation.z, isDragging ? targetTiltZ : 0, delta * 12);

    if (shadowGroupRef.current && shadowRef.current) {
      const pieceCenterY = yOffset + 0.35;
      const lightToPieceVec = currentPos.current.clone().add(new THREE.Vector3(0, pieceCenterY, 0)).sub(LIGHT_POS);
      const groundY = 0.01;
      const t = (groundY - LIGHT_POS.y) / lightToPieceVec.y;
      const shadowWorldPos = LIGHT_POS.clone().add(lightToPieceVec.multiplyScalar(t));
      
      shadowGroupRef.current.position.x = shadowWorldPos.x - currentPos.current.x;
      shadowGroupRef.current.position.z = shadowWorldPos.z - currentPos.current.z;

      const horizontalDist = new THREE.Vector2(shadowWorldPos.x - LIGHT_POS.x, shadowWorldPos.z - LIGHT_POS.z).length();
      const verticalDist = LIGHT_POS.y - groundY;
      const angleOfIncidence = Math.atan2(horizontalDist, verticalDist);
      const angleToLight = Math.atan2(shadowWorldPos.x - LIGHT_POS.x, shadowWorldPos.z - LIGHT_POS.z);
      shadowGroupRef.current.rotation.y = angleToLight;

      const shadowScaleBase = 0.8;
      const heightFactor = Math.max(0, 1 - (yOffset * 1.2));
      const blurFactor = 1 + (yOffset * 1.8);
      const stretchFactor = 1 + Math.pow(Math.sin(angleOfIncidence), 1.8) * 2.8;
      const finalScale = shadowScaleBase * blurFactor;
      
      shadowRef.current.scale.set(finalScale, finalScale * stretchFactor, 1);
      const baseOpacity = isDragging ? 0.45 : 0.32;
      const stretchFade = Math.max(0.3, 1 - (stretchFactor - 1) * 0.15);
      (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = visible && !isCaptured ? (baseOpacity * heightFactor * stretchFade) : 0;
    }

    const visibilityScale = visible ? 1 : 0;
    const targetScale = isCaptured ? pieceScale : (promotionStartTime.current !== null ? pieceScale : visibilityScale);
    const currentScale = groupRef.current.scale.x;
    const newScale = (isCaptured || promotionStartTime.current !== null) ? targetScale : THREE.MathUtils.lerp(currentScale, targetScale, Math.min(delta * 12, 1));
    groupRef.current.scale.set(newScale, newScale, newScale);
    
    if (type === 'n') {
      const targetRotation = color === 'w' ? 0 : Math.PI;
      meshGroupRef.current.rotation.y = THREE.MathUtils.lerp(meshGroupRef.current.rotation.y, targetRotation, Math.min(delta * 8, 1));
    }

    // Refined Emissive Intensity and Pulse Logic
    if (isSelected && !isDragging && !isCaptured) {
      const time = state.clock.elapsedTime;
      const breathPulse = (Math.sin(time * 3.0) + 1) / 2;
      
      if (haloRef.current) {
        const haloOpacity = 0.3 + breathPulse * 0.5;
        const haloScale = 1.0 + breathPulse * 0.1;
        (haloRef.current.material as THREE.MeshBasicMaterial).opacity = haloOpacity;
        haloRef.current.scale.set(haloScale, haloScale, 1);
      }
      
      if (haloOuterRef.current) {
        const outerBreath = (Math.sin(time * 3.0 + Math.PI / 2) + 1) / 2;
        const outerOpacity = 0.15 + outerBreath * 0.15;
        const outerScale = 1.1 + outerBreath * 0.15;
        (haloOuterRef.current.material as THREE.MeshBasicMaterial).opacity = outerOpacity;
        haloOuterRef.current.scale.set(outerScale, outerScale, 1);
      }

      if (auraRef.current) {
        const auraOpacity = 0.05 + breathPulse * 0.2;
        const auraScale = 1.05 + breathPulse * 0.05;
        (auraRef.current.material as THREE.MeshBasicMaterial).opacity = auraOpacity;
        auraRef.current.scale.set(auraScale, 1, auraScale);
      }

      if (materialRef.current && promotionStartTime.current === null) {
        materialRef.current.emissiveIntensity = 0.5 + breathPulse * 1.1;
      }
    } else if (isDragging) {
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = 1.6;
      }
    } else if (!isCaptured && promotionStartTime.current === null) {
      if (materialRef.current) {
        if (isTurn) {
          const turnPulse = (Math.sin(state.clock.elapsedTime * 2.5) + 1) / 2;
          materialRef.current.emissiveIntensity = turnPulse * 0.2;
        } else {
          materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(materialRef.current.emissiveIntensity, 0, Math.min(delta * 10, 1));
        }
      }
    }
  });

  const Base = ({ scale = 1 }) => (
    <group scale={scale}>
      <mesh {...meshProps} position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.1, 32]} />
        {material}
      </mesh>
      <mesh {...meshProps} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.1, 32]} />
        {material}
      </mesh>
    </group>
  );

  const Collar = ({ y }: { y: number }) => (
    <mesh {...meshProps} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.18, 0.04, 12, 24]} />
      {material}
    </mesh>
  );

  const renderGeometry = () => {
    switch (type) {
      case 'p':
        return (
          <group>
            <mesh {...meshProps} position={[0, 0.05, 0]}><cylinderGeometry args={[0.25, 0.32, 0.1, 32]} />{material}</mesh>
            <mesh {...meshProps} position={[0, 0.25, 0]}><cylinderGeometry args={[0.12, 0.25, 0.4, 32]} />{material}</mesh>
            <mesh {...meshProps} position={[0, 0.45, 0]}><sphereGeometry args={[0.2, 32, 32]} />{material}</mesh>
            <Collar y={0.38} />
          </group>
        );
      case 'r':
        return (
          <group>
            <Base />
            <mesh {...meshProps} position={[0, 0.4, 0]}><cylinderGeometry args={[0.25, 0.28, 0.5, 32]} />{material}</mesh>
            <mesh {...meshProps} position={[0, 0.7, 0]}><cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />{material}</mesh>
            <group position={[0, 0.82, 0]}>{[0, 1, 2, 3].map((i) => (<mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]}><boxGeometry args={[0.1, 0.1, 0.32]} />{material}</mesh>))}</group>
          </group>
        );
      case 'n':
        return (
          <group>
            <Base />
            <mesh {...meshProps} position={[0, 0.3, 0]}><cylinderGeometry args={[0.2, 0.28, 0.3, 32]} />{material}</mesh>
            <group position={[0, 0.45, 0]}>
              <mesh {...meshProps} position={[0, 0.1, 0.05]} rotation={[-0.3, 0, 0]}><boxGeometry args={[0.22, 0.4, 0.25]} />{material}</mesh>
              <mesh {...meshProps} position={[0, 0.3, 0.2]} rotation={[0.4, 0, 0]}><boxGeometry args={[0.2, 0.2, 0.35]} />{material}</mesh>
              <mesh {...meshProps} position={[0.06, 0.42, 0.08]}><boxGeometry args={[0.04, 0.12, 0.04]} />{material}</mesh>
              <mesh {...meshProps} position={[-0.06, 0.42, 0.08]}><boxGeometry args={[0.04, 0.12, 0.04]} />{material}</mesh>
            </group>
          </group>
        );
      case 'b':
        return (
          <group>
            <Base />
            <mesh {...meshProps} position={[0, 0.45, 0]}><cylinderGeometry args={[0.1, 0.25, 0.6, 32]} />{material}</mesh>
            <Collar y={0.65} />
            <mesh {...meshProps} position={[0, 0.8, 0]} scale={[1, 1.4, 1]}><sphereGeometry args={[0.18, 32, 32]} />{material}</mesh>
            <mesh {...meshProps} position={[0, 1.05, 0]}><sphereGeometry args={[0.05, 16, 16]} />{material}</mesh>
          </group>
        );
      case 'q':
        return (
          <group>
            <Base />
            <mesh {...meshProps} position={[0, 0.5, 0]}><cylinderGeometry args={[0.12, 0.28, 0.8, 32]} />{material}</mesh>
            <Collar y={0.85} />
            <mesh {...meshProps} position={[0, 0.95, 0]}><cylinderGeometry args={[0.25, 0.18, 0.15, 32]} />{material}</mesh>
            <group position={[0, 1.05, 0]}>
              {Array.from({ length: 8 }).map((_, i) => (<mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 0.2, 0, Math.sin((i / 8) * Math.PI * 2) * 0.2]}><sphereGeometry args={[0.04, 12, 12]} />{material}</mesh>))}
              <mesh position={[0, 0.05, 0]}><sphereGeometry args={[0.08, 16, 16]} />{material}</mesh>
            </group>
          </group>
        );
      case 'k':
        return (
          <group>
            <Base />
            <mesh {...meshProps} position={[0, 0.55, 0]}><cylinderGeometry args={[0.14, 0.3, 0.9, 32]} />{material}</mesh>
            <Collar y={0.95} />
            <mesh {...meshProps} position={[0, 1.05, 0]}><cylinderGeometry args={[0.25, 0.2, 0.2, 32]} />{material}</mesh>
            <group position={[0, 1.25, 0]}>
              <mesh {...meshProps}><boxGeometry args={[0.06, 0.25, 0.06]} />{material}</mesh>
              <mesh {...meshProps} position={[0, 0.05, 0]}><boxGeometry args={[0.18, 0.06, 0.06]} />{material}</mesh>
            </group>
          </group>
        );
      default: return null;
    }
  };

  return (
    <group ref={groupRef} onPointerDown={onPointerDown}>
      <group ref={shadowGroupRef}>
        <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 1.5]} />
          <meshBasicMaterial map={SHADOW_TEXTURE} transparent opacity={0.3} depthWrite={false} blending={THREE.MultiplyBlending} premultipliedAlpha={true} />
        </mesh>
      </group>

      <group ref={meshGroupRef}>
        {renderGeometry()}
        
        {(isSelected || isDragging) && !isCaptured && (
          <group>
            <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <ringGeometry args={[0.42, 0.52, 48]} />
              <meshBasicMaterial color={COLORS.highlightSelect} transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>
            
            <mesh ref={haloOuterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <ringGeometry args={[0.55, 0.58, 64]} />
              <meshBasicMaterial color={COLORS.highlightSelect} transparent opacity={0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>

            <mesh ref={auraRef} position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.4, 0.45, 1.2, 32, 1, true]} />
              <meshBasicMaterial color={COLORS.highlightSelect} transparent opacity={0.1} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export default Piece3D;
