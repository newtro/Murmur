import { useCallback, useEffect, useState } from 'react';
import { Overlay } from './components/overlay/Overlay';
import { useAudioRecording } from './hooks/useAudioRecording';
import { useStreamingAudio } from './hooks/useStreamingAudio';
import type { OverlayState } from '../shared/types';

export default function OverlayApp() {
  const [state, setState] = useState<OverlayState>('idle');
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stable callbacks so the recording/streaming hooks don't re-derive
  // their start* functions every render — which would in turn churn the
  // IPC-subscription useEffect below.
  const handleAudioData = useCallback((data: { base64: string; duration: number }) => {
    window.murmur.sendAudioData(data);
  }, []);
  const handleRecordingError = useCallback((err: Error) => {
    window.murmur.sendRecordingError(err.message);
  }, []);

  const {
    isRecording: batchIsRecording,
    audioLevel: batchAudioLevel,
    duration: batchDuration,
    startRecording: startBatchRecording,
    stopRecording: stopBatchRecording,
    cancelRecording: cancelBatchRecording,
  } = useAudioRecording({
    onAudioData: handleAudioData,
    onError: handleRecordingError,
  });

  const {
    isStreaming: liveIsStreaming,
    audioLevel: liveAudioLevel,
    duration: liveDuration,
    startStreaming: startLiveStreaming,
    stopStreaming: stopLiveStreaming,
    cancelStreaming: cancelLiveStreaming,
  } = useStreamingAudio({
    onError: handleRecordingError,
  });

  // Listen for commands from main. Mode is set in main and forwarded as payload —
  // overlay picks the matching capture hook. Depending on the stable useCallback
  // refs from the two hooks (instead of the parent hook objects) prevents this
  // effect from tearing down and resubscribing on every state change.
  useEffect(() => {
    const unsubStart = window.murmur.onRecordingStart((payload) => {
      const mode = payload?.mode ?? 'batch';
      if (mode === 'live') {
        void startLiveStreaming();
      } else {
        void startBatchRecording();
      }
      window.murmur.sendRecordingStarted();
    });

    const unsubStop = window.murmur.onRecordingStop(() => {
      // Whichever was active will be the one with state — call both; the
      // inactive one's stop is a no-op per its own guard.
      void stopLiveStreaming();
      stopBatchRecording();
    });

    const unsubCancel = window.murmur.onRecordingCancel(() => {
      void cancelLiveStreaming();
      cancelBatchRecording();
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubCancel();
    };
  }, [
    startBatchRecording, stopBatchRecording, cancelBatchRecording,
    startLiveStreaming, stopLiveStreaming, cancelLiveStreaming,
  ]);

  // Overlay state updates from main. Reset wordCount when a new session
  // begins so a prior batch's count doesn't leak into a subsequent live
  // session (which doesn't send wordCount).
  useEffect(() => {
    const unsub = window.murmur.onOverlayUpdate((data) => {
      const nextState = data.state as OverlayState;
      if (nextState === 'listening') {
        setWordCount(0);
        setError(null);
      }
      setState(nextState);
      if (data.wordCount !== undefined) {
        setWordCount(data.wordCount as number);
      }
      if (data.error !== undefined) {
        setError(data.error as string);
      }
    });

    return unsub;
  }, []);

  // Send audio level updates for whichever capture path is active.
  const isRecording = batchIsRecording || liveIsStreaming;
  const audioLevel = batchIsRecording ? batchAudioLevel : liveAudioLevel;
  const duration = batchIsRecording ? batchDuration : liveDuration;
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
