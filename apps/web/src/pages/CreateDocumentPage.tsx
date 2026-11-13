import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FilePlus2,
  FolderLock,
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
  RotateCcw,
  Landmark,
  ClipboardCheck,
  Check
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
    desc: 'Official 5-year execution & comprehensive maintenance agreement between Consumer and Rarebox LLP.',
    badge: 'PM Surya Ghar'
  },
  {
    id: 'ANNEXURE_A_DCR',
    name: 'Annexure A – DCR Undertaking / Self-Declaration',
    scheme: 'MNRE / National Portal',
    category: 'CUSTOMER_KYC',
    desc: 'Vendor Self-Declaration certifying domestic solar cells & ALMM PV modules with serial numbers grid.',
    badge: 'DCR Fulfillment'
  },
  {
    id: 'WORK_COMPLETION_REPORT',
    name: 'Work Completion Report (WCR) & Technical Handover',
    scheme: 'DISCOM / Net-Metering',
    category: 'COMMISSIONING_REPORT',
    desc: 'Joint commissioning report with PV module table, inverter serials, safety checklist, and installer certification.',
    badge: 'DISCOM Handover'
  },
  {
    id: 'GRID_CONNECTIVITY_APP',
    name: 'CSPDCL Grid Connectivity Application (LV Connection)',
    scheme: 'CSPDCL Sub-Division',
    category: 'NET_METERING_DOC',
    desc: 'Formal application to Assistant Engineer (AE) CSPDCL for rooftop solar grid connection approval.',
    badge: 'CSPDCL Grid'
  },
  {
    id: 'CSPDCL_PPA_AGREEMENT',
    name: 'CSPDCL Power Purchase Agreement (PPA) for RTS Plants',
    scheme: 'CSERC Regulations 2019',
    category: 'SIGNED_CONTRACT',
    desc: 'Statutory PPA between CSPDCL and Prosumer for annual surplus energy sale, grid injection, and tariff settlement.',
    badge: 'CSPDCL PPA'
  },
  {
    id: 'BANK_LOAN_DISBURSEMENT',
    name: 'PM Surya Ghar Bank Loan Disbursement Application (बैंक ऋण आवेदन)',
    scheme: 'National Portal / Bank Finance',
    category: 'SUBSIDY_DOC',
    desc: 'Official Hindi application to Bank Branch Manager for project completion verification & loan disbursement.',
    badge: 'Bank Loan'
  }
];

interface CreateDocumentPageProps {
  defaultTemplate?: string;
}

export const CreateDocumentPage: React.FC<CreateDocumentPageProps> = ({ defaultTemplate }) => {
  const [searchParams] = useSearchParams();

  // General Create Document module excludes SITE_PHOTOS_REPORT (which is exclusively in /site-photos)
  const availableTemplates = TEMPLATE_OPTIONS;

  const preselectedCustomerId = searchParams.get('customerId') || '';
  const preselectedTemplate = defaultTemplate || searchParams.get('template') || '';

  // Customer Directory State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Active Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplate || 'ANNEXURE_2_AGREEMENT'
  );

  useEffect(() => {
    const target = defaultTemplate || searchParams.get('template');
    if (target && TEMPLATE_OPTIONS.some(t => t.id === target)) {
      setSelectedTemplateId(target);
    }
  }, [defaultTemplate, searchParams]);

  // Customer & Site Information
  const [tplConsumerName, setTplConsumerName] = useState('SHRI GYAN CHAND JAISWAL');
  const [tplParentage, setTplParentage] = useState('S/O LATE HARIKISHAN JAISWAL');
  const [tplApplicationNo, setTplApplicationNo] = useState('NP-CGSPD26-11760274 / 06-05-2026');
  const [tplConsumerNumber, setTplConsumerNumber] = useState('1001750390');
  const [tplMobile, setTplMobile] = useState('9826178156');
  const [tplAddress, setTplAddress] = useState('SHANTI VIHAR COLONY, DANGANIA');
  const [tplDistrict, setTplDistrict] = useState('Raipur');
  const [tplState, setTplState] = useState('Chhattisgarh');
  const [tplPinCode, setTplPinCode] = useState('492013');
  const [tplCapacityKwp, setTplCapacityKwp] = useState('3');
  const [tplAgreementDate, setTplAgreementDate] = useState('11/06/2026');

  // Vendor Information (Rarebox LLP)
  const [tplVendorName, setTplVendorName] = useState('M/S RAREBOX LLP RAIPUR');
  const [tplVendorOffice, setTplVendorOffice] = useState('MAHADEV GHAT ROAD ASHWANI NAGAR RAIPUR, Chhattisgarh');
  const [tplVendorSignatory, setTplVendorSignatory] = useState('SAMEER SAHU');
  const [tplVendorDesignation, setTplVendorDesignation] = useState('PROPRIETOR / AUTHORIZED SIGNATORY');
  const [tplVendorPhone, setTplVendorPhone] = useState('9630131550');
  const [tplVendorEmail, setTplVendorEmail] = useState('rareboxllp@gmail.com');

  // Annexure 2 Agreement Payment Milestones
  const [tplAdvancePercent, setTplAdvancePercent] = useState('50%');
  const [tplAdvanceDesc, setTplAdvanceDesc] = useState('as an advance on confirmation of the order');
  const [tplMilestonePercent, setTplMilestonePercent] = useState('45%');
  const [tplMilestoneDesc, setTplMilestoneDesc] = useState('Against LOA from DISCOM');
  const [tplFinalPercent, setTplFinalPercent] = useState('5%');
  const [tplFinalDesc, setTplFinalDesc] = useState('On Installation');

  // Annexure - A DCR Details
  const [tplDcrCapacityWp, setTplDcrCapacityWp] = useState('620 Wp');
  const [tplDcrModuleCount, setTcrDcrModuleCount] = useState('05 No’s');
  const [tplDcrModuleMake, setTplDcrModuleMake] = useState('Adani Solar');
  const [tplDcrCellManufacturer, setTplDcrCellManufacturer] = useState('Mundra Solar PV Limited');
  const [tplDcrSerials, setTplDcrSerials] = useState<string[]>([
    'AS2605132C1835',
    'AS2605132C3736',
    'AS2605132C3609',
    'AS2605132C1574',
    'AS2605132C3783'
  ]);

  // Work Completion Report Details
  const [tplWcrModuleManufacturer, setTplWcrModuleManufacturer] = useState('Mundra Solar PV Limited');
  const [tplWcrModuleWattage, setTplWcrModuleWattage] = useState('620 (Wp)');
  const [tplWcrModuleCount, setTplWcrModuleCount] = useState('5 Nos');
  const [tplWcrInstallDate, setTplWcrInstallDate] = useState('11/06/2026');
  const [tplWcrInverterManufacturer, setTplWcrInverterManufacturer] = useState('POLYCAB');
  const [tplWcrInverterCapacity, setTplWcrInverterCapacity] = useState('3 KVA');
  const [tplWcrInverterCount, setTplWcrInverterCount] = useState('01 NOS');
  const [tplWcrInverterSerial, setTplWcrInverterSerial] = useState('3K6300326-2605-668002567P');
  const [tplWcrInverterStandard, setTplWcrInverterStandard] = useState('IEC');

  // WCR Checklist Toggles
  const [wcrAcdb, setWcrAcdb] = useState(true);
  const [wcrLaEarthing, setWcrLaEarthing] = useState(true);
  const [wcrAcCable, setWcrAcCable] = useState(true);
  const [wcrDcCable, setWcrDcCable] = useState(true);
  const [wcrMeterBoard, setWcrMeterBoard] = useState(true);
  const [wcrEarthingCable, setWcrEarthingCable] = useState(true);

  // CSPDCL Grid Connectivity Details
  const [tplDiscomSubDivAE, setTplDiscomSubDivAE] = useState('Sub. Div. Deendayal');

  // CSPDCL PPA Details
  const [tplPpaPlace, setTplPpaPlace] = useState('Raipur');
  const [tplPpaTariff, setTplPpaTariff] = useState('As per CSERC Distributed Solar energy Regulations 2019');

  // Bank Loan Disbursement Application (Hindi) Details
  const [tplLoanBankName, setTplLoanBankName] = useState('UNION BANK');
  const [tplLoanBranchName, setTplLoanBranchName] = useState('AHIWADA BRANCH');
  const [tplLoanApplicantName, setTplLoanApplicantName] = useState('ATUL SONI');
  const [tplLoanMobile, setTplLoanMobile] = useState('9201042828');
  const [tplLoanDisbursedPercent, setTplLoanDisbursedPercent] = useState('100%');

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
      setTplLoanApplicantName(selectedCustomer.name.toUpperCase());
    }
    if (selectedCustomer.primaryPhone) {
      setTplMobile(selectedCustomer.primaryPhone);
      setTplLoanMobile(selectedCustomer.primaryPhone);
    }
    if (selectedCustomer.installationAddress) {
      const addr = selectedCustomer.installationAddress;
      if (addr.addressLine1) {
        setTplAddress(addr.addressLine1.toUpperCase());
      }
      if (addr.city || addr.district) {
        setTplDistrict(addr.district || addr.city || 'Raipur');
      }
      if (addr.state) {
        setTplState(addr.state);
      }
      if (addr.postalCode) {
        setTplPinCode(addr.postalCode);
      }
    }
  }, [selectedCustomer]);

  // Reset details to default sample values
  const handleResetDefaults = () => {
    setSelectedCustomer(null);
    setTplConsumerName('SHRI GYAN CHAND JAISWAL');
    setTplParentage('S/O LATE HARIKISHAN JAISWAL');
    setTplApplicationNo('NP-CGSPD26-11760274 / 06-05-2026');
    setTplConsumerNumber('1001750390');
    setTplMobile('9826178156');
    setTplAddress('SHANTI VIHAR COLONY, DANGANIA');
    setTplDistrict('Raipur');
    setTplState('Chhattisgarh');
    setTplPinCode('492013');
    setTplCapacityKwp('3');
    setTplAgreementDate('11/06/2026');
    setTplLoanApplicantName('ATUL SONI');
    setTplLoanMobile('9201042828');
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
      const filename = `${selectedTemplateId}_${cleanName || 'Document'}.pdf`;
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
          applicationNo: tplApplicationNo,
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
      const errorMsg =
        (err?.details && Array.isArray(err.details) && err.details.length > 0
          ? err.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ')
          : '') ||
        err?.message ||
        'Error saving document';
      alert('Failed to save document in vault: ' + errorMsg);
    } finally {
      setIsSavingToVault(false);
    }
  };

  const currentTemplate = TEMPLATE_OPTIONS.find(t => t.id === selectedTemplateId) ?? TEMPLATE_OPTIONS[0]!;

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Clean, Simple Top Navigation Header */}
      <div className="bg-card border-b border-border shadow-2xs sticky top-0 z-30 backdrop-blur-md bg-card/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Title & Selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shrink-0">
                  <FilePlus2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                    Create Document
                  </h1>
                  <p className="text-[11px] text-muted-foreground">
                    PM Surya Ghar &amp; CSPDCL official agreement &amp; handover forms
                  </p>
                </div>
              </div>

              {/* Template Selector */}
              <div className="relative sm:ml-2">
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full sm:w-[270px] md:w-[310px] px-3 py-1.5 text-xs font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground cursor-pointer shadow-2xs"
                >
                  {availableTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.badge}: {tpl.name.split('–')[0]?.trim()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Selector */}
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <select
                    disabled={loadingCustomers}
                    value={selectedCustomer?._id || selectedCustomer?.id || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const match = customers.find(c => (c._id || c.id) === val);
                      setSelectedCustomer(match || null);
                    }}
                    className="w-full sm:w-[220px] md:w-[250px] px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground cursor-pointer shadow-2xs font-medium disabled:opacity-50"
                  >
                    <option value="">{loadingCustomers ? 'Loading...' : '-- Select Customer --'}</option>
                    {customers.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name} {c.customerCode ? `(${c.customerCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    title="Reset to default sample"
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl border border-border transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons: 1 Single Compact Row */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenPdfPreview}
                disabled={generatingPdf}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-1.5 border border-border cursor-pointer disabled:opacity-50"
              >
                {generatingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-solar-500" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-solar-600" />
                )}
                <span>Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {generatingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveTemplateToVault}
                disabled={isSavingToVault || !selectedCustomer}
                title={!selectedCustomer ? 'Please select a customer above to enable saving to vault' : undefined}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingToVault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderLock className="w-3.5 h-3.5" />
                )}
                <span>Save to Vault</span>
              </button>
            </div>
          </div>

          {/* Success Notification if Saved to Vault */}
          {vaultSaveSuccess && (
            <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-fadeIn">
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
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-6">

        {/* Split Screen Layout: Left = Editable Details, Right = Live Authentic Document */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: DYNAMIC CUSTOMER-SPECIFIC EDITABLE FORM      */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-5">
              {/* Header: Indicates tailored form for current document */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
                    ✏️
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-foreground">
                      Customer-Specific Details
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Tailored for: <span className="text-solar-600 font-bold">{currentTemplate.name.split('–')[0]?.trim()}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-solar-500/10 text-solar-700 dark:text-solar-400 font-bold px-2 py-0.5 rounded-full">
                  Live Sync
                </span>
              </div>

              {/* ----------------------------------------------------- */}
              {/* 1. ANNEXURE 2 AGREEMENT FIELDS                        */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'ANNEXURE_2_AGREEMENT' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    <span>Consumer (First Party) Information</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Consumer Full Name
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Consumer / BP Number
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
                        System Capacity (kWp)
                      </label>
                      <input
                        type="text"
                        value={tplCapacityKwp}
                        onChange={e => setTplCapacityKwp(e.target.value)}
                        placeholder="e.g. 3.30"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-solar-600"
                      />
                    </div>
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

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        District
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
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        PIN Code
                      </label>
                      <input
                        type="text"
                        value={tplPinCode}
                        onChange={e => setTplPinCode(e.target.value)}
                        placeholder="e.g. 492013"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Agreement Execution Date
                    </label>
                    <input
                      type="text"
                      value={tplAgreementDate}
                      onChange={e => setTplAgreementDate(e.target.value)}
                      placeholder="e.g. 11/06/2026"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-medium text-foreground"
                    />
                  </div>

                  {/* Payment Milestone Terms */}
                  <div className="pt-3 border-t border-border space-y-3">
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
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* 2. ANNEXURE A DCR UNDERTAKING FIELDS                  */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'ANNEXURE_A_DCR' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    <span>Customer &amp; Site Details (Annexure A)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Customer / Beneficiary Name
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
                        District
                      </label>
                      <input
                        type="text"
                        value={tplDistrict}
                        onChange={e => setTplDistrict(e.target.value)}
                        placeholder="Raipur"
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
                        placeholder="Chhattisgarh"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-semibold text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Application Number
                      </label>
                      <input
                        type="text"
                        value={tplApplicationNo}
                        onChange={e => setTplApplicationNo(e.target.value)}
                        placeholder="NP-CGSPD26-11760274 / 06-05-2026"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Installed Capacity (KW)
                      </label>
                      <input
                        type="text"
                        value={tplCapacityKwp}
                        onChange={e => setTplCapacityKwp(e.target.value)}
                        placeholder="3"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-solar-600"
                      />
                    </div>
                  </div>

                  {/* DCR Module & Cell Parameters */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>DCR Modules &amp; Serial Numbers Grid</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          PV Module Capacity
                        </label>
                        <input
                          type="text"
                          value={tplDcrCapacityWp}
                          onChange={e => setTplDcrCapacityWp(e.target.value)}
                          placeholder="620 Wp"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Number of Modules
                        </label>
                        <input
                          type="text"
                          value={tplDcrModuleCount}
                          onChange={e => setTcrDcrModuleCount(e.target.value)}
                          placeholder="05 No’s"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          PV Module Make
                        </label>
                        <input
                          type="text"
                          value={tplDcrModuleMake}
                          onChange={e => setTplDcrModuleMake(e.target.value)}
                          placeholder="Adani Solar"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Cell Manufacturer
                        </label>
                        <input
                          type="text"
                          value={tplDcrCellManufacturer}
                          onChange={e => setTplDcrCellManufacturer(e.target.value)}
                          placeholder="Mundra Solar PV Limited"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1.5">
                        Module Serial Numbers (Grid of 5)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[0, 1, 2, 3, 4].map(idx => (
                          <div key={idx}>
                            <input
                              type="text"
                              value={tplDcrSerials[idx] || ''}
                              onChange={e => {
                                const updated = [...tplDcrSerials];
                                updated[idx] = e.target.value.trim();
                                setTplDcrSerials(updated);
                              }}
                              placeholder={`Sr #${idx + 1}`}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg font-mono font-semibold text-foreground"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* 3. WORK COMPLETION REPORT (WCR) FIELDS               */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'WORK_COMPLETION_REPORT' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Applicant &amp; Equipment Handover Details</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Name of Applicant
                    </label>
                    <input
                      type="text"
                      value={tplConsumerName}
                      onChange={e => setTplConsumerName(e.target.value)}
                      placeholder="e.g. SHRI GYAN CHAND JAISWAL"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Application Reg. No.
                      </label>
                      <input
                        type="text"
                        value={tplApplicationNo}
                        onChange={e => setTplApplicationNo(e.target.value)}
                        placeholder="NP-CGSPD26-11760274 / 06-05-2026"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        BP No.
                      </label>
                      <input
                        type="text"
                        value={tplConsumerNumber}
                        onChange={e => setTplConsumerNumber(e.target.value)}
                        placeholder="1001750390"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Mobile No.
                      </label>
                      <input
                        type="text"
                        value={tplMobile}
                        onChange={e => setTplMobile(e.target.value)}
                        placeholder="9826178156"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Date of Installation
                      </label>
                      <input
                        type="text"
                        value={tplWcrInstallDate}
                        onChange={e => setTplWcrInstallDate(e.target.value)}
                        placeholder="11/06/2026"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-mono"
                      />
                    </div>
                  </div>

                  {/* Module Specifications */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-xs font-bold text-solar-600 uppercase tracking-wider">
                      Solar PV Module Specifications
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Module Manufacturer
                        </label>
                        <input
                          type="text"
                          value={tplWcrModuleManufacturer}
                          onChange={e => setTplWcrModuleManufacturer(e.target.value)}
                          placeholder="Mundra Solar PV Limited"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Module Wattage (Wp)
                        </label>
                        <input
                          type="text"
                          value={tplWcrModuleWattage}
                          onChange={e => setTplWcrModuleWattage(e.target.value)}
                          placeholder="620 (Wp)"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          No. of Modules
                        </label>
                        <input
                          type="text"
                          value={tplWcrModuleCount}
                          onChange={e => setTplWcrModuleCount(e.target.value)}
                          placeholder="5 Nos"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Total Capacity (kWp)
                        </label>
                        <input
                          type="text"
                          value={tplCapacityKwp}
                          onChange={e => setTplCapacityKwp(e.target.value)}
                          placeholder="3"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold text-solar-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inverter Specifications */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-xs font-bold text-solar-600 uppercase tracking-wider">
                      Inverter Installed Details
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Inverter Make &amp; Manufacturer
                        </label>
                        <input
                          type="text"
                          value={tplWcrInverterManufacturer}
                          onChange={e => setTplWcrInverterManufacturer(e.target.value)}
                          placeholder="POLYCAB"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          AC Capacity (KVA)
                        </label>
                        <input
                          type="text"
                          value={tplWcrInverterCapacity}
                          onChange={e => setTplWcrInverterCapacity(e.target.value)}
                          placeholder="3 KVA"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          No. of Inverters
                        </label>
                        <input
                          type="text"
                          value={tplWcrInverterCount}
                          onChange={e => setTplWcrInverterCount(e.target.value)}
                          placeholder="01 NOS"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Inverter Serial Number
                        </label>
                        <input
                          type="text"
                          value={tplWcrInverterSerial}
                          onChange={e => setTplWcrInverterSerial(e.target.value)}
                          placeholder="3K6300326-2605-668002567P"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Standard (BIS/IEC)
                        </label>
                        <input
                          type="text"
                          value={tplWcrInverterStandard}
                          onChange={e => setTplWcrInverterStandard(e.target.value)}
                          placeholder="IEC"
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Safety & Checklist Toggles */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <h3 className="text-xs font-bold text-solar-600 uppercase tracking-wider">
                      Technical &amp; Safety Checklist (Click to Toggle)
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: 'ACDB & DCDB', state: wcrAcdb, setter: setWcrAcdb },
                        { label: 'LA Earthing Cable', state: wcrLaEarthing, setter: setWcrLaEarthing },
                        { label: 'AC Cable', state: wcrAcCable, setter: setWcrAcCable },
                        { label: 'DC Cable', state: wcrDcCable, setter: setWcrDcCable },
                        { label: 'METER BOARD', state: wcrMeterBoard, setter: setWcrMeterBoard },
                        { label: 'Earthing ISI Mark', state: wcrEarthingCable, setter: setWcrEarthingCable }
                      ].map((chk, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => chk.setter(!chk.state)}
                          className={`p-2 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                            chk.state
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                              : 'bg-muted/40 border-border text-muted-foreground'
                          }`}
                        >
                          <span className="truncate">{chk.label}</span>
                          {chk.state ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* 4. CSPDCL GRID CONNECTIVITY APPLICATION FIELDS       */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'GRID_CONNECTIVITY_APP' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    <span>CSPDCL Sub-Division &amp; Connection Details</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      CSPDCL Sub Division AE Office
                    </label>
                    <input
                      type="text"
                      value={tplDiscomSubDivAE}
                      onChange={e => setTplDiscomSubDivAE(e.target.value)}
                      placeholder="Sub Division AE Sub. Div. Deendayal"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Application Date
                      </label>
                      <input
                        type="text"
                        value={tplAgreementDate}
                        onChange={e => setTplAgreementDate(e.target.value)}
                        placeholder="11/06/2026"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Plant Capacity (KW)
                      </label>
                      <input
                        type="text"
                        value={tplCapacityKwp}
                        onChange={e => setTplCapacityKwp(e.target.value)}
                        placeholder="3"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold text-solar-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Consumer Full Name
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
                      Address
                    </label>
                    <input
                      type="text"
                      value={tplAddress}
                      onChange={e => setTplAddress(e.target.value)}
                      placeholder="SHANTI VIHAR COLONY, DANGANIA"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        District
                      </label>
                      <input
                        type="text"
                        value={tplDistrict}
                        onChange={e => setTplDistrict(e.target.value)}
                        placeholder="Raipur"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
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
                        placeholder="Chhattisgarh"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Contact Mobile (MOB)
                      </label>
                      <input
                        type="text"
                        value={tplMobile}
                        onChange={e => setTplMobile(e.target.value)}
                        placeholder="9826178156"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Consumer BP Number
                      </label>
                      <input
                        type="text"
                        value={tplConsumerNumber}
                        onChange={e => setTplConsumerNumber(e.target.value)}
                        placeholder="1001750390"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* 5. CSPDCL POWER PURCHASE AGREEMENT (PPA) FIELDS      */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'CSPDCL_PPA_AGREEMENT' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>CSPDCL Prosumer PPA Parameters</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Execution Place / City
                      </label>
                      <input
                        type="text"
                        value={tplPpaPlace}
                        onChange={e => setTplPpaPlace(e.target.value)}
                        placeholder="Raipur"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Execution Date
                      </label>
                      <input
                        type="text"
                        value={tplAgreementDate}
                        onChange={e => setTplAgreementDate(e.target.value)}
                        placeholder="11/06/2026"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Prosumer Full Name
                    </label>
                    <input
                      type="text"
                      value={tplConsumerName}
                      onChange={e => setTplConsumerName(e.target.value)}
                      placeholder="e.g. SHRI GYAN CHAND JAISWAL"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Prosumer BP Number
                      </label>
                      <input
                        type="text"
                        value={tplConsumerNumber}
                        onChange={e => setTplConsumerNumber(e.target.value)}
                        placeholder="1001750390"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        RTS Plant Capacity (kWp)
                      </label>
                      <input
                        type="text"
                        value={tplCapacityKwp}
                        onChange={e => setTplCapacityKwp(e.target.value)}
                        placeholder="3"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold text-solar-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Premises Address
                    </label>
                    <input
                      type="text"
                      value={tplAddress}
                      onChange={e => setTplAddress(e.target.value)}
                      placeholder="SHANTI VIHAR COLONY, DANGANIA"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        District
                      </label>
                      <input
                        type="text"
                        value={tplDistrict}
                        onChange={e => setTplDistrict(e.target.value)}
                        placeholder="Raipur"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
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
                        placeholder="Chhattisgarh"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      PPA Tariff &amp; Modality
                    </label>
                    <input
                      type="text"
                      value={tplPpaTariff}
                      onChange={e => setTplPpaTariff(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground text-xs"
                    />
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* 6. BANK LOAN DISBURSEMENT APPLICATION FIELDS         */}
              {/* ----------------------------------------------------- */}
              {selectedTemplateId === 'BANK_LOAN_DISBURSEMENT' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-solar-600 uppercase tracking-wider">
                    <Landmark className="w-3.5 h-3.5" />
                    <span>बैंक एवं ऋण विवरण (Bank Loan Application)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        बैंक का नाम (Bank Name)
                      </label>
                      <input
                        type="text"
                        value={tplLoanBankName}
                        onChange={e => setTplLoanBankName(e.target.value)}
                        placeholder="UNION BANK"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        शाखा (Branch Name)
                      </label>
                      <input
                        type="text"
                        value={tplLoanBranchName}
                        onChange={e => setTplLoanBranchName(e.target.value)}
                        placeholder="AHIWADA BRANCH"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        आवेदक / ऋणधारक का नाम (Applicant)
                      </label>
                      <input
                        type="text"
                        value={tplLoanApplicantName}
                        onChange={e => setTplLoanApplicantName(e.target.value)}
                        placeholder="ATUL SONI"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        मोबाइल नंबर (Mobile)
                      </label>
                      <input
                        type="text"
                        value={tplLoanMobile}
                        onChange={e => setTplLoanMobile(e.target.value)}
                        placeholder="9201042828"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        स्वीकृत ऋण वितरण प्रतिशत (%)
                      </label>
                      <input
                        type="text"
                        value={tplLoanDisbursedPercent}
                        onChange={e => setTplLoanDisbursedPercent(e.target.value)}
                        placeholder="100%"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        आवेदन दिनांक (Date)
                      </label>
                      <input
                        type="text"
                        value={tplAgreementDate}
                        onChange={e => setTplAgreementDate(e.target.value)}
                        placeholder="11/06/2026"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------- */}
              {/* COMMON VENDOR SIGNATORY SECTION                       */}
              {/* ----------------------------------------------------- */}
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-solar-600" />
                    <span>Vendor Signatory &amp; Stamp</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Rarebox LLP Official Seal
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Authorized Signatory
                    </label>
                    <input
                      type="text"
                      value={tplVendorSignatory}
                      onChange={e => setTplVendorSignatory(e.target.value)}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Signatory Mobile
                    </label>
                    <input
                      type="text"
                      value={tplVendorPhone}
                      onChange={e => setTplVendorPhone(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Signatory Email
                    </label>
                    <input
                      type="text"
                      value={tplVendorEmail}
                      onChange={e => setTplVendorEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Vendor Firm Name
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
                    Registered Office Address
                  </label>
                  <input
                    type="text"
                    value={tplVendorOffice}
                    onChange={e => setTplVendorOffice(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground text-xs"
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
                  {/* FORMAT 1: ANNEXURE 2 MODEL AGREEMENT                  */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'ANNEXURE_2_AGREEMENT' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
                        <h2 className="text-lg font-bold tracking-tight uppercase">Annexure 2</h2>
                        <h3 className="text-sm font-bold leading-snug">
                          Agreement between Consumer &amp; Vendor for installation of grid connected rooftop solar (RTS) project under PM – Surya Ghar Muft Bijli Yojana
                        </h3>
                        <p className="text-[11px] text-slate-600 pt-1">
                          This agreement is executed on <strong>{tplAgreementDate}</strong> for design, supply, installation, commissioning and 5-year comprehensive maintenance of RTS project/system along with warranty under PM Surya Ghar Muft Bijli Yojana
                        </p>
                        {tplConsumerNumber && (
                          <p className="text-[11px] font-mono font-semibold pt-0.5 text-slate-700">
                            Consumer Application / BP No: <span className="underline font-bold">{tplConsumerNumber}</span>
                          </p>
                        )}
                      </div>

                      {/* Between Parties */}
                      <div className="space-y-3 text-justify mb-5">
                        <p className="font-bold text-xs uppercase tracking-wider text-center">Between</p>
                        <p className="pl-4 border-l-2 border-slate-400">
                          <strong>{tplConsumerNumber}</strong> Name of Consumer having address <strong>{tplConsumerName}</strong>, at <strong>{tplParentage}</strong>, <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong> (hereinafter referred to as <strong>first Party i.e./consumer/ purchaser/owner of system</strong>).
                        </p>
                        <p className="text-center font-bold text-xs uppercase tracking-wider my-1">And</p>
                        <p className="pl-4 border-l-2 border-slate-400">
                          <strong>{tplVendorName}</strong>, having registered office at <strong>{tplVendorOffice}</strong> (hereinafter referred to as <strong>second Party i.e. Vendor/ contractor/System Integrator</strong>).
                        </p>
                      </div>

                      {/* Whereas */}
                      <div className="space-y-2 text-justify mb-5">
                        <p>
                          <strong>Whereas</strong> First Party wishes to install a Grid Connected Rooftop Solar Plant on the rooftop of the residential building of the Consumer under <strong>PM Surya Ghar Muft Bijli Yojana</strong>.
                        </p>
                        <p>
                          <strong>And whereas</strong> Second Party has verified availability of appropriate roof and found it feasible to install a Grid Connected Roof Top Solar plant and that the second party is willing to design, supply, install, test, commission and carry out Operation &amp; Maintenance of the Rooftop Solar plant for 5-year period on this day, the First Party and Second Party agree to the following:
                        </p>
                      </div>

                      {/* First Party Undertakings */}
                      <div className="space-y-1.5 mb-4">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          The First Party hereby undertakes to perform the following activities:
                        </h4>
                        <ol className="list-decimal pl-5 space-y-1 text-justify">
                          <li>Submission of online application at National Portal for installation of RTS project/system, Submission of application for net-metering and system inspection and upload of the relevant documents on the National Portal of the scheme.</li>
                          <li>Provide secure storage of the material of the RTS plant delivered at the premises till handover of the system.</li>
                          <li>Provide access to the Roof Top during installation of the plant, operation &amp; maintenance, testing of the plant and equipment and for meter reading from solar meter, inverter etc.</li>
                          <li>Provide electricity during plant installation and water for cleaning of the panels.</li>
                          <li>Report any malfunctioning of the plant to the Vendor during the warranty period.</li>
                          <li>Pay the amount as per the payment schedule as mutually agreed with the vendor, including any additional amount to the second party for any additional work / customization required depending upon the building condition.</li>
                        </ol>
                      </div>

                      {/* Second Party Undertakings (18 points from statutory standard) */}
                      <div className="space-y-1.5 mb-5">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          The Second Party hereby undertakes to perform the following activities:
                        </h4>
                        <ol className="list-decimal pl-5 space-y-1.5 text-justify">
                          <li><strong>Compliance:</strong> The Vendor must follow all the standards and safety guidelines prescribed under state regulations and technical standards prescribed by MNRE for RTS projects, failing which the vendor is liable for blacklisting from participation in the govt. project/ scheme and other penal actions in accordance with the law. The responsibility of supply, installation and commissioning of the rooftop solar project/system in complete compliance with MNRE scheme guidelines lies with the Vendor.</li>
                          <li><strong>Site Survey:</strong> Site visit, survey and development of detailed project report for installation of RTS system. This also includes feasibility study of roof, strength of roof and shadow free area. If any additional work or customization is involved for the plant installation as per site condition and requirement of the consumer building, the Vendor shall prepare an estimate and can raise separate invoice including GST in addition to the amount towards standard plant cost. The consumer shall pay the amount for such additional work directly to the Vendor.</li>
                          <li><strong>Design &amp; Engineering:</strong> Design of plant along with drawings and selection of components as per standard provided by the DISCOM/SERC/MNRE for best performance and safety of the plant.</li>
                          <li><strong>Module and Inverter:</strong> The solar modules, including the solar cells, should be manufactured in India. Both the solar modules and inverters shall conform to the relevant standards and specifications prescribed by MNRE. Any other requirement, viz. star labelling (solar modules), quality control orders and standards &amp; labelling (inverters) etc., shall also be complied.</li>
                          <li><strong>Procurement &amp; Supply:</strong> Procurement of complete system as per BIS/IS/IEC standard (whatever applicable) &amp; safety guidelines for installation of rooftop solar plants. The supplied materials should comply with all MNRE standards for release of subsidy.</li>
                          <li><strong>Installation &amp; Civil work:</strong> Complete civil work, structure work and electrical work (including drawings) following all the safety and relevant BIS standards.</li>
                          <li><strong>Documentation:</strong> All such documents shall be provided to the consumer for online uploading and submission of technical specifications, IEC/BIS report, Sr. Nos, Warranty card of Solar Panel &amp; Inverter, Layout &amp; Electrical SLD, Structure Design and Drawing, Cable and other detailed documents.</li>
                          <li><strong>Project completion report (PCR):</strong> Assisting the consumer in filling and uploading of signed documents (Consumer &amp; Vendor) on the national portal.</li>
                          <li><strong>Warranty:</strong> System warranty certificates should be provided to the consumer. The complete system should be warranted for 5 years from the date of commissioning by DISCOM. Individual component warranty documents provided by the manufacturer shall be provided to the consumer and all possible assistance should be extended to the consumer for claiming the warranty from the manufacturer.</li>
                          <li><strong>NET Meter &amp; Grid Connectivity:</strong> Net meter supply/procurement, testing and approvals shall be in the scope of vendor. Grid connection of the plant shall be in the scope of the vendor.</li>
                          <li><strong>Testing and Commissioning:</strong> The vendor shall be present at the time of testing and commissioning by the DISCOM.</li>
                          <li><strong>Operation &amp; Maintenance:</strong> Five (5) years Comprehensive Operation and Maintenance including overhauling, wear and tear and regular checking of healthiness of system at proper interval shall be in the scope of vendor. The vendor shall also educate the consumer on best practices for cleaning of the modules and system maintenance.</li>
                          <li><strong>Insurance:</strong> Any insurance cost pertaining to material transfer/storage before commissioning of the system shall be in the scope of the vendor.</li>
                          <li><strong>Applicable Standard:</strong> The system must meet the technical standards and specifications notified by MNRE. The vendor is solely responsible to supply component and service which meets the technical standards and specification prescribed by MNRE and State DISCOMs.</li>
                          <li><strong>Project/system cost &amp; payment terms:</strong> The cost of the plant and payment schedule should be mutually discussed and decided between the vendor and consumer. The consumer may opt for milestone-based payment to the vendor and the same shall be included in the agreement.</li>
                          <li><strong>Dispute:</strong> In-case of any dispute between consumer and vendor (in supply/installation/ maintenance of system or payment terms), both parties must settle the same mutually or as per law. MNRE/DISCOM shall not be liable for, and would not be a party to any dispute arising between vendor and consumer.</li>
                          <li><strong>Subsidy / Project Related Documents:</strong> Vendor must provide all the documents to consumer and help in uploading the same to National Portal for smooth release of subsidy.</li>
                          <li><strong>Performance of Plant:</strong> The Performance Ratio (PR) of Plant must be 75% at the time of commissioning of the project by DISCOM or its authorized agency. Vendor must provide (returnable basis) radiation sensor with valid calibration certificate of any NABL / International laboratory at the time of commissioning / testing of the plant. Vendor must maintain the PR of the plant till warranty of project i.e. 5 years from the date of commissioning.</li>
                        </ol>
                      </div>

                      {/* Payment Terms Table */}
                      <div className="space-y-1.5 mb-6">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Mutually Agreed Terms of Payment:
                        </h4>
                        <p className="text-[11px] text-slate-700">Applicant shall pay the total cost to the Vendor as under:</p>
                        <table className="w-full border-collapse border border-slate-400 text-left my-2 text-[11px]">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-400 px-3 py-1.5 font-bold w-16">S.No.</th>
                              <th className="border border-slate-400 px-3 py-1.5 font-bold w-28">Milestone (%)</th>
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

                      {/* Signatures & Seal */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-6">
                        {/* First Party (Consumer) */}
                        <div className="space-y-8">
                          <div>
                            <p className="font-bold text-xs uppercase">Signature of First Party (Consumer)</p>
                            <p className="text-[11px] text-slate-600">Consumer / Purchaser / Owner</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Name:</strong> {tplConsumerName}</p>
                            <p><strong>Address:</strong> {tplParentage}, {tplAddress}</p>
                            <p><strong>District:</strong> {tplDistrict}, <strong>State:</strong> {tplState}</p>
                          </div>
                        </div>

                        {/* Second Party (Vendor) with Stamp */}
                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Signature of Second Party (Vendor)</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>Name:</strong> {tplVendorSignatory}</p>
                            <p><strong>Address:</strong> Ashwini Nagar, Raipur</p>
                            <p><strong>District:</strong> Raipur, <strong>State:</strong> Chhattisgarh</p>
                          </div>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-500 text-center leading-tight">
                        <p>
                          <strong>Disclaimer:</strong> This agreement is between vendor and consumer and any dispute related to the same shall not involve any third party including MNRE and Distribution Utilities.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* FORMAT 2: ANNEXURE - A DCR UNDERTAKING                */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'ANNEXURE_A_DCR' && (
                    <div className="space-y-5">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
                        <h2 className="text-lg font-bold tracking-tight uppercase">Annexure - A</h2>
                        <h3 className="text-sm font-bold leading-snug">
                          Undertaking / Self-Declaration for Domestic Content Requirement fulfillment
                        </h3>
                        <p className="text-[11px] text-slate-600 font-medium">(On a plain Paper)</p>
                      </div>

                      {/* Point 1: Certification */}
                      <div className="text-justify leading-relaxed space-y-2">
                        <p>
                          <strong>1.</strong> This is to certify that <strong>{tplVendorName}</strong> has installed <strong>{tplCapacityKwp} KW</strong> Grid Connected Rooftop Solar Plant for <strong>{tplConsumerName}</strong>, at <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong>. Under application number <strong>{tplApplicationNo}</strong> under CSPDCL.
                        </p>
                      </div>

                      {/* Point 2: PV Module Specifications */}
                      <div className="text-justify leading-relaxed space-y-3">
                        <p>
                          <strong>2.</strong> It is hereby undertaken that the PV modules installed for the above-mentioned project are domestically manufactured using domestic manufactured solar cells. The details of installed PV Modules are follows:
                        </p>

                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-2 text-[11px]">
                          <p><strong>PV Module Capacity:</strong> {tplDcrCapacityWp}</p>
                          <p><strong>Number of PV Modules:</strong> {tplDcrModuleCount}</p>
                          <p className="font-bold pt-1">Sr. No of Solar PV Module:</p>

                          {/* Grid Table for Serial Numbers */}
                          <div className="border border-slate-300 rounded overflow-hidden">
                            <table className="w-full text-center border-collapse text-[11px]">
                              <tbody>
                                <tr>
                                  <td className="border border-slate-300 p-1.5 font-mono font-bold bg-white">
                                    {tplDcrSerials[0] || 'AS2605132C1835'}
                                  </td>
                                  <td className="border border-slate-300 p-1.5 font-mono font-bold bg-white">
                                    {tplDcrSerials[1] || 'AS2605132C3736'}
                                  </td>
                                  <td className="border border-slate-300 p-1.5 bg-slate-50"></td>
                                </tr>
                                <tr>
                                  <td className="border border-slate-300 p-1.5 font-mono font-bold bg-white">
                                    {tplDcrSerials[2] || 'AS2605132C3609'}
                                  </td>
                                  <td className="border border-slate-300 p-1.5 font-mono font-bold bg-white">
                                    {tplDcrSerials[3] || 'AS2605132C1574'}
                                  </td>
                                  <td className="border border-slate-300 p-1.5 bg-slate-50"></td>
                                </tr>
                                <tr>
                                  <td className="border border-slate-300 p-1.5 font-mono font-bold bg-white">
                                    {tplDcrSerials[4] || 'AS2605132C3783'}
                                  </td>
                                  <td className="border border-slate-300 p-1.5 bg-slate-50"></td>
                                  <td className="border border-slate-300 p-1.5 bg-slate-50"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="pt-2 space-y-1">
                            <p><strong>PV Module Make:</strong> {tplDcrModuleMake}</p>
                            <p><strong>Cell manufacturer’s name:</strong> {tplDcrCellManufacturer}</p>
                          </div>
                        </div>
                      </div>

                      {/* Point 3 & 4: Manufacturer Certification & Solemn Declaration */}
                      <div className="text-justify leading-relaxed space-y-2">
                        <p>
                          <strong>3.</strong> The above undertaking is based on the certificate issued by PV Module manufacturer/supplier while supplying the above mentioned order.
                        </p>
                        <p>
                          <strong>4.</strong> I, <strong>{tplVendorSignatory}</strong> on behalf of <strong>{tplVendorName}</strong> further declare that the information given above is true and correct and nothing has been concealed therein. If anything is found incorrect at any stage, then REC/ MNRE may take any appropriate action against my company for wrong declaration. Supporting documents and proof of the above information will be provided as and when requested by MNRE.
                        </p>
                      </div>

                      {/* Signature with Official Rarebox LLP Seal */}
                      <div className="pt-6 border-t-2 border-slate-300 flex justify-end">
                        <div className="space-y-2 text-right">
                          <p className="text-[11px] text-slate-600">(Signature with official Seal)</p>
                          <p className="font-bold text-xs uppercase">For {tplVendorName}</p>

                          <div className="flex justify-end py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5 text-right font-medium">
                            <p><strong>Name:</strong> {tplVendorSignatory}</p>
                            <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                            <p><strong>Phone:</strong> {tplVendorPhone}</p>
                            <p><strong>Email:</strong> {tplVendorEmail}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* FORMAT 3: WORK COMPLETION REPORT (WCR)                */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'WORK_COMPLETION_REPORT' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-5 border-b-2 border-slate-900 pb-3">
                        <h2 className="text-xl font-bold tracking-tight uppercase">Work Completion Report</h2>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Rooftop Solar PV Installation &amp; Technical Commissioning Certificate
                        </p>
                      </div>

                      {/* Applicant Particulars */}
                      <div className="bg-slate-50 border border-slate-300 p-3.5 rounded-md text-[11px] space-y-1">
                        <p><strong>Name of Applicant:</strong> <span className="font-bold">{tplConsumerName}</span></p>
                        <p><strong>Application Registration No.:</strong> <span className="font-mono font-semibold">{tplApplicationNo}</span></p>
                        <p><strong>BP No.:</strong> <span className="font-mono font-bold">{tplConsumerNumber}</span></p>
                        <p><strong>Mob. No.:</strong> <span className="font-mono">{tplMobile}</span></p>
                      </div>

                      {/* Table 1: Solar PV System Module Detail */}
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Solar PV System Module Detail
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold w-1/2 bg-slate-50">Name of manufacturer with address</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplWcrModuleManufacturer}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Capacity of each Module (Wp)</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplWcrModuleWattage}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">No. of Modules</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplWcrModuleCount}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Total Capacity (kWp)</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold text-solar-600">{tplCapacityKwp} kw</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Date of installation</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-mono">{tplWcrInstallDate}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Any other information</td>
                              <td className="border border-slate-300 px-3 py-1.5">No</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Table 2: Inverter Installed Detail */}
                      <div className="space-y-1 pt-1">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Inverter Installed Detail
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold w-1/2 bg-slate-50">Name of manufacturer with address</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplWcrInverterManufacturer}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Make of the inverter</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplWcrInverterManufacturer}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">AC capacity of individual inverter (KVA)</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplWcrInverterCapacity}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">No. of inverters installed</td>
                              <td className="border border-slate-300 px-3 py-1.5">{tplWcrInverterCount}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Total AC capacity of inverter (KVA)</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{tplWcrInverterCapacity}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Serial Nos.</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold text-slate-900">{tplWcrInverterSerial}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Applicable Standard (BIS/IEC)</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold">{tplWcrInverterStandard}</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1.5 font-semibold bg-slate-50">Any other information</td>
                              <td className="border border-slate-300 px-3 py-1.5">NO</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Table 3: Other Details Checklist */}
                      <div className="space-y-1 pt-1">
                        <h4 className="font-bold text-xs uppercase border-b border-slate-300 pb-0.5">
                          Other Technical Details
                        </h4>
                        <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                          <tbody>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono w-12 text-center">a)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">ACDB &amp; DCDB</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center w-16">
                                {wcrAcdb ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono text-center">b)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">LA Earthing Cable</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center">
                                {wcrLaEarthing ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono text-center">c)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">AC Cable</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center">
                                {wcrAcCable ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono text-center">d)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">DC Cable</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center">
                                {wcrDcCable ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono text-center">e)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">METER BOARD</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center">
                                {wcrMeterBoard ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-300 px-3 py-1 font-mono text-center">f)</td>
                              <td className="border border-slate-300 px-3 py-1 font-medium">Earthing Cable – ISI Mark</td>
                              <td className="border border-slate-300 px-3 py-1 font-bold text-center">
                                {wcrEarthingCable ? <span className="text-emerald-600">✅</span> : <span className="text-slate-400">❌</span>}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Statutory Notes & Certification */}
                      <div className="space-y-1.5 text-[11px] pt-1 text-justify">
                        <p className="text-slate-700">
                          <strong>Note:</strong> The contractor also provides to the consumer Operation and Maintenance Manual at site &amp; the detail of caution signage.
                        </p>
                        <p className="font-semibold text-slate-900 border-l-2 border-slate-500 pl-3 py-0.5">
                          Certified that the above information for installed Solar Roof Top PV System under net metering arrangement and the equipment used comply with the Technical and Safety standards as specified by the Nigam under net metering system.
                        </p>
                      </div>

                      {/* Signatures & Seal */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 mb-4">
                        <div className="space-y-10">
                          <div>
                            <p className="font-bold text-xs uppercase">Customer Acceptance</p>
                            <p className="text-[11px] text-slate-600">Signature of the Customer</p>
                          </div>
                          <div className="border-b border-slate-400 w-48 h-8"></div>
                          <div className="text-[11px]">
                            <p><strong>Customer Name:</strong> {tplConsumerName}</p>
                            <p><strong>Mobile:</strong> {tplMobile}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-bold text-xs uppercase">Certified Installer</p>
                          <p className="text-[11px] text-slate-600">Signature of the Installer</p>

                          <div className="py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5">
                            <p><strong>For:</strong> {tplVendorName}</p>
                            <p><strong>Authorized Signatory:</strong> {tplVendorSignatory}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* FORMAT 4: CSPDCL GRID CONNECTIVITY APPLICATION       */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'GRID_CONNECTIVITY_APP' && (
                    <div className="space-y-6">
                      {/* Date */}
                      <div className="flex justify-between items-center text-[11px] border-b border-slate-200 pb-2">
                        <span className="font-mono font-semibold">Ref: CSPDCL/GRID-CONN/{tplConsumerNumber}</span>
                        <span>Date: <strong>{tplAgreementDate}</strong></span>
                      </div>

                      {/* Addressed to */}
                      <div className="space-y-1 text-[11px]">
                        <p className="font-bold text-xs">To,</p>
                        <p className="pl-4 font-bold text-slate-900">Sub Division AE</p>
                        <p className="pl-4 font-semibold text-slate-800">C S P D C L</p>
                        <p className="pl-4 text-slate-700">{tplDiscomSubDivAE}</p>
                      </div>

                      {/* Subject */}
                      <div className="bg-slate-100 p-3 rounded-md border border-slate-300">
                        <p className="font-bold text-xs leading-snug">
                          Subject: Application for Grid Connectivity Rooftop {tplCapacityKwp} KW SP Solar Power plant.
                        </p>
                      </div>

                      {/* Body */}
                      <div className="space-y-4 text-justify leading-relaxed">
                        <p className="font-bold">Respected Sir,</p>
                        <p>
                          We would like to inform you that installed <strong>{tplCapacityKwp} KW</strong> Grid Connected Solar Power Plant at home building Roof Top to <strong>{tplConsumerName}</strong>, at <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong>. Details of Roof Top SPV to be installed in as under:
                        </p>

                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-md space-y-1.5 text-[11px]">
                          <p><strong>Name –</strong> {tplConsumerName}</p>
                          <p><strong>Address –</strong> {tplAddress}</p>
                          <p><strong>District:</strong> {tplDistrict}, <strong>State:</strong> {tplState}.</p>
                          <p><strong>MOB –</strong> {tplMobile}</p>
                          <p><strong>BP –</strong> {tplConsumerNumber}</p>
                        </div>

                        <p>
                          We are submitting all required documents, certificates, etc related to our SPV. We request you to permit us to connect to the Grid (LV Connection).
                        </p>

                        <p className="pt-2">Thanking You,</p>
                      </div>

                      {/* Signature with Rarebox Stamp */}
                      <div className="pt-8 border-t-2 border-slate-300 flex justify-end">
                        <div className="space-y-2 text-right">
                          <p className="font-bold text-xs uppercase">For, RAREBOX LLP</p>
                          <p className="text-[11px] text-slate-600">Authorized Signatory</p>

                          <div className="flex justify-end py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5 text-right font-medium">
                            <p><strong>Name:</strong> {tplVendorSignatory}</p>
                            <p><strong>Office:</strong> {tplVendorOffice}</p>
                            <p><strong>Contact:</strong> {tplVendorPhone}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* FORMAT 5: CSPDCL POWER PURCHASE AGREEMENT (PPA)       */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'CSPDCL_PPA_AGREEMENT' && (
                    <div className="space-y-4">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-5 border-b-2 border-slate-900 pb-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          CHHATTISGARH STATE POWER DISTRIBUTION CO.LTD.
                        </h2>
                        <p className="text-[10px] text-slate-600 font-medium">
                          (A Government of Chhattisgarh Undertaking) (A Successor Company of CSEB) CIN-U40108CT2003SGC015822
                        </p>
                        <h3 className="text-sm font-bold uppercase tracking-tight pt-1">
                          POWER PURCHASE AGREEMENT FOR RTS PLANTS
                        </h3>
                      </div>

                      {/* Parties Preamble */}
                      <div className="space-y-2 text-justify text-[11px]">
                        <p>
                          This Power Purchase Agreement is made and entered into at <strong>{tplPpaPlace}</strong> on the <strong>{tplAgreementDate}</strong> Two Thousand and Twenty Six between <strong>CHHATTISGARH STATE POWER DISTRIBUTION CO.LTD. RAIPUR</strong> (hereinafter referred to as CSPDCL/Licensee), a company incorporated under the provisions of the Companies Act, 2013, having its head office at Vidyut Sewa Bhawan, Dangania, Raipur – 492013, Chhattisgarh, India, which expression shall, unless repugnant to the subject, context or meaning thereof, be deemed to mean and include its successors, authorized representatives and permitted assigns of the <strong>FIRST PART</strong>;
                        </p>
                        <p className="text-center font-bold text-xs uppercase my-1">And</p>
                        <p>
                          <strong>{tplConsumerNumber}</strong> having its premises at, <strong>{tplConsumerName}</strong>, at <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong>. hereinafter referred to the <strong>'Prosumer'</strong> as party on the <strong>SECOND PART</strong>.
                        </p>
                      </div>

                      {/* Recitals */}
                      <div className="space-y-2 text-justify text-[11px]">
                        <p>
                          The Chhattisgarh State Electricity Regulatory Commission (hereinafter referred to as “the Commission”) has notified Chhattisgarh State Electricity Regulatory Commission (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2019 (hereinafter referred to as “CSERC Distributed Solar energy Regulations 2019”) wherein modalities for purchase annual surplus energy (excess energy injected to CSPDCL’s distribution system by the RTS Plants having capacity 1kWp &amp; above after netting off) by distribution licensee and other related dispensations are suitably addressed. Also, as per provisions in the CSERC Distributed Solar energy Regulations 2019, power generated by such RTS Plants will also qualify for CSPDCL’s renewable purchase obligation.
                        </p>
                        <p>
                          Whereas Prosumer has set up <strong>{tplCapacityKwp}.00 kWp</strong> Roof-Top Solar Power Plant at <strong>{tplConsumerName}</strong>, at <strong>{tplAddress}</strong>, District: <strong>{tplDistrict}</strong>, State: <strong>{tplState}</strong> for their captive use whereas Prosumer has offered annual surplus solar power for sale to the Licensee in accordance to CSERC Distributed Solar energy Regulations 2019, and CEA Technical &amp; Safety Standards.
                        </p>
                        <p className="font-bold text-xs">NOW This agreement witnesses and the parties hereto have agreed as below:</p>
                      </div>

                      {/* Clauses */}
                      <div className="space-y-2 text-justify text-[11px]">
                        <p>
                          <strong>Part 1: Definitions and interpretations:</strong> “Grid Meter/Bidirectional Meter” (GM) means import and export meter on the basis of which energy bills shall be raised. “Solar Meter/Generating Meter” (SM) means a meter used for accounting and billing of electricity generated by the Rooftop PV Plant.
                        </p>
                        <p>
                          <strong>TARIFF:</strong> {tplPpaTariff}. The tariff for excess electricity at the end of settlement period shall be settled by CSPDCL as per regulation 11(c) of CSERC Regulations 2019.
                        </p>
                        <p>
                          <strong>Payment of Dues:</strong> CSPDCL is obligated to make direct payment of dues into the bank account of Prosumer towards excess electricity, if any, at the end of settlement period by 15th May of ensuing financial year suomotu, provided Bank account / NEFT details have been registered online.
                        </p>
                        <p>
                          <strong>METERING:</strong> The Grid Meter (GM) and Solar meter shall be interface type complying with Time of Day (TOD) requirements and approved by CSPDCL/CSPTCL. Meters shall be jointly tested, inspected, and sealed.
                        </p>
                        <p>
                          <strong>DURATION:</strong> Valid for useful life of the RTS plants (25 Years) from the date of commercial operation (COD).
                        </p>
                      </div>

                      {/* Witnesses & Signatures */}
                      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-[11px] mb-2">
                        <div className="space-y-6">
                          <div>
                            <p className="font-bold text-xs uppercase">PROSUMER: -</p>
                            <p className="pt-4 font-bold">{tplConsumerName}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700">WITNESSES (Consumer):</p>
                            <div className="border-b border-slate-400 w-44 h-5 mt-2"></div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <p className="font-bold text-xs uppercase">CSPDCL Authority: -</p>
                            <p className="pt-4 font-bold">Executive / Assistant Engineer (O&amp;M)</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700">WITNESSES (CSPDCL):</p>
                            <div className="border-b border-slate-400 w-44 h-5 mt-2"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===================================================== */}
                  {/* FORMAT 6: BANK LOAN DISBURSEMENT APPLICATION (HINDI) */}
                  {/* ===================================================== */}
                  {selectedTemplateId === 'BANK_LOAN_DISBURSEMENT' && (
                    <div className="space-y-5 font-sans">
                      {/* Document Header */}
                      <div className="text-center space-y-1 mb-5 border-b-2 border-slate-900 pb-3">
                        <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-950">
                          PM Surya Ghar योजना के अंतर्गत स्वीकृत ऋण की शेष राशि के वितरण (Disbursement) हेतु आवेदन।
                        </h2>
                        <p className="text-[11px] text-slate-600 font-semibold">
                          (शाखा प्रबंधक को परियोजना पूर्णता एवं अंतिम ऋण वितरण हेतु औपचारिक पत्र)
                        </p>
                      </div>

                      {/* To: Branch Manager */}
                      <div className="space-y-1 text-xs">
                        <p className="font-bold">सेवा में,</p>
                        <p className="pl-4 font-bold text-slate-900">शाखा प्रबंधक महोदय,</p>
                        <p className="pl-4 font-semibold text-slate-800">{tplLoanBankName}</p>
                        <p className="pl-4 text-slate-700">{tplLoanBranchName}</p>
                      </div>

                      {/* Subject */}
                      <div className="bg-slate-100 p-3 rounded-md border border-slate-300">
                        <p className="font-bold text-xs leading-snug">
                          विषय: PM Surya Ghar योजना के अंतर्गत स्वीकृत ऋण की शेष राशि के वितरण (Disbursement) हेतु आवेदन।
                        </p>
                      </div>

                      {/* Body Letter in Hindi */}
                      <div className="space-y-3.5 text-justify leading-relaxed text-xs">
                        <p className="font-bold">महोदय,</p>
                        <p>
                          सविनय निवेदन है कि मैं <strong>{tplLoanApplicantName}</strong> आपके बैंक का ग्राहक एवं PM Surya Ghar योजना के अंतर्गत ऋणधारक हूँ। मेरे स्वीकृत ऋण की <strong>{tplLoanDisbursedPercent}</strong> राशि का वितरण पहले ही किया जा चुका है। परियोजना का कार्य पूर्ण हो चुका है।
                        </p>
                        <p>
                          अतः आपसे विनम्र अनुरोध है कि आवश्यक अभिलेखों एवं औपचारिकताओं का निरीक्षण कर सकते हैं।
                        </p>
                        <p>इसके लिए मैं आपका सदैव आभारी रहूँगा।</p>
                      </div>

                      {/* Applicant & Contractor Verification */}
                      <div className="pt-8 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs mb-4">
                        {/* Applicant Details */}
                        <div className="space-y-2">
                          <p className="font-bold uppercase text-slate-900">भवदीय,</p>
                          <div className="space-y-1 pt-1 text-[11px]">
                            <p><strong>नाम: -</strong> {tplLoanApplicantName}</p>
                            <p><strong>मोबाइल नंबर: -</strong> {tplLoanMobile}</p>
                            <p><strong>दिनांक: -</strong> {tplAgreementDate}</p>
                            <p className="pt-4"><strong>हस्ताक्षर:</strong> ____________________</p>
                          </div>
                        </div>

                        {/* Installer Verification Seal */}
                        <div className="space-y-2 text-right">
                          <p className="font-bold text-xs uppercase">Certified Solar Vendor</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>

                          <div className="flex justify-end py-1">
                            <img
                              src={RAREBOX_STAMP_BASE64}
                              alt="Rarebox LLP Stamp & Signature"
                              className="w-32 h-32 object-contain filter contrast-125"
                            />
                          </div>

                          <div className="text-[11px] space-y-0.5 text-right font-medium">
                            <p><strong>Signatory:</strong> {tplVendorSignatory}</p>
                            <p><strong>Phone:</strong> {tplVendorPhone}</p>
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
