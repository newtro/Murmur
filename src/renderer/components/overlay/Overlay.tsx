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
    <div className="fixed inset-0 flex items-end justify-center pb-8 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-900/90 backdrop-blur-xl rounded-full px-6 py-3 shadow-2xl border border-gray-700/50 pointer-events-auto"
        >
          <div className="flex items-center gap-4">
            <StatusIcon state={state} />
            <StatusContent
              state={state}
              duration={duration}
              wordCount={wordCount}
              error={error}
              audioLevel={audioLevel}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatusIcon({ state }: { state: OverlayState }) {
  switch (state) {
    case 'listening':
      return (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-red-500"
        >
          <Mic size={20} />
        </motion.div>
      );
    case 'processing':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-blue-400"
        >
          <Loader2 size={20} />
        </motion.div>
      );
    case 'complete':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-green-400"
        >
          <Check size={20} />
        </motion.div>
      );
    case 'error':
      return (
        <motion.div className="text-yellow-400">
          <AlertCircle size={20} />
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
  switch (state) {
    case 'listening':
      return (
        <div className="flex items-center gap-3">
          <Waveform audioLevel={audioLevel} />
          <span className="text-white/80 text-sm font-medium tabular-nums min-w-[40px]">
            {formatDuration(duration)}
          </span>
        </div>
      );
    case 'processing':
      return (
        <span className="text-white/80 text-sm">Processing...</span>
      );
    case 'complete':
      return (
        <span className="text-white/80 text-sm">
          Inserted {wordCount} words
        </span>
      );
    case 'error':
      return (
        <span className="text-yellow-200 text-sm">
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
