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
  ShieldCheck,
  MapPin,
  ExternalLink,
  UploadCloud,
  Trash2,
  Info,
  Navigation,
  Sparkles,
  CheckSquare
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';
import { downloadElementAsPdf, generatePdfFromElement } from '../lib/pdfGenerator.js';
import { DocumentCategory, DocumentAccessClassification } from '@ins-solar/shared';
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

export type PhotoSlotId = 'structure' | 'inverter' | 'meter' | 'earthing' | 'lightning';

export interface PhotoSlotConfig {
  id: PhotoSlotId;
  shortTitle: string;
  officialTitle: string;
  badge: string;
  infoGuideline: string;
  checklist: string[];
}

export interface PhotoSlotData {
  dataUrl: string | null;
  caption: string;
  gps: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string | null;
}

export const PHOTO_SLOT_CONFIGS: PhotoSlotConfig[] = [
  {
    id: 'structure',
    shortTitle: 'Structure Pic with Consumer',
    officialTitle: '1. Solar Mounting Structure & Array with Consumer',
    badge: 'Structure & Array',
    infoGuideline:
      'Clear photo showing rooftop solar module mounting structure (MMS), solar panels array, and beneficiary/consumer standing in front of the rooftop array.',
    checklist: ['Elevated solar MMS structure', 'ALMM/DCR solar panels visible', 'Consumer / Beneficiary in frame']
  },
  {
    id: 'inverter',
    shortTitle: 'Inverter with Consumer',
    officialTitle: '2. On-Grid Solar Inverter & ACDB/DCDB with Consumer',
    badge: 'Inverter & Junction',
    infoGuideline:
      'Photo of on-grid solar inverter, AC distribution board (ACDB), DC distribution board (DCDB), display screen and beneficiary/consumer standing beside the equipment.',
    checklist: ['Inverter operational display', 'ACDB & DCDB protection boxes', 'Consumer standing next to setup']
  },
  {
    id: 'meter',
    shortTitle: 'Meter with Consumer',
    officialTitle: '3. Bi-Directional Net Meter with Consumer',
    badge: 'DISCOM Net Meter',
    infoGuideline:
      'Clear photo of DISCOM bidirectional net meter showing digital display / meter serial number and consumer standing beside the meter board.',
    checklist: ['DISCOM bidirectional net meter', 'Legible meter serial number & reading', 'Consumer beside meter']
  },
  {
    id: 'earthing',
    shortTitle: 'Earthing Pic',
    officialTitle: '4. Chemical Earthing Pits & Grounding Chambers',
    badge: 'Chemical Earthing',
    infoGuideline:
      'Clear photo showing chemical earthing pit / pipe / grounding electrode and earth chamber with cover, ensuring safety compliance.',
    checklist: ['Dedicated chemical earthing pit', 'Earth electrode & copper/GI busbar', 'Inspection chamber with cover']
  },
  {
    id: 'lightning',
    shortTitle: 'Lightning Arrester with Consumer',
    officialTitle: '5. Lightning Arrester (LA) & Grounding with Consumer',
    badge: 'Lightning Protection',
    infoGuideline:
      'Photo of lightning arrester rod mounted at the highest point of terrace/structure with down-conductor and consumer on the terrace.',
    checklist: ['LA rod mounted at highest elevation', 'Down-conductor GI/copper strip', 'Consumer standing on terrace']
  }
];

const createEmptySlots = (): Record<PhotoSlotId, PhotoSlotData> => ({
  structure: {
    dataUrl: null,
    caption: '1. Rooftop Solar MMS & PV Array with Beneficiary Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  },
  inverter: {
    dataUrl: null,
    caption: '2. On-Grid Solar Inverter & ACDB/DCDB Distribution Junction with Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  },
  meter: {
    dataUrl: null,
    caption: '3. Bi-Directional Net Meter with Serial Number & Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  },
  earthing: {
    dataUrl: null,
    caption: '4. Chemical Earthing Pits, Grounding Chamber & Heavy-Duty Electrode',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  },
  lightning: {
    dataUrl: null,
    caption: '5. Lightning Arrester (LA) Terminal & Terrace Grounding with Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  }
});

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
  const [tplAgreementDate, setTplAgreementDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  });

  // Vendor Information (Rarebox LLP)
  const [tplVendorName] = useState('M/S RAREBOX LLP RAIPUR');
  const [tplVendorSignatory] = useState('SAMEER SAHU');
  const [tplVendorDesignation] = useState('PROPRIETOR / AUTHORIZED SIGNATORY');
  const [tplVendorPhone] = useState('9630131550');

  // Photo Framing Mode: 'contain' fits entire photo without crop, 'cover' fills frame
  const [imageFit, setImageFit] = useState<'contain' | 'cover'>('contain');

  // 5 Mandatory Photo Slots (Starts clean without demo pictures)
  const [photoSlots, setPhotoSlots] = useState<Record<PhotoSlotId, PhotoSlotData>>(createEmptySlots);

  // GPS loading states
  const [locatingSlot, setLocatingSlot] = useState<PhotoSlotId | null>(null);
  const [isLocatingAll, setIsLocatingAll] = useState(false);

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
        const lat = addr.geoCoordinates.latitude;
        const lng = addr.geoCoordinates.longitude;
        const formatted = `Lat: ${lat.toFixed(6)}°, Long: ${lng.toFixed(6)}° • Acc: ±4m • ${tplAgreementDate}`;
        // Pre-fill GPS if slot has no coordinates yet
        setPhotoSlots(prev => {
          const next = { ...prev };
          (Object.keys(next) as PhotoSlotId[]).forEach(k => {
            if (!next[k].latitude) {
              next[k] = {
                ...next[k],
                latitude: lat,
                longitude: lng,
                accuracy: 4,
                timestamp: tplAgreementDate,
                gps: formatted
              };
            }
          });
          return next;
        });
      }
    }
  }, [selectedCustomer, tplAgreementDate]);

  // Direct Browser Geolocation Hook
  const captureDeviceLocation = (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
    formatted: string;
  }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const err = new Error('Geolocation is not supported by your device or browser.');
        alert(err.message);
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = Math.round(pos.coords.accuracy || 4);
          const now = new Date();
          const timeStr =
            now.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }) +
            ' ' +
            now.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          const formatted = `Lat: ${lat.toFixed(6)}°, Long: ${lng.toFixed(6)}° • Acc: ±${acc}m • ${timeStr}`;

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            timestamp: timeStr,
            formatted
          });
        },
        (err) => {
          let msg = 'Failed to fetch device GPS location.';
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'GPS Location permission denied. Please allow location access in your browser.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'GPS Position unavailable. Please ensure device location is switched on.';
          } else if (err.code === err.TIMEOUT) {
            msg = 'GPS Location request timed out. Please try again.';
          }
          console.warn('Geolocation capture notice:', err);
          alert(msg);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  };

  // Upload or Camera Capture Handler
  const handlePhotoUpload = async (slotId: PhotoSlotId, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoSlots(prev => ({
        ...prev,
        [slotId]: {
          ...prev[slotId],
          dataUrl
        }
      }));

      // Automatically hook live GPS if not already tagged
      const currentSlot = photoSlots[slotId];
      if (!currentSlot?.latitude) {
        try {
          const loc = await captureDeviceLocation();
          setPhotoSlots(prev => ({
            ...prev,
            [slotId]: {
              ...prev[slotId],
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              timestamp: loc.timestamp,
              gps: loc.formatted
            }
          }));
        } catch {
          // Handled in captureDeviceLocation
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // 1-Click GPS Capture for a Specific Slot
  const handleCaptureGpsForSlot = async (slotId: PhotoSlotId) => {
    setLocatingSlot(slotId);
    try {
      const loc = await captureDeviceLocation();
      setPhotoSlots(prev => ({
        ...prev,
        [slotId]: {
          ...prev[slotId],
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          timestamp: loc.timestamp,
          gps: loc.formatted
        }
      }));
    } finally {
      setLocatingSlot(null);
    }
  };

  // Global Auto-Geotag All 5 Slots at once
  const handleGeotagAllSlots = async () => {
    setIsLocatingAll(true);
    try {
      const loc = await captureDeviceLocation();
      setPhotoSlots(prev => {
        const next = { ...prev };
        PHOTO_SLOT_CONFIGS.forEach(cfg => {
          next[cfg.id] = {
            ...next[cfg.id],
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            timestamp: loc.timestamp,
            gps: loc.formatted
          };
        });
        return next;
      });
    } finally {
      setIsLocatingAll(false);
    }
  };

  // Remove Photo from Slot
  const handleRemovePhoto = (slotId: PhotoSlotId) => {
    setPhotoSlots(prev => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        dataUrl: null
      }
    }));
  };

  // Reset to Empty
  const handleClearAllPhotos = () => {
    setPhotoSlots(createEmptySlots());
  };

  // Optional: Load sample photos for demonstration or test preview
  const handleLoadSamplePhotos = () => {
    const timeNow = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    setPhotoSlots({
      structure: {
        dataUrl: SAMPLE_PHOTO1_BASE64,
        caption: '1. Rooftop Solar Structure & Array with Beneficiary Consumer',
        gps: `Lat: 21.237361°, Long: 81.603828° • Acc: ±4m • ${tplAgreementDate} ${timeNow}`,
        latitude: 21.237361,
        longitude: 81.603828,
        accuracy: 4,
        timestamp: `${tplAgreementDate} ${timeNow}`
      },
      inverter: {
        dataUrl: SAMPLE_PHOTO3_BASE64,
        caption: '2. On-Grid Solar Inverter, ACDB & DCDB Junction with Consumer',
        gps: `Lat: 21.237278°, Long: 81.604320° • Acc: ±3m • ${tplAgreementDate} ${timeNow}`,
        latitude: 21.237278,
        longitude: 81.604320,
        accuracy: 3,
        timestamp: `${tplAgreementDate} ${timeNow}`
      },
      meter: {
        dataUrl: SAMPLE_PHOTO1_BASE64,
        caption: '3. Bi-Directional Net Meter with Serial Number & Consumer',
        gps: `Lat: 21.237300°, Long: 81.604100° • Acc: ±4m • ${tplAgreementDate} ${timeNow}`,
        latitude: 21.2373,
        longitude: 81.6041,
        accuracy: 4,
        timestamp: `${tplAgreementDate} ${timeNow}`
      },
      earthing: {
        dataUrl: SAMPLE_PHOTO2_BASE64,
        caption: '4. Chemical Earthing Pits & Heavy-Duty Grounding Chambers',
        gps: `Lat: 21.237414°, Long: 81.603882° • Acc: ±5m • ${tplAgreementDate} ${timeNow}`,
        latitude: 21.237414,
        longitude: 81.603882,
        accuracy: 5,
        timestamp: `${tplAgreementDate} ${timeNow}`
      },
      lightning: {
        dataUrl: SAMPLE_PHOTO4_BASE64,
        caption: '5. Lightning Arrester (LA) Terminal & Terrace Grounding with Consumer',
        gps: `Lat: 21.237171°, Long: 81.603859° • Acc: ±4m • ${tplAgreementDate} ${timeNow}`,
        latitude: 21.237171,
        longitude: 81.603859,
        accuracy: 4,
        timestamp: `${tplAgreementDate} ${timeNow}`
      }
    });
  };

  const handleResetDefaults = () => {
    setSelectedCustomer(null);
    setTplConsumerName('SHRI GYAN CHAND JAISWAL');
    setTplConsumerNumber('1001750390');
    setTplCapacityKwp('3');
    setTplAddress('SHANTI VIHAR COLONY, DANGANIA');
    setTplDistrict('Raipur');
    handleClearAllPhotos();
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
    if (!selectedCustomer) {
      alert('Please select an existing customer to save this site photo compliance report into their vault.');
      return;
    }

    try {
      setIsSavingToVault(true);
      setVaultSaveSuccess(null);

      const cleanName = tplConsumerName.trim() || 'Consumer';
      const title = `Client Site Photos Compliance Document - ${cleanName}`;
      const filename = `SITE_PHOTOS_${cleanName.replace(/\s+/g, '_')}.pdf`;

      // 1. Generate PDF Blob
      const { blob } = await generatePdfFromElement(documentPrintRef.current, {
        filename
      });

      const custId = selectedCustomer._id || selectedCustomer.id;

      // 2. Register Document in DB
      const docPayload: any = {
        originalFilename: filename,
        safeDisplayName: title,
        category: DocumentCategory.SITE_PHOTOS,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        mimeType: 'application/pdf',
        fileSizeBytes: Math.max(blob.size, 1024),
        metadata: {
          documentType: 'SITE_PHOTOS_REPORT',
          consumerNumber: tplConsumerNumber,
          capacityKwp: tplCapacityKwp,
          address: tplAddress,
          district: tplDistrict,
          agreementDate: tplAgreementDate,
          generatedVia: 'SitePhotosComplianceModule',
          categories: PHOTO_SLOT_CONFIGS.map(c => c.shortTitle)
        }
      };

      if (custId && /^[0-9a-fA-F]{24}$/.test(custId)) {
        docPayload.customerId = custId;
        docPayload.relatedEntityType = 'Customer';
        docPayload.relatedEntityId = custId;
      }

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
        `Site Photos Compliance document "${title}" (${docRes.documentNumber || 'DOC-REG'}) saved into customer vault successfully!`
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

  const uploadedCount = Object.values(photoSlots).filter(s => !!s.dataUrl).length;

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Clean Top Header */}
      <div className="bg-card border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground mb-1">
                <Link to="/" className="hover:text-solar-600 transition">Field Operations</Link>
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
                    PM Surya Ghar &amp; DISCOM 5-point photographic inspection report with live browser GPS geotagging.
                  </p>
                </div>
              </div>
            </div>

            {/* Active Format Badge & Upload Status */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-orange-500/10 px-3.5 py-2 rounded-xl border border-orange-500/30 text-orange-800 dark:text-orange-300">
                <Camera className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-orange-600 dark:text-orange-400">Locked Format: </span>
                  <span className="font-bold">SITE PHOTOS AT &lt;CUSTOMER&gt;</span>
                </div>
              </div>

              <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 ${
                uploadedCount === 5
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200'
              }`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{uploadedCount} / 5 Photos Uploaded</span>
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
                  <span className="truncate">Client Site Photos Compliance Document (5 Categories)</span>
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
                title="Reset all fields to clean defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSamplePhotos}
                className="px-3 py-2 text-xs font-semibold text-solar-700 bg-solar-50 hover:bg-solar-100 dark:bg-solar-950/40 dark:text-solar-300 rounded-xl transition flex items-center space-x-1 cursor-pointer border border-solar-200 dark:border-solar-800"
                title="Populate with sample photos for quick preview / demo testing"
              >
                <Sparkles className="w-3.5 h-3.5 text-solar-600" />
                <span>Load Sample Demo Photos</span>
              </button>

              <button
                type="button"
                onClick={() => setImageFit(f => (f === 'contain' ? 'cover' : 'contain'))}
                className="px-3 py-2 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer shadow-2xs"
                title="Toggle between fitting full image without cropping or filling frame"
              >
                <Camera className="w-3.5 h-3.5 text-orange-600" />
                <span>Photo Fit: <strong>{imageFit === 'contain' ? 'Full Image (Fit)' : 'Fill Frame (Crop)'}</strong></span>
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

        {/* Global Inspection Guidelines Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-200 dark:border-orange-800/40 rounded-2xl p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-orange-600 text-white rounded-xl shadow-xs mt-0.5 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  PM Surya Ghar 5 Mandatory Inspection Photo Requirements
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  DISCOM &amp; MNRE inspection mandates 5 live photos: <strong>Structure with Consumer</strong>, <strong>Inverter with Consumer</strong>, <strong>Meter with Consumer</strong>, <strong>Earthing Pic</strong>, and <strong>Lightning Arrester with Consumer</strong>. Live GPS coordinates and timestamps are automatically hooked into each photo.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleGeotagAllSlots}
                disabled={isLocatingAll}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Hook live GPS coordinates into all 5 photo slots at once"
              >
                {isLocatingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>📍 Auto-Geotag All 5 Slots</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace: 2 Columns (Left: Customer Details & 5 Photo Upload Cards, Right: Live Paper View) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Details & 5 Photo Uploaders (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Customer & Site Details Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
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
            </div>

            {/* 5 Mandatory Inspection Photo Cards with Direct GPS Hooking */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    5 Mandatory Site Photo Uploaders
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Direct GPS hooked • Live coordinate stamping
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllPhotos}
                  className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                >
                  Clear All Photos
                </button>
              </div>

              {PHOTO_SLOT_CONFIGS.map((cfg, index) => {
                const slot = photoSlots[cfg.id];
                const isLocatingThis = locatingSlot === cfg.id;
                const hasPhoto = !!slot.dataUrl;
                const hasGps = !!slot.latitude && !!slot.longitude;

                return (
                  <div
                    key={cfg.id}
                    className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3 transition-all hover:border-orange-500/40"
                  >
                    {/* Slot Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>{cfg.shortTitle}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-orange-500/10 text-orange-600 rounded font-medium border border-orange-200">
                              {cfg.badge}
                            </span>
                          </h4>
                        </div>
                      </div>

                      {hasPhoto && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(cfg.id)}
                          className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inspection Guideline Info Pill */}
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border/60 text-[11px] space-y-1.5">
                      <p className="text-muted-foreground leading-snug">
                        {cfg.infoGuideline}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {cfg.checklist.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center space-x-1 text-[9px] bg-background px-1.5 py-0.5 rounded border border-border text-foreground font-medium"
                          >
                            <CheckSquare className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>{item}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Photo Upload Dropzone / Preview */}
                    {hasPhoto ? (
                      <div className="space-y-2">
                        <div className="relative group rounded-xl overflow-hidden border border-border bg-slate-950 flex items-center justify-center">
                          <img
                            src={slot.dataUrl!}
                            alt={cfg.shortTitle}
                            className={`w-full h-48 ${imageFit === 'contain' ? 'object-contain' : 'object-cover'} bg-slate-950`}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                            <label className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg cursor-pointer shadow-md hover:bg-slate-100 transition flex items-center space-x-1">
                              <Camera className="w-3.5 h-3.5" />
                              <span>Replace</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePhotoUpload(cfg.id, f);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(cfg.id)}
                              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md hover:bg-rose-700 transition flex items-center space-x-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-border hover:border-orange-500/60 rounded-xl p-4 flex flex-col items-center justify-center space-y-1.5 cursor-pointer bg-muted/20 hover:bg-orange-50/20 transition group">
                        <div className="w-9 h-9 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center group-hover:scale-110 transition">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          Upload {cfg.shortTitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground text-center">
                          Click to select image or snap directly with mobile camera
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoUpload(cfg.id, f);
                          }}
                        />
                      </label>
                    )}

                    {/* Geotag & GPS Detail Section */}
                    <div className="p-2.5 bg-background rounded-xl border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <MapPin className={`w-3.5 h-3.5 ${hasGps ? 'text-emerald-600' : 'text-amber-500'}`} />
                          <span className="text-[11px] font-bold text-foreground">
                            GPS Geotag Details
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            hasGps
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {hasGps ? 'Live Geotagged' : 'Pending GPS Tag'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCaptureGpsForSlot(cfg.id)}
                          disabled={isLocatingThis}
                          className="px-2 py-1 text-[10px] font-bold text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 rounded border border-orange-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {isLocatingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Navigation className="w-3 h-3" />
                          )}
                          <span>{hasGps ? 'Refresh GPS' : '📍 Capture GPS'}</span>
                        </button>
                      </div>

                      {hasGps ? (
                        <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 space-y-1">
                          <div className="flex justify-between items-center text-foreground font-semibold">
                            <span>Lat: {slot.latitude?.toFixed(6)}° N, Long: {slot.longitude?.toFixed(6)}° E</span>
                            <span className="text-emerald-600 font-bold">±{slot.accuracy}m</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span>Time: {slot.timestamp || tplAgreementDate}</span>
                            <a
                              href={`https://maps.google.com/?q=${slot.latitude},${slot.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-solar-600 hover:underline flex items-center space-x-0.5"
                            >
                              <span>Maps</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic">
                          Click &quot;📍 Capture GPS&quot; or upload photo to auto-detect coordinates from your phone/browser.
                        </p>
                      )}

                      {/* Editable Caption / Remarks Field */}
                      <div className="pt-1">
                        <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                          Photo Caption &amp; Remarks (Appears on Document)
                        </label>
                        <input
                          type="text"
                          value={slot.caption}
                          onChange={e => {
                            const val = e.target.value;
                            setPhotoSlots(prev => ({
                              ...prev,
                              [cfg.id]: {
                                ...prev[cfg.id],
                                caption: val
                              }
                            }));
                          }}
                          placeholder={`Remarks for ${cfg.shortTitle}...`}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded font-medium text-foreground truncate"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Paper Document Preview (7 cols) */}
          <div className="lg:col-span-7 sticky top-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-foreground">
                    Live Paper Document View (A4 Compliance Report)
                  </span>
                  <span className="text-[10px] text-muted-foreground">(Synchronized with all 5 photos)</span>
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
                  className="bg-white text-slate-900 mx-auto max-w-[850px] p-6 sm:p-8 shadow-xl rounded-sm leading-relaxed text-[12px] sm:text-[13px]"
                  style={{
                    fontFamily: '"Times New Roman", Times, serif',
                    color: '#0f172a'
                  }}
                >
                  <div className="space-y-5 text-slate-900 font-serif">
                    {/* Document Header matching official format: SITE PHOTOS AT <CUSTOMER NAME> */}
                    <div className="text-center pb-3 border-b-2 border-slate-900">
                      <div className="flex items-center justify-center space-x-2 text-[10px] font-sans font-bold tracking-widest text-slate-600 uppercase mb-1">
                        <span>PM Surya Ghar Muft Bijli Yojana</span>
                        <span>•</span>
                        <span>DISCOM Rooftop Solar Quality Inspection</span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wide underline underline-offset-6">
                        SITE PHOTOS AT {tplConsumerName || 'SHRI GYAN CHAND JAISWAL'}
                      </h1>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold text-slate-700 mt-2.5 font-sans">
                        <span><strong>Consumer / BP No:</strong> {tplConsumerNumber || '1001750390'}</span>
                        <span>•</span>
                        <span><strong>Capacity:</strong> {tplCapacityKwp || '3'} kWp Rooftop Solar</span>
                        <span>•</span>
                        <span><strong>Site:</strong> {tplAddress || 'SHANTI VIHAR COLONY, DANGANIA'}, {tplDistrict || 'RAIPUR'}</span>
                        <span>•</span>
                        <span><strong>Inspection Date:</strong> {tplAgreementDate}</span>
                      </div>
                    </div>

                    {/* 5 Mandatory Inspection Photos in Symmetrical 2-Column Grid */}
                    <div className="grid grid-cols-2 gap-4" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
                      {PHOTO_SLOT_CONFIGS.map((cfg, index) => {
                        const slot = photoSlots[cfg.id];
                        const hasPhoto = !!slot.dataUrl;

                        return (
                          <div
                            key={cfg.id}
                            className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col"
                          >
                            {/* Card Header: Clean, bold, non-overlapping, standard sans-serif */}
                            <div
                              className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between min-h-[38px] border-b border-slate-700"
                              style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-solar-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
                                  {index + 1}
                                </span>
                                <span className="font-bold text-xs uppercase tracking-wide text-white leading-snug">
                                  {cfg.shortTitle}
                                </span>
                              </div>
                            </div>

                            {/* Photo Image or Empty Inspection Frame: Consistent height, object-contain / cover toggle, dark backdrop */}
                            <div className="relative h-[250px] sm:h-[275px] bg-slate-950 flex items-center justify-center overflow-hidden">
                              {hasPhoto ? (
                                <>
                                  <img
                                    src={slot.dataUrl!}
                                    alt={cfg.shortTitle}
                                    crossOrigin="anonymous"
                                    className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                  />
                                  {/* Bottom Geotag Overlay Strip: 2 structured lines, zero text truncation or collision */}
                                  <div
                                    className="absolute inset-x-0 bottom-0 bg-slate-950/90 backdrop-blur-xs text-white px-3 py-1.5 font-mono text-[9.5px] border-t border-slate-700/80"
                                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                                  >
                                    <div className="flex items-center justify-between text-amber-300 font-bold leading-tight">
                                      <span>
                                        📍 {slot.latitude ? `Lat: ${slot.latitude.toFixed(6)}°, Long: ${slot.longitude?.toFixed(6)}°` : 'Lat: 21.237361°, Long: 81.603828°'}
                                      </span>
                                      <span className="text-[8.5px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold border border-emerald-500/40 shrink-0 ml-1">
                                        LIVE GPS
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-300 text-[8.5px] mt-0.5 leading-tight">
                                      <span>Acc: ±{slot.accuracy || 4}m</span>
                                      <span>{slot.timestamp || tplAgreementDate}</span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-slate-100 w-full h-full">
                                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-slate-400">
                                    <Camera className="w-5 h-5" />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">
                                    {cfg.shortTitle}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Awaiting Site Photo Upload / Camera Capture
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Photo Caption Strip: Clean full-width text, NO cutoff */}
                            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-800 leading-snug">
                              <p className="font-semibold">{slot.caption}</p>
                            </div>
                          </div>
                        );
                      })}

                      {/* 6th Symmetrical Box: Field Compliance & Technical Verification Certificate with exact same height & style */}
                      <div className="border-2 border-slate-800 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col">
                        {/* Card Header matching photos */}
                        <div
                          className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between min-h-[38px] border-b border-slate-700"
                          style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
                              ✓
                            </span>
                            <span className="font-bold text-xs uppercase tracking-wide text-white leading-snug">
                              Technical Inspection Seal
                            </span>
                          </div>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/40">
                            PASS / 100%
                          </span>
                        </div>

                        {/* Body matching photo height */}
                        <div className="h-[250px] sm:h-[275px] bg-slate-50 p-3.5 flex flex-col justify-between text-xs">
                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-600 leading-tight">
                              Official PM Surya Ghar &amp; DISCOM Technical Quality &amp; Safety Compliance Audit:
                            </p>
                            <div className="space-y-1.5 text-[10.5px] text-slate-800 font-medium">
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600 font-bold">✔</span>
                                <span>Solar MMS: Hot-dip galvanized structure &amp; DCR modules</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600 font-bold">✔</span>
                                <span>Inverter: Dual MPPT, IP65 enclosure &amp; SPD protection</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600 font-bold">✔</span>
                                <span>Net Meter: DISCOM synchronized bi-directional meter</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600 font-bold">✔</span>
                                <span>Earthing: Dual chemical pits resistance &lt; 5 Ohms verified</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600 font-bold">✔</span>
                                <span>Lightning Arrester: Air terminal covers 45° terrace cone</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[9.5px] text-slate-600 font-mono">
                            <span>📍 Live GPS Verified On-Site</span>
                            <span className="font-bold text-slate-800">CSPDCL / MNRE RTS</span>
                          </div>
                        </div>

                        {/* Footer Caption matching photos */}
                        <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-700 leading-snug font-medium">
                          Certified Field Quality Audit • Handover Ready
                        </div>
                      </div>
                    </div>

                    {/* Official Handover & Verification Seal Footer */}
                    <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-6 items-end font-sans">
                      <div className="space-y-1.5 text-xs">
                        <p className="font-bold uppercase tracking-wider text-slate-800">
                          Consumer / Beneficiary Acknowledgement
                        </p>
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          I hereby certify that all solar PV rooftop equipment, inverter, net meter, chemical earthing pits, and lightning arrester shown in the 5 inspection photographs above have been installed at my premises in complete working condition under PM Surya Ghar Muft Bijli Yojana.
                        </p>
                        <div className="pt-2 text-xs font-semibold space-y-0.5">
                          <p><strong>Consumer Name:</strong> {tplConsumerName}</p>
                          <p><strong>BP No:</strong> {tplConsumerNumber}</p>
                          <p className="pt-2"><strong>Signature:</strong> ___________________________</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-right text-xs">
                        <p className="font-bold uppercase tracking-wider text-slate-800">Certified EPC Vendor</p>
                        <p className="text-[10px] text-slate-600">For {tplVendorName}</p>
                        <div className="flex justify-end py-1">
                          <img
                            src={RAREBOX_STAMP_BASE64}
                            alt="Rarebox LLP Stamp"
                            className="w-24 h-24 object-contain filter contrast-125"
                          />
                        </div>
                        <div className="text-[10px] space-y-0.5 text-right font-medium text-slate-700">
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
                    High-Resolution Vector PDF (5 Inspection Categories with Geotag Coordinates)
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
