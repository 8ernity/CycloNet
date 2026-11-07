interface CycloneSpeechRecognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void; stop(): void;
}
interface Window {
  __cyclonet_current_context?: Record<string, unknown>;
  SpeechRecognition?: new () => CycloneSpeechRecognition;
  webkitSpeechRecognition?: new () => CycloneSpeechRecognition;
}
