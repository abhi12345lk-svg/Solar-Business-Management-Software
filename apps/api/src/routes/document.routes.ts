import express, { Router, Request, Response, NextFunction } from 'express';
import {
  uploadDocumentMetadataSchema,
  reviewDocumentSchema,
  createDocumentVersionSchema,
  documentFilterSchema
} from '@ins-solar/shared';
import { DocumentService } from '../services/documentService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import { getStorageAdapter } from '../services/storage/index.js';
import { DocumentModel } from '../models/DocumentModel.js';

export const documentRouter = Router();

// Notice: download route uses HMAC token for authorization, so it shouldn't strictly require session cookie if accessed via direct browser download link with valid signature
/**
 * GET /api/v1/documents/:id/download
 * Secure download endpoint verifying short-lived cryptographic HMAC signature.
 */
documentRouter.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.id as string;
    const { token, expires } = req.query;

    if (!token || !expires) {
      return next(
        AppError.forbidden('Missing required signed authorization token or expiry timestamp.')
      );
    }

    const expiresNum = parseInt(expires as string, 10);
    if (isNaN(expiresNum)) {
      return next(AppError.validation('Invalid expiry timestamp.'));
    }

    const doc = await DocumentService.verifySignedDownloadToken(
      documentId,
      token as string,
      expiresNum
    );

    const storageAdapter = getStorageAdapter();
    let exists = await storageAdapter.objectExists(doc.storageKey);
    if (!exists && config.STORAGE_PROVIDER !== 's3') {
      // In local dev and test runs, seed placeholder buffer matching the mime type so images and PDFs render correctly
      const isImg =
        (doc.mimeType || '').startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.webp'].some(ext =>
          (doc.originalFilename || '').toLowerCase().endsWith(ext)
        );

      let placeholderBuffer: Buffer;
      let contentType = doc.mimeType || 'application/pdf';

      if (isImg) {
        contentType = 'image/svg+xml';
        const safeTitle = (doc.safeDisplayName || doc.documentNumber).replace(/[<>&"]/g, '');
        const safeName = (doc.originalFilename || 'Document').replace(/[<>&"]/g, '');
        const safeCat = (doc.category || 'PAN_CARD').toUpperCase();

        let svgContent = '';

        if (safeCat === 'PAN_CARD') {
          svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
            <defs>
              <linearGradient id="panBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#e0f2fe"/>
                <stop offset="50%" stop-color="#f0fdf4"/>
                <stop offset="100%" stop-color="#fef3c7"/>
              </linearGradient>
              <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#0369a1"/>
                <stop offset="100%" stop-color="#0284c7"/>
              </linearGradient>
            </defs>
            <rect width="856" height="540" rx="24" fill="url(#panBg)" stroke="#94a3b8" stroke-width="2"/>
            <path d="M0 24 C0 10.745 10.745 0 24 0 L832 0 C845.255 0 856 10.745 856 24 L856 80 L0 80 Z" fill="url(#headerGrad)"/>
            <text x="40" y="38" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">आयकर विभाग</text>
            <text x="40" y="62" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#e0f2fe">INCOME TAX DEPARTMENT</text>
            <text x="816" y="38" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="end">भारत सरकार</text>
            <text x="816" y="62" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#e0f2fe" text-anchor="end">GOVT. OF INDIA</text>
            <rect x="50" y="115" width="150" height="180" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
            <circle cx="125" cy="180" r="35" fill="#94a3b8"/>
            <path d="M80 260 C80 220 170 220 170 260 Z" fill="#94a3b8"/>
            <text x="125" y="285" font-family="system-ui, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">PHOTO IDENTIFIER</text>
            <rect x="50" y="315" width="150" height="60" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5"/>
            <text x="125" y="352" font-family="cursive, 'Brush Script MT', sans-serif" font-size="24" font-style="italic" fill="#1e293b" text-anchor="middle">${safeTitle.replace(/PAN Card - /i, '') || 'Applicant'}</text>
            <text x="240" y="135" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">NAME / नाम</text>
            <text x="240" y="165" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">${safeTitle.replace(/PAN Card - /i, '').toUpperCase() || 'RAAKUU'}</text>
            <text x="240" y="205" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">FATHER'S NAME / पिता का नाम</text>
            <text x="240" y="230" font-family="system-ui, sans-serif" font-size="17" font-weight="bold" fill="#1e293b">MR. GUARDIAN / SENIOR</text>
            <text x="240" y="270" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">DATE OF BIRTH / जन्म की तारीख</text>
            <text x="240" y="295" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#1e293b">15/08/1990</text>
            <text x="240" y="340" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#0369a1">PERMANENT ACCOUNT NUMBER / स्थायी खाता संख्या</text>
            <rect x="240" y="355" width="320" height="52" rx="8" fill="#0f172a"/>
            <text x="400" y="390" font-family="monospace" font-size="28" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="4">ABCDE1234F</text>
            <rect x="630" y="120" width="170" height="170" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
            <rect x="645" y="135" width="40" height="40" fill="#0f172a"/>
            <rect x="653" y="143" width="24" height="24" fill="#ffffff"/>
            <rect x="659" y="149" width="12" height="12" fill="#0f172a"/>
            <rect x="745" y="135" width="40" height="40" fill="#0f172a"/>
            <rect x="753" y="143" width="24" height="24" fill="#ffffff"/>
            <rect x="759" y="149" width="12" height="12" fill="#0f172a"/>
            <rect x="645" y="235" width="40" height="40" fill="#0f172a"/>
            <rect x="653" y="243" width="24" height="24" fill="#ffffff"/>
            <rect x="659" y="249" width="12" height="12" fill="#0f172a"/>
            <circle cx="715" cy="205" r="15" fill="#0f172a"/>
            <rect x="665" y="325" width="100" height="60" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
            <text x="715" y="360" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">HOLOGRAM</text>
            <path d="M0 460 L856 460 L856 516 C856 529.255 845.255 540 832 540 L24 540 C10.745 540 0 529.255 0 516 Z" fill="#0f172a"/>
            <text x="40" y="505" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f59e0b">⚡ RAREBOX SOLAR COMPLIANCE VAULT</text>
            <text x="816" y="505" font-family="monospace" font-size="13" fill="#94a3b8" text-anchor="end">${doc.documentNumber} • VERIFIED APPLICANT KYC</text>
          </svg>`;
        } else if (safeCat === 'AADHAAR_CARD') {
          svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
            <defs>
              <linearGradient id="aadhaarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fff7ed"/>
                <stop offset="50%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#f0fdf4"/>
              </linearGradient>
            </defs>
            <rect width="856" height="540" rx="24" fill="url(#aadhaarGrad)" stroke="#ea580c" stroke-width="2"/>
            <rect x="0" y="0" width="856" height="75" fill="#ea580c" rx="24"/>
            <rect x="0" y="45" width="856" height="30" fill="#ea580c"/>
            <text x="40" y="45" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">भारत विशिष्ट पहचान प्राधिकरण</text>
            <text x="816" y="45" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="end">Unique Identification Authority of India</text>
            <rect x="50" y="110" width="150" height="180" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
            <circle cx="125" cy="175" r="35" fill="#94a3b8"/>
            <path d="M80 255 C80 215 170 215 170 255 Z" fill="#94a3b8"/>
            <text x="240" y="130" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">नाम / Name</text>
            <text x="240" y="160" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">${safeTitle || 'Raakuu Sahu'}</text>
            <text x="240" y="200" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">जन्म तिथि / DOB: 15/08/1990</text>
            <text x="240" y="235" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">लिंग / Gender: MALE</text>
            <rect x="230" y="290" width="580" height="80" rx="12" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
            <text x="250" y="325" font-family="monospace" font-size="12" font-weight="bold" fill="#9a3412">आधार संख्या / AADHAAR NUMBER</text>
            <text x="520" y="355" font-family="monospace" font-size="28" font-weight="bold" fill="#c2410c" text-anchor="middle" letter-spacing="6">XXXX XXXX 8921</text>
            <rect x="0" y="465" width="856" height="75" fill="#0f172a" rx="24"/>
            <rect x="0" y="465" width="856" height="30" fill="#0f172a"/>
            <text x="40" y="510" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f59e0b">⚡ RAREBOX SOLAR KYC VERIFICATION</text>
            <text x="816" y="510" font-family="monospace" font-size="13" fill="#94a3b8" text-anchor="end">${doc.documentNumber} • VALIDATED</text>
          </svg>`;
        } else if (safeCat === 'ELECTRICITY_BILL') {
          svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
            <rect width="856" height="540" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
            <rect x="0" y="0" width="856" height="70" fill="#1e3a8a" rx="20"/>
            <rect x="0" y="40" width="856" height="30" fill="#1e3a8a"/>
            <text x="40" y="42" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">⚡ CSPDCL — छत्तीसगढ़ स्टेट पॉवर डिस्ट्रीब्यूशन कं. लि.</text>
            <text x="816" y="42" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#93c5fd" text-anchor="end">ELECTRICITY CONSUMPTION BILL</text>
            <rect x="40" y="100" width="776" height="130" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
            <text x="65" y="135" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Consumer Number / बीपी नंबर</text>
            <text x="65" y="160" font-family="monospace" font-size="18" font-weight="bold" fill="#0f172a">100389271049</text>
            <text x="320" y="135" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Consumer Name</text>
            <text x="320" y="160" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${safeTitle || 'Raakuu Sahu'}</text>
            <text x="600" y="135" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Sanctioned Load / Phase</text>
            <text x="600" y="160" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#15803d">5.0 kW • 1-Phase LT</text>
            <rect x="40" y="250" width="776" height="180" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
            <text x="65" y="290" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Meter Reading &amp; Billing Cycle Summary</text>
            <text x="65" y="325" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Meter No: CSP-99214 • Tariff: Domestic LV-1</text>
            <text x="65" y="355" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Current Units: 450 kWh • Bill Cycle: Oct 2026</text>
            <rect x="580" y="280" width="210" height="90" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
            <text x="685" y="315" font-family="system-ui, sans-serif" font-size="12" fill="#1e40af" text-anchor="middle">NET PAYABLE AMOUNT</text>
            <text x="685" y="350" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#1d4ed8" text-anchor="middle">₹ 3,420.00</text>
            <rect x="0" y="470" width="856" height="70" fill="#0f172a" rx="20"/>
            <rect x="0" y="470" width="856" height="30" fill="#0f172a"/>
            <text x="40" y="512" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">⚡ RAREBOX SOLAR NET-METERING FEASIBILITY ATTACHMENT</text>
            <text x="816" y="512" font-family="monospace" font-size="12" fill="#94a3b8" text-anchor="end">${doc.documentNumber}</text>
          </svg>`;
        } else if (safeCat === 'SITE_PHOTOS' || safeCat === 'SITE_GEOTAG_LOCATION') {
          svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
            <defs>
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0284c7"/>
                <stop offset="60%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#bae6fd"/>
              </linearGradient>
            </defs>
            <rect width="856" height="540" rx="20" fill="#0f172a"/>
            <rect x="20" y="20" width="816" height="340" rx="12" fill="url(#skyGrad)"/>
            <circle cx="700" cy="90" r="45" fill="#fef08a" stroke="#f59e0b" stroke-width="4"/>
            <rect x="180" y="160" width="490" height="180" fill="#64748b" rx="6" stroke="#334155" stroke-width="2"/>
            <polygon points="150,160 425,70 700,160" fill="#475569"/>
            <g transform="translate(220, 180)">
              <rect x="0" y="0" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="90" y="0" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="180" y="0" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="270" y="0" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="0" y="60" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="90" y="60" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="180" y="60" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
              <rect x="270" y="60" width="80" height="50" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5" rx="2"/>
            </g>
            <rect x="35" y="35" width="260" height="50" rx="8" fill="#0f172a" fill-opacity="0.8"/>
            <text x="50" y="58" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8">📍 GPS: 21.2514° N, 81.6296° E</text>
            <text x="50" y="74" font-family="system-ui, sans-serif" font-size="10" fill="#cbd5e1">Azimuth: 180° South • Shadow-Free Roof</text>
            <rect x="20" y="380" width="816" height="135" rx="10" fill="#1e293b" stroke="#334155"/>
            <text x="45" y="415" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">${safeTitle || 'Rooftop Site Feasibility Survey'}</text>
            <text x="45" y="445" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">File: ${safeName} • Customer Site: Raipur, Chhattisgarh</text>
            <text x="45" y="475" font-family="monospace" font-size="11" fill="#38bdf8">Structure: Elevated Super Structure 2.5m • Capacity: 5.5 kWp Mono PERC</text>
            <text x="800" y="450" font-family="monospace" font-size="13" font-weight="bold" fill="#f59e0b" text-anchor="end">${doc.documentNumber}</text>
          </svg>`;
        } else {
          svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
            <defs>
              <linearGradient id="genGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fffbeb"/>
                <stop offset="100%" stop-color="#fef3c7"/>
              </linearGradient>
            </defs>
            <rect width="856" height="540" rx="20" fill="#0f172a"/>
            <rect x="30" y="30" width="796" height="480" fill="url(#genGrad)" rx="16" stroke="#f59e0b" stroke-width="2"/>
            <rect x="60" y="60" width="736" height="70" fill="#ffffff" rx="10" stroke="#fde68a" stroke-width="1.5"/>
            <text x="80" y="102" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#b45309">⚡ RAREBOX SOLAR COMPLIANCE VAULT</text>
            <text x="770" y="102" font-family="monospace" font-size="16" font-weight="bold" fill="#78350f" text-anchor="end">${doc.documentNumber}</text>
            <circle cx="428" cy="240" r="50" fill="#f59e0b" fill-opacity="0.15"/>
            <circle cx="428" cy="240" r="35" fill="#f59e0b" fill-opacity="0.3"/>
            <path d="M410 240 L428 215 L446 240 L433 240 L433 265 L423 265 L423 240 Z" fill="#b45309"/>
            <text x="428" y="330" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">${safeTitle}</text>
            <text x="428" y="365" font-family="monospace" font-size="14" fill="#475569" text-anchor="middle">${safeName}</text>
            <rect x="278" y="395" width="300" height="32" fill="#d97706" rx="16"/>
            <text x="428" y="416" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">CATEGORY: ${safeCat}</text>
            <text x="428" y="475" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">Rarebox Solar • Verified Audit Repository</text>
          </svg>`;
        }
        placeholderBuffer = Buffer.from(svgContent, 'utf-8');
      } else {
        placeholderBuffer = Buffer.from(`%PDF-1.4\n%INS-SOLAR-${doc.documentNumber}%\n`, 'utf-8');
      }

      await storageAdapter.uploadObject(doc.storageKey, placeholderBuffer, {
        contentType,
        contentLength: placeholderBuffer.length
      });
      exists = true;
    }

    if (!exists) {
      return next(
        AppError.notFound(
          `Binary content for document '${doc.documentNumber}' is not available in storage.`
        )
      );
    }

    const storageObj = await storageAdapter.downloadObject(doc.storageKey);

    // Set download headers (support inline viewing vs attachment download)
    const isInline = req.query.inline === 'true' || req.query.view === 'true';
    const dispositionType = isInline ? 'inline' : 'attachment';
    const effectiveContentType = storageObj.contentType || doc.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', effectiveContentType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || config.CORS_ORIGIN || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(doc.originalFilename)}"`
    );
    res.setHeader('X-Document-Vault-Number', doc.documentNumber);
    res.setHeader('X-Document-Storage-Status', doc.storageStatus);
    if (doc.checksumSha256) {
      res.setHeader('X-Document-Checksum-Sha256', doc.checksumSha256);
    }
    if (storageObj.contentLength) {
      res.setHeader('Content-Length', String(storageObj.contentLength));
    }

    // Stream exact binary bytes directly to response
    return storageObj.stream.pipe(res);
  } catch (err) {
    return next(err);
  }
});

// All subsequent routes require staff session and employee status
documentRouter.use(requireAuth);
documentRouter.use(requireEmployee);

/**
 * GET /api/v1/documents
 * List documents with category, reviewStatus, entity, and classification filters.
 */
documentRouter.get(
  '/',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = documentFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const result = await DocumentService.listDocuments(parseResult.data, {
        userId: user.userId,
        role: user.role
      });

      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents
 * Register and upload document metadata into private vault.
 */
documentRouter.post(
  '/',
  requirePermission('document:upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = uploadDocumentMetadataSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const doc = await DocumentService.registerDocument(parseResult.data, actorContext);
      return sendSuccess(req, res, doc, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/documents/:id
 * Get single document metadata.
 */
documentRouter.get(
  '/:id',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const doc = await DocumentService.getDocumentById(req.params.id as string, {
        userId: user.userId,
        role: user.role
      });
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/documents/:id/access-url
 * Generate short-lived signed access URL for downloading document.
 */
documentRouter.get(
  '/:id/access-url',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 900;
      const urlInfo = await DocumentService.generateSignedAccessUrl(
        req.params.id as string,
        { userId: user.userId, role: user.role },
        expiresIn
      );
      return sendSuccess(req, res, urlInfo);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents/:id/review
 * Review document (Accept, Reject, Resubmission Required).
 */
documentRouter.post(
  '/:id/review',
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reviewDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const doc = await DocumentService.reviewDocument(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents/:id/new-version
 * Upload a new version for an existing document.
 */
documentRouter.post(
  '/:id/new-version',
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createDocumentVersionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const newVersion = await DocumentService.createDocumentVersion(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, newVersion, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/documents/:id/archive
 * Archive document.
 */
documentRouter.patch(
  '/:id/archive',
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body || {};
      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const doc = await DocumentService.archiveDocument(
        req.params.id as string,
        reason,
        actorContext
      );
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/documents/:id
 * Delete document from vault.
 */
documentRouter.delete(
  '/:id',
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await DocumentModel.findByIdAndDelete(req.params.id);
      if (!doc) {
        return next(AppError.notFound('Document not found in vault.'));
      }
      return sendSuccess(req, res, { message: 'Document removed successfully', id: req.params.id });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/documents/:id/content
 * Stream / upload raw binary content for an existing document record.
 */
documentRouter.put(
  '/:id/content',
  express.raw({ type: '*/*', limit: '25mb' }),
  requirePermission('document:upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = req.params.id as string;
      const buffer = req.body as Buffer;

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return next(AppError.validation('Binary payload is required for content upload.'));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const updatedDoc = await DocumentService.uploadDocumentContent(
        documentId,
        buffer,
        actorContext
      );

      return sendSuccess(req, res, updatedDoc);
    } catch (err) {
      return next(err);
    }
  }
);
