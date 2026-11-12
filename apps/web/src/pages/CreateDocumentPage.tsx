import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FilePlus2,
  FolderLock,
  ChevronRight,
  Sparkles,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  FileText,
  Building2,
  User,
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';
import { downloadElementAsPdf, generatePdfFromElement } from '../lib/pdfGenerator.js';
import { RAREBOX_STAMP_BASE64 } from '../assets/rareboxStampBase64.js';

interface CustomerOption {
  _id?: string;
  id?: string;
  customerCode?: string;
  name: string;
  primaryPhone?: string;
  email?: string;
  type?: string;
  status?: string;
  installationAddress?: {
    addressLine1?: string;
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    geoCoordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  billingAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
  };
}

interface ProjectOption {
  _id?: string;
  id?: string;
  projectCode: string;
  name: string;
  status?: string;
  systemCapacityKwp?: number;
  currentStage?: string;
}

const TEMPLATE_OPTIONS = [
  {
    id: 'ANNEXURE_2_AGREEMENT',
    name: 'Annexure 2 – Consumer & Vendor RTS Agreement',
    scheme: 'PM – Surya Ghar Muft Bijli Yojana',
    category: 'SIGNED_CONTRACT',
    desc: 'Official Model Agreement between Consumer and Registered Vendor for grid connected rooftop solar RTS project.',
    badge: 'Statutory Standard'
  },
  {
    id: 'ANNEXURE_3_UNDERTAKING',
    name: 'Annexure 3 – Consumer Undertaking & DCR Declaration',
    scheme: 'MNRE / National Portal',
    category: 'CUSTOMER_KYC',
    desc: 'Mandatory undertaking confirming DCR module authenticity, net-metering readiness, and DBT subsidy bank details.',
    badge: 'DBT Subsidy'
  },
  {
    id: 'WARRANTY_CERTIFICATE',
    name: '5-Year Comprehensive Solar Warranty Certificate',
    scheme: 'Rarebox Solar Quality Assurance',
    category: 'WARRANTY_CERTIFICATE',
    desc: 'Statutory 5-year workmanship and hardware performance warranty executed with vendor seal.',
    badge: 'O&M Compliance'
  },
  {
    id: 'NET_METERING_APPLICATION',
    name: 'DISCOM Net-Metering Feasibility Application',
    scheme: 'State Electricity Distribution Board',
    category: 'NET_METERING_DOC',
    desc: 'Formal grid synchronization & bi-directional smart meter connectivity application with sanctioned load.',
    badge: 'DISCOM NOC'
  }
];

export const CreateDocumentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';

  // Customer Directory State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Active Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ANNEXURE_2_AGREEMENT');

  // Customer & Site Information (General Editable Fields)
  const [tplConsumerNumber, setTplConsumerNumber] = useState('1001750390');
  const [tplConsumerName, setTplConsumerName] = useState('SHRI GYAN CHAND JAISWAL');
  const [tplParentage, setTplParentage] = useState('S/O LATE HARIKISHAN JAISWAL');
  const [tplAddress, setTplAddress] = useState('SHANTI VIHAR COLONY, DANGANIA');
  const [tplDistrict, setTplDistrict] = useState('RAIPUR');
  const [tplState, setTplState] = useState('Chhattisgarh');
  const [tplPinCode, setTplPinCode] = useState('492013');
  const [tplMobile, setTplMobile] = useState('+91 98271 23456');
  const [tplCapacityKwp, setTplCapacityKwp] = useState('3.30');
  const [tplAgreementDate, setTplAgreementDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  });

  // Payment Milestones (Annexure 2 Agreement)
  const [tplAdvancePercent, setTplAdvancePercent] = useState('50%');
  const [tplAdvanceDesc, setTplAdvanceDesc] = useState('as an advance on confirmation of the order');
  const [tplMilestonePercent, setTplMilestonePercent] = useState('45%');
  const [tplMilestoneDesc, setTplMilestoneDesc] = useState('Against LOA from DISCOM');
  const [tplFinalPercent, setTplFinalPercent] = useState('5%');
  const [tplFinalDesc, setTplFinalDesc] = useState('On Installation');

  // Vendor Signatory Details
  const [tplVendorName, setTplVendorName] = useState('RAREBOX LLP');
  const [tplVendorOffice, setTplVendorOffice] = useState('MAHADEV GHAT ROAD ASHWANI NAGAR RAIPUR, Chhattisgarh');
  const [tplVendorSignatory, setTplVendorSignatory] = useState('Sameer Sahu');
  const [tplVendorDesignation, setTplVendorDesignation] = useState('Partner / Authorized Signatory');

  // Banking Details for DBT Subsidy (Annexure 3 Undertaking)
  const [tplBankName, setTplBankName] = useState('State Bank of India');
  const [tplBankAccountNo, setTplBankAccountNo] = useState('38492019482');
  const [tplIfscCode, setTplIfscCode] = useState('SBIN0001234');
  const [tplBankBranch, setTplBankBranch] = useState('Dangania Branch, Raipur');

  // Hardware Details (Warranty Certificate)
  const [tplModuleBrand, setTplModuleBrand] = useState('Waaree 550W Mono PERC DCR');
  const [tplModuleCount, setTplModuleCount] = useState('6 Nos');
  const [tplInverterBrand, setTplInverterBrand] = useState('Growatt 3.3kW Single Phase On-Grid');
  const [tplInverterSerial, setTplInverterSerial] = useState('GW-2026-33K-88192');
  const [tplStructureType, setTplStructureType] = useState('Hot-Dip Galvanized Elevated Structure');

  // DISCOM Details (Net-Metering Application)
  const [tplDiscomName, setTplDiscomName] = useState('CSPDCL (Chhattisgarh State Power Distribution Co. Ltd.)');
  const [tplDiscomDivision, setTplDiscomDivision] = useState('Raipur West O&M Division');
  const [tplSanctionedLoad, setTplSanctionedLoad] = useState('4.0 kW');
  const [tplPhaseType, setTplPhaseType] = useState('Single Phase (230V)');

  // Ref to formatted document container for PDF rendering
  const documentPrintRef = useRef<HTMLDivElement>(null);

  // PDF Preview & Download State
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Vault Save State
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState<string | null>(null);

  // Load Customers on Mount
  useEffect(() => {
    setLoadingCustomers(true);
    apiClient<any>('/customers?limit=100')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.items || res?.data || []);
        setCustomers(list);
        if (preselectedCustomerId) {
          const match = list.find((c: CustomerOption) => (c._id || c.id) === preselectedCustomerId);
          if (match) {
            setSelectedCustomer(match);
          }
        }
      })
      .catch(err => {
        console.warn('Failed to load customers:', err);
      })
      .finally(() => {
        setLoadingCustomers(false);
      });
  }, [preselectedCustomerId]);

  // Load Projects when Customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setProjects([]);
      setSelectedProjectId('');
      return;
    }

    const cId = selectedCustomer._id || selectedCustomer.id;
    if (!cId) return;

    apiClient<any>(`/projects?customerId=${cId}`)
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.items || res?.data || []);
        setProjects(list);
        if (list.length > 0 && list[0]) {
          setSelectedProjectId(list[0]._id || list[0].id || '');
          if (list[0].systemCapacityKwp) {
            setTplCapacityKwp(String(list[0].systemCapacityKwp));
          }
        } else {
          setSelectedProjectId('');
        }
      })
      .catch(err => {
        console.warn('Failed to load projects:', err);
      });
  }, [selectedCustomer]);

  // Autofill customer details into document when selected
  useEffect(() => {
    if (!selectedCustomer) return;

    if (selectedCustomer.customerCode) {
      setTplConsumerNumber(selectedCustomer.customerCode);
    }
    if (selectedCustomer.name) {
      setTplConsumerName(selectedCustomer.name.toUpperCase());
    }
    if (selectedCustomer.primaryPhone) {
      setTplMobile(selectedCustomer.primaryPhone);
    }
    if (selectedCustomer.installationAddress) {
      const addr = selectedCustomer.installationAddress;
      if (addr.addressLine1) {
        setTplAddress(addr.addressLine1.toUpperCase());
      }
      if (addr.city || addr.district) {
        setTplDistrict((addr.district || addr.city || 'RAIPUR').toUpperCase());
      }
      if (addr.state) {
        setTplState(addr.state);
      }
      if (addr.postalCode) {
        setTplPinCode(addr.postalCode);
      }
    }
  }, [selectedCustomer]);

  // Reset details to sample template defaults
  const handleResetDefaults = () => {
    setSelectedCustomer(null);
    setTplConsumerNumber('1001750390');
    setTplConsumerName('SHRI GYAN CHAND JAISWAL');
    setTplParentage('S/O LATE HARIKISHAN JAISWAL');
    setTplAddress('SHANTI VIHAR COLONY, DANGANIA');
    setTplDistrict('RAIPUR');
    setTplState('Chhattisgarh');
    setTplPinCode('492013');
    setTplMobile('+91 98271 23456');
    setTplCapacityKwp('3.30');
    setVaultSaveSuccess(null);
  };

  // Preview PDF Modal Handler
  const handleOpenPdfPreview = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const { objectUrl } = await generatePdfFromElement(documentPrintRef.current, {
        filename: `${selectedTemplateId}_${cleanName || 'Consumer'}.pdf`
      });
      setPdfPreviewUrl(objectUrl);
      setPdfPreviewModalOpen(true);
    } catch (err: any) {
      alert('Could not render PDF preview: ' + (err?.message || 'Rendering error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Direct Download PDF Handler
  const handleDownloadPdf = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const tplName = selectedTemplateId === 'ANNEXURE_2_AGREEMENT'
        ? 'Solar_Agreement'
        : selectedTemplateId === 'ANNEXURE_3_UNDERTAKING'
        ? 'Consumer_Undertaking'
        : selectedTemplateId === 'WARRANTY_CERTIFICATE'
        ? 'Warranty_Certificate'
        : 'Net_Metering_Application';
      const filename = `${tplName}_${cleanName || 'Consumer'}.pdf`;
      await downloadElementAsPdf(documentPrintRef.current, filename);
    } catch (err: any) {
      alert('Failed to generate PDF download: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Save to Customer Vault in Database
  const handleSaveTemplateToVault = async () => {
    if (!documentPrintRef.current) return;
    if (!selectedCustomer) {
      alert('Please select an existing customer to save this document into their vault.');
      return;
    }

    try {
      setIsSavingToVault(true);
      setVaultSaveSuccess(null);

      const cleanName = tplConsumerName.trim();
      const currentTpl = TEMPLATE_OPTIONS.find(t => t.id === selectedTemplateId);
      const title = `${currentTpl ? currentTpl.name : 'Solar Document'} - ${cleanName}`;
      const filename = `${selectedTemplateId}_${cleanName.replace(/\s+/g, '_')}.pdf`;

      // 1. Generate PDF Blob
      const { blob } = await generatePdfFromElement(documentPrintRef.current, {
        filename
      });

      const custId = selectedCustomer._id || selectedCustomer.id;

      // 2. Register Document in DB
      const docPayload = {
        originalFilename: filename,
        safeDisplayName: title,
        category: currentTpl?.category || 'SIGNED_CONTRACT',
        accessClassification: 'CUSTOMER_VISIBLE',
        mimeType: 'application/pdf',
        fileSizeBytes: blob.size,
        customerId: custId,
        projectId: selectedProjectId || undefined,
        relatedEntityType: 'Customer',
        relatedEntityId: custId,
        metadata: {
          templateId: selectedTemplateId,
          scheme: currentTpl?.scheme,
          consumerNumber: tplConsumerNumber,
          capacityKwp: tplCapacityKwp,
          agreementDate: tplAgreementDate,
          generatedVia: 'DocumentTemplateModule'
        }
      };

      const docRes = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify(docPayload)
      });

      const docId = docRes?._id || docRes?.id;
      if (!docId) throw new Error('Could not obtain document registration ID.');

      // 3. Upload raw PDF blob
      const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
      const uploadUrl = getFullApiUrl(`/documents/${docId}/content`);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/pdf',
          ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
        },
        body: blob
      });

      if (!uploadRes.ok) {
        console.warn('PDF blob storage upload notice:', uploadRes.statusText);
      }

      setVaultSaveSuccess(
        `Document "${title}" (${docRes.documentNumber || 'DOC-REG'}) saved into customer vault successfully!`
      );
    } catch (err: any) {
      alert('Failed to save document in vault: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingToVault(false);
    }
  };

  const currentTemplate = TEMPLATE_OPTIONS.find(t => t.id === selectedTemplateId) ?? TEMPLATE_OPTIONS[0]!;

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Clean Top Header (No extra buttons or tabs) */}
      <div className="bg-card border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground mb-1">
                <Link to="/customers" className="hover:text-solar-600 transition">CRM</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-foreground font-bold">Create Document</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shadow-2xs">
                  <FilePlus2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Document Template Editor &amp; Generator
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a document format, edit customer-specific fields, and generate an instant PDF with verified company seal.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Template Status Pill */}
            <div className="flex items-center space-x-2 bg-muted/40 px-3.5 py-2 rounded-xl border border-border">
              <Sparkles className="w-4 h-4 text-solar-600" />
              <div className="text-xs">
                <span className="text-muted-foreground">Active Format: </span>
                <span className="font-bold text-foreground">{currentTemplate.name.split('–')[0]?.trim()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Control Bar: Template Selector, Customer Autofill & Actions */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Template & Customer Selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Template Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  1. Select Document Template
                </label>
                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="w-full sm:w-[320px] px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground cursor-pointer shadow-2xs"
                  >
                    {TEMPLATE_OPTIONS.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Autofill Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  2. Select Customer to Autofill Details {loadingCustomers && '(Loading...)'}
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    disabled={loadingCustomers}
                    value={selectedCustomer?._id || selectedCustomer?.id || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const match = customers.find(c => (c._id || c.id) === val);
                      setSelectedCustomer(match || null);
                    }}
                    className="w-full sm:w-[280px] px-3 py-2.5 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground cursor-pointer shadow-2xs font-medium disabled:opacity-50"
                  >
                    <option value="">{loadingCustomers ? 'Loading directory...' : '-- Manual Entry / Choose Customer --'}</option>
                    {customers.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name} {c.customerCode ? `(${c.customerCode})` : ''} - {c.installationAddress?.city || 'Raipur'}
                      </option>
                    ))}
                  </select>

                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      title="Reset to default sample"
                      className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl border border-border transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Preview PDF, Download PDF & Save to Vault */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
              <button
                type="button"
                onClick={handleOpenPdfPreview}
                disabled={generatingPdf}
                className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-solar-500" />
                ) : (
                  <Eye className="w-4 h-4 text-solar-600" />
                )}
                <span>Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-4 py-2.5 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {generatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveTemplateToVault}
                disabled={isSavingToVault || !selectedCustomer}
                title={!selectedCustomer ? 'Please select a customer above to enable saving to vault' : undefined}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingToVault ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderLock className="w-4 h-4" />
                )}
                <span>Save to Customer Vault</span>
              </button>
            </div>
          </div>

          {vaultSaveSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{vaultSaveSuccess}</span>
              </div>
              <Link to="/documents" className="font-bold underline hover:text-emerald-900 ml-3">
                View in Vault →
              </Link>
            </div>
          )}
        </div>

        {/* Split Screen Layout: Left = Editable Details, Right = Live Authentic Document */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: CUSTOMER-SPECIFIC EDITABLE FORM FIELDS       */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
                    ✏️
                  </div>
                  <h2 className="text-sm font-black text-foreground">
                    Customer-Specific Details
                  </h2>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Live updates preview
                </span>
              </div>

              {/* Section 1: Customer Identity & Site Details */}
              <div className="space-y-3.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer &amp; Site Information</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Consumer Application / BP / Service No.
                  </label>
                  <input
                    type="text"
                    value={tplConsumerNumber}
                    onChange={e => setTplConsumerNumber(e.target.value)}
                    placeholder="e.g. 1001750390"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono text-foreground font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Consumer Full Name (First Party)
                  </label>
                  <input
                    type="text"
                    value={tplConsumerName}
                    onChange={e => setTplConsumerName(e.target.value)}
                    placeholder="e.g. SHRI GYAN CHAND JAISWAL"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Father's / Husband's / Guardian's Name
                  </label>
                  <input
                    type="text"
                    value={tplParentage}
                    onChange={e => setTplParentage(e.target.value)}
                    placeholder="e.g. S/O LATE HARIKISHAN JAISWAL"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Installation Premises Address
                  </label>
                  <input
                    type="text"
                    value={tplAddress}
                    onChange={e => setTplAddress(e.target.value)}
                    placeholder="e.g. SHANTI VIHAR COLONY, DANGANIA"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      District / City
                    </label>
                    <input
                      type="text"
                      value={tplDistrict}
                      onChange={e => setTplDistrict(e.target.value)}
                      placeholder="e.g. RAIPUR"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={tplState}
                      onChange={e => setTplState(e.target.value)}
                      placeholder="e.g. Chhattisgarh"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-semibold text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Postal PIN Code
                    </label>
                    <input
                      type="text"
                      value={tplPinCode}
                      onChange={e => setTplPinCode(e.target.value)}
                      placeholder="e.g. 492013"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Contact Mobile Number
                    </label>
                    <input
                      type="text"
                      value={tplMobile}
                      onChange={e => setTplMobile(e.target.value)}
                      placeholder="e.g. +91 98271 23456"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Solar System Capacity (kWp)
                    </label>
                    <input
                      type="text"
                      value={tplCapacityKwp}
                      onChange={e => setTplCapacityKwp(e.target.value)}
                      placeholder="e.g. 3.30"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-solar-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Document / Agreement Date
                    </label>
                    <input
                      type="text"
                      value={tplAgreementDate}
                      onChange={e => setTplAgreementDate(e.target.value)}
                      placeholder="e.g. 12 November 2026"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-medium text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Template-Specific Dynamic Fields */}
              {selectedTemplateId === 'ANNEXURE_2_AGREEMENT' && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Payment Milestone Terms</span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplAdvancePercent}
                          onChange={e => setTplAdvancePercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center text-foreground"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplAdvanceDesc}
                          onChange={e => setTplAdvanceDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplMilestonePercent}
                          onChange={e => setTplMilestonePercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center text-foreground"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplMilestoneDesc}
                          onChange={e => setTplMilestoneDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplFinalPercent}
                          onChange={e => setTplFinalPercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center text-foreground"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplFinalDesc}
                          onChange={e => setTplFinalDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplateId === 'ANNEXURE_3_UNDERTAKING' && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Consumer DBT Subsidy Bank Details</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={tplBankName}
                        onChange={e => setTplBankName(e.target.value)}
                        placeholder="State Bank of India"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={tplBankAccountNo}
                        onChange={e => setTplBankAccountNo(e.target.value)}
                        placeholder="e.g. 38492019482"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={tplIfscCode}
                        onChange={e => setTplIfscCode(e.target.value)}
                        placeholder="e.g. SBIN0001234"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={tplBankBranch}
                        onChange={e => setTplBankBranch(e.target.value)}
                        placeholder="e.g. Dangania Branch, Raipur"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplateId === 'WARRANTY_CERTIFICATE' && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Hardware Specifications &amp; Serial Numbers</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Solar PV Modules (Make &amp; Watts)
                      </label>
                      <input
                        type="text"
                        value={tplModuleBrand}
                        onChange={e => setTplModuleBrand(e.target.value)}
                        placeholder="Waaree 550W Mono PERC DCR"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Quantity of Modules
                      </label>
                      <input
                        type="text"
                        value={tplModuleCount}
                        onChange={e => setTplModuleCount(e.target.value)}
                        placeholder="6 Nos"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Grid-Tie Inverter Model
                      </label>
                      <input
                        type="text"
                        value={tplInverterBrand}
                        onChange={e => setTplInverterBrand(e.target.value)}
                        placeholder="Growatt 3.3kW On-Grid"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Inverter Serial Number
                      </label>
                      <input
                        type="text"
                        value={tplInverterSerial}
                        onChange={e => setTplInverterSerial(e.target.value)}
                        placeholder="GW-2026-33K-88192"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Mounting Structure Specifications
                    </label>
                    <input
                      type="text"
                      value={tplStructureType}
                      onChange={e => setTplStructureType(e.target.value)}
                      placeholder="Hot-Dip Galvanized Elevated Structure"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>
              )}

              {selectedTemplateId === 'NET_METERING_APPLICATION' && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    <span>DISCOM Technical Particulars</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      DISCOM Name
                    </label>
                    <input
                      type="text"
                      value={tplDiscomName}
                      onChange={e => setTplDiscomName(e.target.value)}
                      placeholder="CSPDCL"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        O&amp;M Division / Sub-Division
                      </label>
                      <input
                        type="text"
                        value={tplDiscomDivision}
                        onChange={e => setTplDiscomDivision(e.target.value)}
                        placeholder="Raipur West Division"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Sanctioned Load (kW)
                      </label>
                      <input
                        type="text"
                        value={tplSanctionedLoad}
                        onChange={e => setTplSanctionedLoad(e.target.value)}
                        placeholder="4.0 kW"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Power Supply Phase
                    </label>
                    <input
                      type="text"
                      value={tplPhaseType}
                      onChange={e => setTplPhaseType(e.target.value)}
                      placeholder="Single Phase (230V)"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>
              )}

              {/* Section 3: Vendor / Second Party Signatory */}
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-solar-600" />
                    <span>Vendor Signatory &amp; Stamp</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Official Rarebox Seal Included
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Authorized Signatory Name
                  </label>
                  <input
                    type="text"
                    value={tplVendorSignatory}
                    onChange={e => setTplVendorSignatory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Vendor Entity Name
                    </label>
                    <input
                      type="text"
                      value={tplVendorName}
                      onChange={e => setTplVendorName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={tplVendorDesignation}
                      onChange={e => setTplVendorDesignation(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Registered Office Address
                  </label>
                  <input
                    type="text"
                    value={tplVendorOffice}
                    onChange={e => setTplVendorOffice(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: LIVE AUTHENTIC DOCUMENT CANVAS              */}
          {/* ========================================================= */}
          <div className="lg:col-span-7">
            <div className="sticky top-6 space-y-3">
              {/* Document View Top Banner */}
              <div className="flex items-center justify-between bg-card px-4 py-2.5 rounded-xl border border-border shadow-2xs">
                <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
                  <FileText className="w-4 h-4 text-solar-600" />
                  <span>Live Paper Document View</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (Updates automatically with your edits)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenPdfPreview}
                  className="text-xs text-solar-600 font-bold hover:underline inline-flex items-center space-x-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Full PDF Preview</span>
                </button>
              </div>

              {/* Formatted A4 Document Canvas */}
              <div className="bg-slate-900/60 p-3 sm:p-5 rounded-2xl border border-slate-800 overflow-auto max-h-[85vh] shadow-2xl flex justify-center">
                <div
                  ref={documentPrintRef}
                  className="bg-white text-slate-900 w-full max-w-[800px] p-8 sm:p-12 rounded-lg shadow-xl text-[12px] leading-relaxed font-serif"
                  style={{ minHeight: '1050px' }}
                >
                  {/* ===================================================== */}
                  {/* TEMPLATE 1: ANNEXURE 2 MODEL AGREEMENT                */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'ANNEXURE_2_AGREEMENT' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
                        <h2 className="text-lg font-bold tracking-tight uppercase">Annexure 2</h2>
                        <h3 className="text-sm font-bold leading-snug">
                          Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project under PM – Surya Ghar Muft Bijli Yojana
                        </h3>
                        {tplConsumerNumber && (
                          <p className="text-[11px] font-mono font-semibold pt-1 text-slate-700">
                            Consumer Application / BP No: <span className="underline font-bold">{tplConsumerNumber}</span>
                          </p>
                        )}
                      </div>

                      {/* Preamble / Parties */}
                      <div className="space-y-3 text-justify mb-5">
                        <p>
                          This Agreement is entered into on this day <strong>{tplAgreementDate}</strong>, by and between:
                        </p>
                        <p className="pl-4 border-l-2 border-slate-400">
                          <strong>1. {tplConsumerName || '[CONSUMER NAME]'}</strong>, {tplParentage || '[RELATION/PARENTAGE]'}, residing at{' '}
                          <strong>{tplAddress || '[INSTALLATION ADDRESS]'}</strong>, District: <strong>{tplDistrict || '[DISTRICT]'}</strong>, State:{' '}
                          <strong>{tplState || '[STATE]'}</strong> (hereinafter referred to as the <strong>"Consumer / First Party"</strong>, which expression shall unless repugnant to the context include his/her successors, legal heirs, and permitted assigns).
                        </p>
                        <p className="text-center font-bold text-xs uppercase tracking-wider my-1">AND</p>
                        <p className="pl-4 border-l-2 border-slate-400">
                          <strong>2. {tplVendorName}</strong>, an entity registered under the Limited Liability Partnership Act, having its registered office at{' '}
                          <strong>{tplVendorOffice}</strong>, represented by its authorized signatory <strong>{tplVendorSignatory}</strong> ({tplVendorDesignation}) (hereinafter referred to as the <strong>"Vendor / Second Party"</strong>, which expression shall include its successors and permitted assigns).
                        </p>
                      </div>

                      {/* Recitals / Whereas */}
                      <div className="space-y-2 text-justify mb-5">
                        <p>
                          <strong>WHEREAS</strong> the Consumer desires to install a Grid-Connected Rooftop Solar (RTS) Photovoltaic plant of capacity{' '}
                          <span className="font-bold underline text-slate-900">{tplCapacityKwp} kWp</span> at the premises mentioned above under the <strong>PM – Surya Ghar Muft Bijli Yojana</strong>;
                        </p>
                        <p>
                          <strong>AND WHEREAS</strong> the Vendor is an authorized and registered vendor under the Scheme who has agreed to design, supply, install, test, and commission the said RTS project along with net-metering synchronization in accordance with technical specifications and standards approved by MNRE and the State Electricity Distribution Company (DISCOM);
                        </p>
                        <p>
                          <strong>NOW, THEREFORE</strong>, in consideration of the mutual covenants herein contained, the Parties hereby agree as follows:
                        </p>
                      </div>

                      {/* 1. Responsibilities of Consumer */}
                      <div className="space-y-1.5 mb-4">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          1. Roles &amp; Responsibilities of First Party (Consumer):
                        </h4>
                        <ol className="list-decimal pl-5 space-y-1 text-justify">
                          <li>Provide unencumbered, shadow-free rooftop space and right of access for installation, inspection, and maintenance.</li>
                          <li>Furnish accurate electricity consumer connection number, latest paid electricity bill, and KYC identification documents.</li>
                          <li>Ensure availability of necessary power supply and clean water connection during installation and testing phases.</li>
                          <li>Make timely payments to the Vendor as per the agreed payment schedule outlined below.</li>
                          <li>Assist the Vendor in coordination with DISCOM officials for site inspection, net-meter installation, and testing.</li>
                        </ol>
                      </div>

                      {/* 2. Responsibilities of Vendor (18 points from statutory standard) */}
                      <div className="space-y-1.5 mb-5">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          2. Roles &amp; Responsibilities of Second Party (Vendor):
                        </h4>
                        <ol className="list-decimal pl-5 space-y-1 text-justify">
                          <li>Conduct comprehensive rooftop structural feasibility and electrical load assessment prior to installation.</li>
                          <li>Supply only ALMM-listed Tier-1 high efficiency solar photovoltaic modules manufactured with Domestic Content Requirement (DCR) cells.</li>
                          <li>Supply MNRE/BIS compliant grid-tied solar string inverter with built-in remote monitoring and MPPT technology.</li>
                          <li>Fabricate and install hot-dip galvanized elevated structure capable of withstanding local wind speeds up to 150 km/h.</li>
                          <li>Install dual independent earthing pits with chemical compound for inverter AC/DC and lightning surge dissipation.</li>
                          <li>Provide lightning arrestor system covering the entire rooftop solar array perimeter.</li>
                          <li>Provide IP65 ACDB and DCDB with surge protection devices (SPD), DC MCBs, and isolators.</li>
                          <li>Use UV-stabilized, weather-proof copper solar DC cables routed through rigid heavy-duty conduits.</li>
                          <li>Handle submission of net-metering interconnection application with DISCOM authorities.</li>
                          <li>Coordinate pre-commissioning testing, meter inspection, and bi-directional meter synchronization.</li>
                          <li>Facilitate online portal commissioning report submission for prompt Direct Benefit Transfer (DBT) subsidy disbursement.</li>
                          <li>Provide 5 (Five) Years Comprehensive Free Maintenance and warranty covering all equipment and workmanship.</li>
                          <li>Pass on 25-year module performance warranty (90% capacity at 10 years, 80% at 25 years).</li>
                          <li>Provide inverter replacement warranty as per OEM manufacturer standards.</li>
                          <li>Conduct safety demonstration, emergency shutdown training, and handover technical manuals to Consumer.</li>
                          <li>Strictly adhere to Central Electricity Authority (CEA) and State Electrical Inspectorate safety guidelines.</li>
                          <li>Ensure safe handling, transit insurance, and installation protocols to prevent any roof structural damage.</li>
                          <li>Attend to any technical breakdown or generation grievance within 72 hours of intimation by the Consumer.</li>
                        </ol>
                      </div>

                      {/* 3. Payment Terms Table */}
                      <div className="space-y-1.5 mb-6">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          3. Terms of Payment:
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left my-2 text-[11px]">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 px-3 py-1.5 font-bold w-16">S.No.</th>
                              <th className="border border-slate-400 px-3 py-1.5 font-bold w-24">Milestone (%)</th>
                              <th className="border border-slate-400 px-3 py-1.5 font-bold">Payment Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-400 px-3 py-1.5 font-mono text-center">1</td>
                              <td className="border border-slate-400 px-3 py-1.5 font-bold text-center">{tplAdvancePercent}</td>
                              <td className="border border-slate-400 px-3 py-1.5">{tplAdvanceDesc}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-400 px-3 py-1.5 font-mono text-center">2</td>
                              <td className="border border-slate-400 px-3 py-1.5 font-bold text-center">{tplMilestonePercent}</td>
                              <td className="border border-slate-400 px-3 py-1.5">{tplMilestoneDesc}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-400 px-3 py-1.5 font-mono text-center">3</td>
                              <td className="border border-slate-400 px-3 py-1.5 font-bold text-center">{tplFinalPercent}</td>
                              <td className="border border-slate-400 px-3 py-1.5">{tplFinalDesc}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Signatures & Vendor Stamp */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-6">
                        {/* Consumer (First Party) */}
                        <div className="space-y-10">
                          <div>
                            <p className="font-bold text-xs uppercase">First Party (Consumer)</p>
                            <p className="text-[11px] text-slate-600">Signature of Consumer / Beneficiary</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Name:</strong> {tplConsumerName}</p>
                            <p><strong>Address:</strong> {tplAddress}, {tplDistrict}, {tplState}</p>
                            <p><strong>Date:</strong> {tplAgreementDate}</p>
                          </div>
                        </div>

                        {/* Vendor (Second Party) with Rarebox LLP Stamp */}
                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Second Party (Vendor)</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          {/* Authentic Rarebox LLP Blue Stamp with Signature */}
                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Authorized Signatory:</strong> {tplVendorSignatory}</p>
                            <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                            <p><strong>Office:</strong> {tplVendorOffice}</p>
                          </div>
                        </div>
                      </div>

                      {/* Statutory Disclaimer */}
                      <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-500 text-center leading-tight">
                        <p>
                          This document is executed pursuant to MNRE Operational Guidelines for PM – Surya Ghar Muft Bijli Yojana.
                          Duly synchronized with DISCOM and Central Ministry compliance tracking portal.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* TEMPLATE 2: ANNEXURE 3 CONSUMER UNDERTAKING & DCR     */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'ANNEXURE_3_UNDERTAKING' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
                        <h2 className="text-lg font-bold tracking-tight uppercase">Annexure 3</h2>
                        <h3 className="text-sm font-bold leading-snug">
                          UNDERTAKING BY CONSUMER / BENEFICIARY FOR ROOFTOP SOLAR INSTALLATION UNDER PM – SURYA GHAR MUFT BIJLI YOJANA
                        </h3>
                        <p className="text-[11px] text-slate-600 font-medium">
                          (Mandatory Declaration for Direct Benefit Transfer DBT Subsidy Disbursement &amp; DCR Compliance)
                        </p>
                      </div>

                      {/* Consumer Particulars */}
                      <div className="bg-slate-50 p-4 rounded-md border border-slate-300 text-justify space-y-2 mb-4">
                        <p>
                          I, <strong>{tplConsumerName}</strong>, {tplParentage}, residing at <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong>, PIN: <strong>{tplPinCode}</strong>, holding Consumer / Service Connection No. <strong>{tplConsumerNumber}</strong>, do hereby solemnly declare and affirm as under:
                        </p>
                      </div>

                      {/* Undertaking Points */}
                      <div className="space-y-2 text-justify mb-5">
                        <ol className="list-decimal pl-5 space-y-2">
                          <li>
                            That I have installed a <strong>{tplCapacityKwp} kWp</strong> Grid Connected Rooftop Solar Photovoltaic (RTS) Power Plant at my domestic premises through registered vendor <strong>{tplVendorName}</strong> under the PM – Surya Ghar Muft Bijli Yojana.
                          </li>
                          <li>
                            That the solar PV modules installed on my rooftop are manufactured in India using indigenous solar cells adhering to <strong>Domestic Content Requirement (DCR)</strong> and are enrolled in the Approved List of Models and Manufacturers (ALMM) issued by MNRE.
                          </li>
                          <li>
                            That the entire plant including the inverter, mounting structure, balance of system, and dual independent earthing has been inspected and found in satisfactory operating condition.
                          </li>
                          <li>
                            That I authorize the Direct Benefit Transfer (DBT) Central Financial Assistance (CFA) capital subsidy to be directly credited into my Aadhaar-seeded bank account specified below:
                          </li>
                        </ol>

                        {/* Bank Details Table */}
                        <div className="pl-5 pt-2">
                          <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                            <tbody>
                              <tr>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100 w-44">Name of Account Holder</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplConsumerName}</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Bank Name</td>
                                <td className="border border-slate-300 px-3 py-1.5">{tplBankName}</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Savings Bank Account No.</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold">{tplBankAccountNo}</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">RTGS / NEFT IFSC Code</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold uppercase">{tplIfscCode}</td>
                              </tr>
                              <tr>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Branch Name</td>
                                <td className="border border-slate-300 px-3 py-1.5">{tplBankBranch}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <ol start={5} className="list-decimal pl-5 space-y-2 pt-2">
                          <li>
                            That I have not availed nor shall I claim any double subsidy or incentive from any other Central or State Government scheme for this solar installation.
                          </li>
                          <li>
                            That I undertake to maintain the solar rooftop plant in continuous operation for a minimum period of 5 (Five) years from the date of net-meter synchronization.
                          </li>
                        </ol>
                      </div>

                      {/* Signatures & Vendor Verification */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-4">
                        {/* Consumer Signature */}
                        <div className="space-y-8">
                          <div>
                            <p className="font-bold text-xs uppercase">Declarant / Consumer</p>
                            <p className="text-[11px] text-slate-600">Signature of Consumer / Beneficiary</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Name:</strong> {tplConsumerName}</p>
                            <p><strong>Date:</strong> {tplAgreementDate}</p>
                            <p><strong>Place:</strong> {tplDistrict}, {tplState}</p>
                          </div>
                        </div>

                        {/* Vendor Verification Seal */}
                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Vendor Verification &amp; Attestation</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Authorized Signatory:</strong> {tplVendorSignatory}</p>
                            <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                            <p><strong>Vendor Registration:</strong> Registered MNRE Channel Partner</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* TEMPLATE 3: 5-YEAR COMPREHENSIVE WARRANTY CERTIFICATE */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'WARRANTY_CERTIFICATE' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-amber-600 pb-4">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Rarebox Solar Quality Assurance</span>
                        <h2 className="text-xl font-bold tracking-tight text-slate-950 uppercase">
                          5-Year Comprehensive Warranty Certificate
                        </h2>
                        <h3 className="text-xs font-semibold text-slate-700">
                          Execution, Performance &amp; Free Operation &amp; Maintenance Guarantee
                        </h3>
                        <p className="text-[10px] font-mono text-slate-600 pt-1">
                          Certificate No: <span className="font-bold text-slate-900">WAR-2026-{tplConsumerNumber || '001'}</span> • Commissioning Date: <strong>{tplAgreementDate}</strong>
                        </p>
                      </div>

                      {/* Beneficiary & Site Summary */}
                      <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-md text-justify space-y-1 mb-4">
                        <p>
                          This Comprehensive Warranty Certificate is issued to <strong>{tplConsumerName}</strong> ({tplParentage}) for the <strong>{tplCapacityKwp} kWp</strong> Grid-Connected Rooftop Solar PV Installation situated at:
                        </p>
                        <p className="font-semibold text-slate-800">
                          {tplAddress}, District: {tplDistrict}, State: {tplState} - {tplPinCode} (BP Connection: {tplConsumerNumber})
                        </p>
                      </div>

                      {/* Hardware Warranty Schedule */}
                      <div className="space-y-2 mb-5">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Installed Hardware &amp; Warranty Schedule:
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 px-3 py-1.5 font-bold">Component</th>
                              <th className="border border-slate-400 px-3 py-1.5 font-bold">Equipment Specification / Make</th>
                              <th className="border border-slate-400 px-3 py-1.5 font-bold w-36">Warranty Term</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">Solar PV Modules</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplModuleBrand} ({tplModuleCount})</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold text-emerald-700">25 Years Linear Power Warranty</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">Grid-Tie Inverter</td>
                              <td className="border border-slate-300 px-3 py-1.5">
                                {tplInverterBrand} <br />
                                <span className="font-mono text-[10px] text-slate-600">S/N: {tplInverterSerial}</span>
                              </td>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold text-emerald-700">5 Years OEM Full Replacement</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">Mounting Structure</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplStructureType}</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold text-emerald-700">10 Years Anti-Corrosion</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">Balance of System</td>
                              <td className="border border-slate-300 px-3 py-1.5">ACDB, DCDB, Chemical Earthing, Lightning Arrestor &amp; Cabling</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold text-emerald-700">5 Years Comprehensive</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Scope of Comprehensive 5-Year Maintenance */}
                      <div className="space-y-1.5 mb-5 text-justify">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Scope of Comprehensive 5-Year Maintenance &amp; Service Guarantee:
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Free rectification/replacement of any equipment defect, wiring malfunction, or inverter failure at zero service cost.</li>
                          <li>Periodic quarterly preventive maintenance inspection including earthing resistance measurement and inverter performance logs.</li>
                          <li>Guaranteed breakdown grievance attendance within <strong>72 hours</strong> from time of service ticket logging.</li>
                          <li>Online system monitoring support and generation optimization guidance.</li>
                        </ul>
                      </div>

                      {/* Signatures & Seal */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-4">
                        <div className="space-y-10">
                          <div>
                            <p className="font-bold text-xs uppercase">Customer Acceptance</p>
                            <p className="text-[11px] text-slate-600">Handover Acknowledged &amp; Received</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Customer:</strong> {tplConsumerName}</p>
                            <p><strong>Mobile:</strong> {tplMobile}</p>
                            <p><strong>Date:</strong> {tplAgreementDate}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Issued By Registered EPC Vendor</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Authorized Signatory:</strong> {tplVendorSignatory}</p>
                            <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                            <p><strong>Office:</strong> {tplVendorOffice}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* TEMPLATE 4: DISCOM NET-METERING FEASIBILITY           */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'NET_METERING_APPLICATION' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">{tplDiscomName}</span>
                        <h2 className="text-base font-bold tracking-tight uppercase">
                          APPLICATION FOR CONNECTIVITY &amp; NET-METERING OF ROOFTOP SOLAR PV SYSTEM
                        </h2>
                        <h3 className="text-xs font-medium text-slate-700">
                          Under Grid Connected Rooftop Solar Scheme (Capacity: {tplCapacityKwp} kWp)
                        </h3>
                      </div>

                      {/* Addressed to DISCOM Officer */}
                      <div className="space-y-1 text-[11px] mb-4">
                        <p><strong>To:</strong></p>
                        <p className="pl-3">The Executive Engineer / Assistant Engineer (O&amp;M),</p>
                        <p className="pl-3">{tplDiscomDivision}, {tplDiscomName}</p>
                        <p className="pl-3">{tplDistrict}, {tplState}</p>
                      </div>

                      {/* Part 1: Consumer Particulars */}
                      <div className="space-y-1.5 mb-4">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          1. Particulars of the Applicant / Consumer:
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100 w-48">Consumer Name</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplConsumerName}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Service Connection / BP No.</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold">{tplConsumerNumber}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Installation Site Address</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplAddress}, {tplDistrict}, {tplState} - {tplPinCode}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Registered Mobile &amp; Contact</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-mono">{tplMobile}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Existing Sanctioned Load</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplSanctionedLoad}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Part 2: Proposed Solar PV System Particulars */}
                      <div className="space-y-1.5 mb-4">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          2. Technical Details of Proposed Rooftop Solar PV System:
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100 w-48">Proposed RTS Capacity</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-900">{tplCapacityKwp} kWp</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Power Supply Voltage &amp; Phase</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplPhaseType}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Solar PV Module Specification</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplModuleBrand}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold bg-slate-100">Solar Inverter Make &amp; Rating</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplInverterBrand} (Grid-Synchronized with Anti-Islanding Protection)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Part 3: Registered Vendor Details */}
                      <div className="space-y-1.5 mb-4">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          3. Registered Vendor &amp; Certified EPC Contractor:
                        </h4>
                        <p className="text-[11px] text-justify">
                          The installation shall be executed by registered vendor <strong>{tplVendorName}</strong> ({tplVendorOffice}), adhering strictly to Central Electricity Authority (Technical Standards for Connectivity of Distributed Generation Resources) Regulations.
                        </p>
                      </div>

                      {/* Signatures & Stamp */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-4">
                        <div className="space-y-10">
                          <div>
                            <p className="font-bold text-xs uppercase">Signature of Applicant</p>
                            <p className="text-[11px] text-slate-600">Registered Electricity Consumer</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Name:</strong> {tplConsumerName}</p>
                            <p><strong>Date:</strong> {tplAgreementDate}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Authorized Solar Vendor</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Authorized Signatory:</strong> {tplVendorSignatory}</p>
                            <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FULLSCREEN HIGH-RESOLUTION PDF PREVIEW MODAL              */}
      {/* ========================================================= */}
      {pdfPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-card w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    PDF Document Preview – {tplConsumerName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {currentTemplate.name} • Rarebox LLP Verified
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-2xs transition inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPreviewModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: PDF Iframe */}
            <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDF Document Preview"
                  className="w-full h-full rounded-lg bg-white border-0 shadow-2xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2 text-white">
                  <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
                  <p className="text-xs text-slate-400">Rendering high-resolution PDF pages...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
