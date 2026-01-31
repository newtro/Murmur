import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { AudioLevel } from '../../../shared/types';

interface WaveformProps {
  audioLevel: AudioLevel | null;
}

const BAR_COUNT = 20;

export function Waveform({ audioLevel }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(BAR_COUNT).fill(0.1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / BAR_COUNT) * 0.7;
      const gap = (width / BAR_COUNT) * 0.3;

      // Update bars based on audio level
      const level = audioLevel?.level ?? 0;
      const targetBars = generateBars(level);

      // Smooth transition
      for (let i = 0; i < BAR_COUNT; i++) {
        barsRef.current[i] = barsRef.current[i] * 0.7 + targetBars[i] * 0.3;
      }

      // Draw bars
      for (let i = 0; i < BAR_COUNT; i++) {
        const barHeight = Math.max(2, barsRef.current[i] * height * 0.8);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        // Gradient based on height
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 1)'); // red-500
        gradient.addColorStop(0.5, 'rgba(249, 115, 22, 1)'); // orange-500
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.6)'); // red-500/60

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center"
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={24}
        className="w-[100px] h-6"
      />
    </motion.div>
  );
}

function generateBars(level: number): number[] {
  const bars: number[] = [];
  const centerIndex = Math.floor(BAR_COUNT / 2);

  for (let i = 0; i < BAR_COUNT; i++) {
    // Create a wave pattern that's taller in the middle
    const distanceFromCenter = Math.abs(i - centerIndex) / centerIndex;
    const baseHeight = (1 - distanceFromCenter * 0.5) * level;

    // Add some randomness for visual interest
    const randomFactor = 0.3 + Math.random() * 0.7;
    bars.push(Math.max(0.1, baseHeight * randomFactor));
  }

  return bars;
}
