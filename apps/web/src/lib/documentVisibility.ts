import { PanelType } from '@ins-solar/shared';

export interface DocumentMetaCategory {
  value: string;
  label: string;
  icon: string;
  description: string;
}

export const SOLAR_CATEGORIES: DocumentMetaCategory[] = [
  { value: 'TAX_RECEIPT', label: 'GST Tax Invoice & Bills', icon: '🧾', description: 'Tax invoices, bills of supply & vendor bills' },
  { value: 'INTERNAL_OPERATIONAL', label: 'Payment Vouchers & Accounts Records', icon: '💳', description: 'Bank transaction receipts, vouchers & audit ledgers' },
  { value: 'SUBSIDY_DOC', label: 'PM Surya Ghar Subsidy Dossier', icon: '☀️', description: 'National CFA subsidy application & sanction letters' },
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill', icon: '⚡', description: 'Recent DISCOM power tariff bill' },
  { value: 'AADHAAR_CARD', label: 'Aadhaar Card (KYC)', icon: '🪪', description: 'Applicant identity & address proof' },
  { value: 'PAN_CARD', label: 'PAN Card', icon: '💳', description: 'Income Tax PAN card for billing' },
  { value: 'PROPERTY_TAX_RECEIPT', label: 'Property / House Tax', icon: '🏛️', description: 'Municipal tax receipt or registry deed' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Cheque', icon: '🏦', description: 'Cancelled cheque / passbook for DBT subsidy' },
  { value: 'SITE_PHOTOS', label: 'Site & Rooftop Photos', icon: '📸', description: 'Rooftop layout, shadow & structure photos' },
  { value: 'SITE_GEOTAG_LOCATION', label: 'GPS Site Geotag', icon: '📍', description: 'Verified latitude/longitude installation coordinates' },
  { value: 'QUOTATION_PROPOSAL', label: 'Solar Quotation / Proposal', icon: '📑', description: 'Techno-commercial proposal & plant sizing' },
  { value: 'SIGNED_CONTRACT', label: 'Signed EPC Contract & Agreements', icon: '🖋️', description: 'Executed turnkey installation agreement' },
  { value: 'NET_METERING_DOC', label: 'Net Metering Application', icon: '🔌', description: 'DISCOM net meter submission & SLD' },
  { value: 'WARRANTY_CERTIFICATE', label: 'Equipment Warranty', icon: '📜', description: 'Solar module, inverter & structure warranties' },
  { value: 'COMMISSIONING_REPORT', label: 'Joint Commissioning Report', icon: '📋', description: 'Plant synchronization & test report' },
  { value: 'CUSTOMER_KYC', label: 'General Customer KYC', icon: '👤', description: 'Customer documentation & identity files' },
  { value: 'OTHER', label: 'Other Documents', icon: '📁', description: 'Supplementary paperwork & general records' },
];

export const INSTALLER_CATEGORIES: DocumentMetaCategory[] = [
  { value: 'SITE_PHOTOS', label: 'Site & Rooftop Photos', icon: '📸', description: 'Rooftop layout, 4-point structure & meter photos' },
  { value: 'SITE_GEOTAG_LOCATION', label: 'GPS Site Geotag', icon: '📍', description: 'Verified latitude/longitude installation coordinates' },
  { value: 'COMMISSIONING_REPORT', label: 'Joint Commissioning Report (JCR)', icon: '📋', description: 'Plant synchronization & DISCOM inspection report' },
  { value: 'WARRANTY_CERTIFICATE', label: 'Equipment Warranty & Serials', icon: '📜', description: 'Solar module, inverter barcodes & warranty cards' },
  { value: 'OTHER', label: 'Other Field Records', icon: '📁', description: 'Supplementary fieldwork & test records' },
];

export const SALES_CATEGORIES: DocumentMetaCategory[] = [
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill', icon: '⚡', description: 'Recent DISCOM power tariff bill' },
  { value: 'AADHAAR_CARD', label: 'Aadhaar Card (KYC)', icon: '🪪', description: 'Applicant identity & address proof' },
  { value: 'PAN_CARD', label: 'PAN Card', icon: '💳', description: 'Income Tax PAN card for billing' },
  { value: 'PROPERTY_TAX_RECEIPT', label: 'Property / House Tax', icon: '🏛️', description: 'Municipal tax receipt or registry deed' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Cheque', icon: '🏦', description: 'Cancelled cheque / passbook for DBT subsidy' },
  { value: 'SIGNED_CONTRACT', label: 'Signed EPC Contract & Agreements', icon: '🖋️', description: 'Solar agreement, Annexure A DCR, loan letters' },
  { value: 'QUOTATION_PROPOSAL', label: 'Solar Quotation / Proposal', icon: '📑', description: 'Techno-commercial proposal & plant sizing' },
  { value: 'NET_METERING_DOC', label: 'Net Metering Application', icon: '🔌', description: 'DISCOM net meter submission & SLD' },
  { value: 'SUBSIDY_DOC', label: 'PM Surya Ghar Subsidy Dossier', icon: '☀️', description: 'National CFA subsidy application & bank letters' },
  { value: 'SITE_PHOTOS', label: 'Site & Rooftop Photos', icon: '📸', description: 'Roof feasibility photos for quotation' },
  { value: 'CUSTOMER_KYC', label: 'General Customer KYC', icon: '👤', description: 'Customer documentation & identity files' },
  { value: 'OTHER', label: 'Other Documents', icon: '📁', description: 'Supplementary paperwork & general records' },
];

export const ACCOUNTS_CATEGORIES: DocumentMetaCategory[] = [
  { value: 'TAX_RECEIPT', label: 'GST Tax Invoice & Bills', icon: '🧾', description: 'Tax invoices, bills of supply & vendor bills' },
  { value: 'INTERNAL_OPERATIONAL', label: 'Payment Vouchers & Accounts Records', icon: '💳', description: 'Bank transaction receipts, vouchers & audit ledgers' },
  { value: 'SUBSIDY_DOC', label: 'PM Surya Ghar Subsidy DBT Remittance', icon: '☀️', description: 'Subsidy credit receipts & portal disbursement' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Cheque', icon: '🏦', description: 'Bank proof for payment reconciliation' },
  { value: 'SIGNED_CONTRACT', label: 'Signed EPC Contract (Milestones)', icon: '🖋️', description: 'Customer contract for payment milestones' },
  { value: 'OTHER', label: 'Other Accounts Records', icon: '📁', description: 'Audit ledgers & bank statements' },
];

/**
 * Filter documents according to active department/role panel.
 * Guarantees that:
 * 1. Installers NEVER see legal agreements, DCR undertakings, bank loan letters, customer KYC, or GST invoices.
 * 2. Sales reps focus on Customer KYC, Signed Contracts/Agreements, Proposals, and Subsidy sanction files.
 * 3. Accounts staff focus on GST invoices, payment vouchers, subsidy credits, and payment milestone contracts.
 * 4. Admin has access to all documents or can toggle views.
 */
export const isDocVisibleInPanel = (
  doc: {
    category?: string;
    originalFilename?: string;
    safeDisplayName?: string;
  },
  panel: PanelType
): boolean => {
  const cat = (doc.category || '').toUpperCase();
  const name = `${doc.safeDisplayName || ''} ${doc.originalFilename || ''}`.toLowerCase();

  // Detect legal/commercial/subsidy documents generated by Create Document
  const isCreateDocumentLegalOutput =
    cat === 'SIGNED_CONTRACT' ||
    name.includes('annexure') ||
    name.includes('dcr') ||
    name.includes('solar aggrement') ||
    name.includes('solar agreement') ||
    name.includes('ppa') ||
    name.includes('power_purchase') ||
    name.includes('power purchase') ||
    name.includes('letter_for_bank') ||
    name.includes('letter for bank') ||
    name.includes('disbursement') ||
    name.includes('cover_letter') ||
    name.includes('cover letter') ||
    name.includes('net metering');

  if (panel === PanelType.INSTALLER) {
    // If it's a legal contract, DCR undertaking, loan disbursement letter, or cover letter, BLOCK for installer!
    if (isCreateDocumentLegalOutput) return false;

    // Disallow confidential customer KYC, financial docs, and contracts
    const blockedCategories = [
      'SIGNED_CONTRACT',
      'TAX_RECEIPT',
      'INTERNAL_OPERATIONAL',
      'SUBSIDY_DOC',
      'QUOTATION_PROPOSAL',
      'BANK_PASSBOOK',
      'PAN_CARD',
      'AADHAAR_CARD',
      'PROPERTY_TAX_RECEIPT',
      'ELECTRICITY_BILL',
      'NET_METERING_DOC',
      'CUSTOMER_KYC'
    ];
    if (blockedCategories.includes(cat)) return false;

    // Only allow site and technical field documents
    return ['SITE_PHOTOS', 'SITE_GEOTAG_LOCATION', 'COMMISSIONING_REPORT', 'WARRANTY_CERTIFICATE', 'OTHER'].includes(cat);
  }

  if (panel === PanelType.SALES) {
    // Sales doesn't need internal operational vouchers/ledgers
    if (cat === 'INTERNAL_OPERATIONAL') return false;
    return true;
  }

  if (panel === PanelType.ACCOUNTS) {
    // Accounts doesn't need raw installer rooftop photos
    if (cat === 'SITE_PHOTOS' || cat === 'SITE_GEOTAG_LOCATION') return false;
    return true;
  }

  return true;
};

export const getCategoriesForPanel = (panel: PanelType): DocumentMetaCategory[] => {
  switch (panel) {
    case PanelType.INSTALLER:
      return INSTALLER_CATEGORIES;
    case PanelType.SALES:
      return SALES_CATEGORIES;
    case PanelType.ACCOUNTS:
      return ACCOUNTS_CATEGORIES;
    default:
      return SOLAR_CATEGORIES;
  }
};
