import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Torus } from '@react-three/drei';
import * as THREE from 'three';

const ParticleChaos = () => {
  const groupRef = useRef();
  
  const particles = useMemo(() => {
    return Array.from({ length: 2000 }).map(() => ({
      position: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10 - 5],
      color: new THREE.Color().setHSL(Math.random(), 1, 0.6)
    }));
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      groupRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
};

const SimpleMan = (props) => {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current) return;
    // Walking animation
    const t = state.clock.elapsedTime * 10;
    const leg1 = groupRef.current.children[3]; // Left leg
    const leg2 = groupRef.current.children[4]; // Right leg
    const arm1 = groupRef.current.children[1]; // Left arm
    const arm2 = groupRef.current.children[2]; // Right arm
    
    if (leg1 && leg2 && arm1 && arm2) {
      leg1.rotation.x = Math.sin(t) * 0.5;
      leg2.rotation.x = -Math.sin(t) * 0.5;
      arm1.rotation.x = -Math.sin(t) * 0.5;
      arm2.rotation.x = Math.sin(t) * 0.5;
    }
  });

  return (
    <group ref={groupRef} {...props}>
      {/* Torso */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.4]} />
        <meshStandardMaterial color="#6fa8dc" />
      </mesh>
      {/* Left Arm */}
      <mesh position={[-0.6, 1.5, 0]}>
        <boxGeometry args={[0.3, 1.0, 0.3]} />
        <meshStandardMaterial color="#6fa8dc" />
      </mesh>
      {/* Right Arm */}
      <mesh position={[0.6, 1.5, 0]}>
        <boxGeometry args={[0.3, 1.0, 0.3]} />
        <meshStandardMaterial color="#6fa8dc" />
      </mesh>
      {/* Left Leg */}
      <mesh position={[-0.25, 0.5, 0]}>
        <boxGeometry args={[0.35, 1.0, 0.35]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Right Leg */}
      <mesh position={[0.25, 0.5, 0]}>
        <boxGeometry args={[0.35, 1.0, 0.35]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
};

const PillarsScene = () => {
  const groupRef = useRef();
  
  const pillars = useMemo(() => {
    return Array.from({ length: 40 }).map(() => ({
      position: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 10 - 2, (Math.random() - 0.5) * 30],
      scale: [1 + Math.random() * 2, 5 + Math.random() * 15, 1 + Math.random() * 2],
      rotation: [(Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5]
    }));
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      {pillars.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation}>
          <boxGeometry args={p.scale} />
          <meshStandardMaterial color="#88ccff" roughness={0.2} metalness={0.1} />
        </mesh>
      ))}
      <Float speed={2} floatIntensity={5} rotationIntensity={2}>
        <Torus args={[4, 0.2, 16, 100]} position={[-10, 5, -10]} rotation={[1, 0, 0]}>
          <meshStandardMaterial color="#00aaff" />
        </Torus>
      </Float>
      <Float speed={3} floatIntensity={4} rotationIntensity={3}>
        <Torus args={[3, 0.2, 16, 100]} position={[10, 8, -5]} rotation={[0, 1, 0]}>
          <meshStandardMaterial color="#00aaff" />
        </Torus>
      </Float>
      <SimpleMan position={[0, 0, 5]} rotation={[0, Math.PI, 0]} />
    </group>
  );
};

const StripedPathScene = () => {
  const pathRef = useRef();
  
  useFrame((state) => {
    if (pathRef.current) {
      pathRef.current.position.z = (state.clock.elapsedTime * 10) % 20;
    }
  });

  return (
    <group>
      <group ref={pathRef}>
        {Array.from({ length: 20 }).map((_, i) => (
          <group key={i} position={[0, 0, -i * 10]}>
            <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[4, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-4, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[4, 10]} />
              <meshBasicMaterial color="#66b3ff" />
            </mesh>
            <mesh position={[4, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[4, 10]} />
              <meshBasicMaterial color="#66b3ff" />
            </mesh>
            <mesh position={[-8, -0.5, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[4, 10]} />
              <meshBasicMaterial color="#3399ff" />
            </mesh>
            <mesh position={[8, -0.5, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[4, 10]} />
              <meshBasicMaterial color="#3399ff" />
            </mesh>
          </group>
        ))}
      </group>
      <SimpleMan position={[0, 0, -5]} rotation={[0, Math.PI, 0]} />
    </group>
  );
};

export const CloneScene = ({ audioRef }) => {
  const [time, setTime] = useState(0);

  useFrame(() => {
    if (audioRef && audioRef.current) {
      setTime(audioRef.current.currentTime);
    }
  });

  return (
    <>
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />

      {time > 0 && time < 4.5 && <ParticleChaos />}
      {time >= 7.5 && time < 12 && <PillarsScene />}
      {time >= 12 && time < 16.5 && <StripedPathScene />}
    </>
  );
};
