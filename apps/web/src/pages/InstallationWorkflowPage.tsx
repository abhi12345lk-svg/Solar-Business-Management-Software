import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Camera,
  MapPin,
  Compass,
  QrCode,
  Plus,
  Trash2,
  X,
  FileText,
  RotateCw,
  Sun,
  Zap,
  Building,
  Check,
  ExternalLink,
  ShieldCheck,
  Layers,
  Search,
  Boxes
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import {
  SitePhotoCategory,
  TechnicalManualCategory
} from '@ins-solar/shared';

interface CustomerOption {
  _id: string;
  customerCode?: string;
  name?: string;
  companyName?: string;
  primaryPhone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface ProjectOption {
  _id: string;
  projectNumber: string;
  projectName: string;
  capacityKw: number;
}

interface EquipmentFormState {
  equipmentName: string;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  ratingCapacity: string;
  photoUrl?: string;
  remarks?: string;
}

interface InventoryItemState {
  sNo: number;
  equipmentName: string;
  barcode: string;
  serialNumber: string;
  model: string;
  quantity: number;
  status: string;
  notes?: string;
}

interface SitePhotoState {
  category: SitePhotoCategory;
  title: string;
  fileUrl: string;
  originalFilename: string;
  uploadedAt: string;
}

export const InstallationWorkflowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [installationId, setInstallationId] = useState<string | null>(id || null);
  const [installationNumber, setInstallationNumber] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Step 1: Customer Selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerProjects, setCustomerProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Step 2: Site & System Meta
  const [siteAddress, setSiteAddress] = useState({
    addressLine1: '',
    city: '',
    state: 'Chhattisgarh',
    pincode: '',
    landmark: ''
  });
  const [capacityKw, setCapacityKw] = useState<number>(5);
  const [installationDate, setInstallationDate] = useState<string>(
    new Date().toISOString().split('T')[0] || ''
  );
  const [siteNotes, setSiteNotes] = useState('');

  // Step 3-7: Equipment Details
  const [earthing, setEarthing] = useState<EquipmentFormState>({
    equipmentName: 'Chemical Earthing Pit & Electrode',
    equipmentType: 'EARTHING',
    brand: '',
    model: 'Copper Bonded Rod 3m',
    serialNumber: '',
    barcode: '',
    ratingCapacity: '< 5 Ohms',
    remarks: ''
  });

  const [structure, setStructure] = useState<EquipmentFormState>({
    equipmentName: 'Galvanized Solar Mounting Structure',
    equipmentType: 'STRUCTURE',
    brand: '',
    model: 'HDG 80 Micron Elevated',
    serialNumber: '',
    barcode: '',
    ratingCapacity: 'Tilt 21° / South Facing',
    remarks: ''
  });

  const [panelDetails, setPanelDetails] = useState({
    totalPanels: 10,
    panelManufacturer: 'Waaree Energies',
    panelModel: 'Bi-Facial Mono PERC 550W',
    panelWattage: 550,
    totalCalculatedKw: 5.5,
    serialNumbers: [''],
    barcodes: [''],
    remarks: ''
  });

  const [lightning, setLightning] = useState<EquipmentFormState>({
    equipmentName: 'ESE Lightning Arrester',
    equipmentType: 'LIGHTNING_PROTECTION',
    brand: '',
    model: 'Early Streamer Emission 60μs',
    serialNumber: '',
    barcode: '',
    ratingCapacity: 'Radius 60m Protection',
    remarks: ''
  });

  const [inverter, setInverter] = useState<EquipmentFormState>({
    equipmentName: 'Grid-Tied On-Grid Solar Inverter',
    equipmentType: 'INVERTER',
    brand: 'Growatt',
    model: 'MID 5KTL3-X',
    serialNumber: '',
    barcode: '',
    ratingCapacity: '5.0 kW / 3-Phase',
    remarks: ''
  });

  const [netMeter, setNetMeter] = useState<EquipmentFormState>({
    equipmentName: 'Bi-Directional Net Meter',
    equipmentType: 'NET_METER',
    brand: 'Secure Meters',
    model: 'Premier 300 3-Phase',
    serialNumber: '',
    barcode: '',
    ratingCapacity: 'Class 1.0 / Whole Current',
    remarks: ''
  });

  // Step 8: Dynamic Inventory Table & Barcode Scanner
  const [inventory, setInventory] = useState<InventoryItemState[]>([
    {
      sNo: 1,
      equipmentName: 'Solar PV Modules (550W)',
      barcode: '',
      serialNumber: '',
      model: 'Bi-Facial 550W',
      quantity: 10,
      status: 'VERIFIED',
      notes: ''
    },
    {
      sNo: 2,
      equipmentName: 'Solar Inverter (5kW)',
      barcode: '',
      serialNumber: '',
      model: 'MID 5KTL3-X',
      quantity: 1,
      status: 'VERIFIED',
      notes: ''
    },
    {
      sNo: 3,
      equipmentName: 'Chemical Earthing Rods',
      barcode: '',
      serialNumber: '',
      model: 'Copper Bonded 3m',
      quantity: 3,
      status: 'VERIFIED',
      notes: ''
    }
  ]);

  // Barcode Scanner Modal State
  const [activeBarcodeRowIndex, setActiveBarcodeRowIndex] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [videoStreamActive, setVideoStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Step 9: Site Photographs (10 Categories)
  const [photos, setPhotos] = useState<SitePhotoState[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<string | null>(null);

  // Step 10: GPS Location Capture
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    capturedAt?: string;
  } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Step 11: Technical Manuals
  const [manuals, setManuals] = useState<Array<{
    category: TechnicalManualCategory;
    title: string;
    fileUrl: string;
    fileName: string;
  }>>([]);
  const [isUploadingManual, setIsUploadingManual] = useState(false);
  const [manualCategory, setManualCategory] = useState<TechnicalManualCategory>(
    TechnicalManualCategory.INVERTER_MANUAL
  );
  const [manualTitle, setManualTitle] = useState('');

  // Initial load if editing existing installation
  useEffect(() => {
    if (id) {
      loadExistingInstallation(id);
    }
  }, [id]);

  // Load existing customers on mount
  useEffect(() => {
    apiClient<{ items: CustomerOption[] }>('/customers?limit=50')
      .then(res => {
        if (res?.items) setCustomers(res.items);
      })
      .catch(err => console.error('Failed to load customers:', err));
  }, []);

  const loadExistingInstallation = async (instId: string) => {
    try {
      setIsLoading(true);
      const inst = await apiClient<any>(`/installations/${instId}`);
      if (inst) {
        setInstallationId(inst._id);
        setInstallationNumber(inst.installationNumber);
        setCurrentStep(inst.currentStep || 1);
        setSelectedCustomer({
          _id: inst.customerId,
          customerCode: inst.customerCode,
          name: inst.customerName,
          primaryPhone: inst.customerPhone
        });
        setSelectedProjectId(inst.projectId || '');
        setSiteAddress({
          addressLine1: inst.siteAddress?.addressLine1 || '',
          city: inst.siteAddress?.city || '',
          state: inst.siteAddress?.state || 'Chhattisgarh',
          pincode: inst.siteAddress?.pincode || '',
          landmark: inst.siteAddress?.landmark || ''
        });
        setCapacityKw(inst.capacityKw || 5);
        if (inst.installationDate) {
          setInstallationDate(inst.installationDate.split('T')[0]);
        }
        if (inst.equipment) {
          if (inst.equipment.earthing) setEarthing(inst.equipment.earthing);
          if (inst.equipment.structure) setStructure(inst.equipment.structure);
          if (inst.equipment.lightningProtection) setLightning(inst.equipment.lightningProtection);
          if (inst.equipment.inverter) setInverter(inst.equipment.inverter);
          if (inst.equipment.netMeter) setNetMeter(inst.equipment.netMeter);
        }
        if (inst.panelDetails) {
          setPanelDetails(inst.panelDetails);
        }
        if (inst.inventory) {
          setInventory(inst.inventory);
        }
        if (inst.photos) {
          setPhotos(inst.photos);
        }
        if (inst.gpsLocation) {
          setGpsLocation(inst.gpsLocation);
        }
        if (inst.manuals) {
          setManuals(inst.manuals);
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to load installation details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate Total Installed Capacity when panel count or wattage changes
  useEffect(() => {
    const totalWatts = (panelDetails.totalPanels || 0) * (panelDetails.panelWattage || 0);
    const calculatedKw = Number((totalWatts / 1000).toFixed(2));
    setPanelDetails(prev => ({ ...prev, totalCalculatedKw: calculatedKw }));
    setCapacityKw(calculatedKw);
  }, [panelDetails.totalPanels, panelDetails.panelWattage]);

  // Handle customer select
  const handleSelectCustomer = async (cust: CustomerOption) => {
    setSelectedCustomer(cust);
    if (cust.address) {
      setSiteAddress({
        addressLine1: cust.address.street || '',
        city: cust.address.city || '',
        state: cust.address.state || 'Chhattisgarh',
        pincode: cust.address.pincode || '',
        landmark: ''
      });
    }

    // Try to load any linked projects for this customer
    try {
      const res = await apiClient<{ items: ProjectOption[] }>(`/projects?customerId=${cust._id}`);
      if (res?.items && res.items.length > 0 && res.items[0]) {
        const firstProj = res.items[0];
        setCustomerProjects(res.items);
        setSelectedProjectId(firstProj._id);
        if (firstProj.capacityKw) {
          setCapacityKw(firstProj.capacityKw);
        }
      } else {
        setCustomerProjects([]);
        setSelectedProjectId('');
      }
    } catch {
      setCustomerProjects([]);
    }
  };

  // Save Draft to Backend
  const saveDraft = async (stepToSet?: number) => {
    if (!selectedCustomer) {
      alert('Please select a customer first before saving.');
      return null;
    }

    try {
      setIsSaving(true);
      const payload = {
        customerId: selectedCustomer._id,
        projectId: selectedProjectId || undefined,
        siteAddress,
        capacityKw,
        installationDate: installationDate || undefined,
        currentStep: stepToSet !== undefined ? stepToSet : currentStep,
        equipment: {
          earthing,
          structure,
          panels: {
            ...earthing,
            equipmentName: 'Solar PV Modules',
            equipmentType: 'PANELS',
            brand: panelDetails.panelManufacturer,
            model: panelDetails.panelModel,
            ratingCapacity: `${panelDetails.totalCalculatedKw} kW`,
            remarks: panelDetails.remarks
          },
          lightningProtection: lightning,
          inverter,
          netMeter
        },
        panelDetails,
        inventory,
        gpsLocation: gpsLocation || undefined
      };

      let saved: any;
      if (installationId) {
        saved = await apiClient(`/installations/${installationId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        saved = await apiClient('/installations', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setInstallationId(saved._id);
        setInstallationNumber(saved.installationNumber);
      }

      setSaveSuccessMsg('Installation draft auto-saved');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      return saved;
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      alert(err?.message || 'Error saving installation draft.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Step Navigation
  const handleNextStep = async () => {
    if (currentStep === 1 && !selectedCustomer) {
      alert('Please select an existing customer to proceed.');
      return;
    }

    const nextStep = currentStep + 1;
    await saveDraft(nextStep);
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // GPS Location Handler
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy),
          capturedAt: new Date().toISOString()
        };
        setGpsLocation(coords);
        setIsCapturingGps(false);
      },
      err => {
        setIsCapturingGps(false);
        setGpsError(`Location error: ${err.message}. Please enable location permissions.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Site Photograph Upload Handler
  const handlePhotoUpload = async (category: SitePhotoCategory, file: File) => {
    let currentInstId = installationId;
    if (!currentInstId) {
      const saved = await saveDraft();
      if (!saved?._id) return;
      currentInstId = saved._id;
    }

    try {
      setIsUploadingPhoto(category);
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('category', category);
      formData.append('title', category.replace(/_/g, ' '));
      if (gpsLocation) {
        formData.append('latitude', String(gpsLocation.latitude));
        formData.append('longitude', String(gpsLocation.longitude));
        if (gpsLocation.accuracyMeters) {
          formData.append('accuracyMeters', String(gpsLocation.accuracyMeters));
        }
      }

      const res = await apiClient<SitePhotoState>(
        `/installations/${currentInstId}/photos`,
        {
          method: 'POST',
          body: formData
        }
      );

      setPhotos(prev => {
        const filtered = prev.filter(p => p.category !== category);
        return [...filtered, res];
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(null);
    }
  };

  // Technical Manual Upload Handler
  const handleManualUpload = async (file: File) => {
    let currentInstId = installationId;
    if (!currentInstId) {
      const saved = await saveDraft();
      if (!saved?._id) return;
      currentInstId = saved._id;
    }

    try {
      setIsUploadingManual(true);
      const formData = new FormData();
      formData.append('manual', file);
      formData.append('category', manualCategory);
      formData.append('title', manualTitle || manualCategory.replace(/_/g, ' '));

      const res = await apiClient<any>(`/installations/${currentInstId}/manuals`, {
        method: 'POST',
        body: formData
      });

      setManuals(prev => [...prev, res]);
      setManualTitle('');
    } catch (err: any) {
      alert(err?.message || 'Failed to upload technical manual.');
    } finally {
      setIsUploadingManual(false);
    }
  };

  // Barcode Camera Scanner Simulator / Native BarcodeDetector
  const startCameraScanner = async (rowIndex: number) => {
    setActiveBarcodeRowIndex(rowIndex);
    setManualBarcodeInput('');
    setScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setVideoStreamActive(true);
      }
    } catch (err) {
      console.warn('Camera feed not available or denied, fallback to manual entry:', err);
      setVideoStreamActive(false);
    }
  };

  const stopCameraScanner = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoStreamActive(false);
    setScannerOpen(false);
    setActiveBarcodeRowIndex(null);
  };

  const applyScannedBarcode = (code: string) => {
    if (activeBarcodeRowIndex === null) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    // Duplicate check
    const isDuplicate = inventory.some(
      (item, idx) => idx !== activeBarcodeRowIndex && item.barcode.toUpperCase() === trimmed.toUpperCase()
    );

    if (isDuplicate) {
      alert(`Barcode '${trimmed}' is already scanned for another item in this installation!`);
      return;
    }

    setInventory(prev =>
      prev.map((row, idx) =>
        idx === activeBarcodeRowIndex
          ? { ...row, barcode: trimmed, serialNumber: row.serialNumber || trimmed }
          : row
      )
    );

    stopCameraScanner();
  };

  // Final Submission to Admin QA
  const handleSubmitInstallation = async () => {
    if (photos.length === 0) {
      alert('At least 1 site photograph is required before submitting the installation report.');
      return;
    }

    if (!window.confirm('Submit this solar installation report for Admin QA verification and approval?')) {
      return;
    }

    try {
      setIsSaving(true);
      await saveDraft(11);
      await apiClient(`/installations/${installationId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Installation report submitted for administrative review & approval'
        })
      });

      alert('Installation report submitted successfully!');
      navigate(`/installations/${installationId}`);
    } catch (err: any) {
      alert(err?.message || 'Submission failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const stepLabels = [
    'Customer',
    'Site Info',
    'Earthing',
    'Structure',
    'Panels',
    'Inverter & SPD',
    'Metering',
    'Inventory Barcodes',
    '10 Site Photos',
    'GPS Location',
    'Review & Submit'
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RotateCw className="w-8 h-8 animate-spin text-solar-500" />
        <p className="text-sm font-semibold text-slate-600">Loading installation wizard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link
            to="/installations"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-solar-700 bg-solar-50 px-2 py-0.5 rounded-md border border-solar-200">
                {installationNumber || 'NEW INSTALLATION'}
              </span>
              <span className="text-xs text-slate-400">• Step {currentStep} of 11</span>
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {stepLabels[currentStep - 1]} — Field Installation Wizard
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {saveSuccessMsg && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center">
              <Check className="w-3.5 h-3.5 mr-1" />
              {saveSuccessMsg}
            </span>
          )}
          <button
            type="button"
            onClick={() => saveDraft()}
            disabled={isSaving || !selectedCustomer}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {/* Wizard Progress Ribbon */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[720px] px-2">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div
                key={stepNum}
                onClick={() => {
                  if (selectedCustomer && stepNum <= currentStep) {
                    setCurrentStep(stepNum);
                  }
                }}
                className={`flex flex-col items-center cursor-pointer transition ${
                  isCurrent
                    ? 'text-solar-700 font-bold'
                    : isCompleted
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition ${
                    isCurrent
                      ? 'bg-solar-600 text-white ring-4 ring-solar-100'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className="text-[10px] whitespace-nowrap">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Container Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        {/* STEP 1: SELECT EXISTING CUSTOMER */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Building className="w-5 h-5 mr-2 text-solar-600" />
                Step 1: Link Existing Customer & Project
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Search and select an existing solar client from your customer database. All contact details and rooftop site address will be synchronized automatically.
              </p>
            </div>

            {/* Customer Search */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Search Registered Solar Clients *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Type customer name, mobile number, code, or city..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              {/* Matching Customers Dropdown / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pt-2">
                {customers
                  .filter(c => {
                    if (!customerSearch.trim()) return true;
                    const q = customerSearch.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(q) ||
                      c.companyName?.toLowerCase().includes(q) ||
                      c.customerCode?.toLowerCase().includes(q) ||
                      c.primaryPhone?.includes(q) ||
                      c.address?.city?.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 8)
                  .map(cust => {
                    const isSelected = selectedCustomer?._id === cust._id;
                    return (
                      <div
                        key={cust._id}
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-solar-50/80 border-solar-500 ring-2 ring-solar-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {cust.name || cust.companyName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {cust.customerCode || 'ID'} • {cust.primaryPhone || 'No phone'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {cust.address?.city || 'Site'}, {cust.address?.state || 'CG'}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-solar-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-slate-300" />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Selected Customer Preview */}
            {selectedCustomer && (
              <div className="p-4 bg-solar-50/50 rounded-xl border border-solar-200 space-y-3">
                <span className="text-[11px] font-bold text-solar-800 uppercase tracking-wider block">
                  ✓ Selected Solar Client
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Client Name</span>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.name || selectedCustomer.companyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Contact Phone</span>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.primaryPhone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">City & State</span>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.address?.city || 'Raipur'}, {selectedCustomer.address?.state || 'CG'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Linked Project</span>
                    <span className="font-bold text-slate-900">
                      {customerProjects.length > 0 && customerProjects[0]
                        ? customerProjects[0].projectName
                        : 'Standalone EPC'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SITE & INSTALLATION INFO */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-solar-600" />
                Step 2: Rooftop Site Address & Installation Schedule
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify the exact installation address, planned system capacity in kW, and execution date.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Installation Address Line *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Plot/House No., Street Name, Landmark..."
                  value={siteAddress.addressLine1}
                  onChange={e => setSiteAddress({ ...siteAddress, addressLine1: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  City / District *
                </label>
                <input
                  type="text"
                  required
                  value={siteAddress.city}
                  onChange={e => setSiteAddress({ ...siteAddress, city: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  State / UT *
                </label>
                <input
                  type="text"
                  required
                  value={siteAddress.state}
                  onChange={e => setSiteAddress({ ...siteAddress, state: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Postal PIN Code *
                </label>
                <input
                  type="text"
                  required
                  value={siteAddress.pincode}
                  onChange={e => setSiteAddress({ ...siteAddress, pincode: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Installation Date
                </label>
                <input
                  type="date"
                  value={installationDate}
                  onChange={e => setInstallationDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Site Landmark / Access Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Near Shiv Mandir, rooftop access via internal spiral staircase..."
                  value={siteNotes}
                  onChange={e => setSiteNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EARTHING SYSTEM */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-amber-500" />
                Step 3: Earthing System Equipment Details (Section A)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record the chemical earthing electrode specifications, measured resistance value, and pit details.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Earthing Brand / Make *
                </label>
                <input
                  type="text"
                  placeholder="e.g. True Power, Ashlok, Marconite"
                  value={earthing.brand}
                  onChange={e => setEarthing({ ...earthing, brand: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Electrode Model & Length
                </label>
                <input
                  type="text"
                  placeholder="e.g. Copper Bonded 3 Meter / 17.2mm"
                  value={earthing.model}
                  onChange={e => setEarthing({ ...earthing, model: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pit Resistance Value (Ohms)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1.8 Ohms (Must be < 5 Ohms)"
                  value={earthing.ratingCapacity}
                  onChange={e => setEarthing({ ...earthing, ratingCapacity: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Electrode Serial / Batch Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ERT-2026-88192"
                  value={earthing.serialNumber}
                  onChange={e => setEarthing({ ...earthing, serialNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Earthing Installation Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 3 dedicated pits installed (AC, DC, Lightning). BFC compound filled."
                  value={earthing.remarks}
                  onChange={e => setEarthing({ ...earthing, remarks: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SOLAR STRUCTURE */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Layers className="w-5 h-5 mr-2 text-blue-600" />
                Step 4: Solar Structure Component Details (Section B)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record mounting structure type, tilt angle, azimuth alignment, and galvanization grade.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Structure Type / Make *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hot Dip Galvanized (HDG) Rooftop Elevated"
                  value={structure.brand}
                  onChange={e => setStructure({ ...structure, brand: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Structure Model / Profile
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4-Leg Heavy Duty C-Channel 80 Micron"
                  value={structure.model}
                  onChange={e => setStructure({ ...structure, model: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tilt Angle & Azimuth
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tilt 21° South Facing"
                  value={structure.ratingCapacity}
                  onChange={e => setStructure({ ...structure, ratingCapacity: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Batch / Structure ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. STR-HDG-2026-004"
                  value={structure.serialNumber}
                  onChange={e => setStructure({ ...structure, serialNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mounting Remarks & Wind Resistance
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fastened with M12 chemical anchor bolts into RCC roof slab. Designed for 150 km/h wind load."
                  value={structure.remarks}
                  onChange={e => setStructure({ ...structure, remarks: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SOLAR PANELS QUANTITY & CAPACITY CALCULATION */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Sun className="w-5 h-5 mr-2 text-solar-600" />
                Step 5: Solar Panel Quantity & Automatic kW Calculation (Section C)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter total installed solar modules and individual panel wattage. Total system kW is automatically calculated.
              </p>
            </div>

            {/* Live Calculation Banner */}
            <div className="bg-gradient-to-r from-solar-50 via-amber-50 to-orange-50 p-5 rounded-2xl border border-solar-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-solar-800">
                  Total Installed System Capacity
                </span>
                <div className="text-3xl font-black text-slate-900 mt-0.5">
                  {panelDetails.totalCalculatedKw} kW
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Formula: {panelDetails.totalPanels} Panels × {panelDetails.panelWattage}W ={' '}
                  <span className="font-bold text-solar-700">{panelDetails.totalCalculatedKw} kW</span>
                </div>
              </div>

              <div className="bg-white px-5 py-3 rounded-xl border border-solar-200 shadow-2xs text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Grid Export Rating
                </span>
                <span className="text-base font-black text-slate-800">
                  {panelDetails.totalCalculatedKw} kW Solar PV
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Total Number of Installed Panels *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={panelDetails.totalPanels}
                  onChange={e =>
                    setPanelDetails({ ...panelDetails, totalPanels: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Wattage per Panel (Watts) *
                </label>
                <input
                  type="number"
                  min={100}
                  step={5}
                  required
                  value={panelDetails.panelWattage}
                  onChange={e =>
                    setPanelDetails({ ...panelDetails, panelWattage: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Panel Manufacturer / Brand *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Waaree, Tata Power Solar, Vikram Solar, Adani"
                  value={panelDetails.panelManufacturer}
                  onChange={e => setPanelDetails({ ...panelDetails, panelManufacturer: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Panel Model / Series
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bi-Facial Dual Glass Mono PERC"
                  value={panelDetails.panelModel}
                  onChange={e => setPanelDetails({ ...panelDetails, panelModel: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Panel Installation Remarks & Orientation
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 2 strings of 5 panels each connected in series. 100% shadow-free placement."
                  value={panelDetails.remarks}
                  onChange={e => setPanelDetails({ ...panelDetails, remarks: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: LIGHTNING PROTECTION & INVERTER */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                Step 6: Lightning Protection & Solar Inverter (Sections D & E)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record the surge protection device / lightning arrester and inverter serial numbers and ratings.
              </p>
            </div>

            {/* Lightning Arrester */}
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-4">
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">
                Section D: Lightning Protection System
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Arrester Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. ESE Early Streamer"
                    value={lightning.brand}
                    onChange={e => setLightning({ ...lightning, brand: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Model / Radius</label>
                  <input
                    type="text"
                    placeholder="e.g. 60m Protection Radius"
                    value={lightning.model}
                    onChange={e => setLightning({ ...lightning, model: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. LA-2026-991"
                    value={lightning.serialNumber}
                    onChange={e => setLightning({ ...lightning, serialNumber: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Solar Inverter */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-4">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                Section E: Solar Inverter Details
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Inverter Brand / Make *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Growatt, Sungrow, Sofar, Solis, Polycab"
                    value={inverter.brand}
                    onChange={e => setInverter({ ...inverter, brand: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Inverter Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MID 5KTL3-X Dual MPPT"
                    value={inverter.model}
                    onChange={e => setInverter({ ...inverter, model: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Inverter Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GRW5K202609012"
                    value={inverter.serialNumber}
                    onChange={e => setInverter({ ...inverter, serialNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rated Output (kW / Phase)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5.0 kW / 3-Phase 415V"
                    value={inverter.ratingCapacity}
                    onChange={e => setInverter({ ...inverter, ratingCapacity: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: METERING & WIRING */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-emerald-600" />
                Step 7: Net Meter / Generation Meter & Wiring Details (Section F)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record DISCOM bi-directional net meter serial number, CT rating, and AC/DC wiring cross-sections.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meter Make / Brand
                </label>
                <input
                  type="text"
                  placeholder="e.g. Secure Meters, L&T, Genus, Schneider"
                  value={netMeter.brand}
                  onChange={e => setNetMeter({ ...netMeter, brand: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meter Model & Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premier 300 Bi-Directional 3-Phase"
                  value={netMeter.model}
                  onChange={e => setNetMeter({ ...netMeter, model: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meter Serial Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEC-NM-2026-904"
                  value={netMeter.serialNumber}
                  onChange={e => setNetMeter({ ...netMeter, serialNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meter Class & Accuracy
                </label>
                <input
                  type="text"
                  placeholder="e.g. Class 1.0s / 10-60A"
                  value={netMeter.ratingCapacity}
                  onChange={e => setNetMeter({ ...netMeter, ratingCapacity: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  DC & AC Wiring Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. DC Cable: 4 sq mm solar copper cable in UV conduit. AC Cable: 4 sq mm 4-Core copper armored cable."
                  value={netMeter.remarks}
                  onChange={e => setNetMeter({ ...netMeter, remarks: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: INVENTORY TABLE & BARCODE SCANNER */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center">
                  <Boxes className="w-5 h-5 mr-2 text-solar-600" />
                  Step 8: Equipment Inventory Table & Barcode Scanner
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan equipment barcodes using mobile camera or enter manually. Duplicate barcodes are automatically detected.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newRow: InventoryItemState = {
                    sNo: inventory.length + 1,
                    equipmentName: 'New Component',
                    barcode: '',
                    serialNumber: '',
                    model: '',
                    quantity: 1,
                    status: 'VERIFIED'
                  };
                  setInventory([...inventory, newRow]);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Equipment Row</span>
              </button>
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">S.No.</th>
                    <th className="px-3 py-2.5">Equipment Name</th>
                    <th className="px-3 py-2.5">Barcode / Scan</th>
                    <th className="px-3 py-2.5">Serial Number</th>
                    <th className="px-3 py-2.5">Model</th>
                    <th className="px-3 py-2.5">Qty</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.equipmentName}
                          onChange={e =>
                            setInventory(
                              inventory.map((r, i) =>
                                i === idx ? { ...r, equipmentName: e.target.value } : r
                              )
                            )
                          }
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            placeholder="Barcode..."
                            value={row.barcode}
                            onChange={e =>
                              setInventory(
                                inventory.map((r, i) =>
                                  i === idx ? { ...r, barcode: e.target.value } : r
                                )
                              )
                            }
                            className="w-28 sm:w-36 px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg text-solar-700 font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => startCameraScanner(idx)}
                            className="p-1.5 bg-solar-50 hover:bg-solar-100 text-solar-700 rounded-lg border border-solar-200 transition"
                            title="Scan with Camera"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Serial No..."
                          value={row.serialNumber}
                          onChange={e =>
                            setInventory(
                              inventory.map((r, i) =>
                                i === idx ? { ...r, serialNumber: e.target.value } : r
                              )
                            )
                          }
                          className="w-28 sm:w-36 px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Model..."
                          value={row.model}
                          onChange={e =>
                            setInventory(
                              inventory.map((r, i) => (i === idx ? { ...r, model: e.target.value } : r))
                            )
                          }
                          className="w-24 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={e =>
                            setInventory(
                              inventory.map((r, i) =>
                                i === idx ? { ...r, quantity: parseInt(e.target.value, 10) || 1 } : r
                              )
                            )
                          }
                          className="w-14 px-2 py-1 text-xs font-bold text-center bg-white border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setInventory(inventory.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barcode Scanner Modal */}
            {scannerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-solar-50 text-solar-600 rounded-xl">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Scan Equipment Barcode / QR</h4>
                        <p className="text-[11px] text-slate-400">
                          Row {activeBarcodeRowIndex !== null ? activeBarcodeRowIndex + 1 : 1}:{' '}
                          {activeBarcodeRowIndex !== null
                            ? inventory[activeBarcodeRowIndex]?.equipmentName
                            : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={stopCameraScanner}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Camera Video Feed */}
                  <div className="relative aspect-4/3 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!videoStreamActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <Camera className="w-8 h-8 mb-2 text-slate-500" />
                        <span className="text-xs">Camera preview active on mobile</span>
                        <span className="text-[10px] text-slate-500 mt-1">
                          Or enter the barcode directly below
                        </span>
                      </div>
                    )}
                    {/* Targeting reticle */}
                    <div className="absolute inset-8 border-2 border-solar-500/60 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="w-full h-0.5 bg-solar-500 animate-pulse" />
                    </div>
                  </div>

                  {/* Manual entry fallback */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Or Enter / Paste Barcode Manually
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Scan or type barcode string..."
                        value={manualBarcodeInput}
                        onChange={e => setManualBarcodeInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyScannedBarcode(manualBarcodeInput);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => applyScannedBarcode(manualBarcodeInput)}
                        disabled={!manualBarcodeInput.trim()}
                        className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 9: 10 SITE PHOTOGRAPHS */}
        {currentStep === 9 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center">
                  <Camera className="w-5 h-5 mr-2 text-solar-600" />
                  Step 9: Upload Site Photographs (Max 10 Categories)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Capture clear site photos directly via phone camera or upload files. Maximum 10 photos per installation.
                </p>
              </div>

              <span className="px-3 py-1 bg-solar-50 text-solar-700 text-xs font-bold rounded-xl border border-solar-200 font-mono self-start sm:self-auto">
                {photos.length} / 10 Photos Uploaded
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {Object.values(SitePhotoCategory).map((category, idx) => {
                const existingPhoto = photos.find(p => p.category === category);
                const isUploading = isUploadingPhoto === category;
                const label = category.replace(/_/g, ' ');

                return (
                  <div
                    key={category}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs"
                  >
                    <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 truncate" title={label}>
                        {idx + 1}. {label}
                      </span>
                      {existingPhoto ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>

                    <div className="aspect-4/3 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                      {isUploading ? (
                        <div className="flex flex-col items-center justify-center text-white space-y-1">
                          <RotateCw className="w-6 h-6 animate-spin text-solar-500" />
                          <span className="text-[10px]">Uploading...</span>
                        </div>
                      ) : existingPhoto ? (
                        <img
                          src={existingPhoto.fileUrl}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-3 text-slate-500">
                          <Camera className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                          <span className="text-[10px]">Tap to Capture</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex items-center justify-between bg-white border-t border-slate-100 text-[11px]">
                      <label className="w-full text-center py-1.5 bg-solar-50 hover:bg-solar-100 text-solar-700 font-bold rounded-lg border border-solar-200 cursor-pointer transition flex items-center justify-center space-x-1">
                        <Upload className="w-3 h-3" />
                        <span>{existingPhoto ? 'Replace' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files?.[0]) {
                              handlePhotoUpload(category, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 10: LIVE GPS LOCATION */}
        {currentStep === 10 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Compass className="w-5 h-5 mr-2 text-emerald-600" />
                Step 10: Capture Live Site GPS Location
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Capture the verified hardware GPS coordinates of the customer rooftop installation site using device geolocation permissions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Device Hardware GPS
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click the button below to retrieve real-time latitude, longitude, and accuracy in meters.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isCapturingGps}
                className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCapturingGps ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Capturing GPS...</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    <span>{gpsLocation ? 'Re-Capture Current Location' : 'Capture Site GPS Location'}</span>
                  </>
                )}
              </button>
            </div>

            {gpsError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{gpsError}</span>
              </div>
            )}

            {gpsLocation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Latitude</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {gpsLocation.latitude.toFixed(6)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Longitude</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {gpsLocation.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Accuracy</span>
                    <span className="font-bold text-emerald-600">
                      ±{gpsLocation.accuracyMeters || 5} meters
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Google Maps</span>
                    <a
                      href={`https://maps.google.com/?q=${gpsLocation.latitude},${gpsLocation.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-600 hover:underline inline-flex items-center"
                    >
                      <span>Open Map</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </div>

                {/* OpenStreetMap interactive preview */}
                <div className="h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <iframe
                    title="Site Map"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsLocation.longitude - 0.005}%2C${gpsLocation.latitude - 0.005}%2C${gpsLocation.longitude + 0.005}%2C${gpsLocation.latitude + 0.005}&layer=mapnik&marker=${gpsLocation.latitude}%2C${gpsLocation.longitude}`}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 11: TECHNICAL MANUALS, REVIEW & SUBMIT */}
        {currentStep === 11 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
                Step 11: Technical Manuals & Final Pre-Flight Submission
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload relevant component manuals/datasheets, review all recorded details, and submit for Admin QA verification.
              </p>
            </div>

            {/* Technical Manual Upload Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Attach Technical Manuals & Single-Line Diagrams
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={e => setManualCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    <option value={TechnicalManualCategory.INVERTER_MANUAL}>Inverter Manual</option>
                    <option value={TechnicalManualCategory.PANEL_DATASHEET}>
                      Solar Panel Datasheet
                    </option>
                    <option value={TechnicalManualCategory.STRUCTURE_MANUAL}>Structure Certificate</option>
                    <option value={TechnicalManualCategory.EARTHING_MANUAL}>Earthing Manual</option>
                    <option value={TechnicalManualCategory.WIRING_DIAGRAM}>Wiring Diagram</option>
                    <option value={TechnicalManualCategory.OTHER}>Other Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Growatt Inverter 5kW User Manual"
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-end">
                  <label className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingManual ? 'Uploading...' : 'Choose File & Attach'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          handleManualUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {manuals.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {manuals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-slate-800">{m.title}</span>
                        <span className="text-[10px] text-slate-400">({m.category})</span>
                      </div>
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 font-bold hover:underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pre-Submission Verification Summary Card */}
            <div className="p-5 bg-solar-50/50 rounded-2xl border border-solar-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Installation Report Pre-Flight Checklist</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-solar-100">
                  <span className="text-slate-400 block font-semibold">Customer</span>
                  <span className="font-bold text-slate-900">{selectedCustomer?.name || 'Selected'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-solar-100">
                  <span className="text-slate-400 block font-semibold">Installed Capacity</span>
                  <span className="font-bold text-solar-700">{panelDetails.totalCalculatedKw} kW</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-solar-100">
                  <span className="text-slate-400 block font-semibold">Photographs</span>
                  <span className="font-bold text-emerald-600">{photos.length} / 10 Uploaded</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-solar-100">
                  <span className="text-slate-400 block font-semibold">GPS Location</span>
                  <span className="font-bold text-emerald-600">
                    {gpsLocation ? 'Captured & Geotagged' : 'Not Captured'}
                  </span>
                </div>
              </div>
            </div>

            {/* Submission CTA */}
            <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-indigo-900 text-sm">Ready to Submit for Admin Review?</h4>
                <p className="text-xs text-indigo-700 mt-0.5">
                  Submitting will notify the QA Admin team for verification and final commissioning signoff.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSubmitInstallation}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Submit Installation Report</span>
              </button>
            </div>
          </div>
        )}

        {/* Step Navigation Bar */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-30 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          {currentStep < 11 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-solar-600 hover:bg-solar-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <span>Next: {stepLabels[currentStep]}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitInstallation}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Final Report</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
