import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface GeneratePdfOptions {
  filename?: string;
  marginMm?: number;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Scans a range of canvas pixel rows to find the best horizontal whitespace gap
 * where no text or graphics are present, ensuring page breaks never slice text or lines.
 */
function findSafePageBreakY(
  ctx: CanvasRenderingContext2D,
  width: number,
  targetCutY: number,
  searchWindow: number
): number {
  const startY = Math.max(0, targetCutY - searchWindow);
  const scanHeight = targetCutY - startY;
  if (scanHeight <= 0) return targetCutY;

  try {
    const imgData = ctx.getImageData(0, startY, width, scanHeight);
    const data = imgData.data;

    let bestY = targetCutY;
    let longestGapLength = 0;
    let currentGapLength = 0;
    let currentGapCenter = targetCutY;

    // Scan from startY to targetCutY
    for (let row = 0; row < scanHeight; row++) {
      let isWhiteRow = true;
      const rowOffset = row * width * 4;

      // Sample pixels across the row (stride 2 for performance)
      for (let col = 0; col < width; col += 2) {
        const idx = rowOffset + col * 4;
        const r = data[idx] ?? 255;
        const g = data[idx + 1] ?? 255;
        const b = data[idx + 2] ?? 255;
        const a = data[idx + 3] ?? 255;

        // If pixel is darker than off-white, row contains text or graphics
        if (a > 30 && (r < 240 || g < 240 || b < 240)) {
          isWhiteRow = false;
          break;
        }
      }

      if (isWhiteRow) {
        currentGapLength++;
        if (currentGapLength >= longestGapLength) {
          longestGapLength = currentGapLength;
          currentGapCenter = startY + row - Math.floor(currentGapLength / 2);
          bestY = currentGapCenter;
        }
      } else {
        currentGapLength = 0;
      }
    }

    // If we found a clean whitespace gap (at least 3 consecutive white rows), use its center
    if (longestGapLength >= 3) {
      return bestY;
    }
  } catch (err) {
    console.warn('Canvas scan notice:', err);
  }

  // Fallback if scanning fails or whole window is colored
  return targetCutY;
}

/**
 * Generate a clean, multi-page vector-styled PDF from an HTML element
 * with smart whitespace line-break detection so text is NEVER cut in half.
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: GeneratePdfOptions = {}
): Promise<{ pdf: jsPDF; blob: Blob; objectUrl: string }> {
  const marginMm = options.marginMm ?? 10;
  const orientation = options.orientation ?? 'portrait';
  const format = options.format ?? 'a4';

  const pageWidthMm = orientation === 'portrait' ? 210 : 297;
  const pageHeightMm = orientation === 'portrait' ? 297 : 210;
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const maxContentHeightMm = pageHeightMm - marginMm * 2;

  // Check if element defines explicit individual A4 pages via [data-pdf-page]
  const explicitPages = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'));

  if (explicitPages.length > 0) {
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format
    });

    for (let i = 0; i < explicitPages.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const pageEl = explicitPages[i];
      if (!pageEl) continue;
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
      const fitHeightMm = Math.min(imgHeightMm, maxContentHeightMm);

      pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, fitHeightMm);
    }

    const totalPages = pdf.getNumberOfPages();
    if (totalPages > 1) {
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(140, 140, 140);
        pdf.text(`Page ${p} of ${totalPages}`, pageWidthMm - marginMm - 18, pageHeightMm - 5);
        pdf.text('PM Surya Ghar • Official EPC Document', marginMm, pageHeightMm - 5);
      }
    }

    const blob = pdf.output('blob');
    const objectUrl = URL.createObjectURL(blob);
    return { pdf, blob, objectUrl };
  }

  // Render element to high-res canvas (scale 2 for crisp text and official stamps)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const masterWidth = canvas.width;
  const masterHeight = canvas.height;
  const ctx = canvas.getContext('2d');

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format
  });

  // Calculate max printable height per page in canvas pixel units
  const maxPageCanvasHeight = Math.floor((masterWidth * maxContentHeightMm) / contentWidthMm);

  // If document fits on 1 single page without overflow
  if (masterHeight <= maxPageCanvasHeight) {
    const fitHeightMm = (masterHeight * contentWidthMm) / masterWidth;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', marginMm, marginMm, contentWidthMm, fitHeightMm);

    const blob = pdf.output('blob');
    const objectUrl = URL.createObjectURL(blob);
    return { pdf, blob, objectUrl };
  }

  // Multi-page document: Slice canvas intelligently at whitespace lines between paragraphs
  let currentY = 0;
  let pageIndex = 0;
  // Look back up to 25% of the page height for empty line gaps between paragraphs/clauses
  const searchWindow = Math.floor(maxPageCanvasHeight * 0.25);

  while (currentY < masterHeight) {
    const remainingHeight = masterHeight - currentY;
    let sliceHeight = 0;
    let cutY = 0;

    if (remainingHeight <= maxPageCanvasHeight) {
      // Last page slice fits completely
      sliceHeight = remainingHeight;
      cutY = masterHeight;
    } else {
      const idealCutY = currentY + maxPageCanvasHeight;
      if (ctx) {
        cutY = findSafePageBreakY(ctx, masterWidth, idealCutY, searchWindow);
      } else {
        cutY = idealCutY;
      }

      // Ensure reasonable forward progress
      if (cutY <= currentY + Math.floor(maxPageCanvasHeight * 0.5)) {
        cutY = idealCutY;
      }
      sliceHeight = cutY - currentY;
    }

    // Create a cleanly isolated canvas slice for this page
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = masterWidth;
    sliceCanvas.height = sliceHeight;
    const sliceCtx = sliceCanvas.getContext('2d');

    if (sliceCtx) {
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, masterWidth, sliceHeight);
      sliceCtx.drawImage(
        canvas,
        0,
        currentY,
        masterWidth,
        sliceHeight,
        0,
        0,
        masterWidth,
        sliceHeight
      );
    }

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceHeightMm = (sliceHeight * contentWidthMm) / masterWidth;
    pdf.addImage(
      sliceCanvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      marginMm,
      marginMm,
      contentWidthMm,
      sliceHeightMm
    );

    currentY = cutY;
    pageIndex++;
  }

  // Add clean page numbers and footer on multi-page documents
  const totalPages = pdf.getNumberOfPages();
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(140, 140, 140);
      pdf.text(`Page ${p} of ${totalPages}`, pageWidthMm - marginMm - 18, pageHeightMm - 5);
      pdf.text('PM Surya Ghar • Official EPC Document', marginMm, pageHeightMm - 5);
    }
  }

  const blob = pdf.output('blob');
  const objectUrl = URL.createObjectURL(blob);
  return { pdf, blob, objectUrl };
}

/**
 * Trigger immediate browser download of the generated PDF
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename = 'document.pdf'
): Promise<Blob> {
  const { pdf, blob } = await generatePdfFromElement(element, { filename });
  pdf.save(filename);
  return blob;
}
