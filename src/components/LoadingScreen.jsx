import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

export default function LoadingScreen({ text = "Loading..." }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        gap: '24px'
      }}
    >
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Logo size={42} showWordmark={true} />
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '160px',
          height: '4px',
          background: 'var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <motion.div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--accent)',
              transformOrigin: 'left',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: 'loop',
              ease: 'easeInOut'
            }}
          />
        </div>

        <span style={{ 
          fontFamily: 'var(--font-ui)', 
          fontSize: '13px', 
          fontWeight: 500, 
          color: 'var(--text2)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          {text}
        </span>
      </div>
    </motion.div>
  );
}
