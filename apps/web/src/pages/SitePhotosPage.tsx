import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Camera,
  FolderLock,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  UserCheck,
  FileCheck2,
  MapPin,
  UploadCloud,
  Trash2,
  RotateCw,
  Navigation,
  Plus,
  Search,
  FileText,
  Layers,
  ArrowRight
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';
import { downloadElementAsPdf, generatePdfFromElement } from '../lib/pdfGenerator.js';
import { DocumentCategory, DocumentAccessClassification } from '@ins-solar/shared';

interface CustomerOption {
  _id?: string;
  id?: string;
  customerCode?: string;
  name: string;
  primaryPhone?: string;
  email?: string;
  type?: string;
  status?: string;
  sanctionedLoadKw?: number;
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

export interface ExtraPhotoData {
  id: string;
  category: string;
  title: string;
  dataUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string | null;
  gps: string;
  caption: string;
}

export interface PanelBarcodeRow {
  id: string;
  itemNumber: number;
  description: string;
  serialNumber: string;
  barcode: string;
  status: 'PENDING' | 'VERIFIED';
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
    shortTitle: 'Net Meter with Consumer',
    officialTitle: '3. Bi-Directional Net Meter with Consumer',
    badge: 'DISCOM Net Meter',
    infoGuideline:
      'Close-up photograph showing bidirectional meter, meter serial number, seal, and beneficiary standing next to the meter cabinet.',
    checklist: ['Meter display & serial number', 'DISCOM lead seal intact', 'Consumer standing next to meter']
  },
  {
    id: 'earthing',
    shortTitle: 'Earthing Pit with Consumer',
    officialTitle: '4. Dedicated Solar Earthing Pits with Consumer',
    badge: 'Earthing Pits',
    infoGuideline:
      'Photo showing dedicated maintenance-free chemical earthing pits, grounding electrode chambers, green earthing strips, and consumer beside the pit.',
    checklist: ['Earthing pit chamber visible', 'Proper ground strip routing', 'Consumer standing next to pit']
  }
];

export const EXTRA_PHOTO_CATEGORIES = [
  { value: 'LIGHTNING_ARRESTER', label: '⚡ Lightning Arrester (LA) Terminal with Consumer' },
  { value: 'CABLE_TRAY', label: '🔌 Cable Tray & Conduit Routing' },
  { value: 'ACDB_DCDB_INTERNAL', label: '⚡ ACDB / DCDB Internal Wiring & SPD' },
  { value: 'EARTH_RESISTANCE', label: '🧪 Earth Pit Resistance Meter (Megger)' },
  { value: 'CIVIL_FOUNDATION', label: '🏛️ Rooftop Civil Foundation & Fasteners' },
  { value: 'SAFETY_PPE', label: '🦺 Safety Harness & PPE Compliance' },
  { value: 'BATTERY_BANK', label: '🔋 Solar Battery Bank / Storage' },
  { value: 'DISCOM_INSPECTOR', label: '🤝 Joint DISCOM Field Inspection' },
  { value: 'OTHER', label: '📸 Other Inspection / Rooftop Picture' }
];

export const POST_INSTALL_DOC_TEMPLATES = [
  {
    key: 'JCR',
    title: 'Joint Commissioning Report (JCR)',
    subtitle: 'Official DISCOM & Vendor joint signed commissioning sheet',
    category: DocumentCategory.SIGNED_CONTRACT
  },
  {
    key: 'HANDOVER',
    title: 'Work Completion & Handover Certificate',
    subtitle: 'Signed by consumer acknowledging complete rooftop system handover',
    category: DocumentCategory.CUSTOMER_KYC
  },
  {
    key: 'NET_METER_SLIP',
    title: 'DISCOM Net Meter Testing & Sealing Slip',
    subtitle: 'DISCOM bi-directional net meter test slip and meter seal report',
    category: DocumentCategory.NET_METERING_DOC
  },
  {
    key: 'SLD_SAFETY',
    title: 'Single Line Diagram (SLD) & Earthing Safety Slip',
    subtitle: 'As-built electrical wiring drawing and engineer safety certificate',
    category: DocumentCategory.SITE_PHOTOS
  }
];

export const parseBarcodesFromText = (text: string): string[] => {
  return text
    .split(/[\r\n,;\t]+/)
    .map(line => line.trim().replace(/^['"\s]+|['"\s,.;:]+$/g, '').trim())
    .filter(Boolean);
};

const createEmptySlots = (): Record<PhotoSlotId, PhotoSlotData> => ({
  structure: {
    dataUrl: null,
    caption: '1. Rooftop Solar Mounting Structure & PV Array with Beneficiary Consumer',
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
    caption: '4. Chemical Earthing Pits & Heavy-Duty Grounding System with Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  },
  lightning: {
    dataUrl: null,
    caption: '5. Lightning Arrester (LA) Terminal & Terrace Down Conductor with Consumer',
    gps: '',
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null
  }
});

export interface SitePhotosPageProps {
  initialTab?: 'photos' | 'equipment' | 'documents';
}

export const SitePhotosPage: React.FC<SitePhotosPageProps> = () => {
  const [searchParams] = useSearchParams();

  const activeTab = 'photos';

  // Customer Directory & Selection with Instant Local Cache
  const [customers, setCustomers] = useState<CustomerOption[]>(() => {
    try {
      const cached = localStorage.getItem('solar_cached_customers');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Real Database & Installation Integration State
  const [installations, setInstallations] = useState<any[]>([]);
  const [activeInstallation, setActiveInstallation] = useState<any | null>(null);
  const [isSavingInstallation, setIsSavingInstallation] = useState(false);
  const [dbNotification, setDbNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Left Sidebar State
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'COMPLETED'>('ALL');

  // Customer & Site Template Information
  const [tplConsumerName, setTplConsumerName] = useState('Select Customer');
  const [tplConsumerNumber, setTplConsumerNumber] = useState('');
  const [tplCapacityKwp, setTplCapacityKwp] = useState('3.3');
  const [tplAddress, setTplAddress] = useState('Site Address');
  const [tplDistrict, setTplDistrict] = useState('Raipur');
  const [tplAgreementDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  });

  // 4 Mandatory Photo Slots
  const [photoSlots, setPhotoSlots] = useState<Record<PhotoSlotId, PhotoSlotData>>(createEmptySlots);

  // Extra / Additional Site Photos
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotoData[]>([]);

  // Customer Vault Documents
  const [customerVaultDocs, setCustomerVaultDocs] = useState<any[]>([]);
  const [, setLoadingVaultDocs] = useState(false);

  // Document Preview Modal State
  const [previewDocModal, setPreviewDocModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    mimeType?: string;
  } | null>(null);

  // GPS loading states
  const [locatingSlot, setLocatingSlot] = useState<string | null>(null);
  const [isLocatingAll, setIsLocatingAll] = useState(false);

  // Print/Download ref & UI states
  const documentPrintRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Restore photos from localStorage backup for a customer
  const restoreFromLocalStorage = (custId: string) => {
    try {
      const savedPhotosStr = localStorage.getItem(`solar_photos_${custId}`);
      if (savedPhotosStr) {
        const savedData = JSON.parse(savedPhotosStr);
        if (savedData.photoSlots) {
          setPhotoSlots(prev => {
            const hasPhotos = Object.values(prev).some(s => !!s.dataUrl);
            return hasPhotos ? prev : savedData.photoSlots;
          });
        }
        if (Array.isArray(savedData.extraPhotos) && savedData.extraPhotos.length > 0) {
          setExtraPhotos(prev => (prev.length > 0 ? prev : savedData.extraPhotos));
        }
        if (savedData.savedAt) {
          const d = new Date(savedData.savedAt);
          setLastSavedAt(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString('en-IN'));
        }
      }
    } catch (e) {
      console.warn('Could not restore photos from localStorage:', e);
    }
  };

  // Load detailed installation record directly from MongoDB
  const loadInstallationDetails = async (instId: string) => {
    try {
      const res: any = await apiClient<any>(`/installations/${instId}`);
      const fullInst = res?.data || res;
      if (fullInst && (fullInst._id || fullInst.id)) {
        setActiveInstallation(fullInst);

        if (fullInst.customerName) setTplConsumerName(fullInst.customerName.toUpperCase());
        if (fullInst.customerCode) setTplConsumerNumber(fullInst.customerCode);
        if (fullInst.systemCapacityKw) setTplCapacityKwp(String(fullInst.systemCapacityKw));
        if (fullInst.siteAddress?.addressLine1) setTplAddress(fullInst.siteAddress.addressLine1.toUpperCase());
        if (fullInst.siteAddress?.city || fullInst.siteAddress?.district) {
          setTplDistrict(fullInst.siteAddress.district || fullInst.siteAddress.city);
        }

        let hasPhotosInDb = false;
        // Autofill Photos from MongoDB
        if (Array.isArray(fullInst.photos) && fullInst.photos.length > 0) {
          setPhotoSlots(prev => {
            const next = { ...prev };
            fullInst.photos.forEach((photo: any) => {
              let slotKey: PhotoSlotId | null = null;
              if (photo.category === 'SOLAR_STRUCTURE' || photo.category === 'STRUCTURE') slotKey = 'structure';
              else if (photo.category === 'INVERTER_INSTALLATION' || photo.category === 'INVERTER') slotKey = 'inverter';
              else if (photo.category === 'METER_INSTALLATION' || photo.category === 'NET_METER') slotKey = 'meter';
              else if (photo.category === 'EARTHING_INSTALLATION' || photo.category === 'EARTHING') slotKey = 'earthing';
              else if (photo.category === 'LIGHTNING_PROTECTION' || photo.category === 'LIGHTNING') slotKey = 'lightning';

              if (slotKey) {
                hasPhotosInDb = true;
                next[slotKey] = {
                  dataUrl: photo.fileUrl || null,
                  caption: photo.remarks || photo.title || next[slotKey].caption,
                  gps: photo.gpsLocation?.latitude
                    ? `Lat: ${photo.gpsLocation.latitude.toFixed(6)}°, Long: ${photo.gpsLocation.longitude.toFixed(6)}° • Acc: ±${photo.gpsLocation.accuracyMeters || 4}m`
                    : next[slotKey].gps,
                  latitude: photo.gpsLocation?.latitude || null,
                  longitude: photo.gpsLocation?.longitude || null,
                  accuracy: photo.gpsLocation?.accuracyMeters || null,
                  timestamp: photo.timestamp ? new Date(photo.timestamp).toLocaleDateString('en-IN') : null
                };
              }
            });
            return next;
          });

          // Autofill extra photos
          const extras = fullInst.photos
            .filter((p: any) => p.category === 'FINAL_INSTALLATION' || p.category === 'EXTRA')
            .map((p: any, idx: number) => ({
              id: `extra-${idx + 1}-${Date.now()}`,
              category: 'FINAL_INSTALLATION',
              title: p.title || `Additional Site Photo #${idx + 1}`,
              dataUrl: p.fileUrl || null,
              latitude: p.gpsLocation?.latitude || null,
              longitude: p.gpsLocation?.longitude || null,
              accuracy: p.gpsLocation?.accuracyMeters || null,
              timestamp: p.timestamp ? new Date(p.timestamp).toLocaleDateString('en-IN') : null,
              gps: p.gpsLocation?.latitude
                ? `Lat: ${p.gpsLocation.latitude.toFixed(6)}°, Long: ${p.gpsLocation.longitude.toFixed(6)}°`
                : '',
              caption: p.remarks || ''
            }));
          if (extras.length > 0) setExtraPhotos(extras);

          if (fullInst.updatedAt || fullInst.createdAt) {
            const d = new Date(fullInst.updatedAt || fullInst.createdAt);
            setLastSavedAt(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString('en-IN'));
          }
        }

        // Autofill Verified GPS from MongoDB
        if (fullInst.location?.latitude && fullInst.location?.longitude) {
          const lat = fullInst.location.latitude;
          const lng = fullInst.location.longitude;
          const formatted = `Lat: ${lat.toFixed(6)}°, Long: ${lng.toFixed(6)}° • Acc: ±${fullInst.location.accuracyMeters || 4}m`;
          setPhotoSlots(prev => {
            const next = { ...prev };
            (Object.keys(next) as PhotoSlotId[]).forEach(k => {
              if (!next[k].latitude) {
                next[k] = {
                  ...next[k],
                  latitude: lat,
                  longitude: lng,
                  accuracy: fullInst.location.accuracyMeters || 4,
                  gps: formatted
                };
              }
            });
            return next;
          });
        }

        // If MongoDB didn't have photos, check local storage backup
        const custId = fullInst.customerId?._id || fullInst.customerId || selectedCustomer?._id || selectedCustomer?.id;
        if (!hasPhotosInDb && custId) {
          restoreFromLocalStorage(String(custId));
        }
      }
    } catch (err) {
      console.warn('Could not load installation record from MongoDB:', err);
    }
  };

  // Load customer directory & live installations from MongoDB
  useEffect(() => {
    let isMounted = true;
    const fetchDirectory = async () => {
      try {
        if (customers.length === 0) setLoadingCustomers(true);
        const [custRes, instRes]: [any, any] = await Promise.all([
          apiClient<any>('/customers?limit=100').catch(() => []),
          apiClient<any>('/installations?limit=100').catch(() => [])
        ]);

        const custList: CustomerOption[] = Array.isArray(custRes)
          ? custRes
          : Array.isArray(custRes?.data)
            ? custRes.data
            : Array.isArray(custRes?.customers)
              ? custRes.customers
              : [];

        const instList: any[] = Array.isArray(instRes)
          ? instRes
          : Array.isArray(instRes?.data?.installations)
            ? instRes.data.installations
            : Array.isArray(instRes?.installations)
              ? instRes.installations
              : Array.isArray(instRes?.data)
                ? instRes.data
                : Array.isArray(instRes?.items)
                  ? instRes.items
                  : [];

        if (isMounted) {
          setCustomers(custList);
          if (custList.length > 0) {
            try {
              localStorage.setItem('solar_cached_customers', JSON.stringify(custList));
            } catch {}
          } else {
            try {
              localStorage.removeItem('solar_cached_customers');
            } catch {}
          }
          setInstallations(instList);

          const preselectedCustomerId =
            searchParams.get('customerId') ||
            localStorage.getItem('solar_installer_active_customer_id') ||
            '';

          let targetCustomer: CustomerOption | null = null;
          if (preselectedCustomerId) {
            targetCustomer = custList.find(c => (c._id || c.id) === preselectedCustomerId) || null;
          }
          if (!targetCustomer && custList.length > 0) {
            targetCustomer = custList[0] || null;
          }

          if (targetCustomer) {
            setSelectedCustomer(targetCustomer);
            const custId = targetCustomer._id || targetCustomer.id;
            if (custId) {
              fetchCustomerDocuments(custId);
              const foundInst = instList.find(i =>
                (i.customerId && (i.customerId === custId || i.customerId._id === custId)) ||
                (i.customerCode && targetCustomer?.customerCode && i.customerCode === targetCustomer.customerCode)
              );
              if (foundInst) {
                loadInstallationDetails(foundInst._id || foundInst.id);
              } else {
                restoreFromLocalStorage(custId);
              }
            }
          } else {
            setSelectedCustomer(null);
          }
        }
      } catch (err) {
        console.warn('Customer & installations load error:', err);
      } finally {
        if (isMounted) setLoadingCustomers(false);
      }
    };
    fetchDirectory();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Fetch documents for the selected customer
  const fetchCustomerDocuments = async (customerId: string) => {
    try {
      setLoadingVaultDocs(true);
      const res: any = await apiClient<any>(`/customers/${customerId}/documents`);
      const docs = Array.isArray(res) ? res : res?.data || [];
      setCustomerVaultDocs(docs);
    } catch {
      setCustomerVaultDocs([]);
    } finally {
      setLoadingVaultDocs(false);
    }
  };

  // Switch customer selection & auto-link installation
  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomer(cust);
    setIsClientDrawerOpen(false);
    const custId = cust._id || cust.id;
    if (custId) {
      localStorage.setItem('solar_installer_active_customer_id', custId);
      fetchCustomerDocuments(custId);

      const foundInst = installations.find(i =>
        (i.customerId && (i.customerId === custId || i.customerId._id === custId)) ||
        (i.customerCode && cust.customerCode && i.customerCode === cust.customerCode)
      );

      if (foundInst) {
        loadInstallationDetails(foundInst._id || foundInst.id);
      } else {
        setActiveInstallation(null);
        if (cust.name) setTplConsumerName(cust.name.toUpperCase());
        if (cust.customerCode) setTplConsumerNumber(cust.customerCode);
        if (cust.sanctionedLoadKw) setTplCapacityKwp(String(cust.sanctionedLoadKw));
        if (cust.installationAddress?.addressLine1) setTplAddress(cust.installationAddress.addressLine1.toUpperCase());
        if (cust.installationAddress?.city || cust.installationAddress?.district) {
          setTplDistrict(cust.installationAddress.district || cust.installationAddress.city || 'Raipur');
        }
        restoreFromLocalStorage(custId);
      }
    }
  };

  // 1-Click Initialize Installation Record in MongoDB
  // Autofill customer data when customer selected
  useEffect(() => {
    if (!selectedCustomer) return;
    const custId = selectedCustomer._id || selectedCustomer.id;
    if (custId) {
      localStorage.setItem('solar_installer_active_customer_id', custId);
      fetchCustomerDocuments(custId);
    }

    if (selectedCustomer.name) {
      setTplConsumerName(selectedCustomer.name.toUpperCase());
    }
    if (selectedCustomer.customerCode) {
      setTplConsumerNumber(selectedCustomer.customerCode.replace(/\D/g, '') || selectedCustomer.customerCode);
    }
    if (selectedCustomer.sanctionedLoadKw) {
      setTplCapacityKwp(String(selectedCustomer.sanctionedLoadKw));
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

  // Geolocation Capture
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

  // Process and downscale uploaded photo keeping 100% natural aspect ratio (no forced rotation, no squishing/stretching)
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const rawDataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          let drawW = img.naturalWidth;
          let drawH = img.naturalHeight;

          // Scale down proportionally if larger than 1600px to keep payload crisp & lightweight
          const MAX_DIM = 1600;
          if (drawW > MAX_DIM || drawH > MAX_DIM) {
            if (drawW > drawH) {
              drawH = Math.round((drawH * MAX_DIM) / drawW);
              drawW = MAX_DIM;
            } else {
              drawW = Math.round((drawW * MAX_DIM) / drawH);
              drawH = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = drawW;
          canvas.height = drawH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          // Draw image keeping exact natural width and height proportions
          ctx.drawImage(img, 0, 0, drawW, drawH);

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Upload Photo for Mandatory Slot with Smart Orientation & Compression
  const handlePhotoUpload = async (slotId: PhotoSlotId, file: File) => {
    if (!file) return;
    try {
      const finalDataUrl = await processImageFile(file);

      setPhotoSlots(prev => ({
        ...prev,
        [slotId]: {
          ...prev[slotId],
          dataUrl: finalDataUrl
        }
      }));

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
    } catch (err) {
      console.warn('Photo processing error:', err);
    }
  };

  // 1-Click 90° Clockwise Rotation for Any Slot
  const handleRotateSlot = (slotId: PhotoSlotId) => {
    const slot = photoSlots[slotId];
    if (!slot?.dataUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const rotated = canvas.toDataURL('image/jpeg', 0.85);

      setPhotoSlots(prev => ({
        ...prev,
        [slotId]: {
          ...prev[slotId],
          dataUrl: rotated
        }
      }));
    };
    img.src = slot.dataUrl;
  };

  // Geotag Single Slot
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

  // Geotag All 5 Mandatory Slots
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

  // --------------------------------------------------------------------------
  // EXTRA / ADDITIONAL SITE PHOTOS LOGIC
  // --------------------------------------------------------------------------
  const handleAddExtraPhoto = () => {
    const newId = `extra-${Date.now()}`;
    setExtraPhotos(prev => [
      ...prev,
      {
        id: newId,
        category: 'CABLE_TRAY',
        title: `Extra Inspection Photo #${prev.length + 1}`,
        dataUrl: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null,
        gps: '',
        caption: `Site verification photo #${prev.length + 1}`
      }
    ]);
  };

  const handleUpdateExtraPhoto = (id: string, updates: Partial<ExtraPhotoData>) => {
    setExtraPhotos(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleExtraPhotoUpload = async (id: string, file: File) => {
    if (!file) return;
    try {
      const finalDataUrl = await processImageFile(file);
      handleUpdateExtraPhoto(id, { dataUrl: finalDataUrl });

      const item = extraPhotos.find(p => p.id === id);
      if (!item?.latitude) {
        try {
          const loc = await captureDeviceLocation();
          handleUpdateExtraPhoto(id, {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            timestamp: loc.timestamp,
            gps: loc.formatted
          });
        } catch {
          // handled
        }
      }
    } catch (err) {
      console.warn('Extra photo upload error:', err);
    }
  };

  const handleRotateExtraPhoto = (id: string) => {
    const photo = extraPhotos.find(p => p.id === id);
    if (!photo?.dataUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const rotated = canvas.toDataURL('image/jpeg', 0.85);

      setExtraPhotos(prev => prev.map(p => (p.id === id ? { ...p, dataUrl: rotated } : p)));
    };
    img.src = photo.dataUrl;
  };

  const handleCaptureGpsForExtra = async (id: string) => {
    setLocatingSlot(id);
    try {
      const loc = await captureDeviceLocation();
      handleUpdateExtraPhoto(id, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        timestamp: loc.timestamp,
        gps: loc.formatted
      });
    } finally {
      setLocatingSlot(null);
    }
  };

  const handleRemoveExtraPhoto = (id: string) => {
    setExtraPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Preview document stored in customer vault
  const handlePreviewVaultDoc = async (doc: any) => {
    try {
      const res: any = await apiClient<any>(`/documents/${doc._id}/access-url`);
      const viewUrl = res?.viewUrl || res?.downloadUrl || getFullApiUrl(`/documents/${doc._id}/download`);
      setPreviewDocModal({
        isOpen: true,
        title: doc.safeDisplayName || doc.originalFilename,
        url: viewUrl,
        mimeType: doc.mimeType || 'application/pdf'
      });
    } catch {
      setPreviewDocModal({
        isOpen: true,
        title: doc.safeDisplayName || doc.originalFilename,
        url: getFullApiUrl(`/documents/${doc._id}/download`),
        mimeType: doc.mimeType || 'application/pdf'
      });
    }
  };

  // Persist all 4 Mandatory Site Photos & GPS Location to MongoDB Database and Document Vault
  const handleSavePhotosToDb = async () => {
    try {
      setIsSavingInstallation(true);
      if (!selectedCustomer) {
        alert('Please select a customer first.');
        return;
      }
      const custId = selectedCustomer._id || selectedCustomer.id;
      if (!custId) {
        alert('Invalid customer selected.');
        return;
      }

      let targetInstId = activeInstallation?._id || activeInstallation?.id;

      // Auto-create installation in MongoDB if none exists yet
      if (!targetInstId) {
        const res: any = await apiClient<any>('/installations', {
          method: 'POST',
          body: JSON.stringify({
            customerId: custId,
            systemCapacityKw: selectedCustomer.sanctionedLoadKw || Number(tplCapacityKwp) || 3.3,
            notes: `Auto-initialized during site photo upload for ${tplConsumerName}`,
            isDraft: false
          })
        });
        const created = res?.data || res;
        setActiveInstallation(created);
        setInstallations(prev => [created, ...prev]);
        targetInstId = created._id || created.id;
      }

      const photosList: any[] = [];
      const slotMappings: Array<{ slot: PhotoSlotId; category: string; title: string }> = [
        { slot: 'structure', category: 'SOLAR_STRUCTURE', title: 'Solar PV Mounting Structure & Rooftop Array' },
        { slot: 'inverter', category: 'INVERTER_INSTALLATION', title: 'On-Grid Inverter & ACDB/DCDB' },
        { slot: 'meter', category: 'METER_INSTALLATION', title: 'Net Meter & Generation Check Meter' },
        { slot: 'earthing', category: 'EARTHING_INSTALLATION', title: 'Chemical Earthing Pits & Electrode Chambers' },
        { slot: 'lightning', category: 'LIGHTNING_PROTECTION', title: 'Lightning Arrester & Down Conductor Strip' }
      ];

      slotMappings.forEach(m => {
        const d = photoSlots[m.slot];
        if (d.dataUrl) {
          photosList.push({
            category: m.category,
            title: m.title,
            fileUrl: d.dataUrl,
            originalFilename: `${m.slot}_photo.jpg`,
            mimeType: 'image/jpeg',
            timestamp: new Date(),
            gpsLocation: d.latitude ? {
              latitude: d.latitude,
              longitude: d.longitude,
              accuracyMeters: d.accuracy || 4
            } : undefined,
            remarks: d.caption
          });
        }
      });

      extraPhotos.forEach((p, idx) => {
        if (p.dataUrl) {
          photosList.push({
            category: 'FINAL_INSTALLATION',
            title: p.title || `Additional Site Photo #${idx + 1}`,
            fileUrl: p.dataUrl,
            originalFilename: `extra_${p.id}.jpg`,
            mimeType: 'image/jpeg',
            timestamp: new Date(),
            gpsLocation: p.latitude ? {
              latitude: p.latitude,
              longitude: p.longitude,
              accuracyMeters: p.accuracy || 4
            } : undefined,
            remarks: p.caption
          });
        }
      });

      // 1. Update MongoDB Installation Record
      if (targetInstId) {
        const patchPayload: any = { photos: photosList };
        if (photoSlots.structure.latitude && photoSlots.structure.longitude) {
          patchPayload.location = {
            latitude: photoSlots.structure.latitude,
            longitude: photoSlots.structure.longitude,
            accuracyMeters: photoSlots.structure.accuracy || 4,
            capturedAt: new Date()
          };
        }

        const res: any = await apiClient<any>(`/installations/${targetInstId}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload)
        });
        const updated = res?.data || res;
        if (updated) setActiveInstallation(updated);
      }

      // 2. Save in LocalStorage backup so photos persist across sessions
      const now = new Date();
      const timeDisplay = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' on ' + now.toLocaleDateString('en-IN');
      localStorage.setItem(`solar_photos_${custId}`, JSON.stringify({
        customerId: custId,
        customerName: tplConsumerName,
        savedAt: now.toISOString(),
        photoSlots,
        extraPhotos
      }));
      setLastSavedAt(timeDisplay);

      // 3. Compile 1-Page A4 Report and save directly into Document Vault
      let vaultSaved = false;
      if (documentPrintRef.current) {
        try {
          const cleanName = (tplConsumerName || 'Consumer').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          const filename = `SITE_PHOTOS_${cleanName}.pdf`;
          const title = `Site Inspection Photos Report - ${tplConsumerName.trim() || 'Consumer'}`;

          const { blob } = await generatePdfFromElement(documentPrintRef.current, { filename });

          const docPayload: any = {
            originalFilename: filename,
            safeDisplayName: title,
            category: DocumentCategory.SITE_PHOTOS,
            accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
            mimeType: 'application/pdf',
            fileSizeBytes: Math.max(blob.size, 1024),
            customerId: custId,
            metadata: {
              documentType: 'SITE_PHOTOS_REPORT',
              consumerNumber: tplConsumerNumber,
              consumerName: tplConsumerName,
              photosCount: photosList.length,
              savedAt: now.toISOString()
            }
          };

          const docRes = await apiClient<any>('/documents', {
            method: 'POST',
            body: JSON.stringify(docPayload)
          });
          const docId = docRes?._id || docRes?.id;

          if (docId) {
            const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
            const uploadUrl = getFullApiUrl(`/documents/${docId}/content`);
            await fetch(uploadUrl, {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/pdf',
                ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
              },
              body: blob
            });
            vaultSaved = true;
          }
        } catch (vaultErr) {
          console.warn('Vault upload notice:', vaultErr);
        }
      }

      // 4. Refresh customer documents from vault
      await fetchCustomerDocuments(custId);

      const msg = vaultSaved
        ? `Photos saved successfully and 1-Page A4 Compliance Report archived in Document Vault!`
        : `Photos saved successfully in database and local cache!`;
      setDbNotification({ type: 'success', message: msg });
      setTimeout(() => {
        setDbNotification(null);
      }, 6000);
    } catch (err: any) {
      alert('Failed to save inspection photos: ' + (err?.message || 'Server error'));
    } finally {
      setIsSavingInstallation(false);
    }
  };

  // PDF GENERATION & VAULT ACTIONS
  // --------------------------------------------------------------------------
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

  // Filtered customer list for Left Sidebar
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q) ||
      c.primaryPhone?.includes(q) ||
      c.installationAddress?.city?.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.status === 'ACTIVE') ||
      (statusFilter === 'COMPLETED' && (c.status === 'COMPLETED' || c.status === 'CONNECTED')) ||
      (statusFilter === 'PENDING' && c.status !== 'COMPLETED' && c.status !== 'CONNECTED');

    return matchSearch && matchStatus;
  });

  const mandatoryUploadedCount = Object.values(photoSlots).filter(s => !!s.dataUrl).length;

  const savedSitePhotoDocs = customerVaultDocs.filter(
    (d: any) =>
      d.category === 'SITE_PHOTOS' ||
      d.category === DocumentCategory.SITE_PHOTOS ||
      d.metadata?.documentType === 'SITE_PHOTOS_REPORT' ||
      d.originalFilename?.toLowerCase().includes('site_photo')
  );

  return (
    <div className="min-h-screen bg-muted/20 pb-16 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* TOP HEADER: WORKSTATION NAVIGATION BAR                                    */}
      {/* ========================================================================= */}
      <div className="bg-card border-b border-border shadow-2xs sticky top-0 z-30 backdrop-blur-md bg-card/95">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
            {/* Title & Sleek Customer Selector */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight whitespace-nowrap">
                      Site Photos
                    </h1>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/30">
                      {mandatoryUploadedCount}/4 Photos Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    PM Surya Ghar 4-point inspection &amp; DISCOM net metering compliance
                  </p>
                </div>
              </div>

              {/* Customer Switcher Button */}
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(true)}
                className="px-3 py-1.5 bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 text-xs font-bold rounded-xl border border-solar-500/30 flex items-center space-x-2 cursor-pointer transition shadow-2xs"
                title={`Click to search and change site (Site: ${tplAddress}, ${tplDistrict})`}
              >
                <UserCheck className="w-3.5 h-3.5 text-solar-600" />
                <span className="font-bold truncate max-w-[150px] sm:max-w-[200px]">
                  {tplConsumerName}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-solar-500/20 font-bold">
                  BP: {tplConsumerNumber}
                </span>
                {tplDistrict && (
                  <span className="text-[10px] text-muted-foreground truncate hidden lg:inline">
                    • {tplDistrict}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground font-semibold">Switch ▾</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={handleSavePhotosToDb}
                disabled={isSavingInstallation}
                className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Save inspection photos to database and generate dossier"
              >
                {isSavingInstallation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>Save Photos</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Download 1-Page A4 PDF Report"
              >
                {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE CONTAINER (CLEAN, SPACIOUS, UNCLUTTERED)                    */}
      {/* ========================================================================= */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5 flex-1">
        <div className="w-full space-y-4">
          {/* Sync Status Alert */}
          {dbNotification && (
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between border shadow-2xs ${
              dbNotification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : dbNotification.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
            }`}>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-semibold">{dbNotification.message}</span>
              </div>
              <button onClick={() => setDbNotification(null)} className="ml-2 font-bold cursor-pointer hover:opacity-80">✕</button>
            </div>
          )}

          {/* Saved Dossier & Document Vault Status Bar */}
          {activeTab === 'photos' && (lastSavedAt || savedSitePhotoDocs.length > 0) && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Site Photos Saved &amp; Live in Document Vault
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      {mandatoryUploadedCount}/4 Photos Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {lastSavedAt ? `Saved: ${lastSavedAt}` : 'Available in Document Vault and Inspection Database'} • Client: {tplConsumerName} (BP: {tplConsumerNumber})
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <Link
                  to="/customers"
                  className="px-3 py-1.5 bg-card hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Return to Site Customer Directory"
                >
                  <UserCheck className="w-3.5 h-3.5 text-solar-600" />
                  <span>Site List</span>
                </Link>
                <button
                  type="button"
                  onClick={handleOpenPdfPreview}
                  className="px-3 py-1.5 bg-card hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="View fullscreen PDF report"
                >
                  <Eye className="w-3.5 h-3.5 text-solar-600" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Download A4 PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <Link
                  to={`/documents?customerId=${selectedCustomer?._id || selectedCustomer?.id || ''}`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Open full Site Documents vault to view all files"
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>Site Documents &rarr;</span>
                </Link>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 1: 📸 SITE INSPECTION PHOTOS (5 MANDATORY + EXTRA PHOTOS)        */}
          {/* =================================================================== */}
          {activeTab === 'photos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 5 Mandatory Photo Slots + Extra Photos (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* 4 Mandatory PM Surya Ghar Photos Header */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center space-x-1.5">
                      <Camera className="w-4 h-4 text-solar-600" />
                      <span>4 Mandatory Inspection Photos</span>
                    </h3>
                    <p className="text-[10px] text-muted-foreground">PM Surya Ghar &amp; DISCOM compliance report</p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleGeotagAllSlots}
                      disabled={isLocatingAll}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                      title="Rooftop ki live GPS location automatically 4 photos par set karein"
                    >
                      {isLocatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                      <span>📍 Auto-Detect Site GPS</span>
                    </button>
                  </div>
                </div>

                {/* 5 Mandatory Photo Slots Cards */}
                <div className="space-y-3.5">
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <span>{cfg.shortTitle}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-orange-500/10 text-orange-600 rounded font-medium border border-orange-200">
                                {cfg.badge}
                              </span>
                            </h4>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {hasPhoto && (
                              <button
                                type="button"
                                onClick={() => handleRotateSlot(cfg.id)}
                                className="px-2 py-1 text-[11px] font-bold text-solar-700 dark:text-solar-400 bg-solar-500/10 hover:bg-solar-500/20 rounded-lg border border-solar-500/30 flex items-center space-x-1 cursor-pointer transition"
                                title="Rotate photo 90° clockwise"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>Rotate 90°</span>
                              </button>
                            )}
                            {hasPhoto && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotoSlots(prev => ({
                                    ...prev,
                                    [cfg.id]: { ...prev[cfg.id], dataUrl: null }
                                  }));
                                }}
                                className="p-1 text-muted-foreground hover:text-rose-600 rounded transition cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Upload / Photo Container (100% Proportional, Never Stretches) */}
                        {hasPhoto ? (
                          <div className="relative group rounded-xl overflow-hidden border border-border bg-slate-950 flex items-center justify-center min-h-[176px] max-h-[220px] p-1.5">
                            <img
                              src={slot.dataUrl!}
                              alt={cfg.shortTitle}
                              className="max-h-44 max-w-full w-auto h-auto object-contain mx-auto block"
                              style={{
                                maxHeight: '176px',
                                maxWidth: '100%',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain'
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleRotateSlot(cfg.id)}
                                className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg cursor-pointer shadow-md hover:bg-slate-100 transition flex items-center space-x-1"
                                title="Rotate 90° Clockwise"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>Rotate 90°</span>
                              </button>
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
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-border hover:border-orange-500/60 rounded-xl p-4 flex flex-col items-center justify-center space-y-1.5 cursor-pointer bg-muted/20 hover:bg-orange-50/20 transition group">
                            <UploadCloud className="w-6 h-6 text-orange-600 group-hover:scale-110 transition" />
                            <span className="text-xs font-bold text-foreground">Upload {cfg.shortTitle}</span>
                            <span className="text-[10px] text-muted-foreground">Select image or capture via device camera</span>
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

                        {/* Live Location / GPS Section */}
                        <div className="p-2.5 bg-background rounded-xl border space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-foreground">
                              <MapPin className={`w-3.5 h-3.5 ${hasGps ? 'text-emerald-600' : 'text-amber-500'}`} />
                              <span>📍 Rooftop GPS</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                hasGps ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {hasGps ? '📍 GPS Added' : 'GPS Pending'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCaptureGpsForSlot(cfg.id)}
                              disabled={isLocatingThis}
                              className="px-2 py-1 text-[10px] font-bold text-orange-700 bg-orange-50 rounded border border-orange-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              {isLocatingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                              <span>{hasGps ? '🔄 Update GPS' : '📍 Set Location'}</span>
                            </button>
                          </div>
                          {hasGps && (
                            <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-1.5 rounded border flex justify-between items-center">
                              <span>Lat: {slot.latitude?.toFixed(6)}°, Long: {slot.longitude?.toFixed(6)}°</span>
                              <span className="text-emerald-600 font-bold">±{slot.accuracy}m</span>
                            </div>
                          )}
                          <input
                            type="text"
                            value={slot.caption}
                            onChange={e => {
                              const val = e.target.value;
                              setPhotoSlots(prev => ({ ...prev, [cfg.id]: { ...prev[cfg.id], caption: val } }));
                            }}
                            placeholder="Remarks / caption..."
                            className="w-full px-2 py-1 text-xs bg-background border rounded font-medium text-foreground"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ----------------------------------------------------------- */}
                {/* EXTRA / ADDITIONAL INSPECTION PHOTOS SECTION                */}
                {/* ----------------------------------------------------------- */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center space-x-1.5">
                        <Layers className="w-4 h-4 text-solar-600" />
                        <span>Extra / Additional Site Photos ({extraPhotos.length})</span>
                      </h3>
                      <p className="text-[10px] text-muted-foreground">Cable routing, ACDB inside, civil foundation, PPE, etc.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddExtraPhoto}
                      className="px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Extra Photo</span>
                    </button>
                  </div>

                  {extraPhotos.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs bg-card rounded-2xl border border-dashed space-y-2">
                      <Camera className="w-6 h-6 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold text-foreground">No Extra Photos Added Yet</p>
                      <p className="text-[11px]">Click &quot;+ Add Extra Photo&quot; to upload cable routing, ACDB internals, or test slips.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {extraPhotos.map((extra, idx) => {
                        const hasPhoto = !!extra.dataUrl;
                        const hasGps = !!extra.latitude && !!extra.longitude;
                        const isLocating = locatingSlot === extra.id;

                        return (
                          <div
                            key={extra.id}
                            className="bg-card border rounded-2xl p-4 shadow-2xs space-y-3 border-solar-500/30"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={extra.title}
                                  onChange={e => handleUpdateExtraPhoto(extra.id, { title: e.target.value })}
                                  className="text-xs font-bold text-foreground bg-transparent border-b border-border/80 focus:border-solar-500 focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center space-x-1.5">
                                {hasPhoto && (
                                  <button
                                    type="button"
                                    onClick={() => handleRotateExtraPhoto(extra.id)}
                                    className="px-2 py-1 text-[11px] font-bold text-solar-700 bg-solar-500/10 hover:bg-solar-500/20 rounded-lg border border-solar-500/30 flex items-center space-x-1 cursor-pointer transition"
                                    title="Rotate photo 90° clockwise"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>Rotate 90°</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExtraPhoto(extra.id)}
                                  className="p-1 text-muted-foreground hover:text-destructive rounded transition cursor-pointer"
                                  title="Remove photo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Category selector */}
                            <div>
                              <select
                                value={extra.category}
                                onChange={e => handleUpdateExtraPhoto(extra.id, { category: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs bg-muted/40 border rounded-lg font-medium text-foreground cursor-pointer"
                              >
                                {EXTRA_PHOTO_CATEGORIES.map(cat => (
                                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Image container (100% Proportional, Never Stretches) */}
                            {hasPhoto ? (
                              <div className="relative group rounded-xl overflow-hidden border border-border bg-slate-950 flex items-center justify-center min-h-[160px] max-h-[220px] p-1.5">
                                <img
                                  src={extra.dataUrl!}
                                  alt={extra.title}
                                  className="max-h-44 max-w-full w-auto h-auto object-contain mx-auto block"
                                  style={{
                                    maxHeight: '176px',
                                    maxWidth: '100%',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain'
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRotateExtraPhoto(extra.id)}
                                    className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg cursor-pointer shadow-md hover:bg-slate-100 transition flex items-center space-x-1"
                                    title="Rotate 90° Clockwise"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>Rotate 90°</span>
                                  </button>
                                  <label className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg cursor-pointer shadow-md hover:bg-slate-100 transition flex items-center space-x-1">
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>Replace</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleExtraPhotoUpload(extra.id, f);
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <label className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-xl p-4 flex flex-col items-center justify-center space-y-1.5 cursor-pointer bg-muted/20 hover:bg-blue-50/20 transition group">
                                <UploadCloud className="w-6 h-6 text-blue-600 group-hover:scale-110 transition" />
                                <span className="text-xs font-bold text-foreground">Upload Photo</span>
                                <span className="text-[10px] text-muted-foreground">Select image or take live photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleExtraPhotoUpload(extra.id, f);
                                  }}
                                />
                              </label>
                            )}

                            {/* GPS Details */}
                            <div className="p-2.5 bg-background rounded-xl border space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-foreground">
                                  <MapPin className={`w-3.5 h-3.5 ${hasGps ? 'text-emerald-600' : 'text-amber-500'}`} />
                                  <span>📍 Rooftop GPS</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCaptureGpsForExtra(extra.id)}
                                  disabled={isLocating}
                                  className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded border border-blue-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                                  <span>{hasGps ? '🔄 Update GPS' : '📍 Set Location'}</span>
                                </button>
                              </div>
                              {hasGps && (
                                <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-1.5 rounded border flex justify-between items-center">
                                  <span>Lat: {extra.latitude?.toFixed(6)}°, Long: {extra.longitude?.toFixed(6)}°</span>
                                  <span className="text-emerald-600 font-bold">±{extra.accuracy}m</span>
                                </div>
                              )}
                              <input
                                type="text"
                                value={extra.caption}
                                onChange={e => handleUpdateExtraPhoto(extra.id, { caption: e.target.value })}
                                placeholder="Photo remarks / caption..."
                                className="w-full px-2 py-1 text-xs bg-background border rounded font-medium text-foreground"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Saved Inspection Documents in Customer Vault Card */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderLock className="w-4 h-4 text-solar-600" />
                      <h4 className="text-xs font-bold text-foreground">
                        Saved Documents in Customer Vault
                      </h4>
                    </div>
                    <Link
                      to={`/documents?customerId=${selectedCustomer?._id || selectedCustomer?.id || ''}`}
                      className="text-[11px] font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1"
                    >
                      <span>Open Vault</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {savedSitePhotoDocs.length > 0 ? (
                    <div className="space-y-2">
                      {savedSitePhotoDocs.map((doc: any) => (
                        <div
                          key={doc._id}
                          className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {doc.safeDisplayName || doc.originalFilename}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • {(doc.fileSizeBytes / 1024).toFixed(1)} KB • In Vault
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePreviewVaultDoc(doc)}
                              className="p-1.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted rounded-lg border border-border transition cursor-pointer"
                              title="Preview document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={getFullApiUrl(`/documents/${doc._id}/download`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-muted-foreground hover:text-foreground bg-card hover:bg-muted rounded-lg border border-border transition cursor-pointer"
                              title="Download file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-muted/20 border border-dashed border-border rounded-xl text-center space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        No inspection report saved in vault yet.
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        Click <strong className="text-solar-600">"Save Photos"</strong> above to automatically generate and save this 1-page A4 report directly to customer's Document Vault.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Printable Sheet Container (7 cols) */}
              <div className="lg:col-span-7 sticky top-20">
                <div className="bg-card border rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-bold text-foreground">
                        Live Document Preview (A4 Report)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        (Natural 100% Aspect Ratio)
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenPdfPreview}
                        className="text-xs font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1 cursor-pointer bg-solar-500/10 px-2.5 py-1 rounded-lg border border-solar-500/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Fullscreen Preview</span>
                      </button>
                    </div>
                  </div>

                  {/* Single A4 Sheet Container (100% Matches sitepic.docx - Exactly 1 Page) */}
                  <div className="bg-slate-300 dark:bg-slate-900/90 p-2 sm:p-5 rounded-xl overflow-x-auto">
                    <div ref={documentPrintRef}>
                      <div
                        data-pdf-page="1"
                        className="bg-white text-slate-900 mx-auto w-full max-w-[800px] min-h-[1050px] p-5 sm:p-7 shadow-xl rounded-sm flex flex-col justify-start"
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                          color: '#0f172a'
                        }}
                      >
                        <div>
                          {/* Document Header (Times New Roman, Bold, Underlined, Centered - Same to Same as sitepic.docx) */}
                          <div className="text-center pb-2 mb-2">
                            <h2 className="text-base sm:text-xl font-bold tracking-wide uppercase text-slate-950 underline decoration-1 underline-offset-4">
                              SITE PHOTOS AT {tplConsumerName || 'BENEFICIARY CONSUMER'}
                            </h2>
                          </div>

                          {/* 4 Inspection Photos Stacked Vertically (Full-Width, One Big Picture Below Another, Exact Aspect Ratio) */}
                          <div className="flex flex-col space-y-2.5">
                            {PHOTO_SLOT_CONFIGS.map((cfg, idx) => {
                              const slot = photoSlots[cfg.id];
                              return (
                                <div
                                  key={cfg.id}
                                  className="group relative w-full h-[228px] bg-slate-100/70 overflow-hidden border border-slate-300 rounded-xs flex items-center justify-center p-1"
                                >
                                  {slot.dataUrl ? (
                                    <img
                                      src={slot.dataUrl}
                                      alt={cfg.shortTitle}
                                      className="max-h-[220px] max-w-full w-auto h-auto object-contain mx-auto block"
                                      style={{
                                        maxHeight: '220px',
                                        maxWidth: '100%',
                                        width: 'auto',
                                        height: 'auto',
                                        objectFit: 'contain'
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs italic font-sans">
                                      <span>[Photo #{idx + 1}: {cfg.shortTitle} Pending]</span>
                                    </div>
                                  )}
                                  {/* Quick Rotate Button on Document Preview */}
                                  {slot.dataUrl && (
                                    <button
                                      type="button"
                                      onClick={() => handleRotateSlot(cfg.id)}
                                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition px-2 py-1 bg-black/75 hover:bg-black text-white text-[10px] font-bold rounded flex items-center space-x-1 shadow cursor-pointer z-10"
                                      title="Rotate 90° Clockwise"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Rotate 90°</span>
                                    </button>
                                  )}
                                  {/* Geotag Stamp Watermark in Bottom-Left (NoteCam style) */}
                                  {(slot.latitude && slot.longitude) ? (
                                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-1 rounded shadow-sm leading-tight text-left z-10">
                                      <div>Latitude: {slot.latitude.toFixed(6)}°</div>
                                      <div>Longitude: {slot.longitude.toFixed(6)}°</div>
                                      {slot.accuracy ? <div>Accuracy: ±{Math.round(slot.accuracy)}m</div> : null}
                                      {slot.timestamp ? (
                                        <div>Time: {slot.timestamp}</div>
                                      ) : null}
                                    </div>
                                  ) : slot.gps ? (
                                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm z-10">
                                      📍 {slot.gps}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* CENTERED CLIENT SELECTION MODAL (PROFESSIONAL & CLEAN)                     */}
      {/* ========================================================================= */}
      {isClientDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          style={{ zIndex: 90 }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsClientDrawerOpen(false);
          }}
        >
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border p-4 sm:p-6 space-y-4 flex flex-col max-h-[85vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">
                    Select Active Rooftop Site
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Choose an assigned rooftop solar site to capture 4-point inspection photos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box & Status Filter Bar */}
            <div className="space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, city or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500 text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs">
                {(['ALL', 'ACTIVE', 'PENDING', 'COMPLETED'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      statusFilter === tab
                        ? 'bg-solar-600 text-white font-bold shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab === 'ALL'
                      ? 'All Customers'
                      : tab === 'ACTIVE'
                        ? 'Active Installations'
                        : tab === 'PENDING'
                          ? 'Pending Review'
                          : 'Completed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Cards 2-Column Grid with Custom Smooth Scroll */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[50vh] scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {loadingCustomers && customers.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-solar-500" />
                  <p className="text-xs">Loading customer directory...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-dashed flex flex-col items-center justify-center space-y-1">
                  <p className="font-semibold text-foreground">
                    {customers.length === 0 ? 'No customer sites registered yet' : `No clients found matching "${searchQuery}"`}
                  </p>
                  <p className="text-[11px]">
                    {customers.length === 0
                      ? 'New rooftop customer installations created in Sales or Operations will automatically appear here.'
                      : 'Try searching by a different name, phone number or customer code.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredCustomers.map(cust => {
                    const isSelected = (selectedCustomer?._id || selectedCustomer?.id) === (cust._id || cust.id);
                    const linkedInst = installations.find(i =>
                      (i.customerId && (i.customerId === (cust._id || cust.id) || i.customerId._id === (cust._id || cust.id))) ||
                      (i.customerCode && cust.customerCode && i.customerCode === cust.customerCode)
                    );
                    return (
                      <div
                        key={cust._id || cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer text-xs flex flex-col justify-between ${
                          isSelected
                            ? 'bg-solar-500/10 border-solar-500 shadow-xs ring-1 ring-solar-500/30'
                            : 'bg-card border-border hover:bg-muted/40 hover:border-solar-500/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <span className="font-bold text-foreground truncate block text-xs">
                              {cust.name}
                            </span>
                            {isSelected ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-solar-500/20 text-solar-700 dark:text-solar-300 shrink-0">
                                Selected
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {cust.customerCode || 'CUST'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center space-x-1.5 flex-wrap">
                            <span>📍 {cust.installationAddress?.city || 'Raipur'}</span>
                            {cust.sanctionedLoadKw && (
                              <>
                                <span>•</span>
                                <span>⚡ {cust.sanctionedLoadKw} kWp</span>
                              </>
                            )}
                          </div>
                        </div>

                        {linkedInst ? (
                          <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              ⚡ {linkedInst.installationNumber}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              linkedInst.status === 'APPROVED'
                                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                                : linkedInst.status === 'SUBMITTED'
                                  ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
                                  : linkedInst.status === 'IN_PROGRESS'
                                    ? 'bg-blue-500/15 text-blue-700 border-blue-500/30'
                                    : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                            }`}>
                              {linkedInst.status}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                            {localStorage.getItem(`solar_photos_${cust._id || cust.id}`) ? (
                              <span className="text-emerald-600 font-bold">✓ Photos Saved</span>
                            ) : (
                              <span>Inspection Pending</span>
                            )}
                            <span className="text-solar-600 font-semibold">+ Open Dossier</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs shrink-0">
              <span className="text-muted-foreground text-[11px]">
                Showing {filteredCustomers.length} of {customers.length} clients
              </span>
              <div className="flex items-center space-x-3">
                <Link
                  to="/customers"
                  onClick={() => setIsClientDrawerOpen(false)}
                  className="font-bold text-solar-600 hover:underline inline-flex items-center space-x-1"
                >
                  <span>Return to Site List &rarr;</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsClientDrawerOpen(false)}
                  className="px-3 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL 3: IN-APP DOCUMENT PREVIEW MODAL                                    */}
      {/* ========================================================================= */}
      {previewDocModal && previewDocModal.isOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn"
          style={{ zIndex: 100 }}
          onClick={e => {
            if (e.target === e.currentTarget) setPreviewDocModal(null);
          }}
        >
          <div className="bg-card border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
              <h3 className="font-bold text-foreground text-sm truncate">{previewDocModal.title}</h3>
              <button onClick={() => setPreviewDocModal(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950 min-h-[400px]">
              {previewDocModal.mimeType?.startsWith('image/') ||
              ['.jpg', '.jpeg', '.png', '.webp'].some(ext => previewDocModal.url.toLowerCase().includes(ext)) ? (
                <img src={previewDocModal.url} alt={previewDocModal.title} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              ) : (
                <iframe src={previewDocModal.url} title={previewDocModal.title} className="w-full h-[75vh] border-0 rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: FULLSCREEN HIGH-RESOLUTION PDF PREVIEW MODAL                     */}
      {/* ========================================================================= */}
      {pdfPreviewModalOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
          style={{ zIndex: 100 }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setPdfPreviewModalOpen(false);
              if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
              }
            }
          }}
        >
          <div className="bg-card w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
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
                    5 Inspection Categories + {extraPhotos.length} Extra Photos with Geotags
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
