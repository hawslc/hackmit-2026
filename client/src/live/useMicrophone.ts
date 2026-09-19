import { useCallback, useEffect, useRef } from 'react';

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

/**
 * Acquires one MediaStream for the whole practice session. The same stream is
 * fanned out to Scribe, the audio-feature sampler and the MediaRecorder —
 * never call getUserMedia a second time.
 */
export function useMicrophone() {
  const streamRef = useRef<MediaStream | null>(null);

  const acquire = useCallback(async (): Promise<MediaStream> => {
    if (!streamRef.current) {
      try {
        streamRef.current =
          await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      } catch {
        // The device can still be held briefly after a previous session or
        // another tab released it — retry once before surfacing the error.
        await new Promise((r) => setTimeout(r, 600));
        streamRef.current =
          await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      }
    }
    return streamRef.current;
  }, []);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  return { acquire, release };
}
