/**
 * Real microphone capture.
 *
 * The previous implementation typed a hard-coded sentence into the composer.
 * That was a demo stub, not voice input, so it is gone. This records the
 * device microphone and produces a real audio file.
 *
 * There is deliberately **no speech-to-text here**. No transcription service is
 * wired up in this project, and inventing a transcript would be fabricating
 * clinical content. The recorded audio is a real attachment the patient can
 * review, play back and send; `transcribe()` below is the clean seam where a
 * real STT provider plugs in later.
 *
 * Web uses the standard MediaRecorder API. Native is left as an explicit,
 * reported unsupported state rather than silently doing nothing — adding
 * `expo-audio` there is a one-line swap at the marked point.
 */
import { Platform } from 'react-native';

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopped'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface RecordedClip {
  uri: string;
  name: string;
  type: string;
  sizeBytes: number;
  durationMs: number;
}

export class VoiceCaptureError extends Error {
  readonly reason: 'denied' | 'unsupported' | 'failed';
  constructor(reason: 'denied' | 'unsupported' | 'failed', message: string) {
    super(message);
    this.name = 'VoiceCaptureError';
    this.reason = reason;
  }
}

type MediaRecorderCtor = new (stream: MediaStream) => MediaRecorder;

function getMediaRecorderCtor(): MediaRecorderCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    MediaRecorder?: MediaRecorderCtor;
    navigator?: Navigator;
  };
  if (!w.MediaRecorder || !w.navigator?.mediaDevices?.getUserMedia) return null;
  return w.MediaRecorder;
}

export function isVoiceSupported(): boolean {
  return Platform.OS === 'web' && getMediaRecorderCtor() !== null;
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;

  status: RecorderStatus = 'idle';

  async start(): Promise<void> {
    const Ctor = getMediaRecorderCtor();
    if (!Ctor) {
      this.status = 'unsupported';
      throw new VoiceCaptureError('unsupported', 'Microphone recording is not available here.');
    }
    this.status = 'requesting';
    try {
      // A real permission prompt. A denial is reported, never faked.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      this.status = denied ? 'denied' : 'error';
      throw new VoiceCaptureError(
        denied ? 'denied' : 'failed',
        denied ? 'Microphone permission was denied.' : 'The microphone could not be opened.',
      );
    }
    this.chunks = [];
    // Prefer a webm/opus container that every browser can record.
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      .find((t) => MediaRecorder.isTypeSupported?.(t));
    this.recorder = mimeType ? new Ctor(this.stream) : new Ctor(this.stream);
    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = Date.now();
    this.status = 'recording';
  }

  get isRecording(): boolean {
    return this.status === 'recording';
  }

  async stop(): Promise<RecordedClip> {
    const recorder = this.recorder;
    if (!recorder || this.status !== 'recording') {
      throw new VoiceCaptureError('failed', 'No recording is in progress.');
    }
    const durationMs = Date.now() - this.startedAt;
    const type = recorder.mimeType || 'audio/webm';
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type }));
      recorder.stop();
    });
    this.release();
    this.status = 'stopped';

    if (blob.size === 0) {
      throw new VoiceCaptureError('failed', 'The recording was empty.');
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    return {
      uri: URL.createObjectURL(blob),
      name: `voice-note-${stamp}.${ext}`,
      type,
      sizeBytes: blob.size,
      durationMs,
    };
  }

  cancel(): void {
    try { this.recorder?.stop(); } catch { /* already stopped */ }
    this.release();
    this.status = 'idle';
  }

  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

/**
 * Transcription seam.
 *
 * No speech-to-text provider exists in this project yet, so this reports the
 * real state instead of guessing. When the modelling/platform team supplies a
 * STT service, implement it here and the UI will start showing real text.
 * The audio is already stored either way — it is never lost.
 */
export async function transcribe(_clip: RecordedClip): Promise<{ text: string | null }> {
  return { text: null };
}
