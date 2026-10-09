/**
 * Document & Spreadsheet Studio with Native PDF & Text/CSV Export
 * Uses jsPDF for client-side formatted PDF generation.
 */

import { jsPDF } from 'jspdf';
import type { TextDocumentData, SpreadsheetData } from '../types';

/**
 * Export a structured text document to a formatted, downloadable PDF
 */
export function exportTextDocumentToPdf(doc: TextDocumentData): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header Background Bar (Obsidian Slate)
  pdf.setFillColor(15, 20, 32);
  pdf.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line (Cyan / Obsidian Accent)
  pdf.setDrawColor(0, 240, 255);
  pdf.setLineWidth(1);
  pdf.line(0, 28, pageWidth, 28);

  // Brand Watermark / Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(0, 240, 255);
  pdf.text('VVC-ACIA // OBSIDIAN CORE', margin, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(150, 160, 180);
  pdf.text(`DOCUMENTO OFICIAL · CATEGORÍA: ${(doc.category || 'GENERAL').toUpperCase()}`, margin, 18);
  pdf.text(`FECHA: ${doc.date} · AUTOR: ${doc.author || 'VVC-ACIA Core'}`, margin, 23);

  // Document Title
  let currentY = 40;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(20, 25, 35);
  const titleLines = pdf.splitTextToSize(doc.title, contentWidth);
  pdf.text(titleLines, margin, currentY);
  currentY += titleLines.length * 8 + 4;

  // Subtle separator
  pdf.setDrawColor(200, 210, 225);
  pdf.setLineWidth(0.5);
  pdf.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Document Body Content
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(40, 45, 55);

  const paragraphs = doc.content.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      currentY += 4;
      continue;
    }

    // Check if new page is needed
    if (currentY > pageHeight - 30) {
      pdf.addPage();
      currentY = 25;
    }

    const isBullet = paragraph.trim().startsWith('•') || paragraph.trim().startsWith('-');
    const textToPrint = isBullet ? paragraph.trim() : paragraph;
    const lines = pdf.splitTextToSize(textToPrint, contentWidth);

    pdf.text(lines, margin, currentY);
    currentY += lines.length * 6 + 3;
  }

  // Footer on all pages
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 140, 155);
    pdf.setDrawColor(220, 225, 235);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    pdf.text('Generado por VVC-ACIA Obsidian Engine · Sistema Cifrado y Verificado', margin, pageHeight - 10);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
  }

  const safeFilename = doc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'documento';
  pdf.save(`${safeFilename}_${doc.date}.pdf`);
}

/**
 * Download text document as .txt or .md
 */
export function downloadTextFile(doc: TextDocumentData, extension: 'txt' | 'md' = 'txt'): void {
  const content = `# ${doc.title}
Fecha: ${doc.date}
Autor: ${doc.author || 'VVC-ACIA Core'}
Categoría: ${doc.category}

${doc.content}

---------------------------------------------------------
Generado automáticamente por VVC-ACIA Obsidian Voice Assistant
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = doc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'documento';
  link.setAttribute('download', `${safeFilename}_${doc.date}.${extension}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export a spreadsheet table to a formatted, downloadable PDF
 */
export function exportSpreadsheetToPdf(sheet: SpreadsheetData): void {
  const isLandscape = sheet.columns.length > 5;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const availableWidth = pageWidth - margin * 2;

  // Header Banner
  pdf.setFillColor(15, 20, 32);
  pdf.rect(0, 0, pageWidth, 24, 'F');

  // Accent Line
  pdf.setDrawColor(0, 240, 255);
  pdf.setLineWidth(1);
  pdf.line(0, 24, pageWidth, 24);

  // Brand & Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(0, 240, 255);
  pdf.text('VVC-ACIA // HOJA DE CÁLCULO & DATOS', margin, 11);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(160, 170, 190);
  pdf.text(`HOJA: ${sheet.title.toUpperCase()} · FECHA: ${sheet.date} · REGISTROS: ${sheet.rows.length}`, margin, 18);

  let currentY = 32;

  // Calculate Column Widths
  const colCount = Math.max(1, sheet.columns.length);
  const colWidth = availableWidth / colCount;

  // Table Header Row
  pdf.setFillColor(24, 32, 50);
  pdf.rect(margin, currentY, availableWidth, 9, 'F');
  pdf.setDrawColor(40, 50, 75);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, currentY, availableWidth, 9, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 240, 255);

  sheet.columns.forEach((colName, index) => {
    const x = margin + index * colWidth + 2;
    pdf.text(colName, x, currentY + 6);
  });

  currentY += 9;

  // Table Data Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);

  sheet.rows.forEach((row, rowIndex) => {
    if (currentY > pageHeight - 25) {
      pdf.addPage();
      currentY = 20;

      // Repeat Table Header
      pdf.setFillColor(24, 32, 50);
      pdf.rect(margin, currentY, availableWidth, 9, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 240, 255);
      sheet.columns.forEach((colName, index) => {
        const x = margin + index * colWidth + 2;
        pdf.text(colName, x, currentY + 6);
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      currentY += 9;
    }

    // Alternating Zebra Row Fill
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 253);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(margin, currentY, availableWidth, 8, 'F');

    // Row borders
    pdf.setDrawColor(215, 222, 235);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, currentY, availableWidth, 8, 'S');

    pdf.setTextColor(30, 35, 45);

    sheet.columns.forEach((colName, index) => {
      const x = margin + index * colWidth + 2;
      const cellVal = row[colName] !== undefined ? String(row[colName]) : '';
      const textClipped = pdf.splitTextToSize(cellVal, colWidth - 4)[0] || '';
      pdf.text(textClipped, x, currentY + 5.5);
    });

    currentY += 8;
  });

  // Calculate Totals / Summary Row if enabled
  if (sheet.hasTotals && sheet.rows.length > 0) {
    pdf.setFillColor(230, 238, 250);
    pdf.rect(margin, currentY, availableWidth, 9, 'F');
    pdf.setDrawColor(180, 195, 220);
    pdf.setLineWidth(0.4);
    pdf.rect(margin, currentY, availableWidth, 9, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 25, 45);

    sheet.columns.forEach((colName, index) => {
      const x = margin + index * colWidth + 2;
      if (index === 0) {
        pdf.text('TOTAL / RESUMEN', x, currentY + 6);
      } else {
        // Calculate sum if values are numeric
        const numericValues = sheet.rows
          .map((r) => parseFloat(String(r[colName]).replace(/[$,]/g, '')))
          .filter((v) => !isNaN(v));

        if (numericValues.length > 0) {
          const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
          pdf.text(sum % 1 === 0 ? sum.toString() : sum.toFixed(2), x, currentY + 6);
        }
      }
    });
  }

  // Footer
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 140, 155);
    pdf.setDrawColor(210, 215, 225);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.text('VVC-ACIA Obsidian Core · Hoja de Cálculo Exportada a PDF', margin, pageHeight - 7);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 7);
  }

  const safeFilename = sheet.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'hoja_calculo';
  pdf.save(`${safeFilename}_${sheet.date}.pdf`);
}

/**
 * Download spreadsheet data as standard .csv file
 */
export function downloadCsvFile(sheet: SpreadsheetData): void {
  const headerLine = sheet.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  const rowLines = sheet.rows.map((row) =>
    sheet.columns
      .map((col) => {
        const val = row[col] !== undefined ? String(row[col]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csvContent = [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = sheet.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'hoja_calculo';
  link.setAttribute('download', `${safeFilename}_${sheet.date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
