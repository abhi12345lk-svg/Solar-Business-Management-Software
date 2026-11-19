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
  ClipboardCheck,
  ArrowRight
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';
import { downloadElementAsPdf, generatePdfFromElement } from '../lib/pdfGenerator.js';
import { DocumentCategory, DocumentAccessClassification } from '@ins-solar/shared';
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

  // Real Database & Installation Integration State
  const [installations, setInstallations] = useState<any[]>([]);
  const [activeInstallation, setActiveInstallation] = useState<any | null>(null);
  const [loadingInstallation, setLoadingInstallation] = useState(false);
  const [isSavingInstallation, setIsSavingInstallation] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isReviewingApproval, setIsReviewingApproval] = useState(false);
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

  // Load detailed installation record directly from MongoDB
  const loadInstallationDetails = async (instId: string) => {
    try {
      setLoadingInstallation(true);
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

        // Autofill Inverter from MongoDB
        if (fullInst.inverter?.brand) setInverterBrand(fullInst.inverter.brand);
        if (fullInst.inverter?.modelNumber) setInverterModel(fullInst.inverter.modelNumber);
        if (fullInst.inverter?.serialNumber) setInverterSerial(fullInst.inverter.serialNumber);
        if (fullInst.inverter?.rating) setInverterCapacity(fullInst.inverter.rating);

        // Autofill Solar Panels from MongoDB
        if (fullInst.panelDetails?.manufacturer) setPanelManufacturer(fullInst.panelDetails.manufacturer);
        if (fullInst.panelDetails?.model) setPanelModel(fullInst.panelDetails.model);
        if (fullInst.panelDetails?.wattagePerPanel) setPanelWattage(fullInst.panelDetails.wattagePerPanel);

        // Autofill Barcode Items from MongoDB
        if (Array.isArray(fullInst.inventoryItems) && fullInst.inventoryItems.length > 0) {
          setPanelRows(fullInst.inventoryItems.map((item: any, idx: number) => ({
            id: item._id || `p-${idx + 1}`,
            itemNumber: item.itemNumber || idx + 1,
            description: item.equipmentName || `Solar PV Module ${fullInst.panelDetails?.wattagePerPanel || 540}W`,
            serialNumber: item.serialNumber || '',
            barcode: item.barcode || '',
            status: item.status || 'VERIFIED'
          })));
          setQuickPanelCountInput(fullInst.inventoryItems.length);
        } else if (Array.isArray(fullInst.panelDetails?.panelBarcodes) && fullInst.panelDetails.panelBarcodes.length > 0) {
          setPanelRows(fullInst.panelDetails.panelBarcodes.map((bc: string, idx: number) => ({
            id: `p-${idx + 1}`,
            itemNumber: idx + 1,
            description: `Solar PV Module ${fullInst.panelDetails?.wattagePerPanel || 540}W`,
            serialNumber: fullInst.panelDetails?.panelSerialNumbers?.[idx] || `WAA-${idx + 1}`,
            barcode: bc,
            status: 'VERIFIED'
          })));
          setQuickPanelCountInput(fullInst.panelDetails.panelBarcodes.length);
        }

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
      }
    } catch (err) {
      console.warn('Could not load installation record from MongoDB:', err);
    } finally {
      setLoadingInstallation(false);
    }
  };

  // Load customer directory & live installations from MongoDB
  useEffect(() => {
    let isMounted = true;
    const fetchDirectory = async () => {
      try {
        setLoadingCustomers(true);
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
          : Array.isArray(instRes?.data)
            ? instRes.data
            : Array.isArray(instRes?.items)
              ? instRes.items
              : [];

        if (isMounted) {
          setCustomers(custList);
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
            const foundInst = instList.find(i =>
              (i.customerId && (i.customerId === custId || i.customerId._id === custId)) ||
              (i.customerCode && targetCustomer?.customerCode && i.customerCode === targetCustomer.customerCode)
            );
            if (foundInst) {
              loadInstallationDetails(foundInst._id || foundInst.id);
            }
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
      }
    }
  };

  // 1-Click Initialize Installation Record in MongoDB
  const handleInitializeInstallation = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first.');
      return;
    }
    try {
      setIsSavingInstallation(true);
      const custId = selectedCustomer._id || selectedCustomer.id;
      const res: any = await apiClient<any>('/installations', {
        method: 'POST',
        body: JSON.stringify({
          customerId: custId,
          systemCapacityKw: selectedCustomer.sanctionedLoadKw || Number(tplCapacityKwp) || 3.3,
          notes: `Initialized from Field Operations Workstation for ${tplConsumerName}`,
          isDraft: false
        })
      });
      const created = res?.data || res;
      setActiveInstallation(created);
      setInstallations(prev => [created, ...prev]);
      setDbNotification({
        type: 'success',
        message: `Inspection dossier ${created.installationNumber || 'INST'} created successfully!`
      });
      setTimeout(() => setDbNotification(null), 5000);
    } catch (err: any) {
      alert('Failed to initialize inspection record: ' + (err?.message || 'Server error'));
    } finally {
      setIsSavingInstallation(false);
    }
  };

  // Submit Installation for Admin QA clearance
  const handleSubmitForQaApproval = async () => {
    if (!activeInstallation) return;
    try {
      setIsSubmittingApproval(true);
      const instId = activeInstallation._id || activeInstallation.id;
      const res: any = await apiClient<any>(`/installations/${instId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ notes: '5-Point Site Inspection Photos and Inverter/PV Module Barcodes verified.' })
      });
      const updated = res?.data || res;
      if (updated) setActiveInstallation(updated);
      setDbNotification({
        type: 'success',
        message: `Installation ${activeInstallation.installationNumber} submitted for Admin QA approval!`
      });
      setTimeout(() => setDbNotification(null), 5000);
    } catch (err: any) {
      alert('Failed to submit for approval: ' + (err?.message || 'Error'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Admin Approve Installation
  const handleApproveInstallation = async () => {
    if (!activeInstallation) return;
    try {
      setIsReviewingApproval(true);
      const instId = activeInstallation._id || activeInstallation.id;
      const res: any = await apiClient<any>(`/installations/${instId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'APPROVE',
          adminRemarks: 'Field inspection photos, GPS coordinates and serial numbers verified compliant with DISCOM norms.'
        })
      });
      const updated = res?.data || res;
      if (updated) setActiveInstallation(updated);
      setDbNotification({
        type: 'success',
        message: `Installation ${activeInstallation.installationNumber} approved & commissioned!`
      });
      setTimeout(() => setDbNotification(null), 5000);
    } catch (err: any) {
      alert('Failed to approve installation: ' + (err?.message || 'Error'));
    } finally {
      setIsReviewingApproval(false);
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
    const lines = parseBarcodesFromText(bulkBarcodeText);

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

  const handleExportCsv = () => {
    const csv =
      'S.No,Description,Serial Number,Barcode,Status\n' +
      panelRows
        .map(
          r =>
            `${r.itemNumber},"${(r.description || '').replace(/"/g, '""')}","${(r.serialNumber || '').replace(/"/g, '""')}","${(r.barcode || '').replace(/"/g, '""')}",${r.status}`
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanClient = (tplConsumerName || 'Client').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    a.download = `Solar_Panels_Barcodes_${cleanClient}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Persist hardware equipment & barcodes to MongoDB Database
  const handleSaveEquipment = async () => {
    try {
      setIsSavingInstallation(true);
      setSaveEquipmentSuccess(null);

      let targetInstId = activeInstallation?._id || activeInstallation?.id;

      // Auto-create installation in MongoDB if none exists yet
      if (!targetInstId && selectedCustomer) {
        const custId = selectedCustomer._id || selectedCustomer.id;
        const res: any = await apiClient<any>('/installations', {
          method: 'POST',
          body: JSON.stringify({
            customerId: custId,
            systemCapacityKw: selectedCustomer.sanctionedLoadKw || Number(tplCapacityKwp) || 3.3,
            notes: `Auto-initialized during hardware barcode registration for ${tplConsumerName}`,
            isDraft: false
          })
        });
        const created = res?.data || res;
        setActiveInstallation(created);
        setInstallations(prev => [created, ...prev]);
        targetInstId = created._id || created.id;
      }

      if (targetInstId) {
        const patchPayload: any = {
          inverter: {
            name: 'Solar Grid Inverter',
            brand: inverterBrand,
            modelNumber: inverterModel,
            serialNumber: inverterSerial,
            barcode: inverterSerial,
            rating: inverterCapacity
          },
          panelDetails: {
            manufacturer: panelManufacturer,
            model: panelModel,
            wattagePerPanel: Number(panelWattage) || 540,
            totalPanels: panelRows.length,
            panelSerialNumbers: panelRows.map(r => r.serialNumber),
            panelBarcodes: panelRows.map(r => r.barcode)
          },
          inventoryItems: panelRows.map((r, i) => ({
            itemNumber: i + 1,
            equipmentName: r.description,
            barcode: r.barcode,
            serialNumber: r.serialNumber,
            model: panelModel,
            quantity: 1,
            status: r.status || 'VERIFIED'
          }))
        };

        const updatedRes: any = await apiClient<any>(`/installations/${targetInstId}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload)
        });
        const updatedInst = updatedRes?.data || updatedRes;
        if (updatedInst) setActiveInstallation(updatedInst);
      }

      // Local storage backup
      const equipmentData = {
        customerId: selectedCustomer?._id || selectedCustomer?.id,
        installationId: targetInstId,
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

      const msg = `Equipment specifications and ${panelRows.length} module barcodes saved successfully!`;
      setSaveEquipmentSuccess(msg);
      setDbNotification({ type: 'success', message: msg });
      setTimeout(() => {
        setSaveEquipmentSuccess(null);
        setDbNotification(null);
      }, 5000);
    } catch (err: any) {
      alert('Error saving equipment data: ' + (err?.message || 'Server error'));
    } finally {
      setIsSavingInstallation(false);
    }
  };

  // Persist all 5 Mandatory Site Photos & GPS Location to MongoDB Database
  const handleSavePhotosToDb = async () => {
    try {
      setIsSavingInstallation(true);
      let targetInstId = activeInstallation?._id || activeInstallation?.id;

      // Auto-create installation in MongoDB if none exists yet
      if (!targetInstId && selectedCustomer) {
        const custId = selectedCustomer._id || selectedCustomer.id;
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

      if (!targetInstId) {
        alert('Please select a customer first.');
        return;
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

      const msg = `All ${photosList.length} inspection photos & verified GPS saved successfully!`;
      setVaultSaveSuccess(msg);
      setDbNotification({ type: 'success', message: msg });
      setTimeout(() => {
        setVaultSaveSuccess(null);
        setDbNotification(null);
      }, 5000);
    } catch (err: any) {
      alert('Failed to save inspection photos: ' + (err?.message || 'Server error'));
    } finally {
      setIsSavingInstallation(false);
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
                        ? 'Site Inspection Photos'
                        : activeTab === 'equipment'
                          ? 'Equipment & Barcode Register'
                          : 'Installation Compliance Documents'}
                    </h1>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/30">
                      {activeTab === 'photos'
                        ? '5-Point Inspection'
                        : activeTab === 'equipment'
                          ? 'Hardware Compliance'
                          : 'Handover Dossiers'}
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
                    onClick={handleSavePhotosToDb}
                    disabled={isSavingInstallation}
                    className="px-3.5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Save inspection photos and GPS geotags"
                  >
                    {isSavingInstallation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    <span>Save Photos</span>
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
                    onClick={handleExportCsv}
                    className="px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer shadow-2xs"
                    title="Export Barcode Register to CSV file"
                  >
                    <Download className="w-3.5 h-3.5 text-solar-600" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEquipment}
                    disabled={isSavingInstallation}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    title="Save Inverter & PV module barcodes"
                  >
                    {isSavingInstallation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderLock className="w-3.5 h-3.5" />}
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
          {/* Consolidated Client & Inspection Dossier Ribbon */}
          <div className="bg-card border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Beneficiary & Site Summary */}
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0 font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {tplConsumerName}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold shrink-0">
                    BP: {tplConsumerNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsClientDrawerOpen(true)}
                    className="text-[11px] font-bold text-solar-600 hover:underline cursor-pointer px-2 py-0.5 rounded bg-solar-500/10 border border-solar-500/30 transition"
                  >
                    Switch Client ▾
                  </button>
                </div>
                <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-0.5 flex-wrap">
                  <span>📍 {tplAddress}, {tplDistrict}</span>
                  <span>•</span>
                  <span>⚡ {tplCapacityKwp} kWp Sanctioned</span>
                </div>
              </div>
            </div>

            {/* Dossier Status & Action Buttons */}
            <div className="flex items-center space-x-3 flex-wrap gap-y-2 shrink-0">
              {/* Dossier Identifier Badge */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Dossier:</span>
                {loadingInstallation ? (
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin text-solar-500" />
                    <span>Loading...</span>
                  </span>
                ) : activeInstallation ? (
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-solar-500/15 text-solar-700 dark:text-solar-400 border border-solar-500/30 flex items-center space-x-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{activeInstallation.installationNumber}</span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25">
                    Pending Creation
                  </span>
                )}
              </div>

              {/* Stage Badge */}
              {activeInstallation && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  activeInstallation.status === 'APPROVED'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : activeInstallation.status === 'SUBMITTED'
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30'
                      : activeInstallation.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}>
                  {activeInstallation.status === 'APPROVED'
                    ? '✓ QA Approved & Commissioned'
                    : activeInstallation.status === 'SUBMITTED'
                      ? '⏳ Under Admin QA Review'
                      : activeInstallation.status === 'IN_PROGRESS'
                        ? '⚡ In Progress'
                        : '👷 Crew Assigned'}
                </span>
              )}

              {/* Photos Count Badge */}
              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border flex items-center space-x-1 ${
                mandatoryUploadedCount === PHOTO_SLOT_CONFIGS.length ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
              }`}>
                <Camera className="w-3.5 h-3.5" />
                <span>Photos: {mandatoryUploadedCount}/{PHOTO_SLOT_CONFIGS.length}</span>
              </span>

              {/* Lifecycle Actions */}
              {!activeInstallation ? (
                <button
                  type="button"
                  onClick={handleInitializeInstallation}
                  disabled={isSavingInstallation}
                  className="px-3.5 py-1.5 rounded-xl bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Create an inspection dossier for this beneficiary"
                >
                  {isSavingInstallation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>+ Start Inspection Record</span>
                </button>
              ) : (
                <>
                  {(activeInstallation.status === 'ASSIGNED' || activeInstallation.status === 'IN_PROGRESS') && (
                    <button
                      type="button"
                      onClick={handleSubmitForQaApproval}
                      disabled={isSubmittingApproval}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                      title="Submit completed rooftop installation and photos for Admin QA review"
                    >
                      {isSubmittingApproval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                      <span>Submit for QA</span>
                    </button>
                  )}

                  {activeInstallation.status === 'SUBMITTED' && (
                    <button
                      type="button"
                      onClick={handleApproveInstallation}
                      disabled={isReviewingApproval}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                      title="Approve installation report and certify commissioning"
                    >
                      {isReviewingApproval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Approve Installation</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

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
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Hook live GPS into all 4 slots"
                    >
                      {isLocatingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                      <span>📍 Geotag All</span>
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

                  {/* Single A4 Sheet Container (100% Matches sitepic.docx - Exactly 1 Page) */}
                  <div className="bg-slate-300 dark:bg-slate-900/90 p-2 sm:p-5 rounded-xl overflow-x-auto">
                    <div ref={documentPrintRef}>
                      <div
                        data-pdf-page="1"
                        className="bg-white text-slate-900 mx-auto w-full max-w-[800px] min-h-[1050px] p-6 sm:p-8 shadow-xl rounded-sm flex flex-col justify-between"
                        style={{
                          fontFamily: '"Times New Roman", Times, serif',
                          color: '#0f172a'
                        }}
                      >
                        <div>
                          {/* Document Header (Times New Roman, Bold, Underlined, Centered - Same to Same as sitepic.docx) */}
                          <div className="text-center border-b-2 border-slate-900 pb-3 mb-4 space-y-1">
                            <h2 className="text-base sm:text-xl font-black tracking-wide uppercase text-slate-950 underline decoration-2 underline-offset-4">
                              SITE PHOTOS AT {tplConsumerName || 'BENEFICIARY CONSUMER'}
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

                          {/* 4 Inspection Photos in a 2x2 Grid (Structure, Inverter, Net Meter, Earthing) */}
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
                        </div>

                        {/* Consumer & Vendor Signatures Footer */}
                        <div className="mt-6 pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-6 items-end">
                          <div className="space-y-1.5">
                            <p className="font-bold text-xs uppercase tracking-wide text-slate-900">CONSUMER / BENEFICIARY</p>
                            <p className="text-[11px] text-slate-600">I verify that the above solar plant photos are from my premises.</p>
                            <div className="pt-2 text-xs font-semibold text-slate-900 space-y-1">
                              <p><strong>Name:</strong> {tplConsumerName}</p>
                              <p className="pt-2"><strong>Signature:</strong> ____________________________</p>
                            </div>
                          </div>

                          <div className="space-y-1 text-right">
                            <p className="font-bold text-xs uppercase tracking-wide text-slate-900">CERTIFIED SOLAR VENDOR</p>
                            <p className="text-[11px] text-slate-600">For {tplVendorName}</p>
                            <div className="flex justify-end py-1">
                              <img src={RAREBOX_STAMP_BASE64} alt="Seal" className="w-20 h-20 object-contain" />
                            </div>
                            <p className="text-xs font-semibold text-slate-900">{tplVendorSignatory} ({tplVendorDesignation})</p>
                            <p className="text-[10px] text-slate-600">Ph: {tplVendorPhone}</p>
                          </div>
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
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer shadow-2xs"
                      title="Paste multiple barcodes at once"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-solar-600" />
                      <span>Bulk Paste Barcodes</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddSinglePanel}
                      className="px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Panel Row</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveEquipment}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
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
                    onClick={handleExportCsv}
                    className="text-xs text-solar-600 hover:underline font-semibold cursor-pointer inline-flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Barcode Register (CSV) &rarr;</span>
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

                {/* Stage 4 Next-Step Bridge: DISCOM Net Metering & BM Register */}
                <div className="p-4 bg-gradient-to-r from-solar-500/10 via-cyan-500/10 to-emerald-500/10 border border-solar-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-solar-500/20 text-solar-600 shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center space-x-2">
                        <span>Official EPC Next Step: DISCOM Net Metering &amp; BM Number</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-solar-500/20 text-solar-700 dark:text-solar-300">
                          Step 4
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Physical solar installation complete. Proceed to record Bi-directional Net Meter (BM) number, initial 0000 readings &amp; DISCOM JE testing.
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/net-metering"
                    className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span>Open Net Meter Register</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
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
                    Select Active Client for Workstation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Choose a client to view and update inspection photos, equipment barcodes, and handover docs
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
              {loadingCustomers ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-solar-500" />
                  <p className="text-xs">Loading customer directory...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-dashed">
                  No clients found matching &quot;{searchQuery}&quot;.
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
                            <span>Inspection Pending</span>
                            <span className="text-solar-600 font-semibold">+ New Record</span>
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
                  <span>Full Customer Directory &rarr;</span>
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
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Bulk Paste Barcodes</h3>
                  <p className="text-[10px] text-muted-foreground">Paste barcodes from packing list, shipping manifest, or scanner</p>
                </div>
              </div>
              <button onClick={() => setIsBulkPasteOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-muted-foreground">
                  Paste barcodes (one per line, comma, or semicolon):
                </label>
                {bulkBarcodeText.trim() && (
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      parseBarcodesFromText(bulkBarcodeText).length > 0
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-700 border border-amber-500/30'
                    }`}
                  >
                    ✓ {parseBarcodesFromText(bulkBarcodeText).length} Barcode(s) Detected
                  </span>
                )}
              </div>
              <textarea
                rows={7}
                value={bulkBarcodeText}
                onChange={e => setBulkBarcodeText(e.target.value)}
                placeholder={"984562315320\n984562315321\n984562315322\n..."}
                className="w-full p-3 text-xs bg-background border rounded-xl font-mono text-foreground focus:ring-2 focus:ring-solar-500"
              />

              {/* Live Preview Chips */}
              {parseBarcodesFromText(bulkBarcodeText).length > 0 && (
                <div className="p-2.5 bg-muted/40 rounded-xl border border-border/60 space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground flex justify-between items-center">
                    <span>
                      Detected Preview (first{' '}
                      {Math.min(5, parseBarcodesFromText(bulkBarcodeText).length)} of{' '}
                      {parseBarcodesFromText(bulkBarcodeText).length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkBarcodeText('')}
                      className="text-[10px] text-destructive hover:underline cursor-pointer"
                    >
                      Clear Text
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {parseBarcodesFromText(bulkBarcodeText)
                      .slice(0, 5)
                      .map((code, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono bg-card px-2 py-0.5 rounded border border-border text-foreground font-semibold flex items-center space-x-1"
                        >
                          <span className="text-muted-foreground font-normal">#{idx + 1}</span>
                          <span>{code}</span>
                        </span>
                      ))}
                    {parseBarcodesFromText(bulkBarcodeText).length > 5 && (
                      <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.5">
                        +{parseBarcodesFromText(bulkBarcodeText).length - 5} more...
                      </span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Trailing punctuation like dots (.), commas, or spaces are automatically sanitized. Codes are assigned sequentially to Panel #1, #2, etc. and marked as Verified.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkBarcodes}
                disabled={parseBarcodesFromText(bulkBarcodeText).length === 0}
                className="px-4 py-1.5 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  Apply {parseBarcodesFromText(bulkBarcodeText).length > 0 ? `(${parseBarcodesFromText(bulkBarcodeText).length}) ` : ''}Barcodes
                </span>
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
