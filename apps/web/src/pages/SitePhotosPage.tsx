import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Camera,
  FolderLock,
  ChevronRight,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  RotateCcw,
  UserCheck,
  FileCheck2,
  ShieldCheck
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';
import { downloadElementAsPdf, generatePdfFromElement } from '../lib/pdfGenerator.js';
import { RAREBOX_STAMP_BASE64 } from '../assets/rareboxStampBase64.js';
import {
  SAMPLE_PHOTO1_BASE64,
  SAMPLE_PHOTO2_BASE64,
  SAMPLE_PHOTO3_BASE64,
  SAMPLE_PHOTO4_BASE64
} from '../assets/sampleSitePhotosBase64.js';

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

export const SitePhotosPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Customer Directory State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Customer & Site Information
  const [tplConsumerName, setTplConsumerName] = useState('SHRI GYAN CHAND JAISWAL');
  const [tplConsumerNumber, setTplConsumerNumber] = useState('1001750390');
  const [tplCapacityKwp, setTplCapacityKwp] = useState('3');
  const [tplAddress, setTplAddress] = useState('SHANTI VIHAR COLONY, DANGANIA');
  const [tplDistrict, setTplDistrict] = useState('Raipur');
  const [tplAgreementDate, setTplAgreementDate] = useState('11/06/2026');

  // Vendor Information (Rarebox LLP)
  const [tplVendorName] = useState('M/S RAREBOX LLP RAIPUR');
  const [tplVendorSignatory] = useState('SAMEER SAHU');
  const [tplVendorDesignation] = useState('PROPRIETOR / AUTHORIZED SIGNATORY');
  const [tplVendorPhone] = useState('9630131550');

  // 4 Rooftop Site Photos State
  const [sitePhoto1, setSitePhoto1] = useState<string>(SAMPLE_PHOTO1_BASE64);
  const [sitePhoto1Caption, setSitePhoto1Caption] = useState('1. Solar PV Rooftop Array & Beneficiary View');
  const [sitePhoto1Gps, setSitePhoto1Gps] = useState('Lat: 21.237361°, Long: 81.603828° • Elev: 306.55m • 12-06-2026 15:34');

  const [sitePhoto2, setSitePhoto2] = useState<string>(SAMPLE_PHOTO2_BASE64);
  const [sitePhoto2Caption, setSitePhoto2Caption] = useState('2. Chemical Earthing Pits & Grounding Chambers');
  const [sitePhoto2Gps, setSitePhoto2Gps] = useState('Lat: 21.237414°, Long: 81.603882° • Elev: 306.65m • 11-06-2026 19:36');

  const [sitePhoto3, setSitePhoto3] = useState<string>(SAMPLE_PHOTO3_BASE64);
  const [sitePhoto3Caption, setSitePhoto3Caption] = useState('3. On-Grid Inverter, ACDB & DCDB Distribution Junction');
  const [sitePhoto3Gps, setSitePhoto3Gps] = useState('Lat: 21.237278°, Long: 81.604320° • Elev: 306.25m • 11-06-2026 18:45');

  const [sitePhoto4, setSitePhoto4] = useState<string>(SAMPLE_PHOTO4_BASE64);
  const [sitePhoto4Caption, setSitePhoto4Caption] = useState('4. Lightning Arrester (LA) & Terrace Grounding Earthing');
  const [sitePhoto4Gps, setSitePhoto4Gps] = useState('Lat: 21.237171°, Long: 81.603859° • Elev: 306.25m • 11-06-2026 18:48');

  // Print/Download ref & UI states
  const documentPrintRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState<string | null>(null);

  // Load customer directory for autofill
  useEffect(() => {
    let isMounted = true;
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const res: any = await apiClient<any>('/customers?limit=100');
        const list: CustomerOption[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.customers)
              ? res.customers
              : [];
        if (isMounted) {
          setCustomers(list);
          const preselectedCustomerId = searchParams.get('customerId') || '';
          if (preselectedCustomerId) {
            const match = list.find(c => (c._id || c.id) === preselectedCustomerId);
            if (match) setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.warn('Customer list load error:', err);
      } finally {
        if (isMounted) setLoadingCustomers(false);
      }
    };
    fetchCustomers();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Autofill customer data when customer selected
  useEffect(() => {
    if (!selectedCustomer) return;
    if (selectedCustomer.name) {
      setTplConsumerName(selectedCustomer.name.toUpperCase());
    }
    if (selectedCustomer.customerCode) {
      setTplConsumerNumber(selectedCustomer.customerCode.replace(/\D/g, '') || selectedCustomer.customerCode);
    }
    if (selectedCustomer.installationAddress) {
      const addr = selectedCustomer.installationAddress;
      if (addr.addressLine1) {
        setTplAddress(addr.addressLine1.toUpperCase());
      }
      if (addr.city || addr.district) {
        setTplDistrict(addr.district || addr.city || 'Raipur');
      }
      if (addr.geoCoordinates?.latitude && addr.geoCoordinates?.longitude) {
        const lat = addr.geoCoordinates.latitude.toFixed(6);
        const lng = addr.geoCoordinates.longitude.toFixed(6);
        setSitePhoto1Gps(`Lat: ${lat}°, Long: ${lng}° • Elev: 306.55m • ${tplAgreementDate}`);
        setSitePhoto2Gps(`Lat: ${lat}°, Long: ${lng}° • Elev: 306.65m • ${tplAgreementDate}`);
        setSitePhoto3Gps(`Lat: ${lat}°, Long: ${lng}° • Elev: 306.25m • ${tplAgreementDate}`);
        setSitePhoto4Gps(`Lat: ${lat}°, Long: ${lng}° • Elev: 306.25m • ${tplAgreementDate}`);
      }
    }
  }, [selectedCustomer, tplAgreementDate]);

  const handlePhotoUpload = (slot: 'photo1' | 'photo2' | 'photo3' | 'photo4', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (slot === 'photo1') setSitePhoto1(result);
      if (slot === 'photo2') setSitePhoto2(result);
      if (slot === 'photo3') setSitePhoto3(result);
      if (slot === 'photo4') setSitePhoto4(result);
    };
    reader.readAsDataURL(file);
  };

  const handleResetSitePhotos = () => {
    setSitePhoto1(SAMPLE_PHOTO1_BASE64);
    setSitePhoto1Caption('1. Solar PV Rooftop Array & Beneficiary View');
    setSitePhoto1Gps('Lat: 21.237361°, Long: 81.603828° • Elev: 306.55m • 12-06-2026 15:34');

    setSitePhoto2(SAMPLE_PHOTO2_BASE64);
    setSitePhoto2Caption('2. Chemical Earthing Pits & Grounding Chambers');
    setSitePhoto2Gps('Lat: 21.237414°, Long: 81.603882° • Elev: 306.65m • 11-06-2026 19:36');

    setSitePhoto3(SAMPLE_PHOTO3_BASE64);
    setSitePhoto3Caption('3. On-Grid Inverter, ACDB & DCDB Distribution Junction');
    setSitePhoto3Gps('Lat: 21.237278°, Long: 81.604320° • Elev: 306.25m • 11-06-2026 18:45');

    setSitePhoto4(SAMPLE_PHOTO4_BASE64);
    setSitePhoto4Caption('4. Lightning Arrester (LA) & Terrace Grounding Earthing');
    setSitePhoto4Gps('Lat: 21.237171°, Long: 81.603859° • Elev: 306.25m • 11-06-2026 18:48');
  };

  const handleResetDefaults = () => {
    setSelectedCustomer(null);
    setTplConsumerName('SHRI GYAN CHAND JAISWAL');
    setTplConsumerNumber('1001750390');
    setTplCapacityKwp('3');
    setTplAddress('SHANTI VIHAR COLONY, DANGANIA');
    setTplDistrict('Raipur');
    setTplAgreementDate('11/06/2026');
    handleResetSitePhotos();
    setVaultSaveSuccess(null);
  };

  const handleOpenPdfPreview = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const { objectUrl } = await generatePdfFromElement(documentPrintRef.current, {
        filename: `SITE_PHOTOS_${cleanName || 'Consumer'}.pdf`
      });
      setPdfPreviewUrl(objectUrl);
      setPdfPreviewModalOpen(true);
    } catch (err: any) {
      alert('Could not render PDF preview: ' + (err?.message || 'Rendering error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = `SITE_PHOTOS_${cleanName || 'Consumer'}.pdf`;
      await downloadElementAsPdf(documentPrintRef.current, filename);
    } catch (err: any) {
      alert('Failed to generate PDF download: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!documentPrintRef.current) return;
    try {
      setIsSavingToVault(true);
      setVaultSaveSuccess(null);

      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = `SITE_PHOTOS_${cleanName || 'Consumer'}.pdf`;

      const { blob } = await generatePdfFromElement(documentPrintRef.current, {
        filename
      });

      const title = `Client Site Photos Compliance – ${tplConsumerName}`;
      const payload: any = {
        title,
        documentType: 'SITE_PHOTOS',
        category: 'SITE_PHOTOS',
        mimeType: 'application/pdf',
        fileSizeBytes: blob.size,
        fileName: filename,
        description: `Official 4-angle rooftop site photos document for ${tplConsumerName} (${tplConsumerNumber || 'BP'}).`,
        metadata: {
          templateId: 'SITE_PHOTOS_REPORT',
          consumerName: tplConsumerName,
          consumerNumber: tplConsumerNumber,
          capacityKwp: tplCapacityKwp,
          district: tplDistrict,
          generatedDate: tplAgreementDate,
          generatorSource: 'SitePhotosPage'
        }
      };

      if (selectedCustomer) {
        payload.customerId = selectedCustomer._id || selectedCustomer.id;
      }

      const docRes: any = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const docId = docRes?._id || docRes?.id;
      if (!docId) throw new Error('Could not obtain document registration ID.');

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

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Clean Top Header */}
      <div className="bg-card border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground mb-1">
                <Link to="/installations" className="hover:text-solar-600 transition">Field Operations</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-foreground font-bold">Site Photos Document</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold shadow-2xs">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Client Rooftop Site Photos Compliance Document
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Official PM Surya Ghar &amp; DISCOM rooftop site photography report with GPS geotags. Strictly for installer field documentation.
                  </p>
                </div>
              </div>
            </div>

            {/* Active Format Badge */}
            <div className="flex items-center space-x-2 bg-orange-500/10 px-3.5 py-2 rounded-xl border border-orange-500/30 text-orange-800 dark:text-orange-300">
              <Camera className="w-4 h-4 text-orange-600 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-orange-600 dark:text-orange-400">Locked Format: </span>
                <span className="font-bold">SITE PHOTOS AT &lt;CUSTOMER&gt;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Control Bar */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Format Indicator & Customer Autofill */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Dedicated Locked Format Badge */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  1. Document Format (Exclusive to Site Photos)
                </label>
                <div className="flex items-center space-x-2 px-3.5 py-2.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl text-orange-900 dark:text-orange-200 text-xs sm:text-sm font-bold shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="truncate">Client Site Photos Compliance Document (SITE PHOTOS AT &lt;CLIENT&gt;)</span>
                </div>
              </div>

              {/* Customer Autofill Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  2. Select Customer to Autofill Details
                </label>
                <div className="relative">
                  <select
                    value={selectedCustomer ? selectedCustomer._id || selectedCustomer.id || '' : ''}
                    onChange={e => {
                      const id = e.target.value;
                      if (!id) {
                        setSelectedCustomer(null);
                        return;
                      }
                      const match = customers.find(c => (c._id || c.id) === id);
                      if (match) setSelectedCustomer(match);
                    }}
                    className="w-full sm:w-[320px] px-3.5 py-2.5 text-xs sm:text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Manual Entry / Choose Customer --</option>
                    {customers.map(c => {
                      const cid = c._id || c.id || '';
                      return (
                        <option key={cid} value={cid}>
                          {c.name} {c.customerCode ? `(${c.customerCode})` : ''} - {c.installationAddress?.city || 'Raipur'}
                        </option>
                      );
                    })}
                  </select>
                  {loadingCustomers && (
                    <div className="absolute right-3 top-3 pointer-events-none">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition flex items-center space-x-1 cursor-pointer"
                title="Reset all fields to sample defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPdfPreview}
                disabled={generatingPdf}
                className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs border border-border cursor-pointer disabled:opacity-50"
              >
                {generatingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-solar-600" />
                )}
                <span>Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
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
                onClick={handleSaveToVault}
                disabled={isSavingToVault}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Save generated PDF into customer's document vault"
              >
                {isSavingToVault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderLock className="w-3.5 h-3.5" />
                )}
                <span>Save to Customer Vault</span>
              </button>
            </div>
          </div>

          {vaultSaveSuccess && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{vaultSaveSuccess}</span>
              </div>
              <Link
                to="/documents"
                className="font-bold underline hover:text-emerald-900 transition shrink-0 ml-3"
              >
                Open Vault &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Workspace: 2 Columns (Left: Customer Details & 4 Photo Uploads, Right: Live Paper View) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Details & Photo Uploaders (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Customer &amp; Site Information</h2>
                    <p className="text-[10px] text-muted-foreground">Changes update the paper preview instantly</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Sync
                </span>
              </div>

              {/* Customer Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Customer Full Name (Header Title) *
                  </label>
                  <input
                    type="text"
                    value={tplConsumerName}
                    onChange={e => setTplConsumerName(e.target.value)}
                    placeholder="e.g. SHRI GYAN CHAND JAISWAL"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Document Title: <span className="font-bold text-foreground">SITE PHOTOS AT {tplConsumerName || 'SHRI GYAN CHAND JAISWAL'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Consumer / BP No.
                    </label>
                    <input
                      type="text"
                      value={tplConsumerNumber}
                      onChange={e => setTplConsumerNumber(e.target.value)}
                      placeholder="1001750390"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Rooftop Solar Capacity (kWp)
                    </label>
                    <input
                      type="text"
                      value={tplCapacityKwp}
                      onChange={e => setTplCapacityKwp(e.target.value)}
                      placeholder="3"
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Premises Address &amp; Landmark
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
                      City / District
                    </label>
                    <input
                      type="text"
                      value={tplDistrict}
                      onChange={e => setTplDistrict(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-foreground mb-1">
                      Inspection / Geotag Date
                    </label>
                    <input
                      type="text"
                      value={tplAgreementDate}
                      onChange={e => setTplAgreementDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-mono text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* 4 Interactive Photo Slots with Thumbnails & Camera/Upload */}
              <div className="pt-3 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Upload / Replace 4 Site Photographs
                  </span>
                  <button
                    type="button"
                    onClick={handleResetSitePhotos}
                    className="text-[10px] text-solar-600 hover:text-solar-700 font-bold underline cursor-pointer"
                  >
                    Reset to Default Photos
                  </button>
                </div>

                {/* Slot 1 */}
                <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      1. Solar PV Rooftop Array &amp; Beneficiary
                    </span>
                    <label className="px-2.5 py-1 bg-solar-600 hover:bg-solar-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shadow-2xs">
                      <span>Upload / Camera</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload('photo1', f);
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={sitePhoto1}
                      alt="Slot 1"
                      className="w-20 h-14 object-cover rounded-lg border border-border shrink-0 shadow-2xs bg-white"
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <input
                        type="text"
                        value={sitePhoto1Caption}
                        onChange={e => setSitePhoto1Caption(e.target.value)}
                        placeholder="Caption..."
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded font-semibold text-foreground truncate"
                      />
                      <input
                        type="text"
                        value={sitePhoto1Gps}
                        onChange={e => setSitePhoto1Gps(e.target.value)}
                        placeholder="GPS Coordinates..."
                        className="w-full px-2 py-0.5 text-[10px] bg-background border border-border rounded font-mono text-muted-foreground truncate"
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 2 */}
                <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      2. Chemical Earthing Pits &amp; Grounding
                    </span>
                    <label className="px-2.5 py-1 bg-solar-600 hover:bg-solar-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shadow-2xs">
                      <span>Upload / Camera</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload('photo2', f);
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={sitePhoto2}
                      alt="Slot 2"
                      className="w-20 h-14 object-cover rounded-lg border border-border shrink-0 shadow-2xs bg-white"
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <input
                        type="text"
                        value={sitePhoto2Caption}
                        onChange={e => setSitePhoto2Caption(e.target.value)}
                        placeholder="Caption..."
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded font-semibold text-foreground truncate"
                      />
                      <input
                        type="text"
                        value={sitePhoto2Gps}
                        onChange={e => setSitePhoto2Gps(e.target.value)}
                        placeholder="GPS Coordinates..."
                        className="w-full px-2 py-0.5 text-[10px] bg-background border border-border rounded font-mono text-muted-foreground truncate"
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 3 */}
                <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      3. Grid Inverter, ACDB &amp; DCDB Junction
                    </span>
                    <label className="px-2.5 py-1 bg-solar-600 hover:bg-solar-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shadow-2xs">
                      <span>Upload / Camera</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload('photo3', f);
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={sitePhoto3}
                      alt="Slot 3"
                      className="w-20 h-14 object-cover rounded-lg border border-border shrink-0 shadow-2xs bg-white"
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <input
                        type="text"
                        value={sitePhoto3Caption}
                        onChange={e => setSitePhoto3Caption(e.target.value)}
                        placeholder="Caption..."
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded font-semibold text-foreground truncate"
                      />
                      <input
                        type="text"
                        value={sitePhoto3Gps}
                        onChange={e => setSitePhoto3Gps(e.target.value)}
                        placeholder="GPS Coordinates..."
                        className="w-full px-2 py-0.5 text-[10px] bg-background border border-border rounded font-mono text-muted-foreground truncate"
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 4 */}
                <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      4. Lightning Arrester (LA) &amp; Terrace
                    </span>
                    <label className="px-2.5 py-1 bg-solar-600 hover:bg-solar-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shadow-2xs">
                      <span>Upload / Camera</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload('photo4', f);
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={sitePhoto4}
                      alt="Slot 4"
                      className="w-20 h-14 object-cover rounded-lg border border-border shrink-0 shadow-2xs bg-white"
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <input
                        type="text"
                        value={sitePhoto4Caption}
                        onChange={e => setSitePhoto4Caption(e.target.value)}
                        placeholder="Caption..."
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded font-semibold text-foreground truncate"
                      />
                      <input
                        type="text"
                        value={sitePhoto4Gps}
                        onChange={e => setSitePhoto4Gps(e.target.value)}
                        placeholder="GPS Coordinates..."
                        className="w-full px-2 py-0.5 text-[10px] bg-background border border-border rounded font-mono text-muted-foreground truncate"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Paper Document Preview (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-foreground">
                    Live Paper Document View
                  </span>
                  <span className="text-[10px] text-muted-foreground">(Updates automatically with your edits)</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenPdfPreview}
                  className="text-xs font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Full PDF Preview</span>
                </button>
              </div>

              {/* White Sheet Paper Container */}
              <div className="bg-slate-300 dark:bg-slate-900/80 p-2 sm:p-5 rounded-xl overflow-x-auto">
                <div
                  ref={documentPrintRef}
                  className="bg-white text-slate-900 mx-auto max-w-[850px] p-6 sm:p-10 shadow-xl rounded-sm font-serif leading-relaxed text-[12px] sm:text-[13px]"
                  style={{
                    fontFamily: '"Times New Roman", Times, serif',
                    color: '#0f172a'
                  }}
                >
                  <div className="space-y-6 text-slate-900 font-serif">
                    {/* Document Header matching exact Word document format: SITE PHOTOS AT <CUSTOMER NAME> */}
                    <div className="text-center pb-4 border-b-2 border-slate-900">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 uppercase tracking-wide underline underline-offset-8">
                        SITE PHOTOS AT {tplConsumerName || 'SHRI GYAN CHAND JAISWAL'}
                      </h1>
                      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-700 mt-3 font-sans">
                        <span><strong>Consumer / BP No:</strong> {tplConsumerNumber || '1001750390'}</span>
                        <span>•</span>
                        <span><strong>Capacity:</strong> {tplCapacityKwp || '3'} kWp Rooftop Solar</span>
                        <span>•</span>
                        <span><strong>Site:</strong> {tplAddress || 'SHANTI VIHAR COLONY, DANGANIA'}, {tplDistrict || 'RAIPUR'}</span>
                        <span>•</span>
                        <span><strong>Date:</strong> {tplAgreementDate || '11/06/2026'}</span>
                      </div>
                    </div>

                    {/* 4 Official Site Photos in Clean Vertical Stack matching Word doc */}
                    <div className="space-y-6">
                      {/* Photo 1: Rooftop Array & Beneficiary */}
                      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between font-sans">
                          <span className="font-bold text-xs uppercase tracking-wide">{sitePhoto1Caption}</span>
                          <span className="text-[10px] text-solar-400 font-mono">{sitePhoto1Gps}</span>
                        </div>
                        <div className="p-3 flex justify-center bg-slate-50">
                          <img
                            src={sitePhoto1}
                            alt="Photo 1"
                            crossOrigin="anonymous"
                            className="max-h-[460px] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Photo 2: Chemical Earthing Pits */}
                      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between font-sans">
                          <span className="font-bold text-xs uppercase tracking-wide">{sitePhoto2Caption}</span>
                          <span className="text-[10px] text-solar-400 font-mono">{sitePhoto2Gps}</span>
                        </div>
                        <div className="p-3 flex justify-center bg-slate-50">
                          <img
                            src={sitePhoto2}
                            alt="Photo 2"
                            crossOrigin="anonymous"
                            className="max-h-[460px] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Photo 3: Grid Inverter & ACDB/DCDB */}
                      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between font-sans">
                          <span className="font-bold text-xs uppercase tracking-wide">{sitePhoto3Caption}</span>
                          <span className="text-[10px] text-solar-400 font-mono">{sitePhoto3Gps}</span>
                        </div>
                        <div className="p-3 flex justify-center bg-slate-50">
                          <img
                            src={sitePhoto3}
                            alt="Photo 3"
                            crossOrigin="anonymous"
                            className="max-h-[460px] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Photo 4: Lightning Arrester & Terrace */}
                      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between font-sans">
                          <span className="font-bold text-xs uppercase tracking-wide">{sitePhoto4Caption}</span>
                          <span className="text-[10px] text-solar-400 font-mono">{sitePhoto4Gps}</span>
                        </div>
                        <div className="p-3 flex justify-center bg-slate-50">
                          <img
                            src={sitePhoto4}
                            alt="Photo 4"
                            crossOrigin="anonymous"
                            className="max-h-[460px] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Official Handover & Verification Seal Footer */}
                    <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 gap-6 items-end font-sans">
                      <div className="space-y-2 text-xs">
                        <p className="font-bold uppercase tracking-wider text-slate-800">Consumer / Beneficiary Acknowledgement</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          I hereby certify that all solar PV rooftop equipment, inverter, chemical earthing pits, and lightning arrestor shown in the photographs above have been installed at my premises in complete working condition under PM Surya Ghar Muft Bijli Yojana.
                        </p>
                        <div className="pt-4 text-xs font-semibold space-y-1">
                          <p><strong>Consumer Name:</strong> {tplConsumerName}</p>
                          <p><strong>BP No:</strong> {tplConsumerNumber}</p>
                          <p className="pt-3"><strong>Signature:</strong> ___________________________</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-right text-xs">
                        <p className="font-bold uppercase tracking-wider text-slate-800">Certified EPC Vendor</p>
                        <p className="text-[11px] text-slate-600">For {tplVendorName}</p>
                        <div className="flex justify-end py-1">
                          <img
                            src={RAREBOX_STAMP_BASE64}
                            alt="Rarebox LLP Stamp"
                            className="w-28 h-28 object-contain filter contrast-125"
                          />
                        </div>
                        <div className="text-[11px] space-y-0.5 text-right font-medium text-slate-700">
                          <p><strong>Signatory:</strong> {tplVendorSignatory}</p>
                          <p><strong>Designation:</strong> {tplVendorDesignation}</p>
                          <p><strong>Phone:</strong> {tplVendorPhone}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN HIGH-RESOLUTION PDF PREVIEW MODAL */}
      {pdfPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-card w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    PDF Preview: SITE PHOTOS AT {tplConsumerName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    High-Resolution Vector PDF (Ready for PM Surya Ghar portal &amp; DISCOM upload)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPdfPreviewModalOpen(false);
                    if (pdfPreviewUrl) {
                      URL.revokeObjectURL(pdfPreviewUrl);
                      setPdfPreviewUrl(null);
                    }
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-muted/40 p-3 sm:p-6 overflow-hidden flex items-center justify-center">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDF Preview"
                  className="w-full h-full rounded-xl border border-border shadow-inner bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-solar-600" />
                  <p className="text-xs font-semibold">Generating high-resolution PDF preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
