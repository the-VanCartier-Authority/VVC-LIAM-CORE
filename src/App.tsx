/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { VoiceOrbVisualizer } from './components/VoiceOrbVisualizer';
import { QuickCommandChips } from './components/QuickCommandChips';
import { CommandConsole } from './components/CommandConsole';
import { PhoneActionModal } from './components/PhoneActionModal';
import { MessagingModal } from './components/MessagingModal';
import { ScreenTorchModal } from './components/ScreenTorchModal';
import { DeviceControlsDrawer } from './components/DeviceControlsDrawer';
import { CalendarRemindersModal } from './components/CalendarRemindersModal';
import { EncryptedVaultModal } from './components/EncryptedVaultModal';
import { SettingsModal } from './components/SettingsModal';
import { RealTimeAlertToast } from './components/RealTimeAlertToast';
import { InstallModal } from './components/InstallModal';
import { GmailModal } from './components/GmailModal';
import { GoogleDrivePickerModal } from './components/GoogleDrivePickerModal';
import { GoogleMapsPanel } from './components/GoogleMapsPanel';
import { DocumentSpreadsheetModal } from './components/DocumentSpreadsheetModal';
import { GoogleContactsModal } from './components/GoogleContactsModal';
import { HelpCenterModal } from './components/HelpCenterModal';
import { AgentsModal } from './components/AgentsModal';
import { ApiSecretsModal } from './components/ApiSecretsModal';
import { ModelAgentControlBar } from './components/ModelAgentControlBar';
import { SecretsService, type SecretKeyId } from './services/secretsService';
import { TelemetryPanel } from './components/TelemetryPanel';
import { platformService } from './core/adapters/PlatformService';
import { initAuth, googleSignIn } from './services/googleAuth';
import {
  syncUserProfileToFirestore,
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  saveEventToFirestore,
  deleteEventFromFirestore,
  subscribeToUserTasks,
  subscribeToUserEvents,
} from './services/firestoreSyncService';
import type { User } from 'firebase/auth';

import { 
  type ModelType, 
  type KokoroVoiceId, 
  type CloudServiceIntegrationType,
  type ThemeColorId,
  type DeviceState, 
  type ActiveCall, 
  type PhoneContact, 
  type AlarmItem, 
  type TimerItem, 
  type CalendarEvent, 
  type TaskItem, 
  type EncryptedVaultItem, 
  type ConsoleMessage,
  type ActiveNotificationAlert,
  type AgentProfile,
  AVAILABLE_MODELS,
  CLOUD_INTEGRATIONS,
  KOKORO_VOICES,
  DEFAULT_AGENTS,
  EXCLUSIVE_AGENTS
} from './types';

import { 
  initSpeechRecognition, 
  speakKokoro, 
  stopSpeaking, 
  playCyberTone, 
  setupMicrophoneAnalyzer, 
  stopMicrophoneAnalyzer 
} from './utils/speech';

import { 
  parseNaturalVoiceCommand, 
  generateRTLiteResponse 
} from './utils/rtLiteEngine';

import { 
  downloadICSFile, 
  dispatchTaskWebhook 
} from './utils/ical';

import {
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from './utils/calendarSync';

import {
  registerServiceWorker,
  sendBackgroundAlert,
  testNativePushNotification,
  initNotificationClickListener
} from './services/pushNotificationService';

const INITIAL_CONTACTS: PhoneContact[] = [
  { id: 'c1', name: 'Carlos Méndez', phone: '+34 612 345 678', relation: 'Colega de Proyecto', favorite: true },
  { id: 'c2', name: 'María García', phone: '+34 689 987 654', relation: 'Dirección de Operaciones', favorite: true },
  { id: 'c3', name: 'Alex Rivera', phone: '+1 (555) 304-9821', relation: 'Ingeniero de Sistemas' },
  { id: 'c4', name: 'Laura Gómez', phone: '+34 677 112 233', relation: 'Familia' },
  { id: 'c5', name: 'Emergencias 911', phone: '911', relation: 'Servicio de Urgencias', favorite: true },
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't-1',
    title: 'Comprobar telemetría de inferencia NVIDIA',
    dueDate: new Date().toISOString().split('T')[0],
    timeDue: '14:30',
    priority: 'alta',
    category: 'trabajo',
    isCompleted: false,
    recurrence: 'daily',
    subtasks: [
      { id: 'st-1', title: 'Verificar cuota de API en build.nvidia.com', completed: true },
      { id: 'st-2', title: 'Medir latencia en modelos Flash y Nemotron', completed: false },
    ],
    syncedToThirdParty: { googleCalendar: true, notion: true, todoist: true },
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 't-2',
    title: 'Respaldar claves de cifrado E2EE',
    dueDate: new Date().toISOString().split('T')[0],
    timeDue: '18:00',
    priority: 'critica',
    category: 'urgente',
    isCompleted: false,
    recurrence: 'weekly',
    subtasks: [
      { id: 'st-3', title: 'Verificar huella SHA-256 en bóveda', completed: false },
      { id: 'st-4', title: 'Exportar backup .json cifrado con PBKDF2', completed: false },
    ],
    syncedToThirdParty: { googleCalendar: true, notion: false, todoist: true },
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  },
  {
    id: 't-3',
    title: 'Sincronizar agenda semanal con VVC LIAM CORE',
    dueDate: new Date().toISOString().split('T')[0],
    timeDue: '20:00',
    priority: 'media',
    category: 'proyecto',
    isCompleted: true,
    completedAt: Date.now() - 1800000,
    recurrence: 'none',
    subtasks: [],
    syncedToThirdParty: { googleCalendar: true, notion: true, todoist: false },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 1800000,
  },
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Reunión de Arquitectura Neuronal & Cloud',
    date: new Date().toISOString().split('T')[0],
    time: '11:00',
    endTime: '12:00',
    location: 'Virtual Terminal VVC LIAM CORE',
    description: 'Revisión de integración con Google Calendar y sincronización de tareas.',
    isAutomated: true,
    category: 'reunion',
  },
  {
    id: 'e2',
    title: 'Revisión de Seguridad Zero-Knowledge',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '16:00',
    endTime: '17:00',
    location: 'Laboratorio Cifrado',
    description: 'Auditoría de claves AES-GCM-256 locales.',
    category: 'sistema',
  },
];

const INITIAL_ALARMS: AlarmItem[] = [
  { id: 'a1', time: '07:00', label: 'Despertador Operativo', enabled: true, days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] },
  { id: 'a2', time: '23:30', label: 'Modo Descanso Obsidian', enabled: false, days: ['Todos'] },
];

export default function App() {
  // Model & AI State
  const [currentModel, setCurrentModel] = useState<ModelType>(() => {
    const saved = localStorage.getItem('vvc_liam_model') as ModelType;
    if (saved && saved !== 'nvidia/nemotron-3.5-lightning-30b-a3b') {
      return saved;
    }
    return 'meta/llama-3.2-11b-vision-instruct';
  });

  // Cloud Service Integration State
  const [currentCloudIntegration, setCurrentCloudIntegration] = useState<CloudServiceIntegrationType>(() => {
    return (localStorage.getItem('vvc_liam_cloud_integration') as CloudServiceIntegrationType) || 'google_calendar';
  });

  const [nvidiaApiKey, setNvidiaApiKey] = useState(() => SecretsService.getSecret('nvidia_api_key'));
  const [geminiApiKey, setGeminiApiKey] = useState(() => SecretsService.getSecret('gemini_api_key'));
  const [customApiKey, setCustomApiKey] = useState(() => SecretsService.getSecret('custom_api_key'));
  const [customEndpoint, setCustomEndpoint] = useState(() => SecretsService.getSecret('custom_endpoint') || 'https://integrate.api.nvidia.com/v1/chat/completions');
  const [customModel, setCustomModel] = useState(() => SecretsService.getSecret('custom_model') || 'llama-3.3-70b-versatile');
  const [thirdPartyWebhookUrl, setThirdPartyWebhookUrl] = useState(() => SecretsService.getSecret('webhook_url'));

  // API Secrets Vault Modal State
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
  const [targetSecretId, setTargetSecretId] = useState<SecretKeyId | null>(null);

  const promptSecret = (secretId: SecretKeyId, message?: string) => {
    setTargetSecretId(secretId);
    setIsSecretsModalOpen(true);
    if (message) {
      setActiveAlerts((prev) => [
        {
          id: `sec-${Date.now()}`,
          taskId: 'secrets-vault',
          title: 'Clave Secreta Requerida',
          timeDue: 'Inmediata',
          priority: 'alta',
          category: 'sistema',
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    }
  };

  const handleSecretsUpdated = () => {
    setNvidiaApiKey(SecretsService.getSecret('nvidia_api_key'));
    setGeminiApiKey(SecretsService.getSecret('gemini_api_key'));
    setCustomApiKey(SecretsService.getSecret('custom_api_key'));
    setCustomEndpoint(SecretsService.getSecret('custom_endpoint') || 'https://integrate.api.nvidia.com/v1/chat/completions');
    setCustomModel(SecretsService.getSecret('custom_model') || 'llama-3.3-70b-versatile');
    setThirdPartyWebhookUrl(SecretsService.getSecret('webhook_url'));
  };

  // Kokoro TTS State
  const [selectedVoiceId, setSelectedVoiceId] = useState<KokoroVoiceId>(() => {
    return (localStorage.getItem('vvc_liam_voice') as KokoroVoiceId) || 'es_mateo';
  });
  const [pitchModifier, setPitchModifier] = useState(1.0);
  const [rateModifier, setRateModifier] = useState(1.05);

  // Network & Environment
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [autoDarkMode, setAutoDarkMode] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  // Visual Color Theme State (CSS Variables)
  const [currentTheme, setCurrentTheme] = useState<ThemeColorId>(() => {
    return (localStorage.getItem('vvc_liam_theme') as ThemeColorId) || 'liam-core-official';
  });

  // Apply theme to documentElement on load and update
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('vvc_liam_theme', currentTheme);
  }, [currentTheme]);

  // Device & Hardware State
  const [deviceState, setDeviceState] = useState<DeviceState>({
    flashlight: false,
    brightness: 80,
    volume: 75,
    isMuted: false,
    wifi: true,
    bluetooth: true,
    batteryLevel: 92,
    isCharging: false,
    screenTorchActive: false,
    airplaneMode: false,
    dnd: false,
  });

  // Call simulation state
  const [activeCall, setActiveCall] = useState<ActiveCall>({
    inCall: false,
    contactName: '',
    phoneNumber: '',
    durationSeconds: 0,
    isMuted: false,
    isSpeaker: false,
    state: 'calling',
  });

  // Messaging modal state
  const [messagingState, setMessagingState] = useState<{
    isOpen: boolean;
    recipient: string;
    initialMessage: string;
    channel: 'SMS' | 'WhatsApp';
  }>({
    isOpen: false,
    recipient: '',
    initialMessage: '',
    channel: 'SMS',
  });

  // Advanced Tasks, Reminders & Calendar Collections
  const [contacts, setContacts] = useState<PhoneContact[]>(() => {
    const saved = localStorage.getItem('vvc_liam_contacts');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_CONTACTS;
  });

  useEffect(() => {
    localStorage.setItem('vvc_liam_contacts', JSON.stringify(contacts));
  }, [contacts]);
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('vvc_liam_tasks');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_TASKS;
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('vvc_liam_events');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_EVENTS;
  });

  const [alarms, setAlarms] = useState<AlarmItem[]>(INITIAL_ALARMS);
  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [vaultItems, setVaultItems] = useState<EncryptedVaultItem[]>([]);
  const [masterPassphrase, setMasterPassphrase] = useState('vvc-obsidian-secure-pass-2026');

  // Active Real-time Alert Toasts
  const [activeAlerts, setActiveAlerts] = useState<ActiveNotificationAlert[]>([]);
  const notifiedTaskTimestampsRef = useRef<{ [key: string]: boolean }>({});

  // Console messages with on-device persistence
  const [messages, setMessages] = useState<ConsoleMessage[]>(() => {
    try {
      const saved = localStorage.getItem('vvc_liam_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading chat history from local storage:', e);
    }
    return [
      {
        id: 'm-init',
        sender: 'system',
        text: 'VVC LIAM CORE v1.0.0 activo (Control // Analyze // Execute). Orquestador VAOS con Policy Engine, agentes exclusivos (Vladimir, Valentina, Victoria) y telemetría D3.js en tiempo real.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        modelUsed: 'VVC LIAM CORE // VAOS Orchestrator',
        isE2EE: true,
      },
    ];
  });

  // Voice & Interaction Flags
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [statusLabel, setStatusLabel] = useState('LISTO');

  // Modals Visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isDeviceControlsOpen, setIsDeviceControlsOpen] = useState(false);
  const [isScreenTorchOpen, setIsScreenTorchOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [gmailDraft, setGmailDraft] = useState<{ recipient?: string; subject?: string; body?: string }>({});
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isMapsOpen, setIsMapsOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [docsModalMode, setDocsModalMode] = useState<'document' | 'spreadsheet'>('document');
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [agentsModalInitialTab, setAgentsModalInitialTab] = useState<'list' | 'add' | 'inspect'>('list');
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Custom Agents Matrix State (with VAOS Bifurcation: Exclusive Private Agents vs Public)
  const [agents, setAgents] = useState<AgentProfile[]>(() => {
    const saved = localStorage.getItem('vvc_liam_custom_agents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee exclusive private agents (Vladimir, Valentina, Victoria) are present
          const hasVladimir = parsed.some((a) => a.id === 'exclusive-vladimir');
          if (!hasVladimir) {
            return [...EXCLUSIVE_AGENTS, ...parsed.filter((p) => !p.id.startsWith('exclusive-'))];
          }
          return parsed;
        }
      } catch {}
    }
    return DEFAULT_AGENTS;
  });

  // Active Agent ID: empty string '' means NO agent selected (Modo Neutro Directo por defecto)
  const [activeAgentId, setActiveAgentId] = useState<string>(() => {
    return localStorage.getItem('vvc_liam_active_agent_id') || '';
  });

  // Save agents and active ID to localStorage
  useEffect(() => {
    localStorage.setItem('vvc_liam_custom_agents', JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem('vvc_liam_active_agent_id', activeAgentId);
  }, [activeAgentId]);

  const activeAgent = agents.find((a) => a.id === activeAgentId) || null;
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || 'AIzaSyCzVPjGhif2S8wKYBjkk5TuoqAeuCEatUo';

  // Google Auth User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setCurrentUser(user),
      () => setCurrentUser(null)
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignInFlow = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
        playCyberTone('confirm');
        speakKokoro(
          `Google Workspace y Firebase sincronizados con éxito para ${res.user.displayName || res.user.email}.`,
          selectedVoiceId
        );
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
    }
  };

  // Synchronize User Profile, Tasks and Calendar Events to Firestore in real-time
  useEffect(() => {
    if (currentUser?.uid) {
      syncUserProfileToFirestore(currentUser.uid, {
        email: currentUser.email,
        displayName: currentUser.displayName,
        theme: currentTheme,
        activeAgentId: activeAgentId,
      });

      const unsubTasks = subscribeToUserTasks(currentUser.uid, (cloudTasks) => {
        setTasks((prev) => {
          const ids = new Set(prev.map((t) => t.id));
          const additions = cloudTasks.filter((t) => !ids.has(t.id));
          if (additions.length > 0) {
            return [...prev, ...additions];
          }
          return prev;
        });
      });

      const unsubEvents = subscribeToUserEvents(currentUser.uid, (cloudEvents) => {
        setCalendarEvents((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          const additions = cloudEvents.filter((e) => !ids.has(e.id));
          if (additions.length > 0) {
            return [...prev, ...additions];
          }
          return prev;
        });
      });

      return () => {
        unsubTasks();
        unsubEvents();
      };
    }
  }, [currentUser, currentTheme, activeAgentId]);

  // References
  const speechRecognitionRef = useRef<any>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Save tasks and events to localStorage
  useEffect(() => {
    localStorage.setItem('vvc_liam_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('vvc_liam_events', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  // Persist chat history to on-device localStorage
  useEffect(() => {
    try {
      const historyToSave = messages.slice(-150);
      localStorage.setItem('vvc_liam_chat_history', JSON.stringify(historyToSave));
    } catch (e) {
      console.warn('Error saving chat history to localStorage:', e);
    }
  }, [messages]);

  // Battery API integration
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setDeviceState((prev) => ({
          ...prev,
          batteryLevel: Math.round(battery.level * 100),
          isCharging: battery.charging,
        }));

        battery.addEventListener('levelchange', () => {
          setDeviceState((prev) => ({ ...prev, batteryLevel: Math.round(battery.level * 100) }));
        });
        battery.addEventListener('chargingchange', () => {
          setDeviceState((prev) => ({ ...prev, isCharging: battery.charging }));
        });
      });
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Service Worker Initialization & Background Notification Click Handler
  useEffect(() => {
    registerServiceWorker().then((reg) => {
      if (reg) {
        console.log('[VVC LIAM CORE] Service Worker inicializado con éxito para alertas en segundo plano.');
      }
    });

    const cleanupClickListener = initNotificationClickListener(({ taskId }) => {
      if (taskId) {
        setIsCalendarOpen(true);
      }
    });

    return () => cleanupClickListener();
  }, []);

  // Timers countdown ticker
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.isRunning || t.remainingSeconds <= 0) return t;
          const nextSec = t.remainingSeconds - 1;
          if (nextSec === 0) {
            playCyberTone('alarm');
            speakKokoro(`¡Atención! El temporizador ${t.label} ha finalizado.`, selectedVoiceId);
            sendBackgroundAlert(`VVC LIAM CORE // Temporizador Finalizado`, {
              body: `El temporizador "${t.label}" ha concluido.`,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `timer-${t.id}`,
              requireInteraction: true,
            });
            return { ...t, remainingSeconds: 0, isRunning: false, isCompleted: true };
          }
          return { ...t, remainingSeconds: nextSec };
        })
      );
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [selectedVoiceId]);

  // ADVANCED REAL-TIME NOTIFICATIONS MONITOR FOR TASKS & REMINDERS
  useEffect(() => {
    const checkTasksInterval = setInterval(() => {
      const now = new Date();
      const currentDateStr = now.toISOString().split('T')[0];
      const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      tasks.forEach((task) => {
        if (!task.isCompleted && task.timeDue === currentTimeStr) {
          // Check if due today or snoozed until current time
          const isDueNow = !task.dueDate || task.dueDate === currentDateStr || task.snoozedUntil === currentTimeStr;
          const triggerKey = `${task.id}-${currentTimeStr}-${currentDateStr}`;

          if (isDueNow && !notifiedTaskTimestampsRef.current[triggerKey]) {
            notifiedTaskTimestampsRef.current[triggerKey] = true;

            // 1. Play cybernetic alert tone
            playCyberTone('alert');

            // 2. Add floating toast banner
            const newAlert: ActiveNotificationAlert = {
              id: `alert-${Date.now()}-${task.id}`,
              taskId: task.id,
              title: task.title,
              timeDue: task.timeDue,
              priority: task.priority,
              category: task.category,
              timestamp: Date.now(),
            };
            setActiveAlerts((prev) => [newAlert, ...prev.slice(0, 3)]);

            // 3. Voice announcement with Kokoro TTS
            if (!deviceState.isMuted) {
              speakKokoro(`Atención. Recordatorio programado: ${task.title}. Prioridad ${task.priority}.`, selectedVoiceId);
            }

            // 4. Native Browser & Service Worker Push Notification (Active in background)
            sendBackgroundAlert(`VVC LIAM CORE // ${task.title}`, {
              body: `Hora: ${task.timeDue} · Prioridad: ${task.priority.toUpperCase()}`,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `task-${task.id}`,
              taskId: task.id,
              requireInteraction: true,
            });

            // 5. Dispatch third-party webhook if configured
            if (thirdPartyWebhookUrl) {
              dispatchTaskWebhook(thirdPartyWebhookUrl, 'notified', task);
            }
          }
        }
      });
    }, 2000);

    return () => clearInterval(checkTasksInterval);
  }, [tasks, deviceState.isMuted, selectedVoiceId, thirdPartyWebhookUrl]);

  // Physical Camera Torch Toggle
  const togglePhysicalTorch = async (enable: boolean) => {
    try {
      if (enable) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = stream.getVideoTracks()[0];
        cameraTrackRef.current = track;
        const capabilities: any = track.getCapabilities?.();
        if (capabilities?.torch) {
          await (track as any).applyConstraints({ advanced: [{ torch: true }] });
        }
      } else {
        if (cameraTrackRef.current) {
          cameraTrackRef.current.stop();
          cameraTrackRef.current = null;
        }
      }
    } catch (err) {
      console.debug('Physical camera torch not available, fallback to screen flashlight:', err);
    }
  };

  // Convert Task to Calendar Event
  const handleConvertTaskToEvent = (task: TaskItem) => {
    const newEvent: CalendarEvent = {
      id: `e-task-${task.id}`,
      title: task.title,
      date: task.dueDate || new Date().toISOString().split('T')[0],
      time: task.timeDue || '10:00',
      description: `Tarea vinculada de VVC LIAM CORE [Prioridad: ${task.priority.toUpperCase()}]`,
      location: 'Virtual Hub VVC LIAM CORE',
      category: 'tarea',
      isAutomated: true,
      linkedTaskId: task.id,
    };

    setCalendarEvents((prev) => [newEvent, ...prev]);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, calendarEventId: newEvent.id } : t))
    );

    playCyberTone('confirm');
    speakKokoro(`Tarea "${task.title}" vinculada con éxito al calendario.`, selectedVoiceId);
  };

  // Process User Command (via Voice or Text)
  const handleProcessCommand = useCallback(
    async (commandText: string) => {
      if (!commandText.trim()) return;

      const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const userMsg: ConsoleMessage = {
        id: `u-${Date.now()}`,
        sender: 'user',
        text: commandText,
        timestamp: userTime,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setStatusLabel('PROCESANDO');

      try {
        // Step 1: Run through upgraded RT-Lite Local Intent Parser with existing tasks and calendar events
        const intentResult = parseNaturalVoiceCommand(commandText, deviceState, contacts, tasks, calendarEvents);

        if (intentResult.isHandled) {
          playCyberTone('confirm');

          // Update device state if needed
          if (intentResult.updatedDeviceState) {
            const updatedState = intentResult.updatedDeviceState;
            setDeviceState((prev) => {
              const updated = { ...prev, ...updatedState };
              if (updatedState.flashlight !== undefined) {
                togglePhysicalTorch(Boolean(updatedState.flashlight));
              }
              return updated;
            });
          }

          // Trigger phone call modal with real device dialer integration
          if (intentResult.callContact) {
            const clean = intentResult.callContact.number.replace(/[^\d+]/g, '');
            try {
              window.location.href = `tel:${clean}`;
            } catch {}
            setActiveCall({
              inCall: true,
              contactName: intentResult.callContact.name,
              phoneNumber: intentResult.callContact.number,
              durationSeconds: 0,
              isMuted: false,
              isSpeaker: false,
              state: 'calling',
            });
          }

          // Trigger messaging modal
          if (intentResult.messagePayload) {
            setMessagingState({
              isOpen: true,
              recipient: intentResult.messagePayload.recipient,
              initialMessage: intentResult.messagePayload.message,
              channel: intentResult.messagePayload.channel,
            });
          }

          // Trigger screen torch
          if (intentResult.screenFlashlight || intentResult.actionType === 'torch') {
            if (intentResult.updatedDeviceState?.flashlight) {
              setIsScreenTorchOpen(true);
            } else {
              setIsScreenTorchOpen(false);
            }
          }

          // Handle Task Completion
          if (intentResult.taskToCompleteId) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === intentResult.taskToCompleteId
                  ? { ...t, isCompleted: true, completedAt: Date.now() }
                  : t
              )
            );
          }

          // Handle Task Deletion
          if (intentResult.taskToDeleteId) {
            setTasks((prev) => prev.filter((t) => t.id !== intentResult.taskToDeleteId));
          }

          // Handle Task Modification
          if (intentResult.taskToModify) {
            const mod = intentResult.taskToModify;
            setTasks((prev) =>
              prev.map((t) => (t.id === mod.id ? { ...t, ...mod.updates, updatedAt: Date.now() } : t))
            );
          }

          // Handle New Task Creation
          if (intentResult.newTask) {
            const newTaskItem: TaskItem = {
              id: `t-${Date.now()}`,
              ...intentResult.newTask,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            setTasks((prev) => [newTaskItem, ...prev]);

            // If webhook configured, dispatch
            if (thirdPartyWebhookUrl) {
              dispatchTaskWebhook(thirdPartyWebhookUrl, 'created', newTaskItem);
            }
          }

          // Handle iCal Export trigger
          if (intentResult.triggerICalExport) {
            downloadICSFile(calendarEvents, tasks);
          }

          // Handle Cloud Sync trigger
          if (intentResult.triggerThirdPartySync) {
            playCyberTone('confirm');
          }

          // Add alarm
          if (intentResult.newAlarm) {
            const alarmObj: AlarmItem = {
              id: `a-${Date.now()}`,
              ...intentResult.newAlarm,
            };
            setAlarms((prev) => [...prev, alarmObj]);
          }

          // Add timer
          if (intentResult.newTimer) {
            const timerObj: TimerItem = {
              id: `t-${Date.now()}`,
              label: intentResult.newTimer.label,
              totalSeconds: intentResult.newTimer.seconds,
              remainingSeconds: intentResult.newTimer.seconds,
              isRunning: true,
              isCompleted: false,
            };
            setTimers((prev) => [...prev, timerObj]);
          }

          // Update calendar events if conflicts were resolved
          if (intentResult.eventsToUpdate) {
            setCalendarEvents(intentResult.eventsToUpdate);
          }

          // Add calendar event
          if (intentResult.newCalendarEvent) {
            const eventObj: CalendarEvent = {
              id: `e-${Date.now()}`,
              ...intentResult.newCalendarEvent,
            };
            setCalendarEvents((prev) => [eventObj, ...prev]);
          }

          // Handle multi-provider Calendar Sync trigger
          if (intentResult.triggerCalendarSync) {
            if (intentResult.triggerCalendarSync === 'google' && intentResult.newCalendarEvent) {
              const directUrl = generateGoogleCalendarUrl({ id: 'sync-google', ...intentResult.newCalendarEvent });
              try { window.open(directUrl, '_blank'); } catch {}
            } else if (intentResult.triggerCalendarSync === 'outlook' && intentResult.newCalendarEvent) {
              const directUrl = generateOutlookCalendarUrl({ id: 'sync-outlook', ...intentResult.newCalendarEvent });
              try { window.open(directUrl, '_blank'); } catch {}
            } else {
              downloadICSFile(calendarEvents, tasks);
            }
          }

          // Handle Open Calendar Intent
          if (intentResult.openCalendar) {
            setIsCalendarOpen(true);
          }

          // Handle Open Docs & Spreadsheet Studio Intent
          if (intentResult.openDocs) {
            if (intentResult.docsMode) {
              setDocsModalMode(intentResult.docsMode);
            }
            setIsDocsModalOpen(true);
          }

          // Handle Open Agents Matrix Intent
          if (intentResult.openAgents) {
            setIsAgentsModalOpen(true);
            if (intentResult.targetAgentName) {
              const found = agents.find(
                (a) =>
                  a.name.toLowerCase().includes(intentResult.targetAgentName!.toLowerCase()) ||
                  a.role.toLowerCase().includes(intentResult.targetAgentName!.toLowerCase())
              );
              if (found) {
                setActiveAgentId(found.id);
              }
            }
          }

          // Handle Open Telemetry Panel Intent (VAOS & D3.js)
          if (intentResult.openTelemetry) {
            setIsTelemetryOpen(true);
          }

          // Handle Gmail Intent
          if (intentResult.openGmail) {
            if (intentResult.gmailCompose) {
              setGmailDraft(intentResult.gmailCompose);
            }
            setIsGmailOpen(true);
          }

          // Handle Google Picker Intent
          if (intentResult.openPicker) {
            setIsPickerOpen(true);
          }

          // Handle Google Maps Intent
          if (intentResult.openMaps) {
            setIsMapsOpen(true);
          }

          // Handle Google Contacts Intent
          if (intentResult.openContacts) {
            setIsContactsOpen(true);
          }

          // Handle Help Center Intent
          if (intentResult.openHelp) {
            setIsHelpOpen(true);
          }

          // Handle Theme Change Intent
          if (intentResult.newTheme) {
            setCurrentTheme(intentResult.newTheme);
            playCyberTone('confirm');
          }

          // Handle Native Push Notification Test Intent
          if (intentResult.triggerPushTest) {
            testNativePushNotification();
          }

          // Handle Open Settings Modal Intent
          if (intentResult.openSettings) {
            setIsSettingsOpen(true);
          }

          // Spoken output with Kokoro TTS
          if (!deviceState.isMuted) {
            setIsSpeaking(true);
            speakKokoro(intentResult.spokenResponse, selectedVoiceId, {
              pitchModifier,
              rateModifier,
              volume: deviceState.volume,
              onEnd: () => {
                setIsSpeaking(false);
                setStatusLabel('LISTO');
              },
            });
          }

          // Add response to console
          const assistantMsg: ConsoleMessage = {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: intentResult.spokenResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            actionType: intentResult.actionType,
            actionDetails: intentResult.actionDetails,
            modelUsed: `${activeAgent ? activeAgent.name.split(' ')[0] : 'VVC LIAM'} (RT-Lite)`,
            isE2EE: true,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          setStatusLabel('LISTO');
          return;
        }

        // --- NIVEL 1: MODO DIRECTO (SIN IA / DETERMINISTA) ---
        if (currentModel === 'direct-no-ai') {
          const directText = `[Modo Directo // Sin IA]: Comando "${commandText}" procesado directamente. Sin intervención de modelos generativos. Estado operativo nominal.`;
          if (!deviceState.isMuted) {
            setIsSpeaking(true);
            speakKokoro(directText, selectedVoiceId, {
              pitchModifier,
              rateModifier,
              volume: deviceState.volume,
              onEnd: () => {
                setIsSpeaking(false);
                setStatusLabel('LISTO');
              },
            });
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              sender: 'assistant',
              text: directText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              modelUsed: 'Modo Directo (Sin IA)',
              isE2EE: true,
            },
          ]);
          setIsProcessing(false);
          setStatusLabel('LISTO');
          return;
        }

        // --- NIVEL 2: MOTORES LOCALES ON-DEVICE RT-LITE (100% OFFLINE) ---
        if (isOffline || currentModel.startsWith('rt-lite')) {
          const localAnswer = generateRTLiteResponse(commandText, currentModel);
          if (!deviceState.isMuted) {
            setIsSpeaking(true);
            speakKokoro(localAnswer, selectedVoiceId, {
              pitchModifier,
              rateModifier,
              volume: deviceState.volume,
              onEnd: () => {
                setIsSpeaking(false);
                setStatusLabel('LISTO');
              },
            });
          }

          const currentModelMeta = AVAILABLE_MODELS.find((m) => m.id === currentModel);
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              sender: 'assistant',
              text: localAnswer,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              modelUsed: `${currentModelMeta?.name || 'RT-Lite On-Device'}${activeAgent ? ` · ${activeAgent.name.split(' ')[0]}` : ' · Modo Neutro'}`,
              isE2EE: true,
            },
          ]);
          setIsProcessing(false);
          setStatusLabel('LISTO');
          return;
        }

        // --- NIVEL 3: MODELOS EN LA NUBE (GEMINI, NVIDIA NIM, CUSTOM LLM) ---
        const cloudInfo = CLOUD_INTEGRATIONS.find((c) => c.id === currentCloudIntegration) || CLOUD_INTEGRATIONS[0];

        // Dispatch to VAOS Policy Engine & Telemetry Gateway in background
        platformService.api.dispatchVaos({
          command: commandText,
          agentId: activeAgent ? activeAgent.id : 'neutral-core',
          isExclusiveAgent: activeAgent ? Boolean(activeAgent.isExclusivePrivate) : false,
          injectedSkills: activeAgent ? (activeAgent.injectedSkills || []) : [],
        }).catch((err) => console.warn('[VAOS Gateway]', err));

        // Construct System Prompt according to whether an Agent is selected or No Agent (Neutral Mode)
        let systemPrompt = '';
        if (activeAgent) {
          const agentRulesSection = activeAgent.rules && activeAgent.rules.length > 0
            ? `\n\nREGLAS DE ACTUACIÓN:\n${activeAgent.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
            : '';

          const agentCapabilitiesSection = activeAgent.capabilities && activeAgent.capabilities.length > 0
            ? `\nCAPACIDADES ESPECIALIZADAS: ${activeAgent.capabilities.join(', ')}`
            : '';

          const agentSkillsSection = activeAgent.injectedSkills && activeAgent.injectedSkills.length > 0
            ? `\nSKILLS INYECTADOS DINÁMICAMENTE (VAOS): ${activeAgent.injectedSkills.join(', ')}`
            : '';

          systemPrompt = `[IDENTIDAD DE AGENTE ACTIVO: ${activeAgent.name.toUpperCase()} // ${activeAgent.role.toUpperCase()}]\n${activeAgent.systemPrompt}${agentRulesSection}${agentCapabilitiesSection}${agentSkillsSection}\n\n[CONTEXTO OPERATIVO]:\nVVC LIAM CORE (Control // Analyze // Execute). Orquestador VAOS de alta velocidad con Policy Engine. Integración activa con ${cloudInfo.name}. Control de calendario, tareas y funciones del teléfono. Responde de forma concisa, clara y ejecutiva en español (máximo 3 oraciones) sin fricción ("Más control. Menos ruido.").`;
        } else {
          systemPrompt = `[MODO NEUTRO DIRECTO // SIN AGENTE ACTIVO]:\nEres el asistente operativo central de VVC LIAM CORE actuando en Modo Neutro Directo sin sesgos de personalidad ni roles predeterminados. Responde con neutralidad, concisión, rigor técnico y claridad ejecutiva en español (máximo 3 oraciones) sin fricción ("Más control. Menos ruido.").`;
        }

        const agentTemperature = activeAgent?.temperature !== undefined ? activeAgent.temperature : 0.6;
        const agentMaxTokens = activeAgent?.maxTokens !== undefined ? activeAgent.maxTokens : 800;

        let responseText = '';
        let modelTag = currentModel as string;

        // Route A: Google Gemini Cloud
        if (currentModel.startsWith('google/')) {
          const gemKey = SecretsService.getSecret('gemini_api_key');
          if (!gemKey) {
            promptSecret('gemini_api_key', 'Configura tu Google Gemini API Key secreta para utilizar este modelo.');
            throw new Error('Se requiere tu API Key de Google Gemini guardada como secreto para continuar.');
          }

          const res = await fetch('/api/chat/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: currentModel,
              apiKey: gemKey,
              prompt: commandText,
              systemInstruction: systemPrompt,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: commandText },
              ],
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error servidor Gemini (${res.status})`);
          }

          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content || data.text || 'Comando procesado por Gemini.';
          modelTag = data.model_used || currentModel;
        } 
        // Route B: Custom LLM (OpenAI-compatible / Groq / Ollama)
        else if (currentModel === 'custom-llm') {
          const custEndpoint = SecretsService.getSecret('custom_endpoint');
          const custKey = SecretsService.getSecret('custom_api_key');
          const custModel = SecretsService.getSecret('custom_model') || 'llama-3.3-70b-versatile';

          if (!custEndpoint) {
            promptSecret('custom_endpoint', 'Configura la URL de Endpoint y API Key para el LLM Personalizado.');
            throw new Error('Se requiere configurar el Endpoint URL del LLM en la Bóveda de Secretos.');
          }

          const res = await fetch('/api/chat/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: custEndpoint,
              apiKey: custKey,
              model: custModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: commandText },
              ],
              temperature: agentTemperature,
              max_tokens: agentMaxTokens,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error en Custom LLM (${res.status})`);
          }

          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content || data.text || 'Comando procesado por Custom LLM.';
          modelTag = data.model_used || `${custModel} (Custom)`;
        }
        // Route C: NVIDIA NIM Catalog
        else {
          const nKey = SecretsService.getSecret('nvidia_api_key');
          if (!nKey) {
            promptSecret('nvidia_api_key', 'Configura tu NVIDIA NIM API Key secreta para utilizar este modelo.');
            throw new Error('Se requiere tu API Key de NVIDIA NIM guardada como secreto para continuar.');
          }

          const res = await fetch('/api/chat/nvidia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: currentModel,
              apiKey: nKey,
              endpoint: customEndpoint,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: commandText },
              ],
              temperature: agentTemperature,
              max_tokens: agentMaxTokens,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error servidor NVIDIA (${res.status})`);
          }

          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content || data.text || 'Comando procesado.';
          modelTag = data.model_used || currentModel;
        }

        if (!deviceState.isMuted) {
          setIsSpeaking(true);
          speakKokoro(responseText, selectedVoiceId, {
            pitchModifier,
            rateModifier,
            volume: deviceState.volume,
            onEnd: () => {
              setIsSpeaking(false);
              setStatusLabel('LISTO');
            },
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: responseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            modelUsed: `${modelTag}${activeAgent ? ` · ${activeAgent.name.split(' ')[0]}` : ' · Modo Neutro'}`,
            isE2EE: true,
          },
        ]);
      } catch (err: any) {
        console.warn('Inference error, falling back to RT-Lite local:', err);
        const fallbackText = generateRTLiteResponse(commandText);
        if (!deviceState.isMuted) {
          setIsSpeaking(true);
          speakKokoro(fallbackText, selectedVoiceId, {
            pitchModifier,
            rateModifier,
            volume: deviceState.volume,
            onEnd: () => setIsSpeaking(false),
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: `${fallbackText}\n\n[Nota: Servicio Cloud (${err.message}). Ejecutado con RT-Lite On-Device].`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            modelUsed: 'RT-Lite Local (Fallback)',
            isE2EE: true,
          },
        ]);
      } finally {
        setIsProcessing(false);
        setStatusLabel('LISTO');
      }
    },
    [
      deviceState,
      contacts,
      tasks,
      calendarEvents,
      isOffline,
      currentModel,
      currentCloudIntegration,
      activeAgent,
      nvidiaApiKey,
      geminiApiKey,
      customApiKey,
      customEndpoint,
      customModel,
      thirdPartyWebhookUrl,
      selectedVoiceId,
      pitchModifier,
      rateModifier,
    ]
  );

  // Manual commit handler for speech transcript
  const handleCommitManualTranscript = () => {
    if (!currentTranscript.trim()) return;
    const text = currentTranscript.trim();
    speechRecognitionRef.current?.stop();
    setIsListening(false);
    setCurrentTranscript('');
    setStatusLabel('LISTO');
    handleProcessCommand(text);
  };

  // Setup Speech Recognition Controller
  useEffect(() => {
    const recognition = initSpeechRecognition({
      onStart: () => {
        setIsListening(true);
        setStatusLabel('ESCUCHANDO...');
      },
      onResult: (transcript: string, isFinal: boolean) => {
        setCurrentTranscript(transcript);
        if (isFinal) {
          setCurrentTranscript('');
          setIsListening(false);
          setStatusLabel('LISTO');
          handleProcessCommand(transcript);
        }
      },
      onError: (err: string) => {
        console.warn('Speech error notice:', err);
        setIsListening(false);
        setStatusLabel('LISTO');
      },
      onEnd: () => {
        setIsListening(false);
        setStatusLabel('LISTO');
      },
    });

    speechRecognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [handleProcessCommand]);

  const toggleListening = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
      setStatusLabel('LISTO');
    } else {
      setCurrentTranscript('');
      speechRecognitionRef.current?.start();
    }
  };

  const handleSpeakMessage = (text: string) => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speakKokoro(text, selectedVoiceId, {
        pitchModifier,
        rateModifier,
        volume: deviceState.volume,
        onEnd: () => setIsSpeaking(false),
      });
    }
  };

  const activeModelObj = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0];
  const pendingTasksCount = tasks.filter((t) => !t.isCompleted).length;

  const handleSelectModel = (model: ModelType) => {
    setCurrentModel(model);
    localStorage.setItem('vvc_liam_model', model);
    playCyberTone('confirm');

    // Prompt for secret API key if required and not set
    if (model.startsWith('google/') && !SecretsService.hasSecret('gemini_api_key')) {
      promptSecret('gemini_api_key', 'Configura tu Google Gemini API Key secreta para utilizar este modelo.');
    } else if (model === 'custom-llm' && (!SecretsService.hasSecret('custom_endpoint') || !SecretsService.hasSecret('custom_api_key'))) {
      promptSecret('custom_endpoint', 'Configura tu Endpoint URL y API Key para el LLM Personalizado.');
    } else if (!model.startsWith('rt-lite') && model !== 'direct-no-ai' && !model.startsWith('google/') && model !== 'custom-llm') {
      if (!SecretsService.hasSecret('nvidia_api_key')) {
        promptSecret('nvidia_api_key', 'Ingresa tu NVIDIA NIM API Key secreta para utilizar este modelo en la nube.');
      }
    }
  };

  const handleSelectCloudIntegration = (ci: CloudServiceIntegrationType) => {
    setCurrentCloudIntegration(ci);
    localStorage.setItem('vvc_liam_cloud_integration', ci);
    playCyberTone('confirm');

    if (ci === 'notion_workspace' && !SecretsService.hasSecret('notion_api_key')) {
      promptSecret('notion_api_key', 'Ingresa tu Integration Secret de Notion para sincronizar tareas.');
    } else if (ci === 'todoist_sync' && !SecretsService.hasSecret('todoist_api_key')) {
      promptSecret('todoist_api_key', 'Ingresa tu API Token de Todoist para sincronización en tiempo real.');
    } else if (ci === 'slack_webhooks' && !SecretsService.hasSecret('webhook_url')) {
      promptSecret('webhook_url', 'Configura la URL de Webhook para emitir alertas en Slack / Discord.');
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col relative selection:bg-[var(--primary-accent)]/30 selection:text-white transition-colors duration-300"
      style={{
        filter: deviceState.brightness < 100 ? `brightness(${Math.max(0.4, deviceState.brightness / 100)})` : 'none',
      }}
    >
      {/* Background Cyber Scanlines & Glow Grid */}
      <div className="fixed inset-0 pointer-events-none scanline-bg opacity-30 z-0" />
      <div 
        className="fixed -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] blur-[120px] rounded-full pointer-events-none -z-10 transition-colors duration-500" 
        style={{ backgroundColor: 'rgba(var(--primary-accent-rgb), 0.08)' }}
      />
      <div 
        className="fixed -bottom-40 right-10 w-[500px] h-[500px] blur-[120px] rounded-full pointer-events-none -z-10 transition-colors duration-500" 
        style={{ backgroundColor: 'rgba(var(--secondary-accent-rgb), 0.08)' }}
      />

      {/* Top Bar Header */}
      <Header
        currentModel={currentModel}
        onSelectModel={handleSelectModel}
        currentCloudIntegration={currentCloudIntegration}
        onSelectCloudIntegration={handleSelectCloudIntegration}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSecrets={() => {
          setTargetSecretId(null);
          setIsSecretsModalOpen(true);
        }}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenDocs={() => {
          setDocsModalMode('document');
          setIsDocsModalOpen(true);
        }}
        onOpenAgents={() => setIsAgentsModalOpen(true)}
        onOpenTelemetry={() => setIsTelemetryOpen(true)}
        activeAgentName={activeAgent ? activeAgent.name : undefined}
        onOpenVault={() => setIsVaultOpen(true)}
        onOpenDeviceControls={() => setIsDeviceControlsOpen(true)}
        onOpenGmail={() => setIsGmailOpen(true)}
        onOpenPicker={() => setIsPickerOpen(true)}
        onOpenMaps={() => setIsMapsOpen(true)}
        onOpenContacts={() => setIsContactsOpen(true)}
        currentUser={currentUser}
        onSignInGoogle={handleGoogleSignInFlow}
        isMuted={deviceState.isMuted}
        onToggleMute={() => setDeviceState((p) => ({ ...p, isMuted: !p.isMuted }))}
        pendingTasksCount={pendingTasksCount}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        currentTheme={currentTheme}
        onSelectTheme={(theme) => {
          setCurrentTheme(theme);
          playCyberTone('confirm');
        }}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Unified Direct Model, Credential and Agent Control Bar */}
      <ModelAgentControlBar
        currentModel={currentModel}
        onSelectModel={(model) => {
          setCurrentModel(model);
          playCyberTone('confirm');
        }}
        activeAgentId={activeAgentId}
        agents={agents}
        onSelectAgent={(agentId) => {
          setActiveAgentId(agentId);
          playCyberTone('confirm');
          if (agentId) {
            const ag = agents.find((a) => a.id === agentId);
            if (ag) {
              speakKokoro(`Agente ${ag.name} activado.`, selectedVoiceId);
            }
          } else {
            speakKokoro('Modo Neutro activado. Sin agente.', selectedVoiceId);
          }
        }}
        onOpenAddAgent={() => {
          setAgentsModalInitialTab('add');
          setIsAgentsModalOpen(true);
        }}
        onOpenAllAgents={() => {
          setAgentsModalInitialTab('list');
          setIsAgentsModalOpen(true);
        }}
        onNotify={(msg) => {
          playCyberTone('confirm');
          speakKokoro(msg, selectedVoiceId);
        }}
      />

      {/* Real-Time Live Notification Alerts Toast */}
      <RealTimeAlertToast
        alerts={activeAlerts}
        onComplete={(taskId) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, isCompleted: true, completedAt: Date.now() } : t))
          );
          playCyberTone('confirm');
        }}
        onSnooze={(taskId, minutes) => {
          const now = new Date();
          now.setMinutes(now.getMinutes() + minutes);
          const nextTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, timeDue: nextTime, snoozedUntil: nextTime } : t))
          );
          playCyberTone('confirm');
        }}
        onDismiss={(alertId) => {
          setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
        }}
        onOpenCalendar={() => setIsCalendarOpen(true)}
      />

      {/* Main Command Console & Voice Canvas Area */}
      <main className="flex-1 flex flex-col z-10 w-full max-w-7xl mx-auto py-2">
        {/* Central Voice Orb & Waveform Radar */}
        <VoiceOrbVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          currentTranscript={currentTranscript}
          onToggleListening={toggleListening}
          onCommitTranscript={handleCommitManualTranscript}
          statusLabel={statusLabel}
          activeModelName={activeModelObj.name}
          isOffline={isOffline}
        />

        {/* Quick Voice Command Action Pills */}
        <QuickCommandChips
          onExecuteCommand={(cmd) => handleProcessCommand(cmd)}
          disabled={isProcessing}
        />

        {/* Cyber Command Console Terminal Feed */}
        <CommandConsole
          messages={messages}
          onSendMessage={(txt) => handleProcessCommand(txt)}
          onSpeakMessage={handleSpeakMessage}
          onClearConsole={() => {
            setMessages([]);
            localStorage.removeItem('vvc_liam_chat_history');
          }}
          isListening={isListening}
          onToggleListening={toggleListening}
          isProcessing={isProcessing}
          activeModelName={activeModelObj.name}
          activeAgentName={activeAgent ? activeAgent.name : undefined}
          onOpenAgents={() => setIsAgentsModalOpen(true)}
        />
      </main>

      {/* Phone Call Overlay Modal */}
      <PhoneActionModal
        call={activeCall}
        onEndCall={() => setActiveCall((prev) => ({ ...prev, inCall: false, state: 'ended' }))}
        onToggleMute={() => setActiveCall((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
        onToggleSpeaker={() => setActiveCall((prev) => ({ ...prev, isSpeaker: !prev.isSpeaker }))}
      />

      {/* Messaging Dispatch Modal */}
      <MessagingModal
        isOpen={messagingState.isOpen}
        onClose={() => setMessagingState((p) => ({ ...p, isOpen: false }))}
        recipient={messagingState.recipient}
        initialMessage={messagingState.initialMessage}
        channel={messagingState.channel}
        onSend={(recipient, msg, channel) => {
          playCyberTone('confirm');
          setMessages((prev) => [
            ...prev,
            {
              id: `m-send-${Date.now()}`,
              sender: 'assistant',
              text: `Mensaje ${channel} transmitido con éxito a ${recipient}: "${msg}"`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              actionType: 'message',
              actionDetails: `${channel} a ${recipient}`,
              isE2EE: true,
            },
          ]);
        }}
      />

      {/* Screen Emergency High-Lumen Flashlight Modal */}
      <ScreenTorchModal
        isOpen={isScreenTorchOpen}
        onClose={() => {
          setIsScreenTorchOpen(false);
          setDeviceState((p) => ({ ...p, flashlight: false, screenTorchActive: false }));
          togglePhysicalTorch(false);
        }}
        isTorchActive={deviceState.flashlight}
      />

      {/* Phone Controls Drawer */}
      <DeviceControlsDrawer
        isOpen={isDeviceControlsOpen}
        onClose={() => setIsDeviceControlsOpen(false)}
        deviceState={deviceState}
        onUpdateState={(updated) => {
          setDeviceState((prev) => ({ ...prev, ...updated }));
          if (updated.flashlight !== undefined) {
            togglePhysicalTorch(Boolean(updated.flashlight));
          }
        }}
        contacts={contacts}
        onCallContact={(contact) => {
          setIsDeviceControlsOpen(false);
          handleProcessCommand(`Llamar a ${contact.name}`);
        }}
        onMessageContact={(contact) => {
          setIsDeviceControlsOpen(false);
          setMessagingState({
            isOpen: true,
            recipient: contact.name,
            initialMessage: '',
            channel: 'WhatsApp',
          });
        }}
        onToggleTorchModal={() => setIsScreenTorchOpen(true)}
      />

      {/* Advanced Task, Reminders & Calendar Modal */}
      <CalendarRemindersModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        currentUser={currentUser}
        onSignInGoogle={handleGoogleSignInFlow}
        events={calendarEvents}
        onAddEvent={(newEvent) => {
          const createdEvent = { ...newEvent, id: `e-${Date.now()}` };
          setCalendarEvents((prev) => [createdEvent, ...prev]);
          if (currentUser?.uid) {
            saveEventToFirestore(currentUser.uid, createdEvent);
          }
          playCyberTone('confirm');
        }}
        onDeleteEvent={(id) => {
          setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
          if (currentUser?.uid) {
            deleteEventFromFirestore(currentUser.uid, id);
          }
        }}
        tasks={tasks}
        onToggleTask={(id) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === id) {
                const updated = {
                  ...t,
                  isCompleted: !t.isCompleted,
                  completedAt: !t.isCompleted ? Date.now() : undefined,
                };
                if (currentUser?.uid) saveTaskToFirestore(currentUser.uid, updated);
                return updated;
              }
              return t;
            })
          );
          playCyberTone('click');
        }}
        onAddTask={(newTask) => {
          const created: TaskItem = {
            id: `t-${Date.now()}`,
            ...newTask,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setTasks((prev) => [created, ...prev]);
          if (currentUser?.uid) {
            saveTaskToFirestore(currentUser.uid, created);
          }
          playCyberTone('confirm');
        }}
        onUpdateTask={(id, updates) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === id) {
                const updated = { ...t, ...updates, updatedAt: Date.now() };
                if (currentUser?.uid) saveTaskToFirestore(currentUser.uid, updated);
                return updated;
              }
              return t;
            })
          );
          playCyberTone('confirm');
        }}
        onDeleteTask={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
          if (currentUser?.uid) {
            deleteTaskFromFirestore(currentUser.uid, id);
          }
        }}
        onConvertTaskToEvent={handleConvertTaskToEvent}
        thirdPartyWebhookUrl={thirdPartyWebhookUrl}
        onUpdateWebhookUrl={(url) => {
          setThirdPartyWebhookUrl(url);
          localStorage.setItem('vvc_liam_webhook', url);
        }}
      />

      {/* E2EE Encrypted Vault Modal */}
      <EncryptedVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        vaultItems={vaultItems}
        onSaveItem={(item) => setVaultItems((prev) => [item, ...prev])}
        onDeleteItem={(id) => setVaultItems((prev) => prev.filter((v) => v.id !== id))}
        masterPassphrase={masterPassphrase}
        onUpdateMasterPassphrase={(p) => setMasterPassphrase(p)}
      />

      {/* Settings Modal (AI Models & Cloud Services Dropdowns) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentModel={currentModel}
        onSelectModel={handleSelectModel}
        currentCloudIntegration={currentCloudIntegration}
        onSelectCloudIntegration={handleSelectCloudIntegration}
        nvidiaApiKey={nvidiaApiKey}
        onUpdateNvidiaApiKey={(k) => {
          setNvidiaApiKey(k);
          SecretsService.setSecret('nvidia_api_key', k);
        }}
        geminiApiKey={geminiApiKey}
        onUpdateGeminiApiKey={(k) => {
          setGeminiApiKey(k);
          SecretsService.setSecret('gemini_api_key', k);
        }}
        onOpenSecrets={() => {
          setTargetSecretId(null);
          setIsSecretsModalOpen(true);
        }}
        customEndpoint={customEndpoint}
        onUpdateCustomEndpoint={(ep) => {
          setCustomEndpoint(ep);
          SecretsService.setSecret('custom_endpoint', ep);
        }}
        thirdPartyWebhookUrl={thirdPartyWebhookUrl}
        onUpdateThirdPartyWebhookUrl={(url) => {
          setThirdPartyWebhookUrl(url);
          SecretsService.setSecret('webhook_url', url);
        }}
        selectedVoiceId={selectedVoiceId}
        onSelectVoiceId={(v) => {
          setSelectedVoiceId(v);
          localStorage.setItem('vvc_liam_voice', v);
        }}
        pitchModifier={pitchModifier}
        onUpdatePitch={setPitchModifier}
        rateModifier={rateModifier}
        onUpdateRate={setRateModifier}
        autoDarkMode={autoDarkMode}
        onToggleAutoDarkMode={() => setAutoDarkMode(!autoDarkMode)}
        cloudSyncEnabled={cloudSyncEnabled}
        onToggleCloudSync={() => setCloudSyncEnabled(!cloudSyncEnabled)}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        currentTheme={currentTheme}
        onSelectTheme={(theme) => setCurrentTheme(theme)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* API Keys & Secrets Vault Modal */}
      <ApiSecretsModal
        isOpen={isSecretsModalOpen}
        onClose={() => {
          setIsSecretsModalOpen(false);
          setTargetSecretId(null);
        }}
        targetSecretId={targetSecretId}
        onSecretsUpdated={handleSecretsUpdated}
      />

      {/* App / APK Installation Guide Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Gmail Workspace Modal */}
      <GmailModal
        isOpen={isGmailOpen}
        onClose={() => setIsGmailOpen(false)}
        currentUser={currentUser}
        onAuthChange={(u) => setCurrentUser(u)}
        initialRecipient={gmailDraft.recipient}
        initialSubject={gmailDraft.subject}
        initialBody={gmailDraft.body}
      />

      {/* Google Drive Picker Modal */}
      <GoogleDrivePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        currentUser={currentUser}
        onSignInRequired={async () => {
          try {
            const res = await googleSignIn();
            if (res?.user) setCurrentUser(res.user);
          } catch {}
        }}
      />

      {/* Google Maps Platform Radar Panel */}
      <GoogleMapsPanel
        apiKey={mapsApiKey}
        isOpen={isMapsOpen}
        onClose={() => setIsMapsOpen(false)}
      />

      {/* Document & Spreadsheet Studio Modal (Native PDF, Text/CSV Export & Google Docs Cloud) */}
      <DocumentSpreadsheetModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        initialMode={docsModalMode}
        currentUser={currentUser}
        onSignInGoogle={handleGoogleSignInFlow}
        onNotify={(msg) => {
          playCyberTone('confirm');
          speakKokoro(msg, selectedVoiceId);
        }}
      />

      {/* Google Contacts & Directory Modal (People API v1) */}
      <GoogleContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        currentUser={currentUser}
        onSignInGoogle={handleGoogleSignInFlow}
        contacts={contacts}
        onUpdateContacts={(updated) => setContacts(updated)}
        onInitiateCall={(contact) => {
          setIsContactsOpen(false);
          handleProcessCommand(`Llamar a ${contact.name}`);
        }}
        onInitiateMessage={(contact) => {
          setIsContactsOpen(false);
          setMessagingState({
            isOpen: true,
            recipient: contact.phone || contact.name,
            initialMessage: '',
            channel: 'SMS',
          });
        }}
        onNotify={(msg) => {
          playCyberTone('confirm');
          speakKokoro(msg, selectedVoiceId);
        }}
      />

      {/* Specialized Agents Matrix Modal (JSON Blocks, Custom Agents, File Import/Export) */}
      <AgentsModal
        isOpen={isAgentsModalOpen}
        onClose={() => setIsAgentsModalOpen(false)}
        agents={agents}
        activeAgentId={activeAgentId}
        initialTab={agentsModalInitialTab}
        onSelectAgent={(id) => {
          setActiveAgentId(id);
          const ag = agents.find((a) => a.id === id);
          if (ag) {
            if (ag.preferredModel) {
              setCurrentModel(ag.preferredModel);
            }
            playCyberTone('confirm');
            speakKokoro(`Agente "${ag.name}" activado. Directivas y modelo ${ag.preferredModel || currentModel} sincronizados.`, selectedVoiceId);
          }
        }}
        onAddAgent={(newAgent, activate) => {
          setAgents((prev) => {
            const filtered = prev.filter((a) => a.id !== newAgent.id);
            return [...filtered, newAgent];
          });
          if (activate) {
            setActiveAgentId(newAgent.id);
          }
          playCyberTone('confirm');
        }}
        onAddAgents={(newAgents, activateFirst) => {
          setAgents((prev) => {
            const newIds = new Set(newAgents.map((a) => a.id));
            const filtered = prev.filter((a) => !newIds.has(a.id));
            return [...filtered, ...newAgents];
          });
          if (activateFirst && newAgents.length > 0) {
            setActiveAgentId(newAgents[0].id);
          }
          playCyberTone('confirm');
        }}
        onUpdateAgent={(updated) => {
          setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }}
        onDeleteAgent={(id) => {
          setAgents((prev) => prev.filter((a) => a.id !== id));
          if (activeAgentId === id) {
            setActiveAgentId('ag-executive');
          }
        }}
        onResetAgents={() => {
          setAgents(DEFAULT_AGENTS);
          setActiveAgentId('ag-executive');
          playCyberTone('confirm');
          speakKokoro('Agentes predeterminados restaurados.', selectedVoiceId);
        }}
        onNotify={(msg) => {
          playCyberTone('confirm');
          speakKokoro(msg, selectedVoiceId);
        }}
      />

      {/* Real-time D3.js Telemetry & VAOS Orchestrator Panel */}
      <TelemetryPanel
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
        activeAgentName={activeAgent ? activeAgent.name : 'Modo Neutro'}
      />

      {/* Interactive Help Center Modal (FAQs, Voice Shortcuts & System Guide) */}
      <HelpCenterModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onExecuteVoiceCommand={(cmd) => handleProcessCommand(cmd)}
      />
    </div>
  );
}
