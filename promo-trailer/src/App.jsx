import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CloneScene } from './components/CloneScene';
import { CloneOverlay } from './components/CloneOverlay';

function App() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('/nineteen.mp3');
    // Ensure we don't loop for a timed sequence video
    audioRef.current.loop = false;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleStart = () => {
    if (audioRef.current && !playing) {
      audioRef.current.play().then(() => {
        setPlaying(true);
      }).catch(err => {
        console.error("Audio playback failed:", err);
        setPlaying(true);
      });
    }
  };

  return (
    <>
      <div className={`start-screen ${playing ? 'hidden' : ''}`} onClick={handleStart}>
        <button className="start-btn">PLAY VIDEO</button>
      </div>

      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        {playing && <CloneScene audioRef={audioRef} />}
      </Canvas>

      <CloneOverlay playing={playing} audioRef={audioRef} />
    </>
  );
}

export default App;
