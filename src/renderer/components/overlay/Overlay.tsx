import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waveform } from './Waveform';
import { Mic, Loader2, Check, AlertCircle } from 'lucide-react';
import type { OverlayState, AudioLevel } from '../../../shared/types';

interface OverlayProps {
  state: OverlayState;
  duration: number;
  wordCount: number;
  error: string | null;
  audioLevel: AudioLevel | null;
}

export function Overlay({ state, duration, wordCount, error, audioLevel }: OverlayProps) {
  if (state === 'idle') {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 5, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          background: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '9999px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <StatusIcon state={state} />
        <StatusContent
          state={state}
          duration={duration}
          wordCount={wordCount}
          error={error}
          audioLevel={audioLevel}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function StatusIcon({ state }: { state: OverlayState }) {
  const iconStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  switch (state) {
    case 'listening':
      return (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ color: '#ef4444', ...iconStyle }}
        >
          <Mic size={18} />
        </motion.div>
      );
    case 'processing':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            ...iconStyle,
          }}
        >
          <Loader2 size={18} style={{ display: 'block' }} />
        </motion.div>
      );
    case 'complete':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ color: '#4ade80', ...iconStyle }}
        >
          <Check size={18} />
        </motion.div>
      );
    case 'error':
      return (
        <motion.div style={{ color: '#fbbf24', ...iconStyle }}>
          <AlertCircle size={18} />
        </motion.div>
      );
    default:
      return null;
  }
}

function StatusContent({
  state,
  duration,
  wordCount,
  error,
  audioLevel,
}: {
  state: OverlayState;
  duration: number;
  wordCount: number;
  error: string | null;
  audioLevel: AudioLevel | null;
}) {
  const textStyle = {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties;

  switch (state) {
    case 'listening':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', ...textStyle }}>
          <Waveform audioLevel={audioLevel} />
          <span style={{
            fontVariantNumeric: 'tabular-nums',
            minWidth: '36px',
          }}>
            {formatDuration(duration)}
          </span>
        </div>
      );
    case 'processing':
      return (
        <span style={textStyle}>Processing...</span>
      );
    case 'complete':
      return (
        <span style={textStyle}>
          Inserted {wordCount} words
        </span>
      );
    case 'error':
      return (
        <span style={{ ...textStyle, color: '#fef08a' }}>
          {error || 'An error occurred'}
        </span>
      );
    default:
      return null;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
