import React, { useEffect, useState } from 'react';
import { Overlay } from './components/overlay/Overlay';
import { useAudioRecording } from './hooks/useAudioRecording';
import type { OverlayState } from '../shared/types';

export default function OverlayApp() {
  const [state, setState] = useState<OverlayState>('idle');
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const {
    isRecording,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecording({
    onAudioData: (data) => {
      // Send audio data back to main process
      window.murmur.sendAudioData(data);
    },
    onError: (err) => {
      window.murmur.sendRecordingError(err.message);
    },
  });

  // Listen for commands from main process
  useEffect(() => {
    const unsubStart = window.murmur.onRecordingStart(() => {
      startRecording();
      window.murmur.sendRecordingStarted();
    });

    const unsubStop = window.murmur.onRecordingStop(() => {
      stopRecording();
    });

    const unsubCancel = window.murmur.onRecordingCancel(() => {
      cancelRecording();
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubCancel();
    };
  }, [startRecording, stopRecording, cancelRecording]);

  // Listen for overlay state updates
  useEffect(() => {
    const unsub = window.murmur.onOverlayUpdate((data) => {
      setState(data.state as OverlayState);
      if (data.wordCount !== undefined) {
        setWordCount(data.wordCount as number);
      }
      if (data.error !== undefined) {
        setError(data.error as string);
      }
    });

    return unsub;
  }, []);

  // Send audio level updates
  useEffect(() => {
    if (isRecording && audioLevel) {
      window.murmur.sendAudioLevel(audioLevel);
    }
  }, [isRecording, audioLevel]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
    }}>
      <Overlay
        state={state}
        duration={duration}
        wordCount={wordCount}
        error={error}
        audioLevel={audioLevel}
      />
    </div>
  );
}
