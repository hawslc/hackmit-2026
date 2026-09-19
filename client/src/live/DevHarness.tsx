import { useEffect, useRef, useState } from 'react';
import { usePracticeSession } from './usePracticeSession';

/**
 * DEV-ONLY scratch page for the live capture pipeline.
 * TODO(ux): replace with the real Practice screen — consume the same
 * usePracticeSession() hook and render `live` however the design wants.
 */
export function DevHarness() {
  const { phase, live, session, error, start, finish } = usePracticeSession();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (session?.recording) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(session.recording);
      urlRef.current = url;
      setPlaybackUrl(url);
    }
  }, [session]);

  const m = live?.metrics;

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, maxWidth: 720 }}>
      <h1>live capture dev harness</h1>
      <p>phase: {phase}</p>
      {error && <p style={{ color: 'red' }}>error: {error}</p>}

      <button
        onClick={() => void start()}
        disabled={phase === 'starting' || phase === 'recording'}
      >
        Start practice
      </button>
      <button onClick={() => void finish()} disabled={phase !== 'recording'}>
        Finish
      </button>

      {m && (
        <pre>
          {JSON.stringify(
            {
              wpm: m.wpm,
              fillersPerMin: m.fillersPerMin,
              pauses: m.pauseCount,
              pitchHz: live?.instant.pitchHz?.toFixed(0) ?? '—',
              rms: live?.instant.rms.toFixed(3),
              score: live?.score.overall,
              components: live?.score.components,
            },
            null,
            2,
          )}
        </pre>
      )}

      {(live?.transcript || live?.partial) && (
        <p>
          {live.transcript} <em>{live.partial}</em>
        </p>
      )}

      {session && (
        <>
          <h2>completed session</h2>
          <pre>
            {JSON.stringify(
              { ...session.metrics, pauses: `${session.metrics.pauses.length} kept` },
              null,
              2,
            )}
          </pre>
          <p>
            first words:{' '}
            {session.words
              .slice(0, 5)
              .map((w) => `${w.text}@${w.start.toFixed(1)}s`)
              .join(', ') || '—'}
          </p>
          <p>{session.transcript}</p>
          {playbackUrl && <audio controls src={playbackUrl} />}
        </>
      )}
    </div>
  );
}
