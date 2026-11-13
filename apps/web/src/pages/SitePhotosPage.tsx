import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
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
  Navigation,
  Sparkles,
  Plus,
  Search,
  Barcode,
  Zap,
  Building2,
  Upload,
  FileText,
  Check,
  Layers,
  Boxes,
  FilePlus2,
  Scan,
  ClipboardList,
  ClipboardCheck
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
  },
  {
    id: 'lightning',
    shortTitle: 'Lightning Arrester with Consumer',
    officialTitle: '5. Lightning Arrester (LA) Terminal with Consumer',
    badge: 'Lightning Arrester',
    infoGuideline:
      'Photo showing rooftop lightning arrester (LA) air terminal mounted at the highest rooftop elevation, down conductor strip, and consumer on terrace.',
    checklist: ['LA terminal at highest roof point', 'Proper copper/GI down conductor', 'Consumer visible on rooftop']
  }
];

export const EXTRA_PHOTO_CATEGORIES = [
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

export const SitePhotosPage: React.FC<SitePhotosPageProps> = ({ initialTab }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Active Workstation Tab: determine from prop, pathname or searchParams
  const getTabFromLocation = (): 'photos' | 'equipment' | 'documents' => {
    if (initialTab) return initialTab;
    if (location.pathname.includes('equipment-barcodes')) return 'equipment';
    if (location.pathname.includes('installation-docs')) return 'documents';
    const queryTab = searchParams.get('tab');
    if (queryTab === 'equipment' || queryTab === 'documents' || queryTab === 'photos') return queryTab;
    return 'photos';
  };

  const [activeTab, setActiveTab] = useState<'photos' | 'equipment' | 'documents'>(getTabFromLocation);

  useEffect(() => {
    setActiveTab(getTabFromLocation());
  }, [location.pathname, initialTab, searchParams]);

  // Customer Directory & Selection
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Left Sidebar State
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'COMPLETED'>('ALL');

  // Customer & Site Template Information
  const [tplConsumerName, setTplConsumerName] = useState('SHRI GYAN CHAND JAISWAL');
  const [tplConsumerNumber, setTplConsumerNumber] = useState('1001750390');
  const [tplCapacityKwp] = useState('3');
  const [tplAddress, setTplAddress] = useState('SHANTI VIHAR COLONY, DANGANIA');
  const [tplDistrict, setTplDistrict] = useState('Raipur');
  const [tplAgreementDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  });

  // Vendor Information
  const [tplVendorName] = useState('M/S RAREBOX LLP RAIPUR');
  const [tplVendorSignatory] = useState('SAMEER SAHU');
  const [tplVendorDesignation] = useState('PROPRIETOR / AUTHORIZED SIGNATORY');
  const [tplVendorPhone] = useState('9630131550');

  // 1. Photo Framing Mode: 'contain' fits entire photo without crop, 'cover' fills frame
  const [imageFit, setImageFit] = useState<'contain' | 'cover'>('contain');

  // 2. 5 Mandatory Photo Slots
  const [photoSlots, setPhotoSlots] = useState<Record<PhotoSlotId, PhotoSlotData>>(createEmptySlots);

  // 3. Extra / Additional Site Photos
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotoData[]>([]);

  // 4. Inverter & Equipment Information
  const [inverterBrand, setInverterBrand] = useState('Growatt');
  const [inverterModel, setInverterModel] = useState('MIN 3300TL-X (Single Phase)');
  const [inverterSerial, setInverterSerial] = useState('GW-2026-INV-98104');
  const [inverterCapacity, setInverterCapacity] = useState('3.3 kW');

  // 5. PV Module & Panel Barcodes Table
  const [panelManufacturer, setPanelManufacturer] = useState('Waaree Energies');
  const [panelModel, setPanelModel] = useState('540W Mono PERC Bifacial DCR');
  const [panelWattage, setPanelWattage] = useState<number>(540);
  const [panelRows, setPanelRows] = useState<PanelBarcodeRow[]>([
    { id: 'p-1', itemNumber: 1, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-001', barcode: 'BC-2026-001', status: 'VERIFIED' },
    { id: 'p-2', itemNumber: 2, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-002', barcode: 'BC-2026-002', status: 'VERIFIED' },
    { id: 'p-3', itemNumber: 3, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-003', barcode: 'BC-2026-003', status: 'VERIFIED' },
    { id: 'p-4', itemNumber: 4, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-004', barcode: 'BC-2026-004', status: 'PENDING' },
    { id: 'p-5', itemNumber: 5, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-005', barcode: 'BC-2026-005', status: 'PENDING' },
    { id: 'p-6', itemNumber: 6, description: 'Solar PV Module 540W', serialNumber: 'WAA-540-006', barcode: 'BC-2026-006', status: 'PENDING' }
  ]);
  const [quickPanelCountInput, setQuickPanelCountInput] = useState<number>(6);

  // Barcode Scanner Modal State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [activeScanningRowId, setActiveScanningRowId] = useState<string | null>(null);
  const [scannerManualInput, setScannerManualInput] = useState('');
  const [scannerCameraActive, setScannerCameraActive] = useState(false);
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Bulk Paste Barcodes Modal
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkBarcodeText, setBulkBarcodeText] = useState('');

  // 6. After-Installation Documents State
  const [customerVaultDocs, setCustomerVaultDocs] = useState<any[]>([]);
  const [loadingVaultDocs, setLoadingVaultDocs] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

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
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState<string | null>(null);
  const [saveEquipmentSuccess, setSaveEquipmentSuccess] = useState<string | null>(null);

  // Load customer directory
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
          const preselectedCustomerId =
            searchParams.get('customerId') ||
            localStorage.getItem('solar_installer_active_customer_id') ||
            '';
          if (preselectedCustomerId) {
            const match = list.find(c => (c._id || c.id) === preselectedCustomerId);
            if (match) setSelectedCustomer(match);
            else if (list.length > 0 && !selectedCustomer) setSelectedCustomer(list[0] || null);
          } else if (list.length > 0 && !selectedCustomer) {
            setSelectedCustomer(list[0] || null);
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

  // Upload Photo for Mandatory Slot
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
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      handleUpdateExtraPhoto(id, { dataUrl });

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
    };
    reader.readAsDataURL(file);
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

  // --------------------------------------------------------------------------
  // PANEL MODULES & BARCODE SCANNER LOGIC
  // --------------------------------------------------------------------------
  const handleGeneratePanelSlots = (count: number) => {
    const validCount = Math.max(1, Math.min(100, count));
    const newRows: PanelBarcodeRow[] = [];
    for (let i = 1; i <= validCount; i++) {
      const existing = panelRows.find(r => r.itemNumber === i);
      newRows.push({
        id: existing?.id || `p-${i}-${Date.now()}`,
        itemNumber: i,
        description: `Solar PV Module ${panelWattage}W`,
        serialNumber: existing?.serialNumber || '',
        barcode: existing?.barcode || '',
        status: existing?.barcode ? 'VERIFIED' : 'PENDING'
      });
    }
    setPanelRows(newRows);
  };

  const handleAddSinglePanel = () => {
    const nextNumber = panelRows.length + 1;
    setPanelRows(prev => [
      ...prev,
      {
        id: `p-${nextNumber}-${Date.now()}`,
        itemNumber: nextNumber,
        description: `Solar PV Module ${panelWattage}W`,
        serialNumber: '',
        barcode: '',
        status: 'PENDING'
      }
    ]);
  };

  const handleDeletePanelRow = (id: string) => {
    setPanelRows(prev =>
      prev
        .filter(r => r.id !== id)
        .map((r, idx) => ({ ...r, itemNumber: idx + 1 }))
    );
  };

  const handleUpdatePanelRow = (id: string, updates: Partial<PanelBarcodeRow>) => {
    setPanelRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.barcode !== undefined) {
          updated.status = updates.barcode.trim() ? 'VERIFIED' : 'PENDING';
        }
        return updated;
      })
    );
  };

  // Open Barcode Camera Scanner
  const handleOpenScannerForRow = (rowId: string) => {
    setActiveScanningRowId(rowId);
    setScannerManualInput('');
    setIsBarcodeScannerOpen(true);
    startCameraStream();
  };

  const startCameraStream = async () => {
    try {
      setScannerCameraActive(true);
      setScannerCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setScannerCameraError('Camera stream not supported in this browser. Use manual scanner input.');
      }
    } catch (err: any) {
      console.warn('Camera stream notice:', err);
      setScannerCameraError('Could not access camera. Please allow camera permissions or enter barcode manually.');
    }
  };

  const stopCameraStream = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    setScannerCameraActive(false);
  };

  const handleApplyScannedBarcode = (code: string) => {
    if (!activeScanningRowId || !code.trim()) return;
    const cleanCode = code.trim().toUpperCase();
    handleUpdatePanelRow(activeScanningRowId, {
      barcode: cleanCode,
      serialNumber: cleanCode
    });

    // Advance to next un-scanned row
    const currentIndex = panelRows.findIndex(r => r.id === activeScanningRowId);
    const nextRow = panelRows.slice(currentIndex + 1).find(r => !r.barcode);

    if (nextRow) {
      setActiveScanningRowId(nextRow.id);
      setScannerManualInput('');
    } else {
      setIsBarcodeScannerOpen(false);
      stopCameraStream();
    }
  };

  const handleApplyBulkBarcodes = () => {
    const lines = bulkBarcodeText
      .split(/\r?\n|,/)
      .map(s => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setIsBulkPasteOpen(false);
      return;
    }

    setPanelRows(prev => {
      const totalRequired = Math.max(prev.length, lines.length);
      const next: PanelBarcodeRow[] = [];
      for (let i = 1; i <= totalRequired; i++) {
        const existing = prev[i - 1];
        const assignedBarcode = lines[i - 1] || existing?.barcode || '';
        next.push({
          id: existing?.id || `p-${i}-${Date.now()}`,
          itemNumber: i,
          description: existing?.description || `Solar PV Module ${panelWattage}W`,
          serialNumber: assignedBarcode || existing?.serialNumber || '',
          barcode: assignedBarcode,
          status: assignedBarcode ? 'VERIFIED' : 'PENDING'
        });
      }
      return next;
    });

    setIsBulkPasteOpen(false);
    setBulkBarcodeText('');
  };

  const handleSaveEquipment = async () => {
    try {
      setSaveEquipmentSuccess(null);
      // Persist in local storage for field technician convenience
      const equipmentData = {
        customerId: selectedCustomer?._id || selectedCustomer?.id,
        inverter: {
          brand: inverterBrand,
          model: inverterModel,
          serial: inverterSerial,
          capacity: inverterCapacity
        },
        panels: {
          manufacturer: panelManufacturer,
          model: panelModel,
          wattage: panelWattage,
          totalPanels: panelRows.length,
          calculatedKw: ((panelRows.length * panelWattage) / 1000).toFixed(2),
          modules: panelRows
        },
        savedAt: new Date().toISOString()
      };

      if (selectedCustomer) {
        const key = `solar_equipment_${selectedCustomer._id || selectedCustomer.id}`;
        localStorage.setItem(key, JSON.stringify(equipmentData));
      }

      setSaveEquipmentSuccess(
        `Equipment & Barcodes for ${panelRows.length} panels verified and saved successfully!`
      );
      setTimeout(() => setSaveEquipmentSuccess(null), 5000);
    } catch (err: any) {
      alert('Error saving equipment data: ' + err.message);
    }
  };

  // --------------------------------------------------------------------------
  // AFTER-INSTALLATION DOCUMENTS LOGIC
  // --------------------------------------------------------------------------
  const handleUploadPostInstallDoc = async (templateKey: string, file: File) => {
    if (!selectedCustomer) {
      alert('Please select a customer first.');
      return;
    }
    const custId = selectedCustomer._id || selectedCustomer.id;
    if (!custId) return;

    try {
      setUploadingDocKey(templateKey);
      const template = POST_INSTALL_DOC_TEMPLATES.find(t => t.key === templateKey);
      const title = `${template?.title || templateKey} - ${tplConsumerName}`;

      const docPayload: any = {
        originalFilename: file.name,
        safeDisplayName: title,
        category: template?.category || DocumentCategory.SIGNED_CONTRACT,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        mimeType: file.type || 'application/pdf',
        fileSizeBytes: file.size,
        customerId: custId,
        metadata: {
          postInstallDoc: true,
          templateKey,
          consumerNumber: tplConsumerNumber,
          consumerName: tplConsumerName
        }
      };

      const docRes = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify(docPayload)
      });

      const docId = docRes?._id || docRes?.id;
      if (!docId) throw new Error('Could not register document');

      // Upload raw content
      const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
      const uploadUrl = getFullApiUrl(`/documents/${docId}/content`);
      await fetch(uploadUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
        },
        body: file
      });

      await fetchCustomerDocuments(custId);
      alert(`Document "${title}" uploaded and saved to customer vault!`);
    } catch (err: any) {
      alert('Upload failed: ' + (err?.message || 'Error'));
    } finally {
      setUploadingDocKey(null);
    }
  };

  // --------------------------------------------------------------------------
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

      const { blob } = await generatePdfFromElement(documentPrintRef.current, {
        filename
      });

      const custId = selectedCustomer._id || selectedCustomer.id;

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
          extraPhotosCount: extraPhotos.length
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

      setVaultSaveSuccess(
        `Site Photos Compliance document "${title}" saved into customer vault successfully!`
      );
      if (custId) fetchCustomerDocuments(custId);
    } catch (err: any) {
      alert('Failed to save document in vault: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingToVault(false);
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
  const verifiedBarcodesCount = panelRows.filter(r => r.status === 'VERIFIED').length;
  const calculatedCapacityKw = ((panelRows.length * panelWattage) / 1000).toFixed(2);

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
                  {activeTab === 'photos' ? (
                    <Camera className="w-5 h-5" />
                  ) : activeTab === 'equipment' ? (
                    <Barcode className="w-5 h-5" />
                  ) : (
                    <ClipboardCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-sm sm:text-base font-black text-foreground tracking-tight whitespace-nowrap">
                      {activeTab === 'photos'
                        ? '1. Site Inspection Photos'
                        : activeTab === 'equipment'
                          ? '2. Equipment & Panel Barcodes'
                          : '3. After-Installation Documents'}
                    </h1>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/30">
                      Step {activeTab === 'photos' ? '1' : activeTab === 'equipment' ? '2' : '3'} of 3
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeTab === 'photos'
                      ? 'PM Surya Ghar 5-point inspection & DISCOM net metering compliance'
                      : activeTab === 'equipment'
                        ? 'Inverter specifications, solar module serial numbers & live barcode scanner'
                        : 'Handover certificate, JCR, Net Meter test slip & SLD compliance dossiers'}
                  </p>
                </div>
              </div>

              {/* Customer Switcher Button */}
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(true)}
                className="px-3 py-1.5 bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 text-xs font-bold rounded-xl border border-solar-500/30 flex items-center space-x-2 cursor-pointer transition shadow-2xs"
                title="Click to search and change customer"
              >
                <UserCheck className="w-3.5 h-3.5 text-solar-600" />
                <span className="font-bold truncate max-w-[150px] sm:max-w-[200px]">
                  {tplConsumerName}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-solar-500/20 font-bold">
                  {tplConsumerNumber}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">Switch Client ▾</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
              {activeTab === 'photos' && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenPdfPreview}
                    disabled={generatingPdf}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer disabled:opacity-50"
                    title="Preview PDF Document"
                  >
                    {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-solar-600" />}
                    <span className="hidden sm:inline">Preview PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={generatingPdf}
                    className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Download A4 PDF Report"
                  >
                    {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Download PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToVault}
                    disabled={isSavingToVault}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Save into Customer Document Vault"
                  >
                    {isSavingToVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderLock className="w-3.5 h-3.5" />}
                    <span>Save to Vault</span>
                  </button>
                </>
              )}

              {activeTab === 'equipment' && (
                <>
                  <button
                    type="button"
                    onClick={handleAddSinglePanel}
                    className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    title="Add One Solar Panel Row"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Panel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBulkPasteOpen(true)}
                    className="px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer"
                    title="Bulk Paste Serial Numbers & Barcodes"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-solar-600" />
                    <span className="hidden sm:inline">Bulk Paste</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEquipment}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    title="Save Equipment Register"
                  >
                    <FolderLock className="w-3.5 h-3.5" />
                    <span>Save Equipment</span>
                  </button>
                </>
              )}

              {activeTab === 'documents' && (
                <>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => fetchCustomerDocuments(selectedCustomer._id || selectedCustomer.id || '')}
                      disabled={loadingVaultDocs}
                      className="px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer disabled:opacity-50"
                      title="Refresh Vault Documents"
                    >
                      {loadingVaultDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderLock className="w-3.5 h-3.5 text-solar-600" />}
                      <span>Refresh Documents</span>
                    </button>
                  )}
                  <Link
                    to="/documents"
                    className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Full Vault &rarr;</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Success Alerts */}
          {vaultSaveSuccess && (
            <div className="mt-2.5 p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{vaultSaveSuccess}</span>
              </div>
              <button onClick={() => setVaultSaveSuccess(null)} className="ml-2 font-bold cursor-pointer">✕</button>
            </div>
          )}
          {saveEquipmentSuccess && (
            <div className="mt-2.5 p-2 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{saveEquipmentSuccess}</span>
              </div>
              <button onClick={() => setSaveEquipmentSuccess(null)} className="ml-2 font-bold cursor-pointer">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE CONTAINER (CLEAN, SPACIOUS, UNCLUTTERED)                    */}
      {/* ========================================================================= */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5 flex-1">
        <div className="w-full space-y-4">
          {/* Active Client Info Banner */}
          <div className="bg-card border rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0 font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {tplConsumerName}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold shrink-0">
                    {tplConsumerNumber}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-0.5 flex-wrap">
                  <span>📍 {tplAddress}, {tplDistrict}</span>
                  <span>•</span>
                  <span>⚡ {tplCapacityKwp} kWp Sanctioned</span>
                </div>
              </div>
            </div>

            {/* Quick Metric Badge for Current Active Module */}
            <div className="flex items-center space-x-2 shrink-0">
              {activeTab === 'photos' && (
                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border flex items-center space-x-1 ${
                  mandatoryUploadedCount === 5 ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                }`}>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Inspection Photos: {mandatoryUploadedCount}/5</span>
                </span>
              )}
              {activeTab === 'equipment' && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-bold border bg-blue-500/10 text-blue-700 border-blue-500/30 flex items-center space-x-1">
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Panels: {verifiedBarcodesCount}/{panelRows.length} Verified</span>
                </span>
              )}
              {activeTab === 'documents' && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-bold border bg-emerald-500/10 text-emerald-700 border-emerald-500/30 flex items-center space-x-1">
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>Vault Documents: {customerVaultDocs.length}</span>
                </span>
              )}
            </div>
          </div>

          {/* =================================================================== */}
          {/* TAB 1: 📸 SITE INSPECTION PHOTOS (5 MANDATORY + EXTRA PHOTOS)        */}
          {/* =================================================================== */}
          {activeTab === 'photos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 5 Mandatory Photo Slots + Extra Photos (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* 5 Mandatory PM Surya Ghar Photos Header */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center space-x-1.5">
                      <Camera className="w-4 h-4 text-solar-600" />
                      <span>5 Mandatory Inspection Photos</span>
                    </h3>
                    <p className="text-[10px] text-muted-foreground">PM Surya Ghar &amp; DISCOM compliance report</p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleGeotagAllSlots}
                      disabled={isLocatingAll}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Hook live GPS into all 5 slots"
                    >
                      {isLocatingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                      <span>📍 Geotag All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
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
                      }}
                      className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] font-semibold rounded-lg border cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-solar-600 inline mr-1" />
                      <span>Demo</span>
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

                        {/* Upload / Photo Container */}
                        {hasPhoto ? (
                          <div className="relative group rounded-xl overflow-hidden border bg-slate-950 flex items-center justify-center">
                            <img
                              src={slot.dataUrl!}
                              alt={cfg.shortTitle}
                              className={`w-full h-44 ${imageFit === 'contain' ? 'object-contain' : 'object-cover'} bg-slate-950`}
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

                        {/* Geotag section */}
                        <div className="p-2.5 bg-background rounded-xl border space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-foreground">
                              <MapPin className={`w-3.5 h-3.5 ${hasGps ? 'text-emerald-600' : 'text-amber-500'}`} />
                              <span>GPS Geotag</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                hasGps ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {hasGps ? 'Geotagged' : 'Pending GPS'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCaptureGpsForSlot(cfg.id)}
                              disabled={isLocatingThis}
                              className="px-2 py-1 text-[10px] font-bold text-orange-700 bg-orange-50 rounded border border-orange-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              {isLocatingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                              <span>{hasGps ? 'Refresh GPS' : '📍 Capture GPS'}</span>
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

                              <button
                                type="button"
                                onClick={() => handleRemoveExtraPhoto(extra.id)}
                                className="p-1 text-muted-foreground hover:text-destructive rounded transition cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

                            {/* Image container */}
                            {hasPhoto ? (
                              <div className="relative group rounded-xl overflow-hidden border bg-slate-950 flex items-center justify-center">
                                <img
                                  src={extra.dataUrl!}
                                  alt={extra.title}
                                  className="w-full h-44 object-contain bg-slate-950"
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
                                  <span>GPS Geotag</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCaptureGpsForExtra(extra.id)}
                                  disabled={isLocating}
                                  className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded border border-blue-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                                  <span>{hasGps ? 'Refresh GPS' : '📍 Capture GPS'}</span>
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
                      <button
                        type="button"
                        onClick={() => setImageFit(f => (f === 'contain' ? 'cover' : 'contain'))}
                        className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg border transition cursor-pointer"
                      >
                        <span>Framing: <strong>{imageFit === 'contain' ? 'Full Image' : 'Fill Frame'}</strong></span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPdfPreview}
                        className="text-xs font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Fullscreen</span>
                      </button>
                    </div>
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
                      {/* Document Header */}
                      <div className="text-center border-b-2 border-slate-900 pb-3 mb-4 space-y-1">
                        <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950">
                          SITE PHOTOS AT {tplConsumerName || 'SHRI GYAN CHAND JAISWAL'}
                        </h2>
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-700 font-semibold pt-1">
                          <span><strong>Site:</strong> {tplAddress}, {tplDistrict}</span>
                          <span>•</span>
                          <span><strong>Consumer No / BP:</strong> {tplConsumerNumber}</span>
                          <span>•</span>
                          <span><strong>Capacity:</strong> {tplCapacityKwp} kWp RTS</span>
                          <span>•</span>
                          <span><strong>Inspection Date:</strong> {tplAgreementDate}</span>
                        </div>
                      </div>

                      {/* 5 Mandatory Inspection Photos 2-Col Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {PHOTO_SLOT_CONFIGS.map((cfg) => {
                          const slot = photoSlots[cfg.id];
                          return (
                            <div
                              key={cfg.id}
                              className="border border-slate-800 rounded-lg overflow-hidden bg-slate-50 flex flex-col justify-between"
                            >
                              <div className="p-1.5 bg-slate-900 text-white font-bold text-[11px] truncate">
                                {cfg.officialTitle}
                              </div>
                              <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                                {slot.dataUrl ? (
                                  <img
                                    src={slot.dataUrl}
                                    alt={cfg.shortTitle}
                                    className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                  />
                                ) : (
                                  <span className="text-slate-400 text-xs italic">[Photo Pending]</span>
                                )}
                                {slot.gps && (
                                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-white text-[9px] p-1 font-mono truncate">
                                    📍 {slot.gps}
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5 text-[10px] text-slate-700 bg-white border-t border-slate-200">
                                {slot.caption}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Extra Photos in Print Layout */}
                      {extraPhotos.length > 0 && (
                        <div className="mt-6 pt-4 border-t-2 border-slate-800 space-y-3">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                            Additional Field Inspection &amp; Installation Photos ({extraPhotos.length})
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {extraPhotos.map((extra, idx) => (
                              <div
                                key={extra.id}
                                className="border border-slate-800 rounded-lg overflow-hidden bg-slate-50 flex flex-col justify-between"
                              >
                                <div className="p-1.5 bg-slate-800 text-white font-bold text-[11px] truncate">
                                  {idx + 6}. {extra.title} ({extra.category})
                                </div>
                                <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                                  {extra.dataUrl ? (
                                    <img
                                      src={extra.dataUrl}
                                      alt={extra.title}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">[Photo Pending]</span>
                                  )}
                                  {extra.gps && (
                                    <div className="absolute bottom-0 inset-x-0 bg-black/80 text-white text-[9px] p-1 font-mono truncate">
                                      📍 {extra.gps}
                                    </div>
                                  )}
                                </div>
                                <div className="p-1.5 text-[10px] text-slate-700 bg-white border-t border-slate-200">
                                  {extra.caption || extra.title}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Consumer & Vendor Signatures Footer */}
                      <div className="mt-8 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-6 items-end">
                        <div className="space-y-1">
                          <p className="font-bold text-xs uppercase">Consumer / Beneficiary</p>
                          <p className="text-[11px] text-slate-600">I verify that the above solar plant photos are from my premises.</p>
                          <div className="pt-2 text-xs font-semibold">
                            <p>Name: {tplConsumerName}</p>
                            <p>Signature: ______________________</p>
                          </div>
                        </div>

                        <div className="space-y-1 text-right">
                          <p className="font-bold text-xs uppercase">Certified Solar Vendor</p>
                          <p className="text-[11px] text-slate-600">For {tplVendorName}</p>
                          <div className="flex justify-end py-1">
                            <img src={RAREBOX_STAMP_BASE64} alt="Seal" className="w-20 h-20 object-contain" />
                          </div>
                          <p className="text-xs font-semibold">{tplVendorSignatory} ({tplVendorDesignation})</p><p className="text-[10px] text-slate-600">Ph: {tplVendorPhone}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: ⚡ EQUIPMENT & PANEL BARCODES (S.NO / INVERTER / BARCODES)     */}
          {/* =================================================================== */}
          {activeTab === 'equipment' && (
            <div className="space-y-5">
              {/* Top Row: Inverter & Panel Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Inverter Specifications */}
                <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Inverter Details &amp; Serial</h3>
                        <p className="text-[10px] text-muted-foreground">On-Grid Solar PCU / Inverter specifications</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                      Single Phase On-Grid
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Inverter Make / Brand</label>
                      <input
                        type="text"
                        value={inverterBrand}
                        onChange={e => setInverterBrand(e.target.value)}
                        placeholder="e.g. Growatt / Havells"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-semibold text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Inverter Model</label>
                      <input
                        type="text"
                        value={inverterModel}
                        onChange={e => setInverterModel(e.target.value)}
                        placeholder="e.g. MIN 3300TL-X"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-semibold text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Inverter Serial Number (S.No) *</label>
                      <input
                        type="text"
                        value={inverterSerial}
                        onChange={e => setInverterSerial(e.target.value)}
                        placeholder="e.g. GW-2026-INV-98104"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Capacity Rating</label>
                      <input
                        type="text"
                        value={inverterCapacity}
                        onChange={e => setInverterCapacity(e.target.value)}
                        placeholder="e.g. 3.3 kW"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-semibold text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2: Solar PV Modules Summary */}
                <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Solar PV Modules Overview</h3>
                        <p className="text-[10px] text-muted-foreground">Module wattage &amp; calculated capacity</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                      {calculatedCapacityKw} kW Total
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Panel Manufacturer</label>
                      <input
                        type="text"
                        value={panelManufacturer}
                        onChange={e => setPanelManufacturer(e.target.value)}
                        placeholder="e.g. Waaree Energies"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-semibold text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Panel Model / Technology</label>
                      <input
                        type="text"
                        value={panelModel}
                        onChange={e => setPanelModel(e.target.value)}
                        placeholder="e.g. 540W Mono PERC Bifacial"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-semibold text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Wattage per Module (Wp)</label>
                      <input
                        type="number"
                        value={panelWattage}
                        onChange={e => setPanelWattage(Number(e.target.value) || 540)}
                        placeholder="540"
                        className="w-full px-3 py-1.5 bg-background border rounded-lg font-mono font-bold text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Total Solar Modules</label>
                      <div className="px-3 py-1.5 bg-muted rounded-lg font-bold text-foreground text-sm">
                        {panelRows.length} Modules ({verifiedBarcodesCount} Scanned)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Barcodes Table & Quick Setup Card */}
              <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
                {/* Table Header Controls */}
                <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                      <Barcode className="w-4 h-4 text-solar-600" />
                      <span>Solar PV Panels Serial Number &amp; Barcode Table</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Scan or input every module barcode for PM Surya Ghar subsidy DBT verification
                    </p>
                  </div>

                  {/* Actions: Generate Count, Bulk Paste, Add Single */}
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <div className="flex items-center space-x-1.5 bg-background border rounded-xl p-1 text-xs">
                      <span className="text-muted-foreground pl-1.5 font-semibold">Total Panels:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={quickPanelCountInput}
                        onChange={e => setQuickPanelCountInput(Number(e.target.value) || 1)}
                        className="w-12 px-1 py-0.5 text-center font-bold text-foreground border rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleGeneratePanelSlots(quickPanelCountInput)}
                        className="px-2.5 py-1 bg-solar-600 hover:bg-solar-700 text-white rounded-lg font-bold transition shadow-2xs cursor-pointer"
                        title="Generate slots matching this number"
                      >
                        ⚡ Set Slots
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBulkPasteOpen(true)}
                      className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer"
                      title="Paste multiple barcodes at once"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Bulk Paste</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddSinglePanel}
                      className="px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Panel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveEquipment}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save All</span>
                    </button>
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                      <tr>
                        <th className="px-4 py-3 font-bold w-12 text-center">S.No</th>
                        <th className="px-4 py-3 font-bold">Module Description</th>
                        <th className="px-4 py-3 font-bold">Serial Number (S.No)</th>
                        <th className="px-4 py-3 font-bold">Barcode / QR Code</th>
                        <th className="px-4 py-3 font-bold text-center">Barcode Reader</th>
                        <th className="px-4 py-3 font-bold text-center">Status</th>
                        <th className="px-4 py-3 font-bold w-14 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {panelRows.map(row => (
                        <tr key={row.id} className="hover:bg-muted/20 transition">
                          <td className="px-4 py-2.5 font-bold font-mono text-center text-foreground">
                            #{row.itemNumber}
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={row.description}
                              onChange={e => handleUpdatePanelRow(row.id, { description: e.target.value })}
                              className="w-full px-2 py-1 bg-transparent border-b border-transparent hover:border-border focus:border-solar-500 focus:outline-none text-foreground text-xs"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              placeholder="e.g. WAA-540-001"
                              value={row.serialNumber}
                              onChange={e => handleUpdatePanelRow(row.id, { serialNumber: e.target.value })}
                              className="w-full px-2.5 py-1 bg-background border rounded-lg font-mono text-foreground text-xs"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              placeholder="Scan or enter barcode..."
                              value={row.barcode}
                              onChange={e => handleUpdatePanelRow(row.id, { barcode: e.target.value })}
                              className="w-full px-2.5 py-1 bg-background border rounded-lg font-mono text-foreground text-xs focus:ring-2 focus:ring-solar-500 font-semibold"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenScannerForRow(row.id)}
                              className="px-2.5 py-1 bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 font-bold rounded-lg transition inline-flex items-center space-x-1 cursor-pointer border border-solar-500/30"
                              title="Scan barcode with camera or reader"
                            >
                              <Scan className="w-3.5 h-3.5" />
                              <span>📷 Scan</span>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.status === 'VERIFIED' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center space-x-1">
                                <Check className="w-2.5 h-2.5" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePanelRow(row.id)}
                              className="p-1 text-muted-foreground hover:text-destructive rounded transition cursor-pointer"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="p-3.5 border-t bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
                  <div>
                    <span>Total Panels: <strong>{panelRows.length}</strong></span>
                    <span className="mx-2">•</span>
                    <span>Verified: <strong className="text-emerald-600">{verifiedBarcodesCount}</strong></span>
                    <span className="mx-2">•</span>
                    <span>System Capacity: <strong>{calculatedCapacityKw} kW</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = 'S.No,Description,Serial Number,Barcode,Status\n' +
                        panelRows.map(r => `${r.itemNumber},"${r.description}","${r.serialNumber}","${r.barcode}",${r.status}`).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Solar_Panels_Barcodes_${tplConsumerName.replace(/\s+/g, '_')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-solar-600 hover:underline font-semibold cursor-pointer"
                  >
                    Export Barcodes (CSV) &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: 📄 AFTER-INSTALLATION DOCUMENTS (HANDOVER / JCR / NET METER)   */}
          {/* =================================================================== */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 text-solar-600" />
                      <span>Post-Installation &amp; Handover Compliance Documents</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Upload signed JCR, Handover Certificate, and DISCOM Net Metering verification slips
                    </p>
                  </div>
                  <Link
                    to={`/create-document?customerId=${selectedCustomer?._id || selectedCustomer?.id || ''}`}
                    className="px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 shadow-xs cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>+ Generate Document</span>
                  </Link>
                </div>

                {/* 4 Standard Post-Installation Document Slots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {loadingVaultDocs ? (
                  <div className="col-span-2 py-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2"><Loader2 className="w-6 h-6 animate-spin text-solar-500" /><p className="text-xs">Loading customer documents...</p></div>
                ) : POST_INSTALL_DOC_TEMPLATES.map(slot => {
                    const existingDoc = customerVaultDocs.find(
                      d => d.category === slot.category || d.safeDisplayName?.includes(slot.key)
                    );
                    const isUploading = uploadingDocKey === slot.key;

                    return (
                      <div
                        key={slot.key}
                        className={`p-4 rounded-xl border transition shadow-xs flex flex-col justify-between ${
                          existingDoc ? 'bg-emerald-500/[0.04] border-emerald-500/30' : 'bg-card border-border hover:border-solar-500/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                existingDoc ? 'bg-emerald-500/15 text-emerald-700' : 'bg-solar-500/10 text-solar-600'
                              }`}>
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-foreground block truncate">{slot.title}</span>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{slot.subtitle}</p>
                              </div>
                            </div>

                            {existingDoc ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0 flex items-center space-x-1">
                                <Check className="w-2.5 h-2.5" />
                                <span>Uploaded</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                                Pending
                              </span>
                            )}
                          </div>

                          {existingDoc && (
                            <div className="mt-2.5 pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                              <div className="flex items-center justify-between font-mono text-[10px]">
                                <span className="truncate max-w-[180px] text-foreground font-semibold">
                                  {existingDoc.safeDisplayName || existingDoc.originalFilename}
                                </span>
                                <span>{existingDoc.fileSizeBytes ? `${(existingDoc.fileSizeBytes / 1024).toFixed(1)} KB` : 'Ready'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-2.5 mt-2 border-t border-border/60 flex items-center justify-between gap-1">
                          {existingDoc ? (
                            <>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const res = await apiClient<{ downloadUrl: string; viewUrl?: string }>(
                                        `/documents/${existingDoc._id || existingDoc.id}/access-url`
                                      );
                                      if (res?.downloadUrl) {
                                        setPreviewDocModal({
                                          isOpen: true,
                                          title: existingDoc.safeDisplayName || existingDoc.originalFilename,
                                          url: res.viewUrl || res.downloadUrl,
                                          mimeType: existingDoc.mimeType
                                        });
                                      }
                                    } catch (err: any) {
                                      alert('Failed to preview document: ' + err.message);
                                    }
                                  }}
                                  className="text-[11px] font-bold text-solar-700 bg-solar-500/10 px-2.5 py-1 rounded-md flex items-center space-x-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                                <a
                                  href={getFullApiUrl(`/documents/${existingDoc._id || existingDoc.id}/download`)}
                                  download={existingDoc.originalFilename}
                                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted px-2.5 py-1 rounded-md flex items-center space-x-1"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              </div>
                              <label className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer underline font-medium">
                                Replace
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadPostInstallDoc(slot.key, f);
                                  }}
                                />
                              </label>
                            </>
                          ) : (
                            <label className={`w-full py-1.5 px-2.5 rounded-lg text-center text-xs font-semibold cursor-pointer transition flex items-center justify-center space-x-1.5 ${
                              isUploading ? 'bg-muted text-muted-foreground' : 'bg-solar-600 hover:bg-solar-700 text-white shadow-xs'
                            }`}>
                              {isUploading ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3" />
                                  <span>+ Upload {slot.title.split(' ')[0]}</span>
                                </>
                              )}
                              <input
                                type="file"
                                className="hidden"
                                disabled={isUploading}
                                accept=".pdf,.png,.jpg,.jpeg,.docx"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadPostInstallDoc(slot.key, f);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER CLIENT SELECTION DRAWER                                        */}
      {/* ========================================================================= */}
      {isClientDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex animate-fadeIn"
          style={{ zIndex: 90 }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsClientDrawerOpen(false);
          }}
        >
          <div className="w-full max-w-sm bg-card h-full shadow-2xl border-r p-4 space-y-3.5 flex flex-col animate-slideRight">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-solar-600" />
                <h3 className="font-bold text-sm text-foreground">Select Client for Workstation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, phone, code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500 text-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px] shrink-0">
              {(['ALL', 'ACTIVE', 'PENDING', 'COMPLETED'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-solar-600 text-white font-bold shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab}
                </button>
              ))}
            </div>

            {/* Customer Cards List */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {loadingCustomers ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-solar-500" />
                  <p className="text-xs">Loading clients...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-dashed">
                  No clients match search.
                </div>
              ) : (
                filteredCustomers.map(cust => {
                  const isSelected = (selectedCustomer?._id || selectedCustomer?.id) === (cust._id || cust.id);
                  return (
                    <div
                      key={cust._id || cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsClientDrawerOpen(false);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-solar-500/10 border-solar-500/50 shadow-2xs'
                          : 'bg-card border-border hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-bold text-foreground truncate block">
                          {cust.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-solar-500/20 text-solar-700 dark:text-solar-300 shrink-0">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center space-x-1.5 mt-0.5">
                        <span className="font-mono">{cust.customerCode || 'CUST'}</span>
                        <span>•</span>
                        <span>{cust.installationAddress?.city || 'Raipur'}</span>
                      </div>
                      {cust.primaryPhone && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          📞 {cust.primaryPhone}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t text-center shrink-0">
              <Link
                to="/customers"
                className="text-xs font-semibold text-solar-600 hover:underline inline-flex items-center space-x-1"
              >
                <span>Open Full Customer Directory &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: LIVE BARCODE CAMERA SCANNER DIALOG                               */}
      {/* ========================================================================= */}
      {isBarcodeScannerOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn"
          style={{ zIndex: 100 }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsBarcodeScannerOpen(false);
              stopCameraStream();
            }
          }}
        >
          <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Scan className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Barcode Scanner: Panel #{panelRows.find(r => r.id === activeScanningRowId)?.itemNumber || 1}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Scan with device camera or handheld barcode gun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBarcodeScannerOpen(false);
                  stopCameraStream();
                }}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera Viewfinder */}
            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
              {scannerCameraActive && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-ping z-10" />}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay Target Box */}
              <div className="absolute inset-x-8 inset-y-10 border-2 border-dashed border-solar-500 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-t-2 border-l-2 border-solar-400" />
                  <span className="w-3 h-3 border-t-2 border-r-2 border-solar-400" />
                </div>
                <div className="text-center font-mono text-[10px] text-solar-300 font-bold bg-black/60 py-0.5 rounded">
                  ALIGN BARCODE / QR CODE
                </div>
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-b-2 border-l-2 border-solar-400" />
                  <span className="w-3 h-3 border-b-2 border-r-2 border-solar-400" />
                </div>
              </div>
            </div>

            {scannerCameraError && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                {scannerCameraError}
              </p>
            )}

            {/* Manual Barcode Gun / Keyboard Input */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleApplyScannedBarcode(scannerManualInput);
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-muted-foreground">
                Or Enter / Scan with Barcode Gun:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Barcode or serial number..."
                  value={scannerManualInput}
                  onChange={e => setScannerManualInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                />
                <button
                  type="submit"
                  disabled={!scannerManualInput.trim()}
                  className="px-4 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BULK PASTE BARCODES DIALOG                                       */}
      {/* ========================================================================= */}
      {isBulkPasteOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn"
          style={{ zIndex: 100 }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsBulkPasteOpen(false);
          }}
        >
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-solar-600" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Bulk Paste Barcodes</h3>
                  <p className="text-[10px] text-muted-foreground">Paste barcodes from packing list, shipping manifest, or scanner</p>
                </div>
              </div>
              <button onClick={() => setIsBulkPasteOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                Paste barcodes (one per line or separated by comma):
              </label>
              <textarea
                rows={8}
                value={bulkBarcodeText}
                onChange={e => setBulkBarcodeText(e.target.value)}
                placeholder={"WAA-540-001\nWAA-540-002\nWAA-540-003\nWAA-540-004..."}
                className="w-full p-3 text-xs bg-background border rounded-xl font-mono text-foreground focus:ring-2 focus:ring-solar-500"
              />
              <p className="text-[11px] text-muted-foreground">
                Line 1 will be assigned to Panel #1, Line 2 to Panel #2, and so on.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkBarcodes}
                disabled={!bulkBarcodeText.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition disabled:opacity-50"
              >
                Apply Barcodes
              </button>
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
