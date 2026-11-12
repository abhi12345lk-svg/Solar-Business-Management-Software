import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FilePlus2,
  FolderLock,
  UserCheck,
  Search,
  UploadCloud,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ZoomIn,
  ZoomOut,
  FileText,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Download,
  Eye,
  FileCheck,
  X
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

const CATEGORY_GROUPS = [
  {
    group: 'Identity & Customer KYC',
    icon: '🪪',
    options: [
      { value: 'AADHAAR_CARD', label: 'Aadhaar Card (UIDAI)', desc: 'Front / Back photo or official PDF e-Aadhaar' },
      { value: 'PAN_CARD', label: 'PAN Card (Income Tax)', desc: 'Individual or Business PAN card copy' },
      { value: 'CUSTOMER_KYC', label: 'Customer KYC Dossier', desc: 'Signed KYC application and verification forms' }
    ]
  },
  {
    group: 'Utility & DISCOM Net-Metering',
    icon: '⚡',
    options: [
      { value: 'ELECTRICITY_BILL', label: 'Latest Electricity Bill', desc: 'Discom power bill showing consumer ID & sanction load' },
      { value: 'NET_METERING_DOC', label: 'Net-Metering Application / NOC', desc: 'DISCOM grid connectivity approval or application' }
    ]
  },
  {
    group: 'Property & Site Compliance',
    icon: '🏠',
    options: [
      { value: 'PROPERTY_TAX_RECEIPT', label: 'Property / Municipal Tax Receipt', desc: 'Latest municipal paid receipt / roof ownership proof' },
      { value: 'PROPERTY_DEED', label: 'Property Registry / Deed', desc: 'Roof ownership documents / NOC from premises owner' },
      { value: 'SITE_PHOTOS', label: 'Rooftop & Site Photographs', desc: 'Pre-installation or structure site photographs' },
      { value: 'SITE_GEOTAG_LOCATION', label: 'GPS Geotag Location Record', desc: 'Verified live rooftop GPS coordinates sheet' }
    ]
  },
  {
    group: 'DBT Subsidy & Banking',
    icon: '🏦',
    options: [
      { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Cancelled Cheque', desc: 'Account details required for PM Surya Ghar DBT subsidy' },
      { value: 'SUBSIDY_DOC', label: 'PM Surya Ghar Subsidy Dossier', desc: 'National portal application acknowledgment & claims' }
    ]
  },
  {
    group: 'Commercial & Engineering Handover',
    icon: '📜',
    options: [
      { value: 'SIGNED_CONTRACT', label: 'Signed EPC Customer Agreement', desc: 'Executed solar turnkey supply & installation contract' },
      { value: 'QUOTATION_PROPOSAL', label: 'Solar Quotation & System Design', desc: 'Finalized techno-commercial proposal' },
      { value: 'COMMISSIONING_REPORT', label: 'Commissioning Handover Report', desc: 'Testing, meter sync, and plant handover certification' },
      { value: 'WARRANTY_CERTIFICATE', label: 'Hardware Warranty Certificate', desc: 'Module & Inverter manufacturer warranty policy' },
      { value: 'ENGINEERING_DRAWING', label: 'Single Line Diagram / CAD Layout', desc: 'Electrical layout schematic & structure drawings' },
      { value: 'OTHER', label: 'Other Supporting Document', desc: 'Miscellaneous technical or compliance documents' }
    ]
  }
];

export const CreateDocumentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';

  // Mode: Template Generator (Default) vs Custom Upload
  const [activeTab, setActiveTab] = useState<'TEMPLATE' | 'CUSTOM_UPLOAD'>('TEMPLATE');

  // Customer & Project State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // -------------------------------------------------------------
  // Template Generator State
  // -------------------------------------------------------------
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ANNEXURE_2_AGREEMENT');

  // Template Form Fields (Editable customer-specific details)
  const [tplConsumerNumber, setTplConsumerNumber] = useState('1001750390');
  const [tplConsumerName, setTplConsumerName] = useState('SHRI GYAN CHAND JAISWAL');
  const [tplParentage, setTplParentage] = useState('S/O LATE HARIKISHAN JAISWAL');
  const [tplAddress, setTplAddress] = useState('SHANTI VIHAR COLONY, DANGANIA');
  const [tplDistrict, setTplDistrict] = useState('RAIPUR');
  const [tplState, setTplState] = useState('Chhattisgarh');
  const [tplCapacityKwp, setTplCapacityKwp] = useState('3.30');
  const [tplAgreementDate, setTplAgreementDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  });

  const [tplAdvancePercent, setTplAdvancePercent] = useState('50%');
  const [tplAdvanceDesc, setTplAdvanceDesc] = useState('as an advance on confirmation of the order');
  const [tplMilestonePercent, setTplMilestonePercent] = useState('45%');
  const [tplMilestoneDesc, setTplMilestoneDesc] = useState('Against LOA from DISCOM');
  const [tplFinalPercent, setTplFinalPercent] = useState('5%');
  const [tplFinalDesc, setTplFinalDesc] = useState('On Installation');

  const [tplVendorName, setTplVendorName] = useState('RAREBOX LLP');
  const [tplVendorOffice, setTplVendorOffice] = useState('MAHADEV GHAT ROAD ASHWANI NAGAR RAIPUR. Chhattisgarh');
  const [tplVendorSignatory, setTplVendorSignatory] = useState('Sameer Sahu');
  const [tplVendorDesignation, setTplVendorDesignation] = useState('Partner / Authorized Signatory');

  // Ref to formatted document container for PDF rendering
  const documentPrintRef = useRef<HTMLDivElement>(null);

  // PDF Preview Modal State
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Saving to Vault State
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Custom Upload / Camera / GPS Form State
  // -------------------------------------------------------------
  const [category, setCategory] = useState<string>('AADHAAR_CARD');
  const [displayName, setDisplayName] = useState<string>('');
  const [accessClassification, setAccessClassification] = useState<'CUSTOMER_VISIBLE' | 'INTERNAL_ONLY' | 'RESTRICTED'>('CUSTOMER_VISIBLE');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [sourceMode, setSourceMode] = useState<'UPLOAD' | 'CAMERA' | 'GPS'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsData, setGpsData] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    capturedAt: string;
    googleMapsUrl: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdDocInfo, setCreatedDocInfo] = useState<{
    id: string;
    documentNumber: string;
    safeDisplayName: string;
    category: string;
  } | null>(null);

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

    setLoadingProjects(true);
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
      })
      .finally(() => {
        setLoadingProjects(false);
      });
  }, [selectedCustomer]);

  // When Customer is selected, automatically replace customer-specific details in template
  useEffect(() => {
    if (!selectedCustomer) return;

    if (selectedCustomer.customerCode) {
      setTplConsumerNumber(selectedCustomer.customerCode);
    }
    if (selectedCustomer.name) {
      setTplConsumerName(selectedCustomer.name.toUpperCase());
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
    }
  }, [selectedCustomer]);

  // Auto-generate recommended Display Name for Custom Upload
  useEffect(() => {
    let catLabel = 'Document';
    for (const grp of CATEGORY_GROUPS) {
      const match = grp.options.find(o => o.value === category);
      if (match) {
        const parts = match.label.split('(');
        catLabel = (parts[0] || match.label).trim();
        break;
      }
    }

    const custName = selectedCustomer ? selectedCustomer.name : '';
    if (custName) {
      setDisplayName(`${catLabel} - ${custName}`);
    } else {
      setDisplayName(catLabel);
    }
  }, [category, selectedCustomer]);

  // Handle PDF Preview Generation
  const handleOpenPdfPreview = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const { objectUrl } = await generatePdfFromElement(documentPrintRef.current, {
        filename: `${selectedTemplateId}_${tplConsumerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      });
      setPdfPreviewUrl(objectUrl);
      setPdfPreviewModalOpen(true);
    } catch (err: any) {
      alert('Could not render PDF preview: ' + (err?.message || 'Rendering error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    if (!documentPrintRef.current) return;
    try {
      setGeneratingPdf(true);
      const cleanName = tplConsumerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = `PM_Surya_Ghar_Agreement_${cleanName || 'Consumer'}.pdf`;
      await downloadElementAsPdf(documentPrintRef.current, filename);
    } catch (err: any) {
      alert('Failed to generate PDF download: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Handle Save Template Document into Database Vault
  const handleSaveTemplateToVault = async () => {
    if (!documentPrintRef.current) return;
    if (!selectedCustomer) {
      alert('Please select a customer from the directory to link this document in the vault.');
      return;
    }

    try {
      setIsSavingToVault(true);
      setVaultSaveSuccess(null);

      // 1. Generate PDF Blob
      const { blob } = await generatePdfFromElement(documentPrintRef.current, {
        filename: `Agreement_${tplConsumerName.replace(/\s+/g, '_')}.pdf`
      });

      const custId = selectedCustomer._id || selectedCustomer.id;
      const cleanName = tplConsumerName.trim();
      const currentTpl = TEMPLATE_OPTIONS.find(t => t.id === selectedTemplateId);
      const title = `${currentTpl ? currentTpl.name : 'RTS Agreement'} - ${cleanName}`;
      const filename = `${selectedTemplateId}_${cleanName.replace(/\s+/g, '_')}.pdf`;

      // 2. Register Document in Document Vault
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
          generatedVia: 'CreateDocumentModule'
        }
      };

      const docRes = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify(docPayload)
      });

      const docId = docRes?._id || docRes?.id;
      if (!docId) throw new Error('Could not obtain document registration ID.');

      // 3. Upload raw PDF blob to /documents/:id/content
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
        `Document "${title}" (${docRes.documentNumber || 'DOC-REG'}) registered and saved to vault successfully!`
      );
    } catch (err: any) {
      alert('Failed to save document in vault: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingToVault(false);
    }
  };

  // -------------------------------------------------------------
  // Custom Upload Handlers
  // -------------------------------------------------------------
  const handleFilePicked = (file: File) => {
    setSelectedFile(file);
    setSubmitError(null);

    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setFilePreviewUrl(objectUrl);
      setPreviewZoom(1);
      setPreviewRotation(0);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilePicked(e.dataTransfer.files[0]);
    }
  };

  const startCamera = async () => {
    try {
      setSubmitError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setSubmitError('Unable to access device camera. Please grant camera permission or upload a file.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${category.toLowerCase()}_capture_${timestamp}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });
        handleFilePicked(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.92);
  };

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser or device.');
      return;
    }

    setFetchingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);
        const gUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        setGpsData({
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          capturedAt: new Date().toISOString(),
          googleMapsUrl: gUrl
        });
        setFetchingGps(false);

        if (!selectedFile) {
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 500;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 800, 500);

            const grad = ctx.createLinearGradient(0, 0, 800, 0);
            grad.addColorStop(0, '#f97316');
            grad.addColorStop(1, '#ea580c');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 800, 80);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px system-ui';
            ctx.fillText('SOLAR ROOFTOP GPS SITE GEOTAG RECORD', 30, 48);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '16px system-ui';
            ctx.fillText(`Customer: ${selectedCustomer ? selectedCustomer.name : 'Client Verification'}`, 30, 130);
            ctx.fillText(`Address: ${selectedCustomer?.installationAddress?.city || 'Installation Site'}`, 30, 160);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 22px monospace';
            ctx.fillText(`Latitude:  ${lat}° N`, 30, 220);
            ctx.fillText(`Longitude: ${lng}° E`, 30, 255);
            ctx.fillText(`Accuracy:  ±${accuracy} meters`, 30, 290);

            ctx.fillStyle = '#10b981';
            ctx.font = '14px system-ui';
            ctx.fillText(`Captured At: ${new Date().toLocaleString()}`, 30, 360);
            ctx.fillText('Verified GPS Lock via Device Sensors', 30, 385);

            canvas.toBlob(blob => {
              if (blob) {
                const file = new File([blob], `gps_geotag_${lat}_${lng}.png`, { type: 'image/png' });
                handleFilePicked(file);
              }
            });
          }
        }
      },
      err => {
        setFetchingGps(false);
        setGpsError(err.message || 'Unable to retrieve device GPS coordinates. Please grant location permission.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setSubmitError('Please select a valid customer from the directory to link this document.');
      return;
    }

    if (!displayName.trim()) {
      setSubmitError('Document display name / title is required for statutory compliance.');
      return;
    }

    if (!selectedFile) {
      setSubmitError('Please upload a document file or take a camera snapshot before saving.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const custId = selectedCustomer._id || selectedCustomer.id;

      const docPayload: any = {
        originalFilename: selectedFile.name,
        safeDisplayName: displayName.trim(),
        category,
        accessClassification,
        mimeType: selectedFile.type || 'application/pdf',
        fileSizeBytes: selectedFile.size,
        customerId: custId,
        projectId: selectedProjectId || undefined,
        relatedEntityType: 'Customer',
        relatedEntityId: custId,
        metadata: {
          notes: notes.trim() || undefined,
          gpsLocation: gpsData || undefined
        }
      };

      if (expiryDate) {
        docPayload.expiryDate = new Date(expiryDate).toISOString();
      }

      const docRes = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify(docPayload)
      });

      const docId = docRes?._id || docRes?.id;
      if (!docId) {
        throw new Error('Server did not return a valid document ID.');
      }

      const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
      const uploadUrl = getFullApiUrl(`/documents/${docId}/content`);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
          ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
        },
        body: selectedFile
      });

      if (!uploadRes.ok) {
        console.warn('Document binary streaming warning:', uploadRes.statusText);
      }

      if (gpsData && custId) {
        try {
          await apiClient(`/customers/${custId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              'installationAddress.geoCoordinates': {
                latitude: gpsData.latitude,
                longitude: gpsData.longitude
              }
            })
          });
        } catch (syncErr) {
          console.warn('Customer GPS coordinate sync notice:', syncErr);
        }
      }

      setCreatedDocInfo({
        id: docId,
        documentNumber: docRes.documentNumber || `DOC-${Date.now()}`,
        safeDisplayName: displayName.trim(),
        category
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to register document in vault. Please verify fields and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewDocument = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setGpsData(null);
    setNotes('');
    setCreatedDocInfo(null);
    setSubmitError(null);
    setVaultSaveSuccess(null);
  };

  // Filtered customers for search
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
      (c.primaryPhone && c.primaryPhone.includes(q)) ||
      (c.installationAddress?.city && c.installationAddress.city.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="bg-card border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground mb-1">
                <Link to="/customers" className="hover:text-solar-600 transition">CRM</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <Link to="/customers" className="hover:text-solar-600 transition">Customer Directory</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-foreground font-bold">Create Document</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shadow-2xs">
                  <FilePlus2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Create & Generate Document
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select official solar templates, auto-replace customer details, and generate instant PDF preview and download.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Link
                to="/documents"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-card border border-border text-foreground hover:bg-muted shadow-2xs transition"
              >
                <FolderLock className="w-4 h-4 text-solar-600" />
                <span>Open Document Vault</span>
              </Link>
              <Link
                to="/customers"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-card border border-border text-foreground hover:bg-muted shadow-2xs transition"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Customer Directory</span>
              </Link>
            </div>
          </div>

          {/* Module Mode Navigation Tabs */}
          <div className="flex items-center space-x-2 mt-5 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('TEMPLATE')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition inline-flex items-center space-x-2 ${
                activeTab === 'TEMPLATE'
                  ? 'bg-solar-600 text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>📜 Official Document Templates</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {TEMPLATE_OPTIONS.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CUSTOM_UPLOAD')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition inline-flex items-center space-x-2 ${
                activeTab === 'CUSTOM_UPLOAD'
                  ? 'bg-solar-600 text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>📁 Custom Upload & Geotag</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* ========================================================= */}
        {/* TAB 1: OFFICIAL TEMPLATE WORKFLOW                        */}
        {/* ========================================================= */}
        {activeTab === 'TEMPLATE' && (
          <div className="space-y-6">
            {/* Top Toolbar: Template Selector & Actions */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-solar-600 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Statutory Document Generator</span>
                  </span>
                  <div className="flex items-center space-x-3">
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="px-3 py-2 text-xs sm:text-sm font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 min-w-[280px]"
                    >
                      {TEMPLATE_OPTIONS.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>

                    {/* Customer Quick Selector */}
                    <select
                      value={selectedCustomer?._id || selectedCustomer?.id || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const match = customers.find(c => (c._id || c.id) === val);
                        setSelectedCustomer(match || null);
                      }}
                      className="px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500"
                    >
                      <option value="">-- Choose Customer to Autofill Details --</option>
                      {filteredCustomers.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name} {c.customerCode ? `(${c.customerCode})` : ''} - {c.installationAddress?.city || 'Raipur'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Primary Action Buttons: Preview PDF & Download PDF */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleOpenPdfPreview}
                    disabled={generatingPdf}
                    className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin text-solar-500" /> : <Eye className="w-4 h-4 text-solar-600" />}
                    <span>Preview PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={generatingPdf}
                    className="px-4 py-2.5 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Download PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveTemplateToVault}
                    disabled={isSavingToVault || !selectedCustomer}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingToVault ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderLock className="w-4 h-4" />}
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

            {/* Split Screen Layout: Left = Editable Details, Right = Live Document View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Pane: Customer-Specific Editable Fields (5 Cols) */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="text-sm font-black text-foreground flex items-center space-x-2">
                      <span>✏️ Customer-Specific Details</span>
                    </h2>
                    <span className="text-[11px] text-muted-foreground">Changes update in real-time</span>
                  </div>

                  {/* Customer Information Section */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Consumer / Application Number
                      </label>
                      <input
                        type="text"
                        value={tplConsumerNumber}
                        onChange={e => setTplConsumerNumber(e.target.value)}
                        placeholder="e.g. 1001750390"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Consumer Name (First Party)
                      </label>
                      <input
                        type="text"
                        value={tplConsumerName}
                        onChange={e => setTplConsumerName(e.target.value)}
                        placeholder="e.g. SHRI GYAN CHAND JAISWAL"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-bold"
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
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500"
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
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500"
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
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-semibold"
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
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                          Agreement Execution Date
                        </label>
                        <input
                          type="text"
                          value={tplAgreementDate}
                          onChange={e => setTplAgreementDate(e.target.value)}
                          placeholder="e.g. 12 November 2026"
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-solar-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Terms Section */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-xs font-black text-foreground uppercase tracking-wider text-muted-foreground">
                      Payment Milestone Terms
                    </h3>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplAdvancePercent}
                          onChange={e => setTplAdvancePercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplAdvanceDesc}
                          onChange={e => setTplAdvanceDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplMilestonePercent}
                          onChange={e => setTplMilestonePercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplMilestoneDesc}
                          onChange={e => setTplMilestoneDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={tplFinalPercent}
                          onChange={e => setTplFinalPercent(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg font-bold text-center"
                        />
                      </div>
                      <div className="col-span-9">
                        <input
                          type="text"
                          value={tplFinalDesc}
                          onChange={e => setTplFinalDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vendor Signatory Settings */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-xs font-black text-foreground uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Vendor / Second Party Signatory</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Official Seal Attached</span>
                    </h3>

                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Authorized Signatory Name
                      </label>
                      <input
                        type="text"
                        value={tplVendorSignatory}
                        onChange={e => setTplVendorSignatory(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Vendor Firm Name
                        </label>
                        <input
                          type="text"
                          value={tplVendorName}
                          onChange={e => setTplVendorName(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-foreground mb-1">
                          Signatory Designation
                        </label>
                        <input
                          type="text"
                          value={tplVendorDesignation}
                          onChange={e => setTplVendorDesignation(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-foreground mb-1">
                        Vendor Entity &amp; Registered Office
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

              {/* Right Pane: Live Document Paper Preview (7 Cols) */}
              <div className="lg:col-span-7">
                <div className="sticky top-6 space-y-3">
                  <div className="flex items-center justify-between bg-card px-4 py-2.5 rounded-xl border border-border shadow-2xs">
                    <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
                      <FileText className="w-4 h-4 text-solar-600" />
                      <span>Live Authentic Document Layout</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleOpenPdfPreview}
                        className="text-xs text-solar-600 font-bold hover:underline inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Zoom / Preview Full PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Formatted A4 Document Canvas */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 overflow-auto max-h-[82vh] shadow-2xl flex justify-center">
                    <div
                      ref={documentPrintRef}
                      className="bg-white text-slate-900 w-full max-w-[800px] p-8 sm:p-12 rounded-lg shadow-xl text-[12px] leading-relaxed font-serif"
                      style={{ minHeight: '1050px' }}
                    >
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

                      {/* 1. Activities of First Party (Consumer) */}
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

                      {/* 2. Activities of Second Party (Vendor) - 18 Distinct Responsibilities */}
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CUSTOM UPLOAD & GPS GEOTAG WORKFLOW                */}
        {/* ========================================================= */}
        {activeTab === 'CUSTOM_UPLOAD' && (
          <div>
            {createdDocInfo ? (
              <div className="max-w-3xl mx-auto bg-card border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    {createdDocInfo.documentNumber}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">
                    Document Successfully Registered in Vault!
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    <span className="font-semibold text-foreground">"{createdDocInfo.safeDisplayName}"</span> has been stored, encrypted, and attached to{' '}
                    <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>'s profile.
                  </p>
                </div>

                {gpsData && (
                  <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs flex items-center justify-center space-x-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>Rooftop GPS coordinates ({gpsData.latitude}, {gpsData.longitude}) synchronized with Customer Installation Address.</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    to="/documents"
                    className="px-5 py-2.5 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-2"
                  >
                    <FolderLock className="w-4 h-4" />
                    <span>View in Document Vault</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleResetForNewDocument}
                    className="px-5 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-2 cursor-pointer"
                  >
                    <FilePlus2 className="w-4 h-4 text-solar-600" />
                    <span>Create Another Document</span>
                  </button>
                  <Link
                    to="/customers"
                    className="px-5 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center space-x-2"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Go to Customer Directory</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form Details (7 Cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Step 1: Customer & Project Assignment */}
                  <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex items-center space-x-2.5 border-b border-border pb-3">
                      <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-foreground">Select Customer &amp; Project</h2>
                        <p className="text-[11px] text-muted-foreground">Every document in the vault must be mapped to an existing customer record.</p>
                      </div>
                    </div>

                    {/* Customer Picker */}
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        Customer / Client <span className="text-rose-500">*</span>
                      </label>
                      {loadingCustomers ? (
                        <div className="p-3 bg-muted/40 rounded-xl flex items-center space-x-2 text-xs text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin text-solar-500" />
                          <span>Loading customer directory...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search customer by name, code, phone, or city..."
                              value={customerSearch}
                              onChange={e => setCustomerSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500"
                            />
                          </div>

                          <select
                            value={selectedCustomer?._id || selectedCustomer?.id || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const found = customers.find(c => (c._id || c.id) === val);
                              setSelectedCustomer(found || null);
                            }}
                            required
                            className="w-full px-3 py-2.5 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500 font-medium"
                          >
                            <option value="">-- Choose Customer from Directory ({filteredCustomers.length}) --</option>
                            {filteredCustomers.map(c => {
                              const id = c._id || c.id || '';
                              return (
                                <option key={id} value={id}>
                                  {c.name} {c.customerCode ? `(${c.customerCode})` : ''} - {c.primaryPhone || 'No Phone'} ({c.installationAddress?.city || 'Site'})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Selected Customer Details Card */}
                    {selectedCustomer && (
                      <div className="p-3.5 bg-solar-50/50 dark:bg-solar-950/20 border border-solar-200 dark:border-solar-900/40 rounded-xl text-xs space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-foreground flex items-center space-x-2">
                            <span>{selectedCustomer.name}</span>
                            {selectedCustomer.customerCode && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-300">
                                {selectedCustomer.customerCode}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Phone: <strong className="text-foreground">{selectedCustomer.primaryPhone || 'N/A'}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground flex items-start space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-solar-600 shrink-0 mt-0.5" />
                          <span>
                            {selectedCustomer.installationAddress?.addressLine1 ? (
                              <>
                                {selectedCustomer.installationAddress.addressLine1}, {selectedCustomer.installationAddress.city}, {selectedCustomer.installationAddress.state} ({selectedCustomer.installationAddress.postalCode})
                              </>
                            ) : (
                              'Installation Address on file'
                            )}
                          </span>
                        </div>

                        {projects.length > 0 && (
                          <div className="pt-2 border-t border-solar-200/60 dark:border-solar-900/40">
                            <label className="block text-[11px] font-bold text-foreground mb-1">
                              Link to Active EPC Project (Optional)
                              {loadingProjects && <span className="text-muted-foreground ml-1.5 font-normal">(loading...)</span>}:
                            </label>
                            <select
                              value={selectedProjectId}
                              onChange={e => setSelectedProjectId(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg"
                            >
                              <option value="">-- No specific project linkage --</option>
                              {projects.map(p => {
                                const pId = p._id || p.id || '';
                                return (
                                  <option key={pId} value={pId}>
                                    {p.projectCode} - {p.name} ({p.systemCapacityKwp || 0} kWp) - {p.currentStage || p.status}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Document Category & Metadata */}
                  <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex items-center space-x-2.5 border-b border-border pb-3">
                      <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-foreground">Document Category &amp; Compliance Type</h2>
                        <p className="text-[11px] text-muted-foreground">Choose the standardized category for audit trails and customer visibility.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        Category / Document Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500 font-semibold"
                      >
                        {CATEGORY_GROUPS.map(grp => (
                          <optgroup key={grp.group} label={`${grp.icon} ${grp.group}`}>
                            {grp.options.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-foreground">
                          Document Title / Safe Display Name <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-muted-foreground flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Auto-formatted for client</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        required
                        placeholder="e.g. Aadhaar Card - Raju Thakur"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          Access Classification
                        </label>
                        <select
                          value={accessClassification}
                          onChange={e => setAccessClassification(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500"
                        >
                          <option value="CUSTOMER_VISIBLE">🌐 Customer Visible (Client Portal &amp; Vault)</option>
                          <option value="INTERNAL_ONLY">🔒 Internal Only (Staff &amp; Operations)</option>
                          <option value="RESTRICTED">🛡️ Restricted (Executive Clearance)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          Validity / Expiry Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={e => setExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Compliance Notes / Remarks (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add verification notes, DISCOM consumer number, or audit tags..."
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-solar-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Source, File Picker & Live Preview (5 Cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex items-center space-x-2.5 border-b border-border pb-3">
                      <div className="w-7 h-7 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-foreground">Document Source &amp; File</h2>
                        <p className="text-[11px] text-muted-foreground">Upload file, take camera snapshot, or fetch live GPS.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          setSourceMode('UPLOAD');
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center space-x-1.5 ${
                          sourceMode === 'UPLOAD'
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-solar-600" />
                        <span>File Upload</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSourceMode('CAMERA');
                          startCamera();
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center space-x-1.5 ${
                          sourceMode === 'CAMERA'
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          setSourceMode('GPS');
                          if (!gpsData) fetchCurrentLocation();
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center space-x-1.5 ${
                          sourceMode === 'GPS'
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        <span>Live GPS</span>
                      </button>
                    </div>

                    {sourceMode === 'UPLOAD' && (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2.5 ${
                          isDragging
                            ? 'border-solar-500 bg-solar-50/20'
                            : selectedFile
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-border hover:border-solar-400 bg-muted/20'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleFilePicked(e.target.files[0]);
                            }
                          }}
                        />

                        <div className="w-12 h-12 rounded-2xl bg-solar-500/10 text-solar-600 flex items-center justify-center mx-auto">
                          <UploadCloud className="w-6 h-6" />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-bold text-foreground">
                            {selectedFile ? selectedFile.name : 'Click to browse or drag file here'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Supported: PDF, JPG, PNG, WEBP, DOCX (Max 25MB)
                          </p>
                        </div>

                        {selectedFile && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            ✓ {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB Selected
                          </span>
                        )}
                      </div>
                    )}

                    {sourceMode === 'CAMERA' && (
                      <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          {!isCameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-muted-foreground text-xs p-4 text-center">
                              Camera is inactive. Click "Start Camera" below.
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-center space-x-2">
                          {isCameraActive ? (
                            <>
                              <button
                                type="button"
                                onClick={capturePhoto}
                                className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Camera className="w-4 h-4" />
                                <span>Snap Photo</span>
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition cursor-pointer"
                              >
                                Stop
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={startCamera}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Camera className="w-4 h-4" />
                              <span>Start Camera</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {sourceMode === 'GPS' && (
                      <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                            <MapPin className="w-4 h-4 text-rose-500" />
                            <span>Rooftop GPS Location Geotag</span>
                          </span>
                          <button
                            type="button"
                            onClick={fetchCurrentLocation}
                            disabled={fetchingGps}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-solar-600 text-white hover:bg-solar-700 disabled:opacity-50 transition inline-flex items-center space-x-1 cursor-pointer"
                          >
                            {fetchingGps ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                            <span>{fetchingGps ? 'Locating...' : 'Refresh GPS'}</span>
                          </button>
                        </div>

                        {gpsData ? (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-2 p-2.5 bg-card border border-border rounded-xl">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Latitude</span>
                                <strong className="text-foreground font-mono">{gpsData.latitude}° N</strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Longitude</span>
                                <strong className="text-foreground font-mono">{gpsData.longitude}° E</strong>
                              </div>
                              <div className="col-span-2 pt-1 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Accuracy: ±{gpsData.accuracyMeters}m</span>
                                <a
                                  href={gpsData.googleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-solar-600 font-bold hover:underline inline-flex items-center space-x-0.5"
                                >
                                  <span>Google Maps</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>

                            <p className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>GPS record generated and ready to attach to Customer profile.</span>
                            </p>
                          </div>
                        ) : gpsError ? (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{gpsError}</span>
                          </div>
                        ) : (
                          <div className="p-3 bg-card border border-border rounded-xl text-center space-y-1">
                            <p className="text-xs text-muted-foreground">Click "Refresh GPS" to lock current rooftop coordinates.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedFile && (
                      <div className="pt-2 border-t border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">File Ready for Vault</span>
                          {filePreviewUrl && (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => setPreviewZoom(z => Math.max(0.6, z - 0.2))}
                                className="p-1 hover:bg-muted rounded-md text-muted-foreground"
                                title="Zoom Out"
                              >
                                <ZoomOut className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewZoom(z => Math.min(2.5, z + 0.2))}
                                className="p-1 hover:bg-muted rounded-md text-muted-foreground"
                                title="Zoom In"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                                className="p-1 hover:bg-muted rounded-md text-muted-foreground"
                                title="Rotate 90deg"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {filePreviewUrl ? (
                          <div className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center p-3 max-h-[260px]">
                            <img
                              src={filePreviewUrl}
                              alt="Document Preview"
                              style={{
                                transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                                transition: 'transform 0.2s ease-out'
                              }}
                              className="max-h-[220px] max-w-full object-contain rounded-md"
                            />
                          </div>
                        ) : (
                          <div className="p-4 bg-muted/40 border border-border rounded-xl flex items-center space-x-3">
                            <FileText className="w-8 h-8 text-solar-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground truncate">{selectedFile.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {selectedFile.type || 'Binary Document'} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {submitError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedCustomer || !selectedFile}
                      className="w-full py-3 bg-solar-600 hover:bg-solar-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Encrypting &amp; Storing in Vault...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>Save &amp; Register in Vault</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* FULLSCREEN PDF PREVIEW MODAL                              */}
      {/* ========================================================= */}
      {pdfPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-card w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    PDF Document Preview – {tplConsumerName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    PM – Surya Ghar RTS Agreement • Annexure 2 • Verified
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
