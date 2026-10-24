import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Key, 
  Plus, 
  Trash2, 
  X, 
  Eye, 
  EyeOff, 
  Download, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import type { EncryptedVaultItem } from '../types';
import { encryptText, decryptText, computeFingerprint } from '../utils/crypto';

interface EncryptedVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultItems: EncryptedVaultItem[];
  onSaveItem: (item: EncryptedVaultItem) => void;
  onDeleteItem: (id: string) => void;
  masterPassphrase: string;
  onUpdateMasterPassphrase: (pass: string) => void;
}

export const EncryptedVaultModal: React.FC<EncryptedVaultModalProps> = ({
  isOpen,
  onClose,
  vaultItems,
  onSaveItem,
  onDeleteItem,
  masterPassphrase,
  onUpdateMasterPassphrase,
}) => {
  const [passInput, setPassInput] = useState(masterPassphrase || 'vvc-liam-core-master-key-2026');
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [fingerprint, setFingerprint] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'nota' | 'clave' | 'contacto'>('nota');
  const [decryptedContents, setDecryptedContents] = useState<{ [id: string]: string }>({});
  const [visibleItems, setVisibleItems] = useState<{ [id: string]: boolean }>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    if (passInput) {
      computeFingerprint(passInput).then(setFingerprint);
    }
  }, [passInput]);

  if (!isOpen) return null;

  const handleUnlock = () => {
    if (!passInput.trim()) {
      setErrorMsg('Ingresa una frase de paso para la bóveda.');
      return;
    }
    onUpdateMasterPassphrase(passInput);
    setIsUnlocked(true);
    setErrorMsg('');
  };

  const handleEncryptAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const { ciphertext, iv, salt } = await encryptText(newContent.trim(), passInput);
      const newItem: EncryptedVaultItem = {
        id: `vault-${Date.now()}`,
        title: newTitle.trim(),
        encryptedContent: ciphertext,
        iv,
        salt,
        category: newCategory,
        updatedAt: Date.now(),
      };
      onSaveItem(newItem);
      setNewTitle('');
      setNewContent('');
      setSuccessMsg('Elemento cifrado con éxito mediante AES-GCM-256.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(`Error al cifrar: ${err?.message || 'Error desconocido'}`);
    }
  };

  const handleToggleDecrypt = async (item: EncryptedVaultItem) => {
    if (visibleItems[item.id]) {
      setVisibleItems((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    try {
      const plaintext = await decryptText(item.encryptedContent, item.iv, item.salt, passInput);
      setDecryptedContents((prev) => ({ ...prev, [item.id]: plaintext }));
      setVisibleItems((prev) => ({ ...prev, [item.id]: true }));
      setErrorMsg('');
    } catch {
      setErrorMsg('No se pudo descifrar. Verifica que la clave maestra coincida con la que cifró este elemento.');
    }
  };

  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vaultItems, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vvc_liam_core_encrypted_vault_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-5 shadow-[0_0_50px_rgba(255,42,95,0.2)] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#ff2a5f]" />
            <h3 className="font-mono text-sm font-bold text-white tracking-wider">
              Bóveda de cifrado local experimental
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cryptographic Key & Fingerprint Banner */}
        <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-3 my-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Key className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>Huella Criptográfica SHA-256:</span>
              <span className="text-[#00f0ff] font-bold tracking-wider">{fingerprint || 'GENERANDO...'}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#131929] hover:bg-[#1b2339] text-[11px] font-mono text-slate-300 border border-[#1e2638] transition-colors"
              >
                <Download className="w-3 h-3 text-[#00f0ff]" />
                <span>Exportar Vault</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e2638]/60 text-[10px] font-mono text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Bóveda experimental: contraseña predeterminada y datos sólo en memoria. No la uses para información sensible hasta completar su protección y recuperación.
            </span>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-2.5 rounded bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
          {/* New Item Form */}
          <form onSubmit={handleEncryptAndSave} className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-white font-semibold">
              <span className="text-[#00f0ff] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Cifrar Nueva Nota o Credencial
              </span>
              <span className="text-[10px] text-slate-400">AES-GCM-256 + PBKDF2</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título del registro cifrado..."
                className="flex-1 bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
              >
                <option value="nota">Nota Secreta</option>
                <option value="clave">Credencial / Token</option>
                <option value="contacto">Contacto Privado</option>
              </select>
            </div>

            <textarea
              rows={2}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Contenido confidencial (se encriptará inmediatamente)..."
              className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded p-2 text-xs text-slate-100 focus:outline-none resize-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-4 py-1.5 rounded bg-[#ff2a5f] hover:bg-[#e02050] text-white font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(255,42,95,0.4)] disabled:opacity-40"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Cifrar y Guardar</span>
              </button>
            </div>
          </form>

          {/* Vault Items List */}
          <div className="space-y-2">
            <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Registros en la Bóveda ({vaultItems.length})</span>
            </div>

            {vaultItems.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-[#0b0e17] rounded-xl border border-[#1e2638]">
                Bóveda vacía. Añade tu primera nota o di por voz "Cifrar nota [texto]".
              </div>
            ) : (
              vaultItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#0b0e17] border border-[#1e2638] hover:border-[#ff2a5f]/40 rounded-xl space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[#ff2a5f]" />
                      <span className="font-semibold text-white">{item.title}</span>
                      <span className="text-[10px] text-slate-400 uppercase bg-[#141a29] px-1.5 py-0.2 rounded border border-[#1e2638]">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleDecrypt(item)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#131929] hover:bg-[#1c2438] text-slate-300 hover:text-[#00f0ff] text-[11px] transition-colors"
                        title={visibleItems[item.id] ? 'Ocultar' : 'Descifrar'}
                      >
                        {visibleItems[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{visibleItems[item.id] ? 'Bloquear' : 'Descifrar'}</span>
                      </button>

                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Encrypted preview or Decrypted content */}
                  {visibleItems[item.id] ? (
                    <div className="p-2.5 rounded bg-[#06080d] border border-emerald-500/40 text-emerald-300 text-xs font-mono whitespace-pre-wrap animate-fade-in">
                      {decryptedContents[item.id] || 'Descifrando...'}
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-[#06080d] border border-[#1e2638] text-slate-500 text-[10px] font-mono truncate">
                      Payload: {item.encryptedContent.substring(0, 36)}... (AES-256-GCM)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
