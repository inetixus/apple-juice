import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  "THE AI CODE PARTNER",
  "FOR ROBLOX DEVELOPERS",
  "GENERATE. FIX. SHIP.",
  <span key="aj">APPLE <span className="accent">JUICE</span></span>
];

export const Overlay = ({ playing }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [playing]);

  if (!playing) return null;

  return (
    <div className="overlay-container">
      <div className="vignette"></div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -50, filter: 'blur(20px)', transition: { duration: 0.5 } }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="promo-text"
          style={{ position: 'absolute', top: '10%' }}
        >
          {messages[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
