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
 * Robust implementation with fresh instance per session, silence debounce, and auto-commit
 */
export function initSpeechRecognition(callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStart: () => void;
  onEnd: () => void;
}): { start: () => void; stop: () => void; abort: () => void; isSupported: boolean } {
  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return {
      start: () => callbacks.onError('El navegador no soporta reconocimiento de voz (Web Speech API).'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  let activeRecognition: any = null;
  let silenceTimer: any = null;
  let accumulatedTranscript = '';
  let hasCommitted = false;

  const clearSilence = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const commitTranscript = (finalText: string) => {
    clearSilence();
    if (hasCommitted) return;
    const text = finalText.trim();
    if (text) {
      hasCommitted = true;
      callbacks.onResult(text, true);
    }
  };

  const stopActive = () => {
    clearSilence();
    if (activeRecognition) {
      try {
        activeRecognition.stop();
      } catch {}
      activeRecognition = null;
    }
  };

  return {
    start: () => {
      stopActive();
      hasCommitted = false;
      accumulatedTranscript = '';

      try {
        const recognition = new SpeechRecognitionClass();
        activeRecognition = recognition;

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // Default to user language if Spanish, otherwise es-ES
        const userLang = (navigator.language || '').toLowerCase();
        recognition.lang = userLang.startsWith('es') ? navigator.language : 'es-ES';

        recognition.onstart = () => {
          playCyberTone('activate');
          callbacks.onStart();
        };

        recognition.onresult = (event: any) => {
          let currentFinal = '';
          let currentInterim = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              currentFinal += transcript;
            } else {
              currentInterim += transcript;
            }
          }

          const currentBest = (currentFinal || currentInterim).trim();
          if (currentBest) {
            accumulatedTranscript = currentBest;
            callbacks.onResult(currentBest, false);

            // Silence debounce timer: commit after 1.2s of no new speech
            clearSilence();
            silenceTimer = setTimeout(() => {
              if (accumulatedTranscript.trim() && !hasCommitted) {
                commitTranscript(accumulatedTranscript);
                stopActive();
              }
            }, 1200);
          }

          if (currentFinal.trim()) {
            commitTranscript(currentFinal);
            stopActive();
          }
        };

        recognition.onerror = (event: any) => {
          clearSilence();
          const errorType = event.error;
          console.warn('SpeechRecognition error:', errorType);

          if (errorType === 'no-speech') {
            if (accumulatedTranscript.trim() && !hasCommitted) {
              commitTranscript(accumulatedTranscript);
              return;
            }
          }

          if (errorType === 'not-allowed' || errorType === 'permission-denied') {
            callbacks.onError('Permiso de micrófono no concedido. Permite el micrófono en la barra de direcciones.');
          } else if (errorType !== 'aborted') {
            callbacks.onError(errorType || 'Error de micrófono');
          }
        };

        recognition.onend = () => {
          clearSilence();
          if (accumulatedTranscript.trim() && !hasCommitted) {
            commitTranscript(accumulatedTranscript);
          }
          activeRecognition = null;
          callbacks.onEnd();
        };

        recognition.start();
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        callbacks.onError('No se pudo activar el micrófono.');
        callbacks.onEnd();
      }
    },
    stop: () => {
      clearSilence();
      if (accumulatedTranscript.trim() && !hasCommitted) {
        commitTranscript(accumulatedTranscript);
      }
      stopActive();
    },
    abort: () => {
      clearSilence();
      hasCommitted = true;
      if (activeRecognition) {
        try {
          activeRecognition.abort();
        } catch {}
        activeRecognition = null;
      }
    },
    isSupported: true,
  };
}

let activeAudioElement: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Preprocess and humanize text for Kokoro speech
 * Expands technical abbreviations and normalizes cadence
 */
function humanizeTextForKokoro(rawText: string): string {
  let text = rawText
    .replace(/\[(?:EXEC|E2EE|ALERTA|NOTIF|DISPOSITIVO|CALENDARIO|TAREA)\]/gi, '')
    .replace(/\[\w+[^\]]*\]/g, '')
    .replace(/[`*_~#<>]/g, '')
    .replace(/https?:\/\/\S+/g, 'enlace web')
    .replace(/\bVVC-ACIA\b/gi, 'V V C Asía')
    .replace(/\bE2EE\b/gi, 'cifrado total')
    .replace(/\bNVIDIA\b/gi, 'Envidia')
    .replace(/\bNIM\b/gi, 'N I M')
    .replace(/\bAPI\b/gi, 'A P I')
    .replace(/\bGPS\b/gi, 'G P S')
    .replace(/\bWPA3\b/gi, 'W P A 3')
    .replace(/\bTTS\b/gi, 'voz')
    .replace(/\bAI\b/gi, 'inteligencia artificial')
    .replace(/([.!?])\s*/g, '$1 ')
    .replace(/([,;:])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Asynchronously fetch voices, waiting for browser voiceschanged if needed
 */
function getLoadedVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      cachedVoices = current;
      resolve(current);
      return;
    }

    const onVoicesChanged = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(v);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Timeout fallback after 600ms
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 600);
  });
}

/**
 * Select the highest-fidelity natural voice matching language and profile
 */
function selectOptimalVoice(
  voices: SpeechSynthesisVoice[],
  targetLang: string,
  gender: 'Femenina' | 'Masculina'
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Filter by language prefix
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
  const candidatePool = langVoices.length > 0 ? langVoices : voices;

  const isFemale = (name: string) =>
    /female|muj|monica|mónica|helena|zira|samantha|victoria|karen|elvira|paulina|sabina|sofia|sofía|laura|lucia|lucía|carmen/i.test(
      name
    );
  const isMale = (name: string) =>
    /male|hom|jorge|pablo|david|mark|alex|daniel|alvaro|álvaro|raul|raúl|enrique|carlos|diego|mateo|manuel/i.test(
      name
    );

  // 1st Priority: Natural / Neural voices with matching gender
  const naturalVoices = candidatePool.filter((v) =>
    /natural|neural|online|premium|enhanced|multilingual|studio/i.test(v.name)
  );

  const naturalGenderMatch = naturalVoices.find((v) =>
    gender === 'Femenina' ? isFemale(v.name) : isMale(v.name)
  );
  if (naturalGenderMatch) return naturalGenderMatch;

  // 2nd Priority: Any Natural / Neural voice in the language
  if (naturalVoices.length > 0) return naturalVoices[0];

  // 3rd Priority: Standard voice matching gender
  const standardGenderMatch = candidatePool.find((v) =>
    gender === 'Femenina' ? isFemale(v.name) : isMale(v.name)
  );
  if (standardGenderMatch) return standardGenderMatch;

  // 4th Priority: First voice in language
  return candidatePool[0] || voices[0];
}

/**
 * High-realism on-device Kokoro Voice synthesis
 */
async function speakWithKokoroEngine(
  cleanText: string,
  voiceId: KokoroVoiceId,
  options: {
    pitchModifier?: number;
    rateModifier?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (!('speechSynthesis' in window)) {
    if (options.onEnd) options.onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const profile = KOKORO_VOICES.find((v) => v.id === voiceId) || KOKORO_VOICES[0];
  const voices = await getLoadedVoices();
  const targetLang = profile.language === 'Español' ? 'es' : 'en';

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Apply Kokoro acoustic contouring
  const basePitch = profile.pitch || (profile.gender === 'Femenina' ? 1.1 : 0.92);
  const baseRate = profile.rate || 1.02;

  utterance.pitch = Math.max(0.7, Math.min(1.4, basePitch * (options.pitchModifier || 1.0)));
  utterance.rate = Math.max(0.75, Math.min(1.35, baseRate * (options.rateModifier || 1.0)));
  utterance.volume = options.volume !== undefined ? Math.min(Math.max(options.volume / 100, 0), 1) : 0.95;

  const matchedVoice = selectOptimalVoice(voices, targetLang, profile.gender);
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
    console.warn('SpeechSynthesis error:', e);
    if (options.onEnd) options.onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * High-Fidelity Kokoro Voice Engine
 * Tries server-side neural TTS first; if unavailable, uses high-realism on-device engine
 */
async function playBase64WithWebAudio(
  base64Data: string,
  options: { volume?: number; onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  const ctx = getAudioContext();
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();

  source.buffer = audioBuffer;
  const vol = options.volume !== undefined ? Math.min(Math.max(options.volume / 100, 0), 1) : 0.95;
  gainNode.gain.setValueAtTime(vol, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  if (options.onStart) options.onStart();
  source.onended = () => {
    if (options.onEnd) options.onEnd();
  };
  source.start(0);
}

export async function speakKokoro(
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
  // Cancel previous speech immediately
  stopSpeaking();

  const cleanText = humanizeTextForKokoro(text);
  if (!cleanText) {
    if (options.onEnd) options.onEnd();
    return;
  }

  // 1. Try server neural TTS with an 8s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voiceId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.audio && !data.fallback) {
        const mime = data.mimeType || 'audio/mp3';
        const audioSrc = `data:${mime};base64,${data.audio}`;
        const audio = new Audio(audioSrc);
        activeAudioElement = audio;
        audio.volume = options.volume !== undefined ? Math.min(Math.max(options.volume / 100, 0), 1) : 0.95;

        audio.onplay = () => {
          if (options.onStart) options.onStart();
        };

        audio.onended = () => {
          activeAudioElement = null;
          if (options.onEnd) options.onEnd();
        };

        audio.onerror = async (e) => {
          console.warn('Audio tag playback notice, attempting Web Audio decoding:', e);
          try {
            await playBase64WithWebAudio(data.audio, options);
          } catch (webAudioErr) {
            console.warn('Web Audio playback failed, using fallback engine:', webAudioErr);
            activeAudioElement = null;
            speakWithKokoroEngine(cleanText, voiceId, options);
          }
        };

        await audio.play();
        return;
      }
    }
  } catch (err) {
    // Network timeout or offline - seamlessly proceed to Kokoro engine
  }

  // Fallback to on-device engine
  speakWithKokoroEngine(cleanText, voiceId, options);
}

export function stopSpeaking() {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
