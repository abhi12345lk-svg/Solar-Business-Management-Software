import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface GeneratePdfOptions {
  filename?: string;
  marginMm?: number;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Generate a clean, multi-page vector-styled PDF from an HTML element
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: GeneratePdfOptions = {}
): Promise<{ pdf: jsPDF; blob: Blob; objectUrl: string }> {
  const marginMm = options.marginMm ?? 10;
  const orientation = options.orientation ?? 'portrait';
  const format = options.format ?? 'a4';

  // Render element to high-res canvas (scale 2 for crisp fonts and stamps)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format
  });

  // A4 dimensions in mm: 210 x 297
  const pageWidthMm = orientation === 'portrait' ? 210 : 297;
  const pageHeightMm = orientation === 'portrait' ? 297 : 210;

  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = (canvas.height * contentWidthMm) / canvas.width;

  let heightLeft = contentHeightMm;
  let positionY = marginMm;

  // First Page
  pdf.addImage(imgData, 'JPEG', marginMm, positionY, contentWidthMm, contentHeightMm);
  heightLeft -= (pageHeightMm - marginMm * 2);

  // Subsequent pages if document overflows A4 length
  while (heightLeft > 0) {
    positionY = heightLeft - contentHeightMm + marginMm;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', marginMm, positionY, contentWidthMm, contentHeightMm);
    heightLeft -= (pageHeightMm - marginMm * 2);
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
