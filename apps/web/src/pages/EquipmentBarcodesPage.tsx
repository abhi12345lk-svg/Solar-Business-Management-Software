/**
 * INS Solar Business Management Software — Solar Equipment & Barcode Register
 *
 * Dedicated workstation for registering Inverter serial numbers and scanning/verifying
 * Solar PV Module barcodes for PM Surya Ghar ALMM/DCR subsidy compliance and DISCOM net metering.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Barcode,
  Zap,
  Boxes,
  Check,
  Plus,
  Trash2,
  Scan,
  ClipboardList,
  Download,
  UserCheck,
  Building2,
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  Search,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface CustomerOption {
  _id?: string;
  id?: string;
  legalName?: string;
  name?: string;
  customerCode?: string;
  primaryPhone?: string;
  sanctionedLoadKw?: number;
  installationAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    district?: string;
    pincode?: string;
  };
}

interface PanelBarcodeRow {
  id: string;
  itemNumber: number;
  description: string;
  serialNumber: string;
  barcode: string;
  status: 'VERIFIED' | 'PENDING';
}

function parseBarcodesFromText(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[\r\n,;\t]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);
}

export const EquipmentBarcodesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Customer Directory & Selection
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // MongoDB Installation Record
  const [installations, setInstallations] = useState<any[]>([]);
  const [activeInstallation, setActiveInstallation] = useState<any | null>(null);
  const [loadingInstallation, setLoadingInstallation] = useState(false);
  const [isSavingInstallation, setIsSavingInstallation] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isReviewingApproval, setIsReviewingApproval] = useState(false);

  // Success / Error Alerts
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // Inverter Form State
  const [inverterBrand, setInverterBrand] = useState('Growatt');
  const [inverterModel, setInverterModel] = useState('MIN 3300TL-X');
  const [inverterSerial, setInverterSerial] = useState('');
  const [inverterCapacity, setInverterCapacity] = useState('3.3 kW');
  const [inverterPhase, setInverterPhase] = useState('Single Phase');

  // Solar PV Module Specs State
  const [panelManufacturer, setPanelManufacturer] = useState('Waaree Energies');
  const [panelModel, setPanelModel] = useState('540W Mono PERC Bifacial');
  const [panelWattage, setPanelWattage] = useState<number>(540);
  const [quickPanelCountInput, setQuickPanelCountInput] = useState<number>(10);

  // Panel Barcode Rows State
  const [panelRows, setPanelRows] = useState<PanelBarcodeRow[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `p-${i + 1}`,
      itemNumber: i + 1,
      description: `Solar PV Module 540W`,
      serialNumber: '',
      barcode: '',
      status: 'PENDING'
    }))
  );

  // Camera Scanner Modal State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [activeScanningRowId, setActiveScanningRowId] = useState<string | null>(null);
  const [scannerManualInput, setScannerManualInput] = useState('');
  const [scannerCameraActive, setScannerCameraActive] = useState(false);
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Bulk Paste Barcode Modal State
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkBarcodeText, setBulkBarcodeText] = useState('');

  // 1. Load Customer Directory & Installations on mount
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
            } else {
              // Pre-calculate panel count from customer's sanctioned load
              const loadKw = targetCustomer.sanctionedLoadKw || 3.3;
              const slots = Math.max(1, Math.round((loadKw * 1000) / 540));
              setQuickPanelCountInput(slots);
              handleGeneratePanelSlots(slots, 540);
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

  // 2. Load detailed installation record from MongoDB
  const loadInstallationDetails = async (instId: string) => {
    try {
      setLoadingInstallation(true);
      const res: any = await apiClient<any>(`/installations/${instId}`);
      const fullInst = res?.data || res;
      if (fullInst && (fullInst._id || fullInst.id)) {
        setActiveInstallation(fullInst);

        // Autofill Inverter details
        if (fullInst.inverter?.brand) setInverterBrand(fullInst.inverter.brand);
        if (fullInst.inverter?.modelNumber) setInverterModel(fullInst.inverter.modelNumber);
        if (fullInst.inverter?.serialNumber) setInverterSerial(fullInst.inverter.serialNumber);
        if (fullInst.inverter?.rating) setInverterCapacity(fullInst.inverter.rating);

        // Autofill Solar PV Modules details
        const wPerPanel = fullInst.panelDetails?.wattagePerPanel || 540;
        if (fullInst.panelDetails?.manufacturer) setPanelManufacturer(fullInst.panelDetails.manufacturer);
        if (fullInst.panelDetails?.model) setPanelModel(fullInst.panelDetails.model);
        if (fullInst.panelDetails?.wattagePerPanel) setPanelWattage(wPerPanel);

        // Autofill Barcode Items
        if (Array.isArray(fullInst.inventoryItems) && fullInst.inventoryItems.length > 0) {
          setPanelRows(
            fullInst.inventoryItems.map((item: any, idx: number) => ({
              id: item._id || `p-${idx + 1}`,
              itemNumber: item.itemNumber || idx + 1,
              description: item.equipmentName || `Solar PV Module ${wPerPanel}W`,
              serialNumber: item.serialNumber || '',
              barcode: item.barcode || '',
              status: item.barcode ? 'VERIFIED' : 'PENDING'
            }))
          );
          setQuickPanelCountInput(fullInst.inventoryItems.length);
        } else if (Array.isArray(fullInst.panelDetails?.panelBarcodes) && fullInst.panelDetails.panelBarcodes.length > 0) {
          setPanelRows(
            fullInst.panelDetails.panelBarcodes.map((bc: string, idx: number) => ({
              id: `p-${idx + 1}`,
              itemNumber: idx + 1,
              description: `Solar PV Module ${wPerPanel}W`,
              serialNumber: fullInst.panelDetails?.panelSerialNumbers?.[idx] || `WAA-${idx + 1}`,
              barcode: bc,
              status: bc ? 'VERIFIED' : 'PENDING'
            }))
          );
          setQuickPanelCountInput(fullInst.panelDetails.panelBarcodes.length);
        } else {
          const cap = fullInst.systemCapacityKw || 3.3;
          const slots = Math.max(1, Math.round((cap * 1000) / wPerPanel));
          setQuickPanelCountInput(slots);
          handleGeneratePanelSlots(slots, wPerPanel);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load installation details:', err);
    } finally {
      setLoadingInstallation(false);
    }
  };

  // 3. Switch Customer Handler
  const handleSelectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setIsClientDrawerOpen(false);

    const custId = customer._id || customer.id || '';
    localStorage.setItem('solar_installer_active_customer_id', custId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('customerId', custId);
      return next;
    });

    const foundInst = installations.find(i =>
      (i.customerId && (i.customerId === custId || i.customerId._id === custId)) ||
      (i.customerCode && customer?.customerCode && i.customerCode === customer.customerCode)
    );

    if (foundInst) {
      loadInstallationDetails(foundInst._id || foundInst.id);
    } else {
      setActiveInstallation(null);
      const loadKw = customer.sanctionedLoadKw || 3.3;
      const slots = Math.max(1, Math.round((loadKw * 1000) / panelWattage));
      setQuickPanelCountInput(slots);
      handleGeneratePanelSlots(slots, panelWattage);
    }
  };

  // 4. Initialize MongoDB Installation Record if none exists
  const handleInitializeInstallation = async () => {
    if (!selectedCustomer) return;
    try {
      setIsSavingInstallation(true);
      setErrorNotification(null);
      const custId = selectedCustomer._id || selectedCustomer.id;
      const res: any = await apiClient<any>('/installations', {
        method: 'POST',
        body: JSON.stringify({
          customerId: custId,
          systemCapacityKw: selectedCustomer.sanctionedLoadKw || 3.3,
          notes: `Hardware & Barcode Register initialized for ${selectedCustomer.legalName || selectedCustomer.name}`,
          isDraft: false
        })
      });
      const created = res?.data || res;
      if (created) {
        setActiveInstallation(created);
        setInstallations(prev => [created, ...prev]);
        setSaveSuccess(`Installation record ${created.installationNumber || 'INST-2026-XXXXX'} created successfully!`);
        setTimeout(() => setSaveSuccess(null), 5000);
      }
    } catch (err: any) {
      setErrorNotification(`Failed to initialize installation: ${err.message || 'Error'}`);
    } finally {
      setIsSavingInstallation(false);
    }
  };

  // 5. Generate Panel Rows matching module count
  const handleGeneratePanelSlots = (count: number, wattage = panelWattage) => {
    const validCount = Math.max(1, Math.min(100, count));
    setPanelRows(prev => {
      const next: PanelBarcodeRow[] = [];
      for (let i = 1; i <= validCount; i++) {
        const existing = prev[i - 1];
        next.push({
          id: existing?.id || `p-${i}-${Date.now()}`,
          itemNumber: i,
          description: existing?.description || `Solar PV Module ${wattage}W`,
          serialNumber: existing?.serialNumber || '',
          barcode: existing?.barcode || '',
          status: existing?.barcode ? 'VERIFIED' : 'PENDING'
        });
      }
      return next;
    });
  };

  // 6. Update single panel row
  const handleUpdatePanelRow = (rowId: string, patch: Partial<PanelBarcodeRow>) => {
    setPanelRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const updated = { ...r, ...patch };
        if (patch.barcode !== undefined) {
          updated.status = patch.barcode.trim() ? 'VERIFIED' : 'PENDING';
        }
        return updated;
      })
    );
  };

  // 7. Add single panel row
  const handleAddSinglePanel = () => {
    setPanelRows(prev => {
      const newNum = prev.length + 1;
      return [
        ...prev,
        {
          id: `p-${newNum}-${Date.now()}`,
          itemNumber: newNum,
          description: `Solar PV Module ${panelWattage}W`,
          serialNumber: '',
          barcode: '',
          status: 'PENDING'
        }
      ];
    });
  };

  // 8. Delete panel row
  const handleDeletePanelRow = (rowId: string) => {
    setPanelRows(prev => {
      const filtered = prev.filter(r => r.id !== rowId);
      return filtered.map((r, idx) => ({
        ...r,
        itemNumber: idx + 1
      }));
    });
  };

  // 9. Camera Barcode Scanner Controls
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
        setScannerCameraError('Camera stream not supported in this browser. Please enter barcode manually.');
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

    // Advance to next empty row automatically
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

  // 10. Bulk Paste Barcode Handler
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
    setSaveSuccess(`Parsed and loaded ${lines.length} barcodes into the table! Click "Save to Database" to commit.`);
    setTimeout(() => setSaveSuccess(null), 5000);
  };

  // 11. Export Barcodes to CSV
  const handleExportCsv = () => {
    const custName = selectedCustomer?.legalName || selectedCustomer?.name || 'Customer';
    const csvContent =
      'S.No,Module Description,Serial Number,Barcode / ALMM Code,Status\n' +
      panelRows
        .map(
          r =>
            `"${r.itemNumber}","${r.description.replace(/"/g, '""')}","${r.serialNumber.replace(/"/g, '""')}","${r.barcode.replace(/"/g, '""')}","${r.status}"`
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Solar_Barcodes_${custName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 12. Save Equipment & Barcodes to MongoDB Database
  const handleSaveEquipmentToDb = async () => {
    try {
      setIsSavingInstallation(true);
      setErrorNotification(null);
      setSaveSuccess(null);

      let targetInstId = activeInstallation?._id || activeInstallation?.id;

      // Auto-create installation record in MongoDB if none exists yet
      if (!targetInstId && selectedCustomer) {
        const custId = selectedCustomer._id || selectedCustomer.id;
        const res: any = await apiClient<any>('/installations', {
          method: 'POST',
          body: JSON.stringify({
            customerId: custId,
            systemCapacityKw: selectedCustomer.sanctionedLoadKw || 3.3,
            notes: `Hardware & Barcode Register initialized for ${selectedCustomer.legalName || selectedCustomer.name}`,
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
            status: r.status || (r.barcode ? 'VERIFIED' : 'PENDING')
          }))
        };

        const updatedRes: any = await apiClient<any>(`/installations/${targetInstId}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload)
        });
        const updatedInst = updatedRes?.data || updatedRes;
        if (updatedInst) setActiveInstallation(updatedInst);

        const verifiedCount = panelRows.filter(r => r.status === 'VERIFIED' || !!r.barcode).length;
        setSaveSuccess(
          `✓ Inverter & ${panelRows.length} PV Module Barcodes (${verifiedCount} verified) saved successfully (${updatedInst?.installationNumber || 'INST-2026-XXXXX'})!`
        );
        setTimeout(() => setSaveSuccess(null), 6000);
      }
    } catch (err: any) {
      setErrorNotification(`Error saving equipment to database: ${err?.message || 'Server error'}`);
    } finally {
      setIsSavingInstallation(false);
    }
  };

  // 13. Submit for Admin QA review
  const handleSubmitForQaApproval = async () => {
    if (!activeInstallation?._id && !activeInstallation?.id) return;
    try {
      setIsSubmittingApproval(true);
      const instId = activeInstallation._id || activeInstallation.id;
      const res: any = await apiClient<any>(`/installations/${instId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: 'Equipment specs and PV module barcodes submitted for Admin QA and Net Metering clearance'
        })
      });
      const updated = res?.data || res;
      if (updated) setActiveInstallation(updated);
      setSaveSuccess('Installation submitted for Admin QA review successfully!');
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setErrorNotification(`Failed to submit for QA review: ${err.message || 'Error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // 14. Approve Installation (Admin QA)
  const handleApproveInstallation = async () => {
    if (!activeInstallation?._id && !activeInstallation?.id) return;
    try {
      setIsReviewingApproval(true);
      const instId = activeInstallation._id || activeInstallation.id;
      const res: any = await apiClient<any>(`/installations/${instId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Admin QA: Equipment barcodes verified against ALMM/DCR norms'
        })
      });
      const updated = res?.data || res;
      if (updated) setActiveInstallation(updated);
      setSaveSuccess('Installation certified and approved by Admin QA!');
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setErrorNotification(`Failed to approve installation: ${err.message || 'Error'}`);
    } finally {
      setIsReviewingApproval(false);
    }
  };

  const verifiedBarcodesCount = panelRows.filter(r => r.status === 'VERIFIED' || !!r.barcode).length;
  const calculatedCapacityKw = ((panelRows.length * panelWattage) / 1000).toFixed(2);
  const consumerName = selectedCustomer?.legalName || selectedCustomer?.name || 'Client';
  const consumerCode = selectedCustomer?.customerCode || 'CUST-XXXX';
  const consumerCity = selectedCustomer?.installationAddress?.city || selectedCustomer?.installationAddress?.district || '';
  const consumerLoad = selectedCustomer?.sanctionedLoadKw || 3.3;

  return (
    <div className="min-h-screen bg-muted/20 pb-16 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & WORKSTATION TAB NAVIGATOR                                  */}
      {/* ========================================================================= */}
      <div className="bg-card border-b border-border shadow-2xs sticky top-0 z-30 backdrop-blur-md bg-card/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Title & Brand Icon */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shrink-0 border border-solar-500/20">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                    Solar Equipment &amp; Barcode Register
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/30">
                    PM Surya Ghar ALMM/DCR
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Record Inverter specifications &amp; scan PV module barcodes for net-metering &amp; DBT subsidy audit.
                </p>
              </div>
            </div>

            {/* Customer Switcher */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(true)}
                className="px-3 py-1.5 bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 text-xs font-bold rounded-xl border border-solar-500/30 flex items-center space-x-2 cursor-pointer transition shadow-2xs"
                title="Search and change client"
              >
                <UserCheck className="w-3.5 h-3.5 text-solar-600" />
                <span className="truncate max-w-[140px]">{consumerName}</span>
                <span className="text-[10px] text-muted-foreground">▾</span>
              </button>
            </div>
          </div>

          {/* Real-time Alerts */}
          {saveSuccess && (
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{saveSuccess}</span>
              </div>
              <button onClick={() => setSaveSuccess(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

          {errorNotification && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorNotification}</span>
              </div>
              <button onClick={() => setErrorNotification(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE CONTAINER                                               */}
      {/* ========================================================================= */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 flex-1">
        {/* Row 1: Customer Info & Installation Lifecycle Ribbon */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0 font-bold border border-solar-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{consumerName}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold shrink-0">
                  {consumerCode}
                </span>
                <button
                  type="button"
                  onClick={() => setIsClientDrawerOpen(true)}
                  className="text-[11px] font-bold text-solar-600 hover:underline cursor-pointer ml-1 px-2 py-0.5 rounded bg-solar-500/10 border border-solar-500/20"
                >
                  Change Client ▾
                </button>
              </div>
              <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-0.5 flex-wrap">
                {consumerCity && <span>📍 {consumerCity}</span>}
                <span>•</span>
                <span>⚡ {consumerLoad} kWp Sanctioned</span>
                <span>•</span>
                <span>📋 {panelRows.length} Panels Assigned ({calculatedCapacityKw} kW DC)</span>
              </div>
            </div>
          </div>

          {/* Installation Dossier Status & QA Lifecycle Buttons */}
          <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Dossier:</span>
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
                <button
                  type="button"
                  onClick={handleInitializeInstallation}
                  disabled={isSavingInstallation}
                  className="px-2.5 py-1 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  + Start Record
                </button>
              )}
            </div>

            {activeInstallation && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  activeInstallation.status === 'APPROVED'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : activeInstallation.status === 'SUBMITTED'
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                }`}
              >
                {activeInstallation.status === 'APPROVED'
                  ? '✓ QA Approved'
                  : activeInstallation.status === 'SUBMITTED'
                    ? '⏳ Under Admin Review'
                    : '⚡ Installation In Progress'}
              </span>
            )}

            {activeInstallation && (activeInstallation.status === 'ASSIGNED' || activeInstallation.status === 'IN_PROGRESS') && (
              <button
                type="button"
                onClick={handleSubmitForQaApproval}
                disabled={isSubmittingApproval}
                className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-1 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingApproval ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
                <span>Submit for QA</span>
              </button>
            )}

            {activeInstallation && activeInstallation.status === 'SUBMITTED' && (
              <button
                type="button"
                onClick={handleApproveInstallation}
                disabled={isReviewingApproval}
                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isReviewingApproval ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                <span>Approve (Admin QA)</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Inverter Specifications & PV Modules Specifications (2 Simple Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Inverter Details */}
          <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Solar Inverter Specifications</h3>
                  <p className="text-[10px] text-muted-foreground">Grid-tied inverter rating &amp; serial number</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                {inverterPhase}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Inverter Make / Brand *</label>
                <input
                  type="text"
                  value={inverterBrand}
                  onChange={e => setInverterBrand(e.target.value)}
                  placeholder="e.g. Growatt / Havells / Sungrow"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-semibold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Inverter Model Number</label>
                <input
                  type="text"
                  value={inverterModel}
                  onChange={e => setInverterModel(e.target.value)}
                  placeholder="e.g. MIN 3300TL-X / 5kW"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-semibold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Inverter Serial Number (S.No) *</label>
                <input
                  type="text"
                  value={inverterSerial}
                  onChange={e => setInverterSerial(e.target.value)}
                  placeholder="e.g. GW-2026-INV-98104"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Capacity Rating / Phase</label>
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    value={inverterCapacity}
                    onChange={e => setInverterCapacity(e.target.value)}
                    placeholder="e.g. 3.3 kW"
                    className="w-2/3 px-3 py-2 bg-background border rounded-lg font-semibold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                  />
                  <select
                    value={inverterPhase}
                    onChange={e => setInverterPhase(e.target.value)}
                    className="w-1/3 px-2 py-2 bg-background border rounded-lg text-xs font-semibold text-foreground"
                  >
                    <option value="Single Phase">1-Ph</option>
                    <option value="3-Phase">3-Ph</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Solar PV Modules Overview */}
          <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2.5">
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
                {calculatedCapacityKw} kW DC Total
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Panel Manufacturer *</label>
                <input
                  type="text"
                  value={panelManufacturer}
                  onChange={e => setPanelManufacturer(e.target.value)}
                  placeholder="e.g. Waaree Energies / Tata Power"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-semibold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Cell Technology / Model</label>
                <input
                  type="text"
                  value={panelModel}
                  onChange={e => setPanelModel(e.target.value)}
                  placeholder="e.g. 540W Mono PERC Bifacial DCR"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-semibold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Wattage per Module (Wp) *</label>
                <input
                  type="number"
                  value={panelWattage}
                  onChange={e => {
                    const w = Number(e.target.value) || 540;
                    setPanelWattage(w);
                  }}
                  placeholder="540"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Verification Progress</label>
                <div className="px-3 py-2 bg-muted rounded-lg font-bold text-foreground text-xs flex items-center justify-between">
                  <span>{verifiedBarcodesCount} of {panelRows.length} Scanned</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                    verifiedBarcodesCount === panelRows.length && panelRows.length > 0
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {panelRows.length > 0 ? Math.round((verifiedBarcodesCount / panelRows.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Interactive Barcodes Table & Scanner */}
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-muted/20">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <Barcode className="w-4 h-4 text-solar-600" />
                <span>Solar PV Panels Serial Number &amp; Barcode Table</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scan or paste every PV module barcode for PM Surya Ghar subsidy verification and ALMM clearance.
              </p>
            </div>

            {/* Quick Actions Bar */}
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
                title="Paste multiple barcodes at once from scanner gun or invoice"
              >
                <ClipboardList className="w-3.5 h-3.5 text-solar-600" />
                <span>Bulk Paste Barcodes</span>
              </button>

              <button
                type="button"
                onClick={handleAddSinglePanel}
                className="px-3 py-1.5 bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 text-xs font-bold rounded-xl border border-solar-500/30 transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Row</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-border cursor-pointer shadow-2xs"
                title="Export Barcode Register to CSV file"
              >
                <Download className="w-3.5 h-3.5 text-solar-600" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleSaveEquipmentToDb}
                disabled={isSavingInstallation}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingInstallation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save to Database</span>
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                <tr>
                  <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                  <th className="px-4 py-3 font-bold">Module Description</th>
                  <th className="px-4 py-3 font-bold">Serial Number (S.No)</th>
                  <th className="px-4 py-3 font-bold">Barcode / ALMM Code</th>
                  <th className="px-4 py-3 font-bold text-center">Reader</th>
                  <th className="px-4 py-3 font-bold text-center">Status</th>
                  <th className="px-4 py-3 font-bold w-12 text-center">Action</th>
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
                        className="w-full px-2.5 py-1 bg-background border rounded-lg font-mono text-foreground text-xs focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
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
              <span>System DC Capacity: <strong>{calculatedCapacityKw} kW</strong></span>
            </div>
            <button
              type="button"
              onClick={handleSaveEquipmentToDb}
              disabled={isSavingInstallation}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 self-end sm:self-auto"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Sync to Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CAMERA BARCODE / QR SCANNER MODAL                                      */}
      {/* ========================================================================= */}
      {isBarcodeScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Scan className="w-5 h-5 text-solar-600" />
                <h3 className="text-base font-bold text-foreground">
                  Barcode Scanner (Row #{panelRows.find(r => r.id === activeScanningRowId)?.itemNumber || 1})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBarcodeScannerOpen(false);
                  stopCameraStream();
                }}
                className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Video Preview with Scanning Frame */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-border">
              {scannerCameraActive && (
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              )}
              <div className="absolute inset-8 border-2 border-dashed border-solar-500 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[10px] text-white bg-black/60 px-2 py-0.5 rounded">
                  Align module barcode inside frame
                </span>
              </div>
            </div>

            {scannerCameraError && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                {scannerCameraError}
              </p>
            )}

            {/* Manual Barcode Input / Handheld Scanner Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                Manual / Handheld Scanner Input
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. WAA-540-00123"
                  value={scannerManualInput}
                  onChange={e => setScannerManualInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && scannerManualInput.trim()) {
                      e.preventDefault();
                      handleApplyScannedBarcode(scannerManualInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-background border rounded-lg font-mono text-xs font-bold focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleApplyScannedBarcode(scannerManualInput)}
                  className="px-3.5 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsBarcodeScannerOpen(false);
                  stopCameraStream();
                }}
                className="px-4 py-1.5 text-xs font-semibold border rounded-lg hover:bg-muted text-foreground"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BULK PASTE BARCODES MODAL                                              */}
      {/* ========================================================================= */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-solar-600" />
                <h3 className="text-base font-bold text-foreground">Bulk Paste Module Barcodes</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-md"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste module serials/barcodes directly from an Excel sheet, invoice, or handheld barcode scanner.
              Separate entries by new line, commas, or spaces.
            </p>

            <textarea
              rows={8}
              value={bulkBarcodeText}
              onChange={e => setBulkBarcodeText(e.target.value)}
              placeholder={`WAA-540-001\nWAA-540-002\nWAA-540-003\nWAA-540-004\nWAA-540-005`}
              className="w-full p-3 bg-background border rounded-xl font-mono text-xs text-foreground focus:ring-2 focus:ring-solar-500 focus:outline-none"
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Detected Barcodes: <strong>{parseBarcodesFromText(bulkBarcodeText).length}</strong></span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBulkPasteOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold border rounded-lg hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkBarcodes}
                  className="px-4 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                >
                  Populate Table
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CLIENT SELECTION DRAWER / MODAL                                        */}
      {/* ========================================================================= */}
      {isClientDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-solar-600" />
                <h3 className="text-base font-bold text-foreground">Select Customer / Solar Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Search filter */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={clientSearchTerm}
                onChange={e => setClientSearchTerm(e.target.value)}
                placeholder="Search by customer name, code or city..."
                className="w-full pl-9 pr-3 py-2 bg-background border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
              />
            </div>

            {/* Customer List */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {loadingCustomers ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-solar-500" />
                  <span>Loading customer directory...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No customers found.</div>
              ) : (
                customers
                  .filter(c => {
                    const term = clientSearchTerm.toLowerCase();
                    const name = (c.legalName || c.name || '').toLowerCase();
                    const code = (c.customerCode || '').toLowerCase();
                    const city = (c.installationAddress?.city || '').toLowerCase();
                    return name.includes(term) || code.includes(term) || city.includes(term);
                  })
                  .map(cust => {
                    const isSelected = (selectedCustomer?._id || selectedCustomer?.id) === (cust._id || cust.id);
                    const matchedInst = installations.find(i =>
                      (i.customerId && (i.customerId === (cust._id || cust.id) || i.customerId._id === (cust._id || cust.id))) ||
                      (i.customerCode && cust.customerCode && i.customerCode === cust.customerCode)
                    );

                    return (
                      <div
                        key={cust._id || cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-solar-500/10 border-solar-500/40 text-solar-800 dark:text-solar-300'
                            : 'hover:bg-muted/40 border-border text-foreground'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {cust.legalName || cust.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-2 mt-0.5">
                            <span className="font-mono">{cust.customerCode || 'NO-CODE'}</span>
                            {cust.installationAddress?.city && <span>• {cust.installationAddress.city}</span>}
                            <span>• {cust.sanctionedLoadKw || 3.3} kWp</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center space-x-2">
                          {matchedInst ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              {matchedInst.installationNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              No Inst
                            </span>
                          )}
                          {isSelected && <Check className="w-4 h-4 text-solar-600" />}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-2 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsClientDrawerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold border rounded-lg hover:bg-muted text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
