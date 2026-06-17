import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const CloneOverlay = ({ playing, audioRef }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      if (audioRef && audioRef.current) {
        setTime(audioRef.current.currentTime);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [playing, audioRef]);

  if (!playing) return null;

  return (
    <div className="overlay-container">
      <AnimatePresence>
        {time >= 4.5 && time < 7.5 && (
          <motion.div
            key="what"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="promo-text"
          >
            what<br />
            did <span className="text-outline">find?</span><br />
            you
          </motion.div>
        )}
        
        {time >= 7.5 && time < 12 && (
          <motion.div
            key="found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="promo-text"
            style={{ fontSize: '10vw', left: '10%', top: '30%', textAlign: 'left' }}
          >
            i found <span style={{color: '#000'}}>a <sup style={{fontSize: '3vw', verticalAlign: 'super'}}>place</sup></span>
          </motion.div>
        )}

        {time >= 12 && time < 16.5 && (
          <motion.div
            key="sounds"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="promo-text"
            style={{ top: '20%' }}
          >
            but you<br />
            how <span style={{marginLeft: '20px'}}>this</span> <span style={{fontStyle: 'italic', marginLeft: '40px'}}>sounds</span>
          </motion.div>
        )}

        {time >= 16.5 && (
          <motion.div
            key="outro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="outro-text"
          >
            {`/|、\n(˚ˎ 。7  \n|、˜〵          \nじしˍ,)ノ\nby catireel_`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
