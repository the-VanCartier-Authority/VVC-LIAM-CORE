import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Table, 
  Download, 
  Plus, 
  Trash2, 
  Sparkles, 
  Check, 
  FileDown, 
  Printer, 
  Layers, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Upload,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import type { TextDocumentData, SpreadsheetData } from '../types';
import type { User } from 'firebase/auth';
import { getAccessToken } from '../services/googleAuth';
import {
  listGoogleDocs,
  getGoogleDoc,
  createGoogleDoc,
  insertTextIntoGoogleDoc,
  type GoogleDocSummary,
} from '../services/googleDocsService';
import { 
  exportTextDocumentToPdf, 
  exportSpreadsheetToPdf, 
  downloadTextFile, 
  downloadCsvFile 
} from '../utils/documentPdfExporter';

interface DocumentSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'document' | 'spreadsheet' | 'googledocs';
  onNotify?: (message: string) => void;
  currentUser?: User | null;
  onSignInGoogle?: () => void;
}

const SAMPLE_DOCS: TextDocumentData[] = [
  {
    id: 'doc-1',
    title: 'Informe de Telemetría y Rendimiento VVC-ACIA',
    author: 'VVC-ACIA Executive Core',
    date: new Date().toISOString().split('T')[0],
    category: 'informe',
    content: `1. RESUMEN EJECUTIVO
El sistema de asistencia de voz VVC-ACIA ha operado con un índice de disponibilidad del 99.98% durante el presente ciclo. Los motores de inferencia NVIDIA NIM y los algoritmos RT-Lite han mantenido una latencia media de respuesta inferior a 45ms en operaciones locales.

2. DIAGNÓSTICO DE CONTROL DE HARDWARE
• Linterna y módulos ópticos: 100% calibrados.
• Monitoreo de batería y administración térmica: Óptimo.
• Cifrado E2EE y Bóveda Segura: Protocolo AES-GCM-256 verificado sin anomalías.
• Sincronización de Agenda: Compatibilidad multi-plataforma Google, Outlook y Apple Calendar activa.

3. CONCLUSIONES Y ACCIONES SUGERIDAS
Se recomienda mantener activadas las alertas en segundo plano mediante Service Worker para garantizar la recepción de notificaciones críticas. Todos los subsistemas permanecen sincronizados.`
  },
  {
    id: 'doc-2',
    title: 'Minuta de Reunión de Planificación y Asignación de Tareas',
    author: 'Coordinación de Proyecto',
    date: new Date().toISOString().split('T')[0],
    category: 'minuta',
    content: `ASISTENTES: Carlos Méndez, María García, Alex Rivera, VVC-ACIA OS
OBJETIVO: Revisión de hitos trimestrales y resolución de conflictos de calendario.

ACUERDOS ALCANZADOS:
• Aprobación de la integración bidireccional de calendarios (iCal, Google, Outlook, Apple).
• Implementación del detector de conflictos con reprogramación asistida por voz.
• Automatización de exportación de balances a formato PDF y hoja de cálculo CSV.
• Próxima sesión agendada para el lunes siguiente a las 10:00 horas.`
  }
];

const SAMPLE_SHEETS: SpreadsheetData[] = [
  {
    id: 'sheet-1',
    title: 'Presupuesto Operativo y Asignación de Recursos',
    date: new Date().toISOString().split('T')[0],
    columns: ['Partida', 'Categoría', 'Presupuesto ($)', 'Ejecutado ($)', 'Diferencia ($)'],
    hasTotals: true,
    rows: [
      { 'Partida': 'Servidores de Inferencia GPU', 'Categoría': 'Infraestructura', 'Presupuesto ($)': 1200, 'Ejecutado ($)': 950, 'Diferencia ($)': 250 },
      { 'Partida': 'Licencias y Certificados SSL', 'Categoría': 'Seguridad', 'Presupuesto ($)': 300, 'Ejecutado ($)': 280, 'Diferencia ($)': 20 },
      { 'Partida': 'Almacenamiento Cifrado en la Nube', 'Categoría': 'Storage', 'Presupuesto ($)': 450, 'Ejecutado ($)': 410, 'Diferencia ($)': 40 },
      { 'Partida': 'Comunicaciones & SMS Gateway', 'Categoría': 'Telefonía', 'Presupuesto ($)': 200, 'Ejecutado ($)': 160, 'Diferencia ($)': 40 },
      { 'Partida': 'Auditoría Criptográfica Externa', 'Categoría': 'Compliance', 'Presupuesto ($)': 800, 'Ejecutado ($)': 800, 'Diferencia ($)': 0 },
    ]
  },
  {
    id: 'sheet-2',
    title: 'Registro de Tareas y Control Horario de Dispositivo',
    date: new Date().toISOString().split('T')[0],
    columns: ['ID Tarea', 'Descripción', 'Responsable', 'Horas Estimadas', 'Horas Reales', 'Estado'],
    hasTotals: false,
    rows: [
      { 'ID Tarea': 'T-101', 'Descripción': 'Configuración de Service Worker y Push', 'Responsable': 'Equipo Core', 'Horas Estimadas': '6', 'Horas Reales': '5.5', 'Estado': 'Completada' },
      { 'ID Tarea': 'T-102', 'Descripción': 'Sincronizador Google / Outlook / Apple', 'Responsable': 'Módulo Agenda', 'Horas Estimadas': '8', 'Horas Reales': '7.0', 'Estado': 'Completada' },
      { 'ID Tarea': 'T-103', 'Descripción': 'Generador de Documentos y PDF Export', 'Responsable': 'Módulo Export', 'Horas Estimadas': '4', 'Horas Reales': '3.8', 'Estado': 'Completada' },
      { 'ID Tarea': 'T-104', 'Descripción': 'Detección Inteligente de Conflictos', 'Responsable': 'Algoritmo RT-Lite', 'Horas Estimadas': '5', 'Horas Reales': '4.2', 'Estado': 'Completada' },
    ]
  }
];

export const DocumentSpreadsheetModal: React.FC<DocumentSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'document',
  onNotify,
  currentUser,
  onSignInGoogle,
}) => {
  const [activeTab, setActiveTab] = useState<'document' | 'spreadsheet' | 'googledocs'>(initialMode);

  // Document state
  const [currentDoc, setCurrentDoc] = useState<TextDocumentData>(SAMPLE_DOCS[0]);
  const [docFeedback, setDocFeedback] = useState<string | null>(null);

  // Spreadsheet state
  const [currentSheet, setCurrentSheet] = useState<SpreadsheetData>(SAMPLE_SHEETS[0]);
  const [sheetFeedback, setSheetFeedback] = useState<string | null>(null);

  // Temporary column input
  const [newColName, setNewColName] = useState('');

  // Google Docs state
  const [googleDocsList, setGoogleDocsList] = useState<GoogleDocSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [googleDocsError, setGoogleDocsError] = useState<string | null>(null);
  const [googleDocsSuccess, setGoogleDocsSuccess] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [docToConfirmCreate, setDocToConfirmCreate] = useState<{ title: string; content?: string } | null>(null);

  const fetchGoogleDocs = async () => {
    setIsLoadingDocs(true);
    setGoogleDocsError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setGoogleDocsError('Inicia sesión con Google para acceder a tus Google Docs.');
        return;
      }
      const files = await listGoogleDocs(token);
      setGoogleDocsList(files);
      setGoogleDocsSuccess(`✓ ${files.length} documentos encontrados en Google Drive.`);
      setTimeout(() => setGoogleDocsSuccess(null), 3500);
    } catch (err: any) {
      setGoogleDocsError(err.message || 'Error al conectar con Google Docs');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleLoadDocContent = async (docSummary: GoogleDocSummary) => {
    setIsLoadingDocs(true);
    setGoogleDocsError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Token no disponible');
      const loaded = await getGoogleDoc(token, docSummary.id);
      setCurrentDoc({
        id: `gdoc-${loaded.documentId}`,
        title: loaded.title,
        date: new Date().toISOString().split('T')[0],
        content: loaded.bodyText,
        category: 'general',
      });
      setActiveTab('document');
      setDocFeedback(`✓ Documento "${loaded.title}" cargado en el editor desde Google Docs.`);
      setTimeout(() => setDocFeedback(null), 3500);
    } catch (err: any) {
      setGoogleDocsError(err.message || 'Error al descargar contenido del documento');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const confirmCreateGoogleDoc = async () => {
    if (!docToConfirmCreate) return;
    setIsLoadingDocs(true);
    setGoogleDocsError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Inicia sesión con Google');
      const created = await createGoogleDoc(token, docToConfirmCreate.title, docToConfirmCreate.content);
      setGoogleDocsSuccess(`✓ Documento "${created.name}" creado exitosamente en tu Google Drive.`);
      setDocToConfirmCreate(null);
      setNewDocTitle('');
      fetchGoogleDocs();
      setTimeout(() => setGoogleDocsSuccess(null), 4000);
    } catch (err: any) {
      setGoogleDocsError(err.message || 'Error al crear documento en Google Docs');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  if (!isOpen) return null;

  // Document handlers
  const handleExportDocPdf = () => {
    try {
      exportTextDocumentToPdf(currentDoc);
      setDocFeedback('✓ Documento PDF generado y descargado correctamente.');
      if (onNotify) onNotify(`Documento "${currentDoc.title}" exportado a PDF.`);
      setTimeout(() => setDocFeedback(null), 3500);
    } catch (e: any) {
      setDocFeedback(`Error generando PDF: ${e?.message}`);
    }
  };

  const handleDownloadDocTxt = (ext: 'txt' | 'md') => {
    try {
      downloadTextFile(currentDoc, ext);
      setDocFeedback(`✓ Archivo .${ext.toUpperCase()} descargado.`);
      setTimeout(() => setDocFeedback(null), 3500);
    } catch (e: any) {
      setDocFeedback(`Error descargando archivo: ${e?.message}`);
    }
  };

  // Spreadsheet handlers
  const handleExportSheetPdf = () => {
    try {
      exportSpreadsheetToPdf(currentSheet);
      setSheetFeedback('✓ Hoja de cálculo exportada a PDF.');
      if (onNotify) onNotify(`Hoja de cálculo "${currentSheet.title}" exportada a PDF.`);
      setTimeout(() => setSheetFeedback(null), 3500);
    } catch (e: any) {
      setSheetFeedback(`Error generando PDF: ${e?.message}`);
    }
  };

  const handleDownloadSheetCsv = () => {
    try {
      downloadCsvFile(currentSheet);
      setSheetFeedback('✓ Archivo .CSV descargado.');
      setTimeout(() => setSheetFeedback(null), 3500);
    } catch (e: any) {
      setSheetFeedback(`Error descargando CSV: ${e?.message}`);
    }
  };

  const handleAddSheetRow = () => {
    const emptyRow: Record<string, string | number> = {};
    currentSheet.columns.forEach((col, idx) => {
      emptyRow[col] = idx === 0 ? `Registro ${currentSheet.rows.length + 1}` : '0';
    });
    setCurrentSheet((prev) => ({
      ...prev,
      rows: [...prev.rows, emptyRow],
    }));
  };

  const handleDeleteSheetRow = (rowIndex: number) => {
    setCurrentSheet((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, idx) => idx !== rowIndex),
    }));
  };

  const handleUpdateCell = (rowIndex: number, colName: string, val: string) => {
    setCurrentSheet((prev) => {
      const updatedRows = [...prev.rows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [colName]: val,
      };
      return { ...prev, rows: updatedRows };
    });
  };

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const name = newColName.trim();
    if (currentSheet.columns.includes(name)) return;
    setCurrentSheet((prev) => ({
      ...prev,
      columns: [...prev.columns, name],
      rows: prev.rows.map((row) => ({ ...row, [name]: '0' })),
    }));
    setNewColName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl bg-[#080b12] border border-[#1e2638] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden font-mono text-xs text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2638] bg-[#0c101a]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--primary-accent)]/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              {activeTab === 'document' ? (
                <FileText className="w-4 h-4 text-[var(--primary-accent)]" />
              ) : (
                <Table className="w-4 h-4 text-[var(--primary-accent)]" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                <span>Estudio de Documentos & Hojas de Cálculo</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--primary-accent)]/10 border border-[var(--primary-accent)]/30 text-[var(--primary-accent)] font-semibold">
                  PDF & CSV EXPORT
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Genera, edita y exporta archivos de texto y tablas estructuradas a PDF para descarga inmediata.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#141a29] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 bg-[#080b12] border-b border-[#1e2638]">
          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'document'
                ? 'bg-[#0f1422] text-[var(--primary-accent)] border-t-2 border-[var(--primary-accent)]'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documento de Texto (.txt / .md / PDF)</span>
          </button>

          <button
            onClick={() => setActiveTab('spreadsheet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'spreadsheet'
                ? 'bg-[#0f1422] text-[var(--primary-accent)] border-t-2 border-[var(--primary-accent)]'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Hoja de Cálculo (.csv / PDF)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('googledocs');
              if (googleDocsList.length === 0 && currentUser) {
                fetchGoogleDocs();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'googledocs'
                ? 'bg-[#0f1422] text-emerald-400 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Google Docs (Cloud)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: TEXT DOCUMENT GENERATOR */}
          {activeTab === 'document' && (
            <div className="space-y-4">
              {/* Presets and Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Plantillas Rápidas:</span>
                  <div className="flex items-center gap-1.5">
                    {SAMPLE_DOCS.map((doc, idx) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setCurrentDoc(doc)}
                        className={`px-2.5 py-1 rounded text-[11px] transition-colors border ${
                          currentDoc.id === doc.id
                            ? 'bg-[var(--primary-accent)]/20 border-[var(--primary-accent)] text-[var(--primary-accent)] font-semibold'
                            : 'bg-[#121726] border-[#1e2638] text-slate-300 hover:bg-[#182033]'
                        }`}
                      >
                        {idx === 0 ? 'Informe de Telemetría' : 'Minuta de Reunión'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentDoc({
                          id: `doc-${Date.now()}`,
                          title: 'Nuevo Documento Ejecutivo',
                          author: 'Usuario Principal',
                          date: new Date().toISOString().split('T')[0],
                          category: 'general',
                          content: 'Escribe aquí el contenido del documento...',
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-[#121726] border border-[#1e2638] text-slate-300 hover:text-white hover:bg-[#182033]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>En Blanco</span>
                    </button>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadDocTxt('txt')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#121726] hover:bg-[#182033] border border-[#1e2638] text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>.TXT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocTxt('md')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#121726] hover:bg-[#182033] border border-[#1e2638] text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>.MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        setGoogleDocsError('Inicia sesión con Google para guardar en Google Docs.');
                        setActiveTab('googledocs');
                        return;
                      }
                      setDocToConfirmCreate({
                        title: currentDoc.title || 'Documento sin título',
                        content: currentDoc.content,
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                    title="Exportar documento directamente a Google Docs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Guardar en Google Docs</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDocPdf}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary-accent)] hover:bg-[var(--primary-accent)]/90 text-black font-semibold shadow-[0_0_12px_rgba(0,240,255,0.25)] transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Exportar a PDF 📄</span>
                  </button>
                </div>
              </div>

              {docFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{docFeedback}</span>
                </div>
              )}

              {/* Document Meta Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Título del Documento:</label>
                  <input
                    type="text"
                    value={currentDoc.title}
                    onChange={(e) => setCurrentDoc({ ...currentDoc, title: e.target.value })}
                    className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Autor / Responsable:</label>
                  <input
                    type="text"
                    value={currentDoc.author || ''}
                    onChange={(e) => setCurrentDoc({ ...currentDoc, author: e.target.value })}
                    className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Fecha:</label>
                  <input
                    type="date"
                    value={currentDoc.date}
                    onChange={(e) => setCurrentDoc({ ...currentDoc, date: e.target.value })}
                    className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Text Area Content */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 flex items-center justify-between">
                  <span>Cuerpo del Documento:</span>
                  <span className="text-[10px] text-slate-500">{currentDoc.content.length} caracteres</span>
                </label>
                <textarea
                  rows={12}
                  value={currentDoc.content}
                  onChange={(e) => setCurrentDoc({ ...currentDoc, content: e.target.value })}
                  placeholder="Redacta el informe, minuta o contenido..."
                  className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-3 text-xs text-slate-200 leading-relaxed focus:outline-none font-mono resize-y"
                />
              </div>
            </div>
          )}

          {/* TAB 2: SPREADSHEET GENERATOR */}
          {activeTab === 'spreadsheet' && (
            <div className="space-y-4">
              {/* Presets and Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Hojas de Ejemplo:</span>
                  <div className="flex items-center gap-1.5">
                    {SAMPLE_SHEETS.map((sheet, idx) => (
                      <button
                        key={sheet.id}
                        type="button"
                        onClick={() => setCurrentSheet(sheet)}
                        className={`px-2.5 py-1 rounded text-[11px] transition-colors border ${
                          currentSheet.id === sheet.id
                            ? 'bg-[var(--primary-accent)]/20 border-[var(--primary-accent)] text-[var(--primary-accent)] font-semibold'
                            : 'bg-[#121726] border-[#1e2638] text-slate-300 hover:bg-[#182033]'
                        }`}
                      >
                        {idx === 0 ? 'Presupuesto Operativo' : 'Registro de Horas'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentSheet({
                          id: `sheet-${Date.now()}`,
                          title: 'Nueva Hoja de Cálculo',
                          date: new Date().toISOString().split('T')[0],
                          columns: ['Concepto', 'Cantidad', 'Precio ($)', 'Total ($)'],
                          hasTotals: true,
                          rows: [
                            { 'Concepto': 'Elemento A', 'Cantidad': '10', 'Precio ($)': '25', 'Total ($)': '250' },
                            { 'Concepto': 'Elemento B', 'Cantidad': '5', 'Precio ($)': '40', 'Total ($)': '200' },
                          ],
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-[#121726] border border-[#1e2638] text-slate-300 hover:text-white hover:bg-[#182033]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>En Blanco</span>
                    </button>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSheetCsv}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#121726] hover:bg-[#182033] border border-[#1e2638] text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Descargar .CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSheetPdf}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary-accent)] hover:bg-[var(--primary-accent)]/90 text-black font-semibold shadow-[0_0_12px_rgba(0,240,255,0.25)] transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Exportar Tabla a PDF 📊</span>
                  </button>
                </div>
              </div>

              {sheetFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{sheetFeedback}</span>
                </div>
              )}

              {/* Title & Column Addition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Título de la Hoja:</label>
                  <input
                    type="text"
                    value={currentSheet.title}
                    onChange={(e) => setCurrentSheet({ ...currentSheet, title: e.target.value })}
                    className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-slate-400 block mb-1">Añadir Columna:</label>
                    <input
                      type="text"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      placeholder="Nombre de Columna..."
                      className="w-full bg-[#0a0d16] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-lg p-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="px-3 py-2 mt-4 rounded-lg bg-[#141a29] hover:bg-[#1a2336] text-[var(--primary-accent)] border border-[var(--primary-accent)]/40 text-xs font-semibold"
                  >
                    + Columna
                  </button>
                </div>
              </div>

              {/* Interactive Table Grid */}
              <div className="rounded-xl border border-[#1e2638] bg-[#090c14] overflow-x-auto shadow-inner">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#0f1422] border-b border-[#1e2638]">
                      <th className="p-2.5 text-[11px] font-bold text-slate-400 w-12 text-center">#</th>
                      {currentSheet.columns.map((col) => (
                        <th key={col} className="p-2.5 text-[11px] font-bold text-[var(--primary-accent)] border-r border-[#1e2638]/50">
                          {col}
                        </th>
                      ))}
                      <th className="p-2.5 text-[11px] font-bold text-slate-400 w-12 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-[#1e2638]/40 hover:bg-[#0c101c] transition-colors">
                        <td className="p-2 text-center text-[10px] text-slate-500">{rowIndex + 1}</td>
                        {currentSheet.columns.map((col) => (
                          <td key={col} className="p-1 border-r border-[#1e2638]/40">
                            <input
                              type="text"
                              value={row[col] !== undefined ? String(row[col]) : ''}
                              onChange={(e) => handleUpdateCell(rowIndex, col, e.target.value)}
                              className="w-full bg-transparent px-2 py-1 text-xs text-slate-100 focus:bg-[#121828] focus:outline-none rounded"
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSheetRow(rowIndex)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleAddSheetRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a2336] text-[var(--primary-accent)] border border-[var(--primary-accent)]/30 text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Fila de Datos</span>
                </button>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSheet.hasTotals ?? false}
                      onChange={(e) => setCurrentSheet({ ...currentSheet, hasTotals: e.target.checked })}
                      className="accent-[var(--primary-accent)] rounded"
                    />
                    <span>Calcular Fila de Totales en PDF</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE DOCS (CLOUD) */}
          {activeTab === 'googledocs' && (
            <div className="space-y-4">
              {/* Google Docs Status Header */}
              <div className="bg-[#0b0f19] border border-[#1e2638] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-xs">
                      Google Docs & Google Drive (Documentos en la Nube)
                    </h3>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      {currentUser ? 'CONECTADO' : 'REQUIERE INICIO DE SESIÓN'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Lee, redacta y almacena documentos directamente en tu Google Drive con permisos verificados.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={fetchGoogleDocs}
                      disabled={isLoadingDocs}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                      <span>Actualizar Documentos</span>
                    </button>
                  ) : onSignInGoogle ? (
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="px-3 py-1.5 rounded-lg bg-[#00f0ff] hover:bg-[#00c8d7] text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                    >
                      Acceder con Google
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Status alerts */}
              {googleDocsError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{googleDocsError}</span>
                </div>
              )}
              {googleDocsSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{googleDocsSuccess}</span>
                </div>
              )}

              {/* Create New Google Doc form */}
              {currentUser && (
                <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-emerald-500/30 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Título del nuevo Google Doc..."
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="flex-1 bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newDocTitle.trim()) return;
                      setDocToConfirmCreate({
                        title: newDocTitle.trim(),
                        content: '',
                      });
                    }}
                    className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shrink-0 transition-colors shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                  >
                    Crear Documento
                  </button>
                </div>
              )}

              {/* Google Docs List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Documentos en tu Google Drive ({googleDocsList.length})</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Google Docs API v1
                  </span>
                </div>

                {googleDocsList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-400" />
                    <p>No se encontraron Google Docs cargados</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      {currentUser
                        ? 'Presiona "Actualizar Documentos" para listar tus archivos.'
                        : 'Inicia sesión con Google para acceder a tus documentos de Drive.'}
                    </p>
                  </div>
                ) : (
                  googleDocsList.map((docItem) => (
                    <div
                      key={docItem.id}
                      className="p-3 rounded-xl bg-[#0b0f19] border border-[#1e2638] hover:border-emerald-500/40 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">{docItem.name}</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Google Doc
                          </span>
                        </div>
                        {docItem.modifiedTime && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Modificado: {new Date(docItem.modifiedTime).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadDocContent(docItem)}
                          disabled={isLoadingDocs}
                          className="px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-cyan-400 border border-[#1e2638] text-[10px] font-semibold transition-colors"
                          title="Cargar texto en editor local"
                        >
                          Cargar en Editor
                        </button>

                        {docItem.webViewLink && (
                          <a
                            href={docItem.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            title="Abrir en Google Docs oficial"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal for Google Docs mutations */}
        {docToConfirmCreate && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b0f19] border border-emerald-500/50 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
              <div className="flex items-center gap-2 text-emerald-400">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-bold text-white text-sm">¿Crear Google Doc en Drive?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Confirmas la creación del documento{' '}
                <strong className="text-white">"{docToConfirmCreate.title}"</strong> directamente en tu cuenta de Google Drive?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDocToConfirmCreate(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-slate-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCreateGoogleDoc}
                  disabled={isLoadingDocs}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                >
                  {isLoadingDocs ? 'Creando...' : 'Confirmar Creación'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
