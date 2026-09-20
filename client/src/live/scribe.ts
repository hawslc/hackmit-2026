import type { ScribeTokenResponse, TranscriptWord } from "@cadence/shared";

/**
 * Scribe v2 Realtime over a raw WebSocket. We own the MediaStream (shared
 * with the recorder and audio-feature sampler), so we convert mic audio to
 * 16-bit PCM at 16kHz in an AudioWorklet and stream input_audio_chunk
 * messages ourselves instead of using the SDK's built-in mic capture.
 */

const WS_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const PCM_SAMPLE_RATE = 16000;
/** 4096 int16 samples = 8192 bytes = 256ms of audio per chunk. */
const WORKLET_BUFFER_SAMPLES = 4096;
/** After a final commit, wait at most this long for the last committed event. */
const STOP_GRACE_MS = 3000;

const PCM_WORKLET_SRC = `
class Pcm16kSender extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = options.processorOptions.ratio;
    this.inBuf = new Float32Array(0);
    this.pos = 0;
    this.out = new Int16Array(${WORKLET_BUFFER_SAMPLES});
    this.outLen = 0;
    // Flush the partially-filled output buffer when the session ends.
    this.port.onmessage = (e) => {
      if (e.data === 'flush' && this.outLen > 0) {
        this.port.postMessage(this.out.buffer.slice(0, this.outLen * 2));
        this.outLen = 0;
      }
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const merged = new Float32Array(this.inBuf.length + ch.length);
    merged.set(this.inBuf);
    merged.set(ch, this.inBuf.length);
    this.inBuf = merged;
    while (this.pos + this.ratio <= this.inBuf.length) {
      const start = Math.floor(this.pos);
      const end = Math.floor(this.pos + this.ratio);
      let sum = 0;
      for (let i = start; i < end; i++) sum += this.inBuf[i];
      const s = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
      this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.outLen === this.out.length) {
        this.port.postMessage(this.out.buffer.slice(0));
        this.outLen = 0;
      }
      this.pos += this.ratio;
    }
    const consumed = Math.floor(this.pos);
    this.inBuf = this.inBuf.subarray(consumed);
    this.pos -= consumed;
    return true;
  }
}
registerProcessor('pcm-16k-sender', Pcm16kSender);
`;

export interface ScribeHandlers {
  /** Live, still-changing transcript for the current segment. */
  onPartial?: (text: string) => void;
  /** Final text for a segment plus its word-level timestamps. */
  onCommitted?: (text: string, words: TranscriptWord[]) => void;
  onError?: (message: string) => void;
}

export type ScribeState = "idle" | "connecting" | "open" | "closed";

const MAX_RECONNECTS = 1;

export class ScribeRealtime {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private muteGain: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private handlers: ScribeHandlers = {};
  private intentionalClose = false;
  private reconnects = 0;
  private streaming = false;
  private finalEventResolve: (() => void) | null = null;
  /** Word timestamps restart at 0 per socket; offset keeps them
   *  session-relative across a reconnect. */
  private wordTimeOffset = 0;
  private lastWordEnd = 0;
  state: ScribeState = "idle";

  async connect(stream: MediaStream, handlers: ScribeHandlers): Promise<void> {
    if (this.state === "open" || this.state === "connecting") {
      throw new Error("ScribeRealtime already connected");
    }
    this.state = "connecting";
    this.handlers = handlers;
    this.intentionalClose = false;
    this.reconnects = 0;
    this.wordTimeOffset = 0;
    this.lastWordEnd = 0;

    await this.openSocket();
    await this.startPcmPump(stream);
    this.streaming = true;
    this.state = "open";
  }

  /** Opens the WebSocket and resolves once Scribe confirms session_started. */
  private async openSocket(): Promise<void> {
    const token = await fetchScribeToken();
    const ws = new WebSocket(`${WS_URL}?${scribeParams(token)}`);
    this.ws = ws;

    ws.onmessage = (e) => this.handleMessage(e.data as string, this.handlers);
    ws.onerror = (e) => {
      console.warn("[scribe] WebSocket error event", e);
    };
    ws.onclose = (e) => {
      if (ws !== this.ws) return; // stale socket from before a reconnect
      this.state = "closed";
      if (e.code === 1000 || e.code === 1005 || this.intentionalClose) return;
      console.warn("[scribe] WebSocket closed", e.code, e.reason);
      if (this.reconnects < MAX_RECONNECTS) {
        this.reconnects++;
        this.wordTimeOffset = this.lastWordEnd + 0.1;
        this.state = "connecting";
        this.openSocket()
          .then(() => {
            this.state = "open";
            console.warn("[scribe] reconnected");
          })
          .catch((err: Error) =>
            this.handlers.onError?.(`reconnect failed: ${err.message}`),
          );
      } else {
        this.handlers.onError?.(
          `connection closed (${e.code})${e.reason ? `: ${e.reason}` : ""}`,
        );
      }
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("timed out waiting for Scribe session")),
        10_000,
      );
      const prev = ws.onmessage;
      ws.onmessage = (e) => {
        const msg = safeParse(e.data as string);
        if (msg?.message_type === "session_started") {
          window.clearTimeout(timeout);
          ws.onmessage = prev;
          resolve();
          return;
        }
        if (msg && isErrorType(msg.message_type)) {
          window.clearTimeout(timeout);
          reject(new Error(errorText(msg)));
          return;
        }
        prev?.call(ws, e);
      };
    });
  }

  private handleMessage(raw: string, handlers: ScribeHandlers): void {
    const msg = safeParse(raw);
    if (!msg) return;
    switch (msg.message_type) {
      case "partial_transcript":
        handlers.onPartial?.(stringField(msg, "text"));
        break;
      case "committed_transcript":
        handlers.onCommitted?.(stringField(msg, "text"), []);
        this.finalEventResolve?.();
        break;
      case "committed_transcript_with_timestamps": {
        const words = parseWords(msg.words).map((w) => ({
          ...w,
          start: w.start + this.wordTimeOffset,
          end: w.end + this.wordTimeOffset,
        }));
        if (words.length) this.lastWordEnd = words[words.length - 1]!.end;
        handlers.onCommitted?.(stringField(msg, "text"), words);
        this.finalEventResolve?.();
        break;
      }
      default:
        if (isErrorType(msg.message_type)) handlers.onError?.(errorText(msg));
    }
  }

  private async startPcmPump(stream: MediaStream): Promise<void> {
    // Native-rate context: forcing a 16kHz context can degrade the shared mic
    // chain that MediaRecorder records from. The worklet downsamples to 16k.
    this.ctx = new AudioContext();
    const workletUrl = URL.createObjectURL(
      new Blob([PCM_WORKLET_SRC], { type: "text/javascript" }),
    );
    await this.ctx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    this.source = this.ctx.createMediaStreamSource(stream);
    this.worklet = new AudioWorkletNode(this.ctx, "pcm-16k-sender", {
      processorOptions: { ratio: this.ctx.sampleRate / PCM_SAMPLE_RATE },
    });
    this.worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.streaming && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: toBase64(new Uint8Array(e.data)),
            commit: false,
            sample_rate: PCM_SAMPLE_RATE,
          }),
        );
      }
    };

    // The worklet must be wired into the destination graph to be pulled;
    // a zero gain keeps the mic from echoing through the speakers.
    this.muteGain = this.ctx.createGain();
    this.muteGain.gain.value = 0;
    this.source.connect(this.worklet);
    this.worklet.connect(this.muteGain);
    this.muteGain.connect(this.ctx.destination);
  }

  /**
   * Flushes the worklet's partial buffer, then pushes ~2s of silence so the
   * VAD commits the final segment (manual `commit` is rejected under the
   * `vad` commit strategy), waits for the last committed event, and closes.
   */
  async stop(): Promise<void> {
    this.intentionalClose = true;
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.worklet?.port.postMessage("flush");
      // Give the flushed buffer a beat to send, then stop the mic pump so the
      // silence burst below arrives contiguous — interleaved mic chunks would
      // keep resetting the VAD and the final segment would never commit.
      await new Promise((r) => window.setTimeout(r, 100));
      this.streaming = false;
      const finalEvent = new Promise<void>((resolve) => {
        this.finalEventResolve = resolve;
        window.setTimeout(resolve, STOP_GRACE_MS);
      });
      this.sendSilence(2);
      await finalEvent;
      this.finalEventResolve = null;
      ws.close();
    } else {
      ws?.close();
    }
    await this.teardownAudio();
    this.state = "closed";
  }

  private sendSilence(seconds: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const chunkBytes = WORKLET_BUFFER_SAMPLES * 2;
    const silent = toBase64(new Uint8Array(chunkBytes));
    const chunks = Math.ceil((seconds * PCM_SAMPLE_RATE * 2) / chunkBytes);
    for (let i = 0; i < chunks; i++) {
      this.ws.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: silent,
          commit: false,
          sample_rate: PCM_SAMPLE_RATE,
        }),
      );
    }
  }

  private async teardownAudio(): Promise<void> {
    this.worklet?.port.close();
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.muteGain?.disconnect();
    await this.ctx?.close();
    this.worklet = null;
    this.source = null;
    this.muteGain = null;
    this.ctx = null;
    this.ws = null;
  }
}

async function fetchScribeToken(): Promise<string> {
  const res = await fetch("/api/scribe-token");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`scribe-token failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const { token } = (await res.json()) as ScribeTokenResponse;
  return token;
}

function scribeParams(token: string): string {
  return new URLSearchParams({
    model_id: "scribe_v2_realtime",
    token,
    audio_format: `pcm_${PCM_SAMPLE_RATE}`,
    sample_rate: String(PCM_SAMPLE_RATE),
    commit_strategy: "vad",
    vad_silence_threshold_secs: "1.5",
    include_timestamps: "true",
    language_code: "eng",
  }).toString();
}

function parseWords(raw: unknown): TranscriptWord[] {
  if (!Array.isArray(raw)) return [];
  const words: TranscriptWord[] = [];
  for (const w of raw) {
    if (
      w &&
      typeof w === "object" &&
      typeof (w as Record<string, unknown>).text === "string" &&
      typeof (w as Record<string, unknown>).start === "number" &&
      typeof (w as Record<string, unknown>).end === "number" &&
      (w as Record<string, unknown>).type !== "spacing" &&
      (w as Record<string, unknown>).text!.toString().trim() !== ""
    ) {
      words.push({
        text: (w as { text: string }).text,
        start: (w as { start: number }).start,
        end: (w as { end: number }).end,
      });
    }
  }
  return words;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringField(msg: Record<string, unknown>, key: string): string {
  const v = msg[key];
  return typeof v === "string" ? v : "";
}

function isErrorType(t: unknown): boolean {
  return typeof t === "string" && (t === "error" || t.endsWith("_error"));
}

function errorText(msg: Record<string, unknown>): string {
  const detail = msg.error ?? msg.message ?? msg.message_type;
  return `Scribe: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
}
