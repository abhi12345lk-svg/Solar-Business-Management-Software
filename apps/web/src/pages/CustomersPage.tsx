import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building2,
  Sun,
  FileSpreadsheet,
  FolderKanban,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ShoppingCart,
  FolderLock,
  Upload,
  Trash2,
  ExternalLink,
  FileText,
  Download,
  CreditCard,
  Camera,
  Landmark,
  Zap,
  Navigation,
  Compass,
  Check
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { CustomerDto, CustomerType, CustomerStatus } from '@ins-solar/shared';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Customer Detail Modal / Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);

  // New Customer Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status Lifecycle Update State
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Customer Document Vault Modal State
  const [vaultCustomer, setVaultCustomer] = useState<CustomerDto | null>(null);
  const [vaultDocuments, setVaultDocuments] = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultSuccess, setVaultSuccess] = useState<string | null>(null);
  const [vaultUploadOpen, setVaultUploadOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Vault Upload Form State
  const [newDocCategory, setNewDocCategory] = useState('ELECTRICITY_BILL');
  const [newDocDisplayName, setNewDocDisplayName] = useState('');
  const [newDocClassification, setNewDocClassification] = useState<'INTERNAL_ONLY' | 'CUSTOMER_VISIBLE'>('CUSTOMER_VISIBLE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Direct 1-Click Slot Upload State
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);

  // GPS Geotag Location State
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.INDIVIDUAL);
  const [city, setCity] = useState('');
  const [state, setState] = useState('Chhattisgarh');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [notes, setNotes] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const data = await apiClient<CustomerDto[]>(`/customers?${params.toString()}`);
      setCustomers(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const getStatusBadgeConfig = (status?: string) => {
    switch (status) {
      case 'QUOTATION_SHARED':
        return {
          label: 'Quotation Shared (Ask to Client)',
          className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400 font-semibold',
          dot: 'bg-amber-500'
        };
      case 'ORDER_CONFIRMED':
        return {
          label: 'Order Confirmed',
          className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400 font-semibold',
          dot: 'bg-blue-500'
        };
      case 'SITE_WORK_IN_PROGRESS':
        return {
          label: 'Site Work in Progress',
          className: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400 font-semibold',
          dot: 'bg-purple-500'
        };
      case 'ACTIVE':
      default:
        return {
          label: 'Completed / Active',
          className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 font-semibold',
          dot: 'bg-emerald-500'
        };
      case 'INACTIVE':
        return {
          label: 'Inactive / On Hold',
          className: 'bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400 font-semibold',
          dot: 'bg-slate-400'
        };
    }
  };

  const handleStatusChange = async (customerId: string, newStatus: string) => {
    setUpdatingId(customerId);
    setStatusNotification(null);
    try {
      await apiClient<CustomerDto>(`/customers/${customerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });

      setCustomers(prev =>
        prev.map(c => (c.id === customerId ? { ...c, status: newStatus as any } : c))
      );
      if (selectedCustomer && selectedCustomer.id === customerId) {
        setSelectedCustomer(prev => (prev ? { ...prev, status: newStatus as any } : null));
      }

      const cfg = getStatusBadgeConfig(newStatus);
      setStatusNotification({
        message: `Client status updated to "${cfg.label}" successfully!`,
        type: 'success'
      });
      setTimeout(() => setStatusNotification(null), 4000);
    } catch (err: any) {
      setStatusNotification({
        message: err?.message || 'Failed to update client status.',
        type: 'error'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'ELECTRICITY_BILL':
        return { label: '⚡ Electricity Bill', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' };
      case 'AADHAAR_CARD':
      case 'CUSTOMER_KYC':
        return { label: '🪪 Aadhaar Card (KYC)', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' };
      case 'PAN_CARD':
        return { label: '💳 PAN Card', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' };
      case 'PROPERTY_TAX_RECEIPT':
      case 'TAX_RECEIPT':
      case 'PROPERTY_DEED':
        return { label: '🏛️ Property / Tax Receipt', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
      case 'BANK_PASSBOOK':
        return { label: '🏦 Bank Passbook / Cheque', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
      case 'SITE_PHOTOS':
      case 'INSTALLATION_QUALITY':
        return { label: '📸 Site & Rooftop Photos', color: 'bg-teal-500/10 text-teal-700 border-teal-500/20' };
      case 'SITE_GEOTAG_LOCATION':
        return { label: '📍 GPS Site Geotag', color: 'bg-rose-500/10 text-rose-700 border-rose-500/20' };
      case 'QUOTATION_PROPOSAL':
        return { label: '📋 Solar Quotation', color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' };
      case 'SIGNED_CONTRACT':
        return { label: '✍️ Signed Contract', color: 'bg-slate-500/10 text-slate-700 border-slate-500/20' };
      case 'NET_METERING_DOC':
        return { label: '🔌 Net Metering Feasibility', color: 'bg-sky-500/10 text-sky-700 border-sky-500/20' };
      case 'SUBSIDY_DOC':
        return { label: '🏛️ PM Surya Ghar Subsidy', color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' };
      default:
        return { label: '📄 Other Document', color: 'bg-muted text-muted-foreground border-border' };
    }
  };

  const fetchVaultDocuments = async (customerId: string) => {
    setVaultLoading(true);
    setVaultError(null);
    try {
      const data = await apiClient<any[]>(`/customers/${customerId}/documents`);
      setVaultDocuments(data || []);
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to load vault documents.');
    } finally {
      setVaultLoading(false);
    }
  };

  const openCustomerVault = async (customer: CustomerDto) => {
    setVaultCustomer(customer);
    setVaultUploadOpen(false);
    setVaultError(null);
    setVaultSuccess(null);
    setSelectedFile(null);
    setNewDocDisplayName('');
    setLocationError(null);
    setCurrentCoords(customer.installationAddress?.geoCoordinates || null);
    await fetchVaultDocuments(customer.id);
  };

  const handleDirectSlotUpload = async (slotKey: string, slotTitle: string, file: File) => {
    if (!vaultCustomer) return;
    setUploadingSlotKey(slotKey);
    setVaultError(null);
    setVaultSuccess(null);

    try {
      const displayName = `${slotTitle} - ${vaultCustomer.name}`;
      const docRes = await apiClient<any>(`/customers/${vaultCustomer.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: file.name,
          safeDisplayName: displayName,
          category: slotKey,
          accessClassification: 'CUSTOMER_VISIBLE',
          mimeType: file.type || 'application/pdf',
          fileSizeBytes: file.size
        })
      });

      const docId = docRes?.id || docRes?._id;
      if (docId) {
        try {
          await fetch(`/api/v1/documents/${docId}/content`, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
          });
        } catch (err) {
          console.warn('Direct upload binary notice:', err);
        }
      }

      setVaultSuccess(`"${slotTitle}" successfully uploaded to client vault!`);
      await fetchVaultDocuments(vaultCustomer.id);
      setCustomers(prev =>
        prev.map(c =>
          c.id === vaultCustomer.id
            ? { ...c, documentCount: (c.documentCount || 0) + 1 }
            : c
        )
      );
    } catch (err: any) {
      setVaultError(err?.message || `Failed to upload ${slotTitle}.`);
    } finally {
      setUploadingSlotKey(null);
    }
  };

  const handleFetchCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFetchingLocation(false);
        setCurrentCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setVaultSuccess(`GPS Coordinates fetched: ${pos.coords.latitude.toFixed(5)}°, ${pos.coords.longitude.toFixed(5)}° (±${Math.round(pos.coords.accuracy)}m)`);
      },
      err => {
        setFetchingLocation(false);
        let msg = 'Failed to fetch GPS coordinates.';
        if (err.code === 1) msg = 'Location permission denied by browser. Please allow location access.';
        else if (err.code === 2) msg = 'GPS location unavailable on current network.';
        else if (err.code === 3) msg = 'GPS request timed out. Please try again.';
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSaveGeotag = async () => {
    if (!vaultCustomer || !currentCoords) return;
    setSavingLocation(true);
    setLocationError(null);
    try {
      await apiClient<any>(`/customers/${vaultCustomer.id}/geotag`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          accuracy: currentCoords.accuracy,
          locationNotes: `Live GPS site survey coordinates for ${vaultCustomer.name}`
        })
      });

      setVaultSuccess(`Site coordinates (${currentCoords.latitude.toFixed(5)}°, ${currentCoords.longitude.toFixed(5)}°) saved to customer installation address & document vault!`);

      setVaultCustomer(prev =>
        prev
          ? {
              ...prev,
              installationAddress: {
                ...prev.installationAddress,
                geoCoordinates: {
                  latitude: currentCoords.latitude,
                  longitude: currentCoords.longitude
                }
              } as any,
              documentCount: (prev.documentCount || 0) + 1
            }
          : null
      );

      setCustomers(prev =>
        prev.map(c =>
          c.id === vaultCustomer.id
            ? {
                ...c,
                installationAddress: {
                  ...c.installationAddress,
                  geoCoordinates: {
                    latitude: currentCoords.latitude,
                    longitude: currentCoords.longitude
                  }
                } as any,
                documentCount: (c.documentCount || 0) + 1
              }
            : c
        )
      );

      await fetchVaultDocuments(vaultCustomer.id);
    } catch (err: any) {
      setLocationError(err?.message || 'Failed to save geotag location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleVaultFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultCustomer) return;
    if (!newDocDisplayName.trim()) {
      setVaultError('Document display name/title is required.');
      return;
    }

    setIsUploadingDoc(true);
    setVaultError(null);
    setVaultSuccess(null);

    try {
      const filename = selectedFile?.name || `${newDocDisplayName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const mimeType = selectedFile?.type || 'application/pdf';
      const fileSize = selectedFile?.size || 2048;

      const docRes = await apiClient<any>(`/customers/${vaultCustomer.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: filename,
          safeDisplayName: newDocDisplayName.trim(),
          category: newDocCategory,
          accessClassification: newDocClassification,
          mimeType,
          fileSizeBytes: fileSize
        })
      });

      const docId = docRes?.id || docRes?._id;

      if (selectedFile && docId) {
        try {
          await fetch(`/api/v1/documents/${docId}/content`, {
            method: 'PUT',
            headers: {
              'Content-Type': selectedFile.type || 'application/octet-stream'
            },
            body: selectedFile
          });
        } catch (uploadErr) {
          console.warn('Binary file stream notice:', uploadErr);
        }
      }

      setVaultSuccess(`Document "${newDocDisplayName.trim()}" added to vault successfully!`);
      setVaultUploadOpen(false);
      setSelectedFile(null);
      setNewDocDisplayName('');

      await fetchVaultDocuments(vaultCustomer.id);

      setCustomers(prev =>
        prev.map(c =>
          c.id === vaultCustomer.id
            ? { ...c, documentCount: (c.documentCount || 0) + 1 }
            : c
        )
      );
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to upload document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleVaultDownload = async (doc: any) => {
    try {
      const docId = doc._id || doc.id;
      const res = await apiClient<{ downloadUrl: string }>(`/documents/${docId}/access-url`);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to generate download URL.');
    }
  };

  const handleVaultDelete = async (docId: string, docName: string) => {
    if (!vaultCustomer) return;
    if (!window.confirm(`Are you sure you want to remove "${docName}" from this client's vault?`)) {
      return;
    }
    try {
      await apiClient(`/customers/${vaultCustomer.id}/documents/${docId}`, {
        method: 'DELETE'
      });
      setVaultSuccess(`Document "${docName}" removed from vault.`);
      setVaultDocuments(prev => prev.filter(d => (d._id || d.id) !== docId));
      setCustomers(prev =>
        prev.map(c =>
          c.id === vaultCustomer.id
            ? { ...c, documentCount: Math.max(0, (c.documentCount || 1) - 1) }
            : c
        )
      );
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to delete document.');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        primaryPhone: primaryPhone.trim(),
        email: email.trim() || undefined,
        customerType,
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        billingAddress: {
          type: 'BILLING',
          addressLine1: street.trim() || name.trim(),
          city: city.trim() || 'Raipur',
          state: state.trim() || 'Chhattisgarh',
          postalCode: postalCode.trim() || '492001',
          country: 'India'
        },
        installationAddress: {
          type: 'SITE_INSTALLATION',
          addressLine1: street.trim() || name.trim(),
          city: city.trim() || 'Raipur',
          state: state.trim() || 'Chhattisgarh',
          postalCode: postalCode.trim() || '492001',
          country: 'India'
        },
        notes: notes.trim() || undefined
      };

      await apiClient<CustomerDto>('/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      // Reset form
      setName('');
      setCompanyName('');
      setPrimaryPhone('');
      setEmail('');
      setCity('');
      setPostalCode('');
      setStreet('');
      setGstin('');
      setPan('');
      setNotes('');
      fetchCustomers();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create customer record.');
    } finally {
      setCreating(false);
    }
  };

  // Filtered by type in client
  const filteredCustomers = customers.filter(c => {
    if (typeFilter !== 'ALL') {
      if (typeFilter === CustomerType.COMMERCIAL) {
        if (c.type !== CustomerType.COMMERCIAL && c.type !== CustomerType.INDUSTRIAL) return false;
      } else if (c.type !== typeFilter) {
        return false;
      }
    }
    return true;
  });

  // Calculate Metrics
  const totalCount = customers.length;
  const residentialCount = customers.filter(c => c.type === CustomerType.INDIVIDUAL).length;
  const commercialCount = customers.filter(
    c => c.type === CustomerType.COMMERCIAL || c.type === CustomerType.INDUSTRIAL
  ).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Customer Directory</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {totalCount} Active Clients
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registered solar clients, rooftop site installation profiles, and ongoing projects.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-solar-600 hover:bg-solar-700 text-white shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Sleek Filter & Search Strip */}
      <div className="p-2.5 bg-card border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs">
        {/* Quick Filter Tabs */}
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 border border-border text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === 'ALL'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Clients ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter(CustomerType.INDIVIDUAL)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === CustomerType.INDIVIDUAL
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Residential ({residentialCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter(CustomerType.COMMERCIAL)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === CustomerType.COMMERCIAL || typeFilter === CustomerType.INDUSTRIAL
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Commercial & Industrial ({commercialCount})
          </button>
        </div>

        {/* Live Search & Status */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, code, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-background border rounded-lg text-muted-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value={CustomerStatus.QUOTATION_SHARED}>Quotation Shared (Ask to Client)</option>
            <option value={CustomerStatus.ORDER_CONFIRMED}>Order Confirmed</option>
            <option value={CustomerStatus.SITE_WORK_IN_PROGRESS}>Site Work in Progress</option>
            <option value={CustomerStatus.ACTIVE}>Completed / Active</option>
            <option value={CustomerStatus.INACTIVE}>Inactive</option>
          </select>
        </form>
      </div>

      {/* Live Status Notification Banner */}
      {statusNotification && (
        <div
          className={`p-3 border rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            statusNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">{statusNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotification(null)}
            className="text-muted-foreground hover:text-foreground text-xs ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Customers Data Table */}
      <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
            <p>Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <UserCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-bold text-foreground">No Customers Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {search || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No customer records match your filter criteria. Try clearing filters.'
                : 'Convert prospective leads from the CRM pipeline or directly register new customers.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                to="/leads"
                className="px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition"
              >
                View Leads to Convert →
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition"
              >
                + Register Customer
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Customer Name & Type</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Installation Site</th>
                  <th className="py-3 px-4 text-center">Document Vault</th>
                  <th className="py-3 px-4 text-center">Status / Client Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map(customer => {
                  const initial = (customer.name || 'C').charAt(0).toUpperCase();
                  const isCommercial =
                    customer.type === CustomerType.COMMERCIAL ||
                    customer.type === CustomerType.INDUSTRIAL;

                  const cityStr =
                    customer.installationAddress?.city || customer.billingAddress?.city || 'Raipur';
                  const stateStr =
                    customer.installationAddress?.state || customer.billingAddress?.state || 'Chhattisgarh';
                  const pinStr =
                    customer.installationAddress?.postalCode || customer.billingAddress?.postalCode || '';

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-muted/30 transition group"
                    >
                      {/* Customer Code */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="hover:underline text-solar-600 text-left font-mono font-bold cursor-pointer"
                        >
                          {customer.customerCode}
                        </button>
                        <div className="text-[10px] text-muted-foreground font-sans">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Name & Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(customer)}
                              className="font-bold text-foreground hover:text-solar-600 text-left flex items-center space-x-1.5 transition cursor-pointer"
                            >
                              <span>{customer.name}</span>
                              {isCommercial && (
                                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              )}
                            </button>
                            {customer.companyName && (
                              <div className="text-[11px] text-muted-foreground font-medium">
                                {customer.companyName}
                              </div>
                            )}
                            <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border">
                              {customer.type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1 text-foreground">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <a
                              href={`tel:${customer.primaryPhone}`}
                              className="hover:underline font-mono"
                            >
                              {customer.primaryPhone}
                            </a>
                          </div>
                          {customer.email && (
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <a
                                href={`mailto:${customer.email}`}
                                className="hover:underline truncate max-w-[180px]"
                              >
                                {customer.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Site Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1 text-foreground">
                          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>
                            {cityStr}, {stateStr} {pinStr ? `(${pinStr})` : ''}
                          </span>
                        </div>
                        {customer.installationAddress?.addressLine1 && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                            {customer.installationAddress.addressLine1}
                          </div>
                        )}
                      </td>

                      {/* Document Vault Column */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openCustomerVault(customer)}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-xs cursor-pointer group/btn ${
                            (customer.documentCount || 0) > 0
                              ? 'bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/20 dark:text-blue-400'
                              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                          }`}
                          title={`Open ${customer.name}'s Document Vault`}
                        >
                          <FolderLock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover/btn:scale-110 transition-transform" />
                          <span>Vault ({(customer.documentCount || 0)})</span>
                          <span className="text-[10px] opacity-75 font-normal ml-0.5">+ Upload</span>
                        </button>
                      </td>

                      {/* Status / Client Stage with Interactive Dropdown */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <select
                            value={customer.status || CustomerStatus.ACTIVE}
                            disabled={updatingId === customer.id}
                            onChange={e => handleStatusChange(customer.id, e.target.value)}
                            className={`appearance-none cursor-pointer pl-3 pr-7 py-1 rounded-full text-xs font-semibold border transition shadow-xs focus:outline-none focus:ring-2 focus:ring-solar-500 disabled:opacity-50 ${getStatusBadgeConfig(customer.status).className}`}
                          >
                            <option value={CustomerStatus.QUOTATION_SHARED}>Quotation Shared (Ask to Client)</option>
                            <option value={CustomerStatus.ORDER_CONFIRMED}>Order Confirmed</option>
                            <option value={CustomerStatus.SITE_WORK_IN_PROGRESS}>Site Work in Progress</option>
                            <option value={CustomerStatus.ACTIVE}>Completed / Active</option>
                            <option value={CustomerStatus.INACTIVE}>Inactive</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            {updatingId === customer.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-base">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedCustomer.name}
                    </h3>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold bg-secondary text-secondary-foreground">
                      {selectedCustomer.customerCode}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusBadgeConfig(selectedCustomer.status).className}`}>
                      {getStatusBadgeConfig(selectedCustomer.status).label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCustomer.type} Account • Customer since{' '}
                    {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Direct Workflow Launch Hub */}
            <div className="p-3.5 bg-gradient-to-r from-solar-500/10 via-solar-500/5 to-emerald-500/10 border rounded-xl space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Direct Workflow Launch:</span>
                <span className="text-[11px] text-muted-foreground font-normal">Pre-filled with customer details</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Link
                  to={`/solar-designs?customerId=${selectedCustomer.id}&customerName=${encodeURIComponent(selectedCustomer.name)}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <Sun className="w-3.5 h-3.5" />
                    <span>1. Solar CAD</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">PV sizing simulation</span>
                </Link>

                <Link
                  to={`/quotations?customerId=${selectedCustomer.id}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>2. Quotation</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Draft proposal & BOM</span>
                </Link>

                <Link
                  to={`/orders?customerId=${selectedCustomer.id}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>3. Sales Order</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Billing & payments</span>
                </Link>

                <Link
                  to={`/projects?customerId=${selectedCustomer.id}&customerName=${encodeURIComponent(selectedCustomer.name)}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>4. 10-Stage EPC</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Installation tracker</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedCustomer;
                    setSelectedCustomer(null);
                    openCustomerVault(cust);
                  }}
                  className="p-2.5 bg-card hover:bg-muted/50 border border-blue-500/20 rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5 text-blue-600 font-semibold text-xs">
                    <FolderLock className="w-3.5 h-3.5" />
                    <span>5. Document Vault</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">KYC, Bills & Proofs</span>
                </button>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Contact Information */}
              <div className="p-4 bg-muted/30 border rounded-xl space-y-2">
                <h4 className="font-bold text-foreground flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-solar-500" />
                  <span>Contact Information</span>
                </h4>
                <div className="space-y-1.5 text-muted-foreground pt-1">
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <a
                      href={`tel:${selectedCustomer.primaryPhone}`}
                      className="font-bold text-foreground font-mono hover:underline"
                    >
                      {selectedCustomer.primaryPhone}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium text-foreground">
                      {selectedCustomer.email || 'None Provided'}
                    </span>
                  </div>
                  {selectedCustomer.companyName && (
                    <div className="flex justify-between">
                      <span>Company Name:</span>
                      <span className="font-medium text-foreground">
                        {selectedCustomer.companyName}
                      </span>
                    </div>
                  )}
                  {selectedCustomer.gstin && (
                    <div className="flex justify-between">
                      <span>GSTIN:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedCustomer.gstin}
                      </span>
                    </div>
                  )}
                  {selectedCustomer.pan && (
                    <div className="flex justify-between">
                      <span>PAN:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedCustomer.pan}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Site Installation Address */}
              <div className="p-4 bg-muted/30 border rounded-xl space-y-2">
                <h4 className="font-bold text-foreground flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-solar-500" />
                  <span>Installation Site Address</span>
                </h4>
                <div className="space-y-1 text-muted-foreground pt-1">
                  <p className="font-semibold text-foreground">
                    {selectedCustomer.installationAddress?.addressLine1 || selectedCustomer.name}
                  </p>
                  {selectedCustomer.installationAddress?.addressLine2 && (
                    <p>{selectedCustomer.installationAddress.addressLine2}</p>
                  )}
                  <p>
                    {selectedCustomer.installationAddress?.city || 'Raipur'},{' '}
                    {selectedCustomer.installationAddress?.state || 'Chhattisgarh'}{' '}
                    {selectedCustomer.installationAddress?.postalCode || '492001'}
                  </p>
                  <p>{selectedCustomer.installationAddress?.country || 'India'}</p>
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {selectedCustomer.notes && (
              <div className="p-3.5 bg-muted/20 border rounded-xl text-xs space-y-1">
                <span className="font-semibold text-muted-foreground">Internal Notes & History:</span>
                <p className="text-foreground">{selectedCustomer.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Register New Solar Client</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create direct customer record without requiring prior lead inquiry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Customer / Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Phone Number (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={primaryPhone}
                    onChange={e => setPrimaryPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Customer Account Type
                  </label>
                  <select
                    value={customerType}
                    onChange={e => setCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    <option value={CustomerType.INDIVIDUAL}>Residential / Homeowner</option>
                    <option value={CustomerType.COMMERCIAL}>Commercial Entity</option>
                    <option value={CustomerType.INDUSTRIAL}>Industrial Plant</option>
                    <option value={CustomerType.INSTITUTIONAL}>Institutional / NGO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              {(customerType === CustomerType.COMMERCIAL || customerType === CustomerType.INDUSTRIAL) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Company / Enterprise
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patel Solar Enterprises"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="08AAAAA0000A1Z5"
                      value={gstin}
                      onChange={e => setGstin(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      PAN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={pan}
                      onChange={e => setPan(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Installation Site Address */}
              <div className="space-y-2 pt-1 border-t">
                <span className="text-xs font-bold text-foreground">
                  Site Installation Address
                </span>
                <input
                  type="text"
                  placeholder="Street / Building Address / Landmark"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="City (e.g. Raipur)"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="State"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                  <input
                    type="text"
                    placeholder="PIN Code"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Client Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Electricity bill details, sanction load, roof dimensions..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Save Customer Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Document Vault Modal */}
      {vaultCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-base">
                  <FolderLock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-foreground">
                      Document Vault: {vaultCustomer.name}
                    </h3>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold bg-secondary text-secondary-foreground">
                      {vaultCustomer.customerCode}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Client KYC, Electricity Bills, Rooftop Deeds & DISCOM Sanction Letters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVaultCustomer(null);
                  setVaultUploadOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Alert Notifications inside Vault */}
            {vaultError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center justify-between">
                <span>{vaultError}</span>
                <button onClick={() => setVaultError(null)} className="ml-2 font-bold cursor-pointer">✕</button>
              </div>
            )}
            {vaultSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{vaultSuccess}</span>
                </div>
                <button onClick={() => setVaultSuccess(null)} className="ml-2 font-bold cursor-pointer">✕</button>
              </div>
            )}

            {/* Quick Actions & Header Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
              <div className="text-xs">
                <span className="font-bold text-foreground">
                  Attached Documents: {vaultDocuments.length}
                </span>
                <span className="text-muted-foreground ml-2">
                  • Phone: {vaultCustomer.primaryPhone}
                </span>
                {vaultCustomer.installationAddress?.city && (
                  <span className="text-muted-foreground ml-2">
                    • Site: {vaultCustomer.installationAddress.city}, {vaultCustomer.installationAddress.state}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  to={`/documents?customerId=${vaultCustomer.id}`}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground transition cursor-pointer"
                  title="Open in Full Document Vault"
                >
                  <span>Central Vault</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setVaultUploadOpen(!vaultUploadOpen)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border transition shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{vaultUploadOpen ? 'Close Custom Form' : '+ Custom Document'}</span>
                </button>
              </div>
            </div>

            {/* SECTION 1: DIRECT 1-CLICK SOLAR EPC DOCUMENT SLOTS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                  <FolderLock className="w-3.5 h-3.5 text-solar-500" />
                  <span>Direct Solar EPC Document Slots (1-Click Upload & Status)</span>
                </h4>
                <span className="text-[11px] text-muted-foreground">Direct KYC, Tax, Bill & Subsidy Proofs</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  {
                    key: 'ELECTRICITY_BILL',
                    title: 'Electricity Bill',
                    subtitle: 'Consumer No. & Sanctioned Load',
                    icon: Zap
                  },
                  {
                    key: 'AADHAAR_CARD',
                    title: 'Aadhaar Card',
                    subtitle: 'Applicant KYC Identity Proof',
                    icon: UserCheck
                  },
                  {
                    key: 'PAN_CARD',
                    title: 'PAN Card',
                    subtitle: 'Tax & Financial Identity Proof',
                    icon: CreditCard
                  },
                  {
                    key: 'PROPERTY_TAX_RECEIPT',
                    title: 'Property / House Tax',
                    subtitle: 'Roof Ownership / Municipal Bill',
                    icon: Landmark
                  },
                  {
                    key: 'BANK_PASSBOOK',
                    title: 'Bank Passbook / Cheque',
                    subtitle: 'PM Surya Ghar DBT Subsidy Account',
                    icon: Building2
                  },
                  {
                    key: 'SITE_PHOTOS',
                    title: 'Site & Rooftop Photos',
                    subtitle: 'Rooftop Layout & Meter Box',
                    icon: Camera
                  }
                ].map(slot => {
                  const Icon = slot.icon;
                  const existingDoc = vaultDocuments.find(d =>
                    d.category === slot.key ||
                    (slot.key === 'AADHAAR_CARD' && d.category === 'CUSTOMER_KYC') ||
                    (slot.key === 'PROPERTY_TAX_RECEIPT' && (d.category === 'PROPERTY_DEED' || d.category === 'TAX_RECEIPT')) ||
                    (slot.key === 'SITE_PHOTOS' && d.category === 'INSTALLATION_QUALITY')
                  );
                  const isUploading = uploadingSlotKey === slot.key;

                  return (
                    <div
                      key={slot.key}
                      className={`p-3 rounded-xl border transition shadow-xs flex flex-col justify-between ${
                        existingDoc
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-card border-border hover:border-solar-500/40 hover:bg-muted/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              existingDoc ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-solar-500/10 text-solar-600'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-xs text-foreground">{slot.title}</span>
                          </div>
                          {existingDoc && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Uploaded</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">{slot.subtitle}</p>
                        {existingDoc && (
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                            {existingDoc.originalFilename}
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 mt-2 border-t border-border/60 flex items-center justify-between gap-1">
                        {existingDoc ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVaultDownload(existingDoc)}
                              className="text-[11px] font-semibold text-solar-600 hover:text-solar-700 flex items-center space-x-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>View / Download</span>
                            </button>
                            <label className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer underline font-medium">
                              Replace
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleDirectSlotUpload(slot.key, slot.title, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <label className={`w-full py-1.5 px-2.5 rounded-lg text-center text-xs font-semibold cursor-pointer transition flex items-center justify-center space-x-1.5 ${
                            isUploading
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-solar-600 hover:bg-solar-700 text-white shadow-xs'
                          }`}>
                            {isUploading ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3" />
                                <span>+ Direct Upload</span>
                              </>
                            )}
                            <input
                              type="file"
                              className="hidden"
                              disabled={isUploading}
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleDirectSlotUpload(slot.key, slot.title, file);
                                e.target.value = '';
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

            {/* SECTION 2: LIVE GPS SITE GEOTAGGING */}
            <div className="p-3.5 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-solar-500/10 border border-rose-500/20 rounded-xl space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-foreground">
                        Site GPS Geotag Location (Rooftop Verification)
                      </h4>
                      {currentCoords && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>GPS Ready</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Required by DISCOM & PM Surya Ghar inspector for rooftop solar feasibility.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {fetchingLocation ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detecting Satellites...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-3.5 h-3.5" />
                        <span>📍 Fetch Current Location</span>
                      </>
                    )}
                  </button>

                  {currentCoords && (
                    <button
                      type="button"
                      onClick={handleSaveGeotag}
                      disabled={savingLocation}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {savingLocation ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save GPS to Vault</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {locationError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg font-medium">
                  {locationError}
                </div>
              )}

              {/* Coordinates Pill / Details */}
              {currentCoords && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-background/80 p-2.5 rounded-lg border text-xs">
                  <div className="flex items-center space-x-3 font-mono">
                    <span className="font-semibold text-foreground">
                      Lat: <span className="text-solar-600">{currentCoords.latitude.toFixed(6)}°</span>
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-semibold text-foreground">
                      Long: <span className="text-solar-600">{currentCoords.longitude.toFixed(6)}°</span>
                    </span>
                    {currentCoords.accuracy && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Accuracy: ±{currentCoords.accuracy}m</span>
                      </>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${currentCoords.latitude},${currentCoords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-solar-600 hover:text-solar-700 font-semibold"
                  >
                    <span>View on Google Maps Satellite</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Custom Upload Document Panel */}
            {vaultUploadOpen && (
              <form
                onSubmit={handleVaultFileUpload}
                className="p-4 bg-muted/20 border-2 border-solar-500/30 rounded-xl space-y-3.5 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                    <Upload className="w-3.5 h-3.5 text-solar-500" />
                    <span>Upload Custom Document to Client Vault</span>
                  </h4>
                  <span className="text-[11px] text-muted-foreground">PDF, JPG, PNG, WEBP, XLSX, DOCX (Max 25MB)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Category */}
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">
                      Solar EPC Category *
                    </label>
                    <select
                      value={newDocCategory}
                      onChange={e => setNewDocCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      <option value="ELECTRICITY_BILL">⚡ Electricity Bill (Consumer Proof)</option>
                      <option value="AADHAAR_CARD">🪪 Aadhaar Card (Applicant KYC)</option>
                      <option value="PAN_CARD">💳 PAN Card (Financial / Tax ID)</option>
                      <option value="PROPERTY_TAX_RECEIPT">🏛️ Property / House Tax Receipt (Roof Ownership)</option>
                      <option value="BANK_PASSBOOK">🏦 Bank Passbook / Cheque (PM Surya Ghar DBT Subsidy)</option>
                      <option value="SITE_PHOTOS">📸 Site & Rooftop Photos (Roof & Meter Box)</option>
                      <option value="SITE_GEOTAG_LOCATION">📍 GPS Site Geotag Verification</option>
                      <option value="QUOTATION_PROPOSAL">📋 Solar Quotation & Technical Proposal</option>
                      <option value="SIGNED_CONTRACT">✍️ Signed EPC Contract / Agreement</option>
                      <option value="NET_METERING_DOC">🔌 Net Metering Feasibility / DISCOM Sanction</option>
                      <option value="SUBSIDY_DOC">🏛️ PM Surya Ghar Govt Subsidy (DBT)</option>
                      <option value="OTHER">📄 Other Client Document</option>
                    </select>
                  </div>

                  {/* Access Classification */}
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">
                      Access Classification
                    </label>
                    <select
                      value={newDocClassification}
                      onChange={e => setNewDocClassification(e.target.value as any)}
                      className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      <option value="CUSTOMER_VISIBLE">Customer Visible (Available on Portal)</option>
                      <option value="INTERNAL_ONLY">Internal Only (Rarebox Staff Only)</option>
                    </select>
                  </div>

                  {/* Document Display Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-muted-foreground font-semibold mb-1">
                      Document Title / Safe Display Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Electricity Bill - Oct 2026 or Aadhaar Card Front & Back"
                      value={newDocDisplayName}
                      onChange={e => setNewDocDisplayName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  {/* File Selector */}
                  <div className="sm:col-span-2">
                    <label className="block text-muted-foreground font-semibold mb-1">
                      Select File from Device (PDF, Image, Doc)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        if (file && !newDocDisplayName) {
                          setNewDocDisplayName(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                      className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-solar-500/10 file:text-solar-700 hover:file:bg-solar-500/20 cursor-pointer bg-background border rounded-lg p-1.5"
                    />
                    {selectedFile && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Selected: <span className="font-semibold text-foreground">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setVaultUploadOpen(false);
                      setSelectedFile(null);
                    }}
                    className="px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingDoc}
                    className="px-4 py-1.5 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isUploadingDoc ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading to Vault...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Confirm & Save Document</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Attached Vault Documents List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">Client Vault Documents</h4>

              {vaultLoading ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-solar-500" />
                  <p className="text-xs">Loading client vault documents...</p>
                </div>
              ) : vaultDocuments.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl space-y-2">
                  <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-foreground">No Documents in Vault Yet</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Upload electricity bills, consumer KYC proofs, property deeds, or rooftop layout photos for this client.
                  </p>
                  <button
                    type="button"
                    onClick={() => setVaultUploadOpen(true)}
                    className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Upload First Document</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border border rounded-xl overflow-hidden bg-card text-xs">
                  {vaultDocuments.map(doc => {
                    const meta = getCategoryMeta(doc.category);
                    const docId = doc._id || doc.id;
                    const sizeKb = doc.fileSizeBytes ? (doc.fileSizeBytes / 1024).toFixed(1) : '—';
                    const uploadDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '';

                    return (
                      <div
                        key={docId}
                        className="p-3.5 hover:bg-muted/30 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-bold text-foreground truncate">
                                {doc.safeDisplayName || doc.originalFilename}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${meta.color}`}>
                                {meta.label}
                              </span>
                              {doc.accessClassification === 'CUSTOMER_VISIBLE' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-medium">
                                  Client Visible
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center space-x-2 mt-0.5">
                              <span className="font-mono">{doc.documentNumber}</span>
                              <span>•</span>
                              <span>{doc.originalFilename}</span>
                              <span>•</span>
                              <span>{sizeKb} KB</span>
                              {uploadDate && (
                                <>
                                  <span>•</span>
                                  <span>{uploadDate}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Document Actions */}
                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleVaultDownload(doc)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition cursor-pointer"
                            title="Download or Preview Document"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download / View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVaultDelete(docId, doc.safeDisplayName || doc.originalFilename)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition cursor-pointer"
                            title="Remove Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t text-xs">
              <span className="text-muted-foreground">
                Documents are cryptographically verified and encrypted in Rarebox Vault.
              </span>
              <button
                type="button"
                onClick={() => {
                  setVaultCustomer(null);
                  setVaultUploadOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition cursor-pointer"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
