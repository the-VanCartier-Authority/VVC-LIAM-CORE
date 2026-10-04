import { KOKORO_VOICES, type KokoroVoiceId } from '../types';

// Web Speech API Types
type SpeechRecognitionInstance = any;

let recognitionInstance: SpeechRecognitionInstance | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let micStream: MediaStream | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Play a high-tech synthesized cybernetic acoustic feedback sound
 */
export function playCyberTone(type: 'activate' | 'confirm' | 'alert' | 'alarm' | 'click') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'activate') {
      // Ascending futuristic chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'confirm') {
      // Harmonic dual ping
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(987.77, now + 0.08); // B5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'alert') {
      // Warning double tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(280, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'alarm') {
      // Siren warble
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.2);
      osc.frequency.linearRampToValueAtTime(880, now + 0.4);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Subtle console click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (err) {
    console.debug('Audio context sound playback ignored:', err);
  }
}

/**
 * Initialize microphone analyzer for real-time waveform visualization
 */
export async function setupMicrophoneAnalyzer(): Promise<AnalyserNode | null> {
  try {
    const ctx = getAudioContext();
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    const source = ctx.createMediaStreamSource(micStream);
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    source.connect(analyserNode);
    return analyserNode;
  } catch (err) {
    console.warn('Microphone stream access not granted for waveform visualizer:', err);
    return null;
  }
}

export function stopMicrophoneAnalyzer() {
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  analyserNode = null;
}

/**
 * Speech to Text (STT) Controller
 */
export function initSpeechRecognition(callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStart: () => void;
  onEnd: () => void;
}): { start: () => void; stop: () => void; isSupported: boolean } {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return {
      start: () => callbacks.onError('El navegador no soporta Web Speech API. Usa entrada por texto.'),
      stop: () => {},
      isSupported: false,
    };
  }

  if (!recognitionInstance) {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'es-ES';
  }

  recognitionInstance.onstart = () => {
    playCyberTone('activate');
    callbacks.onStart();
  };

  recognitionInstance.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript.trim()) {
      callbacks.onResult(finalTranscript.trim(), true);
    } else if (interimTranscript.trim()) {
      callbacks.onResult(interimTranscript.trim(), false);
    }
  };

  recognitionInstance.onerror = (event: any) => {
    console.warn('SpeechRecognition error:', event.error);
    callbacks.onError(event.error);
  };

  recognitionInstance.onend = () => {
    callbacks.onEnd();
  };

  return {
    start: () => {
      try {
        recognitionInstance?.start();
      } catch (e) {
        console.debug('Recognition already running:', e);
      }
    },
    stop: () => {
      try {
        recognitionInstance?.stop();
      } catch (e) {
        console.debug('Recognition already stopped:', e);
      }
    },
    isSupported: true,
  };
}

/**
 * Kokoro Realistic Voice Engine (TTS)
 * Implements realistic speech rendering with configurable Kokoro profiles
 */
export function speakKokoro(
  text: string,
  voiceId: KokoroVoiceId = 'es_mateo',
  options: {
    pitchModifier?: number;
    rateModifier?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
  } = {}
) {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser.');
    return;
  }

  window.speechSynthesis.cancel();

  // Find Kokoro profile
  const profile = KOKORO_VOICES.find((v) => v.id === voiceId) || KOKORO_VOICES[0];

  // Clean markdown / console symbols from text before speaking
  const cleanText = text
    .replace(/\[\w+\]/g, '') // remove tags like [EXEC], [E2EE]
    .replace(/[#*_`~>]/g, '') // remove markdown symbols
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Apply Kokoro profile settings
  utterance.pitch = (profile.pitch || 1.0) * (options.pitchModifier || 1.0);
  utterance.rate = (profile.rate || 1.0) * (options.rateModifier || 1.0);
  utterance.volume = options.volume !== undefined ? options.volume / 100 : 0.9;

  // Select optimal browser voice matching language & gender
  const voices = window.speechSynthesis.getVoices();
  const targetLang = profile.language === 'Español' ? 'es' : 'en';

  // Find best matching voice
  const matchedVoice =
    voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(targetLang) &&
        (profile.gender === 'Femenina'
          ? /female|muj|monica|helena|zira|samantha|victoria|karen/i.test(v.name)
          : /male|hom|jorge|pablo|david|mark|alex|daniel/i.test(v.name))
    ) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(targetLang)) ||
    voices[0];

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onstart = () => {
    if (options.onStart) options.onStart();
  };

  utterance.onend = () => {
    if (options.onEnd) options.onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('SpeechSynthesisUtterance error:', e);
    if (options.onEnd) options.onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
