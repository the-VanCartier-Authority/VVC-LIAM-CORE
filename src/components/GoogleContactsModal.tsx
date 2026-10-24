import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  Plus,
  Trash2,
  RefreshCw,
  X,
  ShieldCheck,
  ExternalLink,
  Mail,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import type { PhoneContact } from '../types';
import type { User } from 'firebase/auth';
import { getAccessToken } from '../services/googleAuth';
import {
  listGoogleContacts,
  createGoogleContact,
  deleteGoogleContact,
  convertGoogleContactsToPhoneContacts,
  type GoogleContactItem,
} from '../services/googleContactsService';

interface GoogleContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignInGoogle: () => void;
  contacts: PhoneContact[];
  onUpdateContacts: (contacts: PhoneContact[]) => void;
  onInitiateCall: (contact: PhoneContact) => void;
  onInitiateMessage: (contact: PhoneContact) => void;
  onNotify?: (message: string) => void;
}

export const GoogleContactsModal: React.FC<GoogleContactsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignInGoogle,
  contacts,
  onUpdateContacts,
  onInitiateCall,
  onInitiateMessage,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Contact form
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [syncToGoogleNew, setSyncToGoogleNew] = useState(true);

  // Delete confirmation modal state
  const [contactToDelete, setContactToDelete] = useState<PhoneContact | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      handleFetchGoogleContacts();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleFetchGoogleContacts = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Se requiere iniciar sesión con Google para sincronizar contactos.');
        setIsLoading(false);
        return;
      }

      const googleItems = await listGoogleContacts(token, 100);
      const converted = convertGoogleContactsToPhoneContacts(googleItems);

      // Merge with non-google contacts
      const localOnly = contacts.filter((c) => !c.isGoogleContact);
      const merged = [...localOnly, ...converted];
      onUpdateContacts(merged);

      setSuccessMsg(`✓ Sincronizados ${converted.length} contactos de Google exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error fetching Google Contacts:', err);
      setErrorMsg(err.message || 'Error al conectar con Google People API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      let createdContact: PhoneContact = {
        id: `c-local-${Date.now()}`,
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        relation: 'Contacto Personal',
      };

      if (syncToGoogleNew && currentUser) {
        const token = await getAccessToken();
        if (token) {
          const res = await createGoogleContact(token, {
            givenName: newName.trim(),
            phoneNumber: newPhone.trim() || undefined,
            email: newEmail.trim() || undefined,
          });
          createdContact = {
            id: `google-${res.resourceName.replace('/', '-')}`,
            name: res.name,
            phone: res.phoneNumber || createdContact.phone,
            email: res.email,
            isGoogleContact: true,
          };
        }
      }

      onUpdateContacts([createdContact, ...contacts]);
      setSuccessMsg(`✓ Contacto "${createdContact.name}" añadido exitosamente.`);
      setIsAddingContact(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Error saving contact:', err);
      setErrorMsg(err.message || 'Error al crear contacto');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;
    setIsLoading(true);
    try {
      if (contactToDelete.isGoogleContact && contactToDelete.id.startsWith('google-')) {
        const token = await getAccessToken();
        if (token) {
          // Reconstruct resourceName from id
          const resourceName = contactToDelete.id.replace('google-', '').replace('-', '/');
          await deleteGoogleContact(token, resourceName);
        }
      }

      onUpdateContacts(contacts.filter((c) => c.id !== contactToDelete.id));
      setSuccessMsg(`✓ Contacto "${contactToDelete.name}" eliminado.`);
      setContactToDelete(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Error deleting contact:', err);
      setErrorMsg(err.message || 'Error al eliminar contacto de Google');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-5 shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col max-h-[90vh] relative overflow-hidden">
        {/* Glow header ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-wide flex items-center gap-2">
                Google Contacts & Directorio VAOS
                <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30">
                  People API v1
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Sincronización en tiempo real con Google Contacts y marcación directa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="my-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="my-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Auth / Sync Banner */}
        <div className="my-3 p-3 rounded-xl bg-[#0d121f] border border-[#1e2638] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300">
              {currentUser ? (
                <>
                  Conectado como <strong className="text-white">{currentUser.email}</strong>
                </>
              ) : (
                'Inicia sesión con Google para sincronizar tus contactos de la nube'
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                onClick={handleFetchGoogleContacts}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sincronizar Google</span>
              </button>
            ) : (
              <button
                onClick={onSignInGoogle}
                className="px-3 py-1.5 rounded-lg bg-[#00f0ff] hover:bg-[#00c8d7] text-black text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              >
                <span>Acceder con Google</span>
              </button>
            )}

            <button
              onClick={() => setIsAddingContact(!isAddingContact)}
              className="px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-slate-200 border border-[#1e2638] text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>Nuevo</span>
            </button>
          </div>
        </div>

        {/* Add Contact Form (Toggleable) */}
        {isAddingContact && (
          <form onSubmit={handleSaveContact} className="mb-3 p-3.5 rounded-xl bg-[#0b0e17] border border-[#00f0ff]/30 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#00f0ff]" />
                Registrar Nuevo Contacto
              </span>
              <button
                type="button"
                onClick={() => setIsAddingContact(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nombre completo..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Número telefónico..."
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
              />
              <input
                type="email"
                placeholder="Correo electrónico..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToGoogleNew}
                  onChange={(e) => setSyncToGoogleNew(e.target.checked)}
                  className="rounded border-[#1e2638] text-[#00f0ff] focus:ring-0"
                />
                <span>Guardar también en Google Contacts (Cloud)</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 rounded bg-[#00f0ff] hover:bg-[#00c8d7] text-black text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)]"
              >
                {isLoading ? 'Guardando...' : 'Guardar Contacto'}
              </button>
            </div>
          </form>
        )}

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar contacto por nombre, teléfono o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0e17] border border-[#1e2638] focus:border-[#00f0ff] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
          />
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#00f0ff]" />
              <p>No se encontraron contactos</p>
              <p className="text-[10px] text-slate-600 mt-1">
                {currentUser
                  ? 'Presiona "Sincronizar Google" para cargar tu libreta de direcciones.'
                  : 'Inicia sesión con Google para importar tu lista de People API.'}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-xl bg-[#0b0e17] border border-[#1e2638] hover:border-[#00f0ff]/40 flex items-center justify-between gap-3 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {contact.avatar ? (
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-9 h-9 rounded-full object-cover border border-[#1e2638]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#131929] border border-[#1e2638] flex items-center justify-center font-bold text-white text-xs shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs truncate">{contact.name}</span>
                      {contact.isGoogleContact ? (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          Google Cloud
                        </span>
                      ) : (
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          Local
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 truncate">
                      <span className="text-cyan-400">{contact.phone}</span>
                      {contact.email && (
                        <span className="text-slate-500 truncate">{contact.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={!contact.phone}
                    onClick={() => onInitiateCall(contact)}
                    title={`Llamar a ${contact.name}`}
                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    disabled={!contact.phone}
                    onClick={() => onInitiateMessage(contact)}
                    title={`Enviar mensaje a ${contact.name}`}
                    className="p-2 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setContactToDelete(contact)}
                    title="Eliminar contacto"
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#141a29] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-500">
          <span>Total: {contacts.length} contactos registrados</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acceso con permiso explícito del usuario
          </span>
        </div>

        {/* Delete Confirmation Modal (Strict Workspace destructive requirement) */}
        {contactToDelete && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b0e17] border border-red-500/50 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(255,42,95,0.3)]">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-white text-sm">¿Eliminar contacto?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente a{' '}
                <strong className="text-white">{contactToDelete.name}</strong>?
                {contactToDelete.isGoogleContact && (
                  <span className="block mt-1 text-red-300">
                    Esta acción eliminará el contacto de tu cuenta de Google Contacts.
                  </span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setContactToDelete(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-slate-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteContact}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  {isLoading ? 'Eliminando...' : 'Eliminar permanentemente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
