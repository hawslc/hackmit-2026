const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/**
 * MediaRecorder over the shared mic stream. Produces a Blob for in-browser
 * playback on the review screen; the recording is never uploaded.
 */
export class SessionRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "audio/webm";

  start(stream: MediaStream): void {
    this.mimeType =
      MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    this.chunks = [];
    this.recorder = new MediaRecorder(
      stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000);
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(new Blob(this.chunks, { type: this.mimeType }));
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: this.mimeType }));
      };
      recorder.stop();
    });
  }
}
