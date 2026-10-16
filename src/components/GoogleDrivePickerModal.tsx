import React, { useState } from 'react';
import { 
  X, 
  HardDrive, 
  FolderOpen, 
  ExternalLink, 
  FileText, 
  Plus, 
  ShieldCheck, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { openGooglePicker, type PickedGoogleDriveFile } from '../services/pickerService';
import type { User } from 'firebase/auth';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignInRequired: () => void;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignInRequired,
}) => {
  const [pickedFiles, setPickedFiles] = useState<PickedGoogleDriveFile[]>([]);
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunchPicker = async () => {
    if (!currentUser) {
      onSignInRequired();
      return;
    }

    setPickerError(null);
    setIsOpeningPicker(true);
    try {
      await openGooglePicker({
        onPicked: (file) => {
          setPickedFiles((prev) => [file, ...prev.filter((f) => f.id !== file.id)]);
          setIsOpeningPicker(false);
        },
        onCancel: () => {
          setIsOpeningPicker(false);
        },
        onError: (err) => {
          setIsOpeningPicker(false);
          setPickerError(`Error al abrir Google Picker: ${err.message}`);
        },
      });
    } catch (err: any) {
      setIsOpeningPicker(false);
      setPickerError(`Google Picker: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-[#090b10] border border-blue-500/30 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0d1017] border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold tracking-wider text-gray-200">
                  VVC LIAM CORE // GOOGLE PICKER & DRIVE
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/60">
                  DRIVE API
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Selector nativo de documentos, hojas de cálculo y archivos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {pickerError && (
            <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono flex items-center justify-between gap-2">
              <span>{pickerError}</span>
              <button
                onClick={() => setPickerError(null)}
                className="text-red-400 hover:text-white text-xs underline"
              >
                Cerrar
              </button>
            </div>
          )}

          <div className="p-4 bg-[#0d111a] border border-blue-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-xs font-mono font-bold text-blue-300 flex items-center justify-center sm:justify-start gap-1.5">
                <FolderOpen className="w-4 h-4" />
                <span>Explorar Archivos en Google Drive</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-md">
                Abre el widget oficial de Google Picker para seleccionar documentos, hojas de cálculo, presentaciones o imágenes desde tu cuenta de Google.
              </p>
            </div>

            <button
              onClick={handleLaunchPicker}
              disabled={isOpeningPicker}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-mono text-xs font-bold rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isOpeningPicker ? 'Abriendo...' : 'Seleccionar Archivo'}</span>
            </button>
          </div>

          {/* List of picked files */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
              Archivos Seleccionados ({pickedFiles.length})
            </h5>

            {pickedFiles.length === 0 ? (
              <div className="py-10 text-center text-gray-500 font-mono text-xs border border-dashed border-gray-800 rounded-xl">
                No has seleccionado ningún archivo todavía. Haz clic en &quot;Seleccionar Archivo&quot; para abrir Google Picker.
              </div>
            ) : (
              <div className="space-y-2">
                {pickedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-[#0d1017] border border-gray-800 hover:border-blue-500/40 rounded-xl transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h6 className="text-xs font-semibold text-gray-200 truncate group-hover:text-blue-300">
                          {file.name}
                        </h6>
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          Tipo: {file.mimeType} • ID: {file.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-xs font-mono bg-blue-950/40 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-900/40 flex items-center gap-1 transition-colors"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
