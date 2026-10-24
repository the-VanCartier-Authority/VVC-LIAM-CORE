import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  RefreshCw, 
  Paperclip, 
  User as UserIcon, 
  LogOut, 
  ExternalLink, 
  Search, 
  Inbox, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Volume2, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { 
  listGmailMessages, 
  getGmailMessageDetail, 
  sendGmailEmail, 
  type GmailMessageSummary, 
  type GmailMessageDetail 
} from '../services/gmailService';
import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken, 
  auth 
} from '../services/googleAuth';
import { openGooglePicker, type PickedGoogleDriveFile } from '../services/pickerService';
import { speakKokoro } from '../utils/speech';
import type { User } from 'firebase/auth';

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onAuthChange: (user: User | null) => void;
  initialRecipient?: string;
  initialSubject?: string;
  initialBody?: string;
}

export const GmailModal: React.FC<GmailModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthChange,
  initialRecipient = '',
  initialSubject = '',
  initialBody = '',
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'detail'>('inbox');
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Compose form state
  const [toEmail, setToEmail] = useState(initialRecipient);
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBody);
  const [attachedFiles, setAttachedFiles] = useState<PickedGoogleDriveFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  // Mandatory Confirmation Dialog State for Mutating Actions
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);

  useEffect(() => {
    if (initialRecipient) setToEmail(initialRecipient);
    if (initialSubject) setSubject(initialSubject);
    if (initialBody) setBodyText(initialBody);
    if (initialRecipient || initialSubject || initialBody) {
      setActiveTab('compose');
    }
  }, [initialRecipient, initialSubject, initialBody]);

  // Load emails when modal opens or user logs in
  useEffect(() => {
    if (isOpen && currentUser && activeTab === 'inbox') {
      loadMessages();
    }
  }, [isOpen, currentUser, activeTab]);

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    setErrorMessage(null);
    try {
      const msgs = await listGmailMessages(15);
      setMessages(msgs);
    } catch (err: any) {
      console.warn('Error loading Gmail:', err);
      setErrorMessage(err.message || 'Error al conectar con Gmail');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        onAuthChange(res.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión con Google');
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    onAuthChange(null);
    setMessages([]);
    setSelectedMessage(null);
  };

  const handleOpenDetail = async (msg: GmailMessageSummary) => {
    setIsLoadingMessages(true);
    try {
      const detail = await getGmailMessageDetail(msg.id);
      setSelectedMessage(detail);
      setActiveTab('detail');
    } catch (err: any) {
      setErrorMessage('No se pudo cargar el correo completo.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Launch Google Picker to attach files from Google Drive
  const handleAttachFromDrive = async () => {
    try {
      await openGooglePicker({
        onPicked: (file) => {
          setAttachedFiles((prev) => [...prev, file]);
        },
        onError: (err) => {
          alert(`Error al abrir Google Picker: ${err.message}`);
        },
      });
    } catch (err: any) {
      alert(`Google Picker: ${err.message}`);
    }
  };

  // Handle Send Confirmation & Dispatch
  const handleConfirmSend = async () => {
    setShowSendConfirmation(false);
    setIsSending(true);
    setErrorMessage(null);
    setSendSuccessMessage(null);

    try {
      // Append Drive file links if any attached
      let fullBody = bodyText;
      if (attachedFiles.length > 0) {
        fullBody += '\n\n--- Archivos adjuntos desde Google Drive ---\n';
        attachedFiles.forEach((f) => {
          fullBody += `• ${f.name}: ${f.url}\n`;
        });
      }

      await sendGmailEmail(toEmail, subject, fullBody);
      setSendSuccessMessage(`Correo enviado con éxito a ${toEmail}`);
      setToEmail('');
      setSubject('');
      setBodyText('');
      setAttachedFiles([]);
      setTimeout(() => {
        setSendSuccessMessage(null);
        setActiveTab('inbox');
        loadMessages();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar el correo');
    } finally {
      setIsSending(false);
    }
  };

  const filteredMessages = messages.filter((m) => {
    const q = searchFilter.toLowerCase();
    return (
      m.subject.toLowerCase().includes(q) ||
      m.from.toLowerCase().includes(q) ||
      m.snippet.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-[#090b10] border border-cyan-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.12)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0d1017] border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold tracking-wider text-gray-200">
                  VVC LIAM CORE // GMAIL WORKSPACE
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-950/80 text-red-300 border border-red-800/60">
                  OAUTH 2.0
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Bandeja de entrada, redacción segura y Google Picker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#121620] border border-gray-700/60 rounded-xl text-xs font-mono text-gray-300">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span className="hidden md:inline max-w-[140px] truncate">
                  {currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-gray-400 hover:text-red-400 p-1"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#07090d] border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === 'inbox' || activeTab === 'detail'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Bandeja ({messages.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-2 ${
                activeTab === 'compose'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Redactar</span>
            </button>
          </div>

          {activeTab === 'inbox' && currentUser && (
            <button
              onClick={loadMessages}
              disabled={isLoadingMessages}
              className="p-1.5 text-gray-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-950/40 transition-colors disabled:opacity-50"
              title="Actualizar correos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Notification Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs font-mono text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {sendSuccessMessage && (
            <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{sendSuccessMessage}</span>
            </div>
          )}

          {/* If user not authenticated, show Google Sign-In Card */}
          {!currentUser ? (
            <div className="py-12 px-4 text-center max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.2)]">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h4 className="font-mono text-base font-bold text-gray-200 mb-2">
                Conectar Google Workspace
              </h4>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Inicia sesión con tu cuenta de Google autorizada para leer correos, redactar mensajes y seleccionar archivos desde Google Drive con total privacidad y control de acceso.
              </p>

              {/* Official Google Branded Button */}
              <button
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-medium text-sm shadow-md transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Acceder con Google</span>
              </button>
            </div>
          ) : activeTab === 'inbox' ? (
            /* Inbox Tab */
            <div className="space-y-3">
              {/* Search filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar por remitente, asunto o texto..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0c0f16] border border-gray-800 rounded-xl text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {isLoadingMessages ? (
                <div className="py-12 text-center text-gray-400 font-mono text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Sincronizando mensajes desde Gmail...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-mono text-xs">
                  No se encontraron correos en tu bandeja.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => handleOpenDetail(msg)}
                      className="p-3 bg-[#0d1017] hover:bg-[#121622] border border-gray-800/80 hover:border-cyan-500/40 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {msg.isUnread && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
                          )}
                          <span className="text-xs font-semibold text-gray-200 truncate">
                            {msg.from.replace(/<.*>/, '').trim()}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {msg.date.split(',')[0]}
                          </span>
                        </div>
                        <h5 className="text-xs font-medium text-cyan-400 group-hover:text-cyan-300 truncate mb-1">
                          {msg.subject}
                        </h5>
                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {msg.snippet}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'detail' && selectedMessage ? (
            /* Email Detail Tab */
            <div className="space-y-4">
              <button
                onClick={() => setActiveTab('inbox')}
                className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la bandeja</span>
              </button>

              <div className="p-4 bg-[#0d1017] border border-gray-800 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-100">{selectedMessage.subject}</h4>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      De: <span className="text-cyan-300">{selectedMessage.from}</span>
                    </p>
                    {selectedMessage.to && (
                      <p className="text-[11px] text-gray-500 font-mono">
                        Para: {selectedMessage.to}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      speakKokoro(
                        `Correo de ${selectedMessage.from}. Asunto: ${selectedMessage.subject}. Mensaje: ${selectedMessage.snippet}`
                      )
                    }
                    className="p-2 rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
                    title="Escuchar por voz"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-3 border-t border-gray-800/80">
                  <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans max-h-96 overflow-y-auto pr-2">
                    {selectedMessage.body}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Compose Tab */
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                    Destinatario
                  </label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full px-3 py-2 bg-[#0c0f16] border border-gray-800 rounded-xl text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Asunto del mensaje..."
                    className="w-full px-3 py-2 bg-[#0c0f16] border border-gray-800 rounded-xl text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1">
                    Mensaje
                  </label>
                  <textarea
                    rows={6}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    className="w-full px-3 py-2 bg-[#0c0f16] border border-gray-800 rounded-xl text-xs font-sans text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 leading-relaxed"
                  />
                </div>

                {/* Google Drive Picker Attachment Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-gray-400 uppercase">
                      Archivos de Google Drive
                    </span>
                    <button
                      type="button"
                      onClick={handleAttachFromDrive}
                      className="px-2.5 py-1 text-xs font-mono bg-blue-950/50 hover:bg-blue-900/50 text-blue-300 border border-blue-500/40 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Abrir Google Picker</span>
                    </button>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="space-y-1.5">
                      {attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="px-3 py-1.5 bg-[#0f1420] border border-blue-500/30 rounded-lg flex items-center justify-between text-xs font-mono text-blue-200"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))
                            }
                            className="text-gray-400 hover:text-red-400 p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Button triggering Confirmation Dialog */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!toEmail.trim() || !subject.trim() || isSending}
                    onClick={() => setShowSendConfirmation(true)}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Revisar y Enviar Correo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog for Mutating Operation (Sending Email) */}
      {showSendConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0b0e14] border border-cyan-500/50 rounded-2xl max-w-md w-full p-5 shadow-[0_0_50px_rgba(0,240,255,0.2)] space-y-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <h4 className="font-mono text-sm font-bold text-gray-100">
                Confirmación de Envío en Gmail
              </h4>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              ¿Confirmas el envío de este correo desde tu cuenta de Gmail a{' '}
              <strong className="text-cyan-300 font-mono">{toEmail}</strong> con el asunto &quot;
              <span className="text-gray-100">{subject}</span>&quot;?
            </p>

            {attachedFiles.length > 0 && (
              <div className="text-[11px] font-mono text-blue-300 bg-blue-950/40 p-2 rounded-lg border border-blue-500/20">
                Se adjuntarán enlaces a {attachedFiles.length} archivo(s) de Google Drive.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSendConfirmation(false)}
                className="px-4 py-2 text-xs font-mono text-gray-400 hover:text-white rounded-xl bg-gray-900 border border-gray-800 hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSend}
                className="px-4 py-2 text-xs font-mono font-bold text-white rounded-xl bg-cyan-600 hover:bg-cyan-500 shadow-md transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Enviando...' : 'Confirmar Envío'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
