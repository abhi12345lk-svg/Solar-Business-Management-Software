import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Camera,
  AlertCircle,
  Layers,
  Loader2,
  UploadCloud,
  Eye,
  Check,
  FileText,
  Download,
  Sun
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import {
  SiteSurveyDto,
  SurveyStatus,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory,
  LeadDto
} from '@ins-solar/shared';

// Helper to optimize/compress image files in browser for fast, real uploads
const compressImage = (
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<{ dataUrl: string; size: number }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, size: file.size });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return resolve({ dataUrl: objectUrl, size: file.size });
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const size = Math.round((dataUrl.length * 3) / 4);
      resolve({ dataUrl, size });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, size: file.size });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
  });
};

const isPdfPhoto = (p?: { mimeType?: string; fileName?: string; dataUrl?: string } | null) => {
  if (!p) return false;
  return (
    p.mimeType === 'application/pdf' ||
    Boolean(p.fileName?.toLowerCase().endsWith('.pdf')) ||
    Boolean(p.dataUrl?.startsWith('data:application/pdf'))
  );
};

export const SurveysPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get('leadId');

  const [surveys, setSurveys] = useState<SiteSurveyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Create Survey Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // CRM Leads State for Survey Creation
  const [availableLeads, setAvailableLeads] = useState<LeadDto[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [manualLeadEntry, setManualLeadEntry] = useState(false);

  // Form Fields
  const [leadId, setLeadId] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Chhattisgarh');
  const [postalCode, setPostalCode] = useState('');
  const [roofType, setRoofType] = useState<RoofType>(RoofType.RCC_FLAT);
  const [usableRoofAreaSqFt, setUsableRoofAreaSqFt] = useState('1000');
  const [monthlyUnitsKwh, setMonthlyUnitsKwh] = useState('500');
  const [averageMonthlyBillRs, setAverageMonthlyBillRs] = useState('4000');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState('5');
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>(ConnectionPhase.SINGLE);
  const [proposedCapacityKw, setProposedCapacityKw] = useState('4.5');
  const [scheduledDate, setScheduledDate] = useState('');
  const [orientationAzimuth, setOrientationAzimuth] = useState('South facing, 180°');
  const [observations, setObservations] = useState('');

  // Photo Attachment Modal State
  const [activeSurvey, setActiveSurvey] = useState<SiteSurveyDto | null>(null);
  const [attachingPhoto, setAttachingPhoto] = useState(false);
  const [photoCategory, setPhotoCategory] = useState<SurveyPhotoCategory>(SurveyPhotoCategory.ROOF);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchSurveys = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const data = await apiClient<any>(`/surveys?${params.toString()}`);
      const list = Array.isArray(data) ? data : data?.items || data?.surveys || [];
      setSurveys(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load surveys.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSurveys();
  };

  const handleUpdateStatus = async (surveyId: string, newStatus: SurveyStatus) => {
    setUpdatingStatus(true);
    try {
      await apiClient(`/surveys/${surveyId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setSurveys(prev =>
        prev.map(s => (s.id === surveyId ? { ...s, status: newStatus } : s))
      );
      if (activeSurvey && activeSurvey.id === surveyId) {
        setActiveSurvey(prev => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update survey status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fetchAvailableLeads = async () => {
    setLoadingLeads(true);
    try {
      const data = await apiClient<any>('/leads?limit=100');
      const list = Array.isArray(data) ? data : data?.items || data?.leads || [];
      setAvailableLeads(list);
    } catch {
      // Non-blocking
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  useEffect(() => {
    if (showCreateModal && availableLeads.length === 0) {
      fetchAvailableLeads();
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (leadIdFromUrl) {
      setLeadId(leadIdFromUrl);
      setShowCreateModal(true);
      fetchAvailableLeads();
      apiClient<LeadDto>(`/leads/${leadIdFromUrl}`)
        .then(lead => {
          if (lead) {
            if (lead.location) {
              if (lead.location.street) setAddressLine1(lead.location.street);
              if (lead.location.city) setCity(lead.location.city);
              if (lead.location.state) setState(lead.location.state);
              if (lead.location.pinCode) setPostalCode(lead.location.pinCode);
            }
            if (lead.estimatedCapacityKw) {
              setProposedCapacityKw(String(lead.estimatedCapacityKw));
            }
          }
        })
        .catch(() => {});
    }
  }, [leadIdFromUrl]);

  const handleSelectLead = (selectedId: string) => {
    setLeadId(selectedId);
    const lead = availableLeads.find(l => l.id === selectedId);
    if (lead) {
      if (lead.location) {
        if (lead.location.street) setAddressLine1(lead.location.street);
        if (lead.location.city) setCity(lead.location.city);
        if (lead.location.state) setState(lead.location.state);
        if (lead.location.pinCode) setPostalCode(lead.location.pinCode);
      }
      if (lead.estimatedCapacityKw) {
        setProposedCapacityKw(String(lead.estimatedCapacityKw));
      }
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        leadId: leadId.trim(),
        siteAddress: {
          type: 'SITE_INSTALLATION' as any,
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: 'India'
        },
        roofType,
        usableRoofAreaSqFt: parseFloat(usableRoofAreaSqFt),
        monthlyUnitsKwh: monthlyUnitsKwh ? parseFloat(monthlyUnitsKwh) : undefined,
        averageMonthlyBillPaise: averageMonthlyBillRs
          ? Math.round(parseFloat(averageMonthlyBillRs) * 100)
          : undefined, // Convert rupees to integer paise
        sanctionedLoadKw: parseFloat(sanctionedLoadKw),
        connectionPhase,
        proposedCapacityKw: proposedCapacityKw ? parseFloat(proposedCapacityKw) : undefined,
        orientationAzimuth: orientationAzimuth.trim() || undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        observations: observations.trim() || undefined
      };

      await apiClient<SiteSurveyDto>('/surveys', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      resetCreateForm();
      fetchSurveys();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create survey.');
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    try {
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file, 1600, 0.85);
        setPhotoPreviewUrl(compressed.dataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = () => setPhotoPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
      }
    } catch {
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAttachPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    if (!photoFile && !photoPreviewUrl) {
      alert('Please select or drag & drop a site photo first.');
      return;
    }

    setAttachingPhoto(true);
    try {
      const fileName = photoFile ? photoFile.name : `photo_${Date.now()}.jpg`;
      const mimeType = photoFile ? photoFile.type || 'image/jpeg' : 'image/jpeg';
      const fileSizeBytes = photoFile ? photoFile.size : 500000;
      const storageKey = `surveys/${activeSurvey.surveyNumber}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const payload = {
        photos: [
          {
            storageKey,
            fileName,
            fileSizeBytes,
            mimeType: (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType) as any,
            category: photoCategory,
            caption: photoCaption.trim() || undefined,
            dataUrl: photoPreviewUrl || undefined
          }
        ]
      };

      const updated = await apiClient<SiteSurveyDto>(`/surveys/${activeSurvey.id}/photos`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setActiveSurvey(updated);
      setPhotoCaption('');
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchSurveys();
    } catch (err: any) {
      alert(err?.message || 'Failed to attach photo.');
    } finally {
      setAttachingPhoto(false);
    }
  };

  const resetCreateForm = () => {
    setLeadId('');
    setAddressLine1('');
    setCity('');
    setState('Chhattisgarh');
    setPostalCode('');
    setObservations('');
    setCreateError(null);
    setManualLeadEntry(false);
  };

  const getStatusBadge = (status: SurveyStatus) => {
    switch (status) {
      case SurveyStatus.DRAFT:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
      case SurveyStatus.SCHEDULED:
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case SurveyStatus.IN_PROGRESS:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case SurveyStatus.COMPLETED:
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case SurveyStatus.REJECTED:
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      case SurveyStatus.CANCELLED:
        return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  const totalCount = surveys.length;
  const draftCount = surveys.filter(s =>
    [SurveyStatus.DRAFT, SurveyStatus.SCHEDULED, SurveyStatus.IN_PROGRESS].includes(s.status)
  ).length;
  const completedCount = surveys.filter(s => s.status === SurveyStatus.COMPLETED).length;

  const filteredSurveys = surveys.filter(s => {
    if (statusFilter === 'DRAFT') {
      return [SurveyStatus.DRAFT, SurveyStatus.SCHEDULED, SurveyStatus.IN_PROGRESS].includes(s.status);
    }
    if (statusFilter === SurveyStatus.COMPLETED) {
      return s.status === SurveyStatus.COMPLETED;
    }
    if (statusFilter !== 'ALL') {
      return s.status === statusFilter;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Site Surveys & Feasibility
          </h1>
          <p className="text-sm text-muted-foreground">
            Rooftop audits, shadow analyses, electrical loads, and site evidence logs.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Site Survey</span>
        </button>
      </div>

      {/* Sleek Filter & Search Strip */}
      <div className="p-2.5 bg-card border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs">
        {/* Quick Filter Tabs */}
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 border border-border text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Surveys ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === 'DRAFT'
                ? 'bg-background text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pending / Draft ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(SurveyStatus.COMPLETED)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === SurveyStatus.COMPLETED
                ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Live Search & Status Select */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search survey number, lead, city..."
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
            {Object.values(SurveyStatus).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </form>
      </div>

      {/* Survey List Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
            <p>Loading site surveys...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Layers className="w-10 h-10 mx-auto text-solar-500 opacity-50" />
            <p className="font-semibold text-foreground">No site surveys found in this view.</p>
            <p className="text-xs">
              Try resetting the filter tab or schedule a new survey.
            </p>
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSearch('');
              }}
              className="mt-2 px-3 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="block md:hidden divide-y">
              {filteredSurveys.map(srv => {
                const leadIdStr =
                  typeof srv.leadId === 'object' && srv.leadId
                    ? (srv.leadId as any)._id || (srv.leadId as any).id
                    : srv.leadId;
                return (
                  <div key={srv.id} className="p-4 hover:bg-muted/30 transition-colors space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setActiveSurvey(srv)}
                          className="font-mono text-xs font-bold text-solar-600 hover:underline block text-left cursor-pointer"
                        >
                          {srv.surveyNumber}
                        </button>
                        <h3 className="font-bold text-sm text-foreground truncate mt-0.5">
                          {leadIdStr ? (
                            <Link to={`/leads/${leadIdStr}`} className="hover:text-solar-600 hover:underline">
                              {srv.prospectName || srv.leadCode || 'Site Survey'}
                            </Link>
                          ) : (
                            srv.prospectName || srv.leadCode || 'Site Survey'
                          )}
                        </h3>
                        {srv.siteAddress?.city && (
                          <p className="text-xs text-muted-foreground truncate">
                            📍 {srv.siteAddress.city}, {srv.siteAddress.state}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${getStatusBadge(
                          srv.status
                        )}`}
                      >
                        {srv.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          Roof & Usable Area
                        </span>
                        <span className="font-semibold text-foreground">
                          {srv.roofType} • {srv.usableRoofAreaSqFt} sq.ft
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          Proposed Capacity
                        </span>
                        <span className="font-bold text-solar-600">
                          {srv.proposedCapacityKw ? `${srv.proposedCapacityKw} kWp` : '5 kWp'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs gap-2">
                      <button
                        onClick={() => setActiveSurvey(srv)}
                        className="inline-flex items-center font-bold text-xs text-foreground bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-md border border-border transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-solar-500" />
                        <span>Audit Details</span>
                        {Boolean(srv.photos && srv.photos.length > 0) && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-solar-500/15 text-solar-700 dark:text-solar-300 font-bold">
                            {srv.photos.length}
                          </span>
                        )}
                      </button>
                      <Link
                        to={`/solar-designs?surveyId=${(srv as any)._id || srv.id}&capacity=${srv.proposedCapacityKw || 5}&leadId=${(srv as any).leadId?._id || srv.leadId || ''}&customerId=${(srv as any).customerId?._id || (srv as any).customerId || ''}`}
                        className="inline-flex items-center text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-md border border-emerald-500/30 transition cursor-pointer"
                      >
                        <Sun className="w-3.5 h-3.5 mr-1" />
                        <span>PV Sizing →</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Survey ID</th>
                    <th className="py-3 px-4">Originating Lead</th>
                    <th className="py-3 px-4">Site Location</th>
                    <th className="py-3 px-4">Roof Type</th>
                    <th className="py-3 px-4">Usable Area</th>
                    <th className="py-3 px-4">Load / Phase</th>
                    <th className="py-3 px-4">Proposed</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSurveys.map(srv => {
                    const leadIdStr =
                      typeof srv.leadId === 'object' && srv.leadId
                        ? (srv.leadId as any)._id || (srv.leadId as any).id
                        : srv.leadId;
                    return (
                      <tr key={srv.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold">
                          <button
                            type="button"
                            onClick={() => setActiveSurvey(srv)}
                            className="text-solar-600 hover:text-solar-700 hover:underline cursor-pointer text-left"
                          >
                            {srv.surveyNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {leadIdStr ? (
                            <Link
                              to={`/leads/${leadIdStr}`}
                              className="text-foreground hover:text-solar-600 hover:underline font-semibold"
                            >
                              {srv.leadCode || 'Lead Record'}
                            </Link>
                          ) : (
                            srv.leadCode || '—'
                          )}
                          {srv.prospectName && (
                            <span className="block text-xs text-muted-foreground">
                              {srv.prospectName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {srv.siteAddress.city}, {srv.siteAddress.state}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">{srv.roofType}</td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {srv.usableRoofAreaSqFt} sq.ft
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {srv.sanctionedLoadKw} kW ({srv.connectionPhase})
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {srv.proposedCapacityKw ? `${srv.proposedCapacityKw} kWp` : '5 kWp'}
                          {Boolean(
                            srv.proposedCapacityKw &&
                            srv.sanctionedLoadKw &&
                            srv.proposedCapacityKw > srv.sanctionedLoadKw
                          ) && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold block mt-1 border border-amber-500/20">
                              ⚠️ Load Enh. Req.
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                              srv.status
                            )}`}
                          >
                            {srv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => setActiveSurvey(srv)}
                              className="inline-flex items-center text-xs font-semibold text-foreground hover:text-solar-600 bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 rounded-md border border-border transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 mr-1 text-solar-500" />
                              <span>Audit Details</span>
                              {Boolean(srv.photos && srv.photos.length > 0) && (
                                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-solar-500/15 text-solar-700 dark:text-solar-300 font-bold">
                                  {srv.photos.length}
                                </span>
                              )}
                            </button>
                            <Link
                              to={`/solar-designs?surveyId=${(srv as any)._id || srv.id}&capacity=${srv.proposedCapacityKw || 5}&leadId=${(srv as any).leadId?._id || srv.leadId || ''}&customerId=${(srv as any).customerId?._id || (srv as any).customerId || ''}`}
                              className="inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-md border border-emerald-500/30 transition cursor-pointer"
                              title="Proceed to Solar PV CAD & Sizing"
                            >
                              <Sun className="w-3.5 h-3.5 mr-1" />
                              <span>PV Sizing →</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Create Survey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Schedule Site Survey
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSurvey} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {createError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Originating Solar Lead <span className="text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setManualLeadEntry(!manualLeadEntry);
                        setLeadId('');
                      }}
                      className="text-[11px] text-solar-600 dark:text-solar-400 hover:underline font-medium"
                    >
                      {manualLeadEntry ? '← Select from CRM Leads' : 'Custom / Search by Code'}
                    </button>
                  </div>

                  {!manualLeadEntry ? (
                    <div className="space-y-2">
                      <select
                        required
                        value={leadId}
                        onChange={e => handleSelectLead(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                      >
                        <option value="">
                          {loadingLeads
                            ? 'Loading CRM leads...'
                            : '-- Select Active Lead from CRM --'}
                        </option>
                        {availableLeads.map(lead => (
                          <option key={lead.id} value={lead.id}>
                            {lead.leadCode} — {lead.prospectName} ({lead.prospectPhone})
                            {lead.location?.city ? ` • ${lead.location.city}` : ''}
                          </option>
                        ))}
                      </select>
                      {availableLeads.length === 0 && !loadingLeads && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No active leads found. Switch to custom entry or create a Lead in CRM
                          first.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        value={leadId}
                        onChange={e => setLeadId(e.target.value)}
                        placeholder="Enter Lead Code (e.g. LEAD-2026-00001) or Phone"
                        className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        System will automatically resolve and link the survey to this Lead record.
                      </p>
                    </div>
                  )}

                  {/* Selected Lead Summary Preview */}
                  {leadId &&
                    !manualLeadEntry &&
                    (() => {
                      const selectedLead = availableLeads.find(l => l.id === leadId);
                      if (!selectedLead) return null;
                      return (
                        <div className="mt-2 p-2.5 bg-solar-50/70 dark:bg-solar-950/30 border border-solar-200 dark:border-solar-800/60 rounded-lg text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-solar-800 dark:text-solar-300">
                              {selectedLead.prospectName}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              📞 {selectedLead.prospectPhone}
                            </span>
                            {selectedLead.location?.city && (
                              <span className="text-muted-foreground ml-2">
                                📍 {selectedLead.location.city}, {selectedLead.location.state}
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-solar-100 text-solar-800 dark:bg-solar-900/60 dark:text-solar-300 font-mono">
                            {selectedLead.leadCode}
                          </span>
                        </div>
                      );
                    })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={e => setAddressLine1(e.target.value)}
                      placeholder="e.g. Plot 12, Industrial Area"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Raipur"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={e => setPostalCode(e.target.value)}
                      placeholder="302001"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Roof Type *
                    </label>
                    <select
                      value={roofType}
                      onChange={e => setRoofType(e.target.value as RoofType)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      {Object.values(RoofType).map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Usable Roof Area (sq.ft) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={usableRoofAreaSqFt}
                      onChange={e => setUsableRoofAreaSqFt(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Sanctioned Load (kW) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={sanctionedLoadKw}
                      onChange={e => setSanctionedLoadKw(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Phase</label>
                    <select
                      value={connectionPhase}
                      onChange={e => setConnectionPhase(e.target.value as ConnectionPhase)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      <option value={ConnectionPhase.SINGLE}>Single Phase</option>
                      <option value={ConnectionPhase.THREE}>Three Phase</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Proposed (kWp)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={proposedCapacityKw}
                      onChange={e => setProposedCapacityKw(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Units (kWh/mo)
                    </label>
                    <input
                      type="number"
                      value={monthlyUnitsKwh}
                      onChange={e => setMonthlyUnitsKwh(e.target.value)}
                      placeholder="500"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Monthly Bill (₹)
                    </label>
                    <input
                      type="number"
                      value={averageMonthlyBillRs}
                      onChange={e => setAverageMonthlyBillRs(e.target.value)}
                      placeholder="4000"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                {parseFloat(proposedCapacityKw) > parseFloat(sanctionedLoadKw) && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
                    <span className="text-base">⚠️</span>
                    <span>
                      <strong>DISCOM Load Advisory:</strong> Proposed system capacity (
                      {proposedCapacityKw} kWp) exceeds the customer's sanctioned load (
                      {sanctionedLoadKw} kW). Net Metering utility clearance will require a formal
                      Load Enhancement filing with the DISCOM division.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Orientation & Azimuth
                  </label>
                  <input
                    type="text"
                    value={orientationAzimuth}
                    onChange={e => setOrientationAzimuth(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Surveyor Observations
                  </label>
                  <textarea
                    rows={2}
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Waterproofing status, RCC parapet wall height, tree shadows..."
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t bg-card shrink-0 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm font-bold bg-solar-600 text-white rounded-lg hover:bg-solar-700 shadow-sm disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Create Site Survey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Photos Attachment Modal */}
      {activeSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-bold text-foreground font-mono truncate">
                    {activeSurvey.surveyNumber}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${getStatusBadge(
                      activeSurvey.status
                    )}`}
                  >
                    {activeSurvey.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activeSurvey.prospectName ? (
                    <strong className="text-foreground">{activeSurvey.prospectName}</strong>
                  ) : (
                    activeSurvey.leadCode || 'Site Feasibility Audit'
                  )}{' '}
                  • {activeSurvey.siteAddress?.city || ''}, {activeSurvey.siteAddress?.state || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSurvey(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-sm font-semibold shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Feasibility & Technical Audit Specifications */}
              <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                    <Sun className="w-3.5 h-3.5 mr-1.5 text-solar-500" />
                    <span>Technical Feasibility & Site Audit Findings</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {activeSurvey.leadCode || ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Roof Structure</span>
                    <span className="font-bold text-foreground">{activeSurvey.roofType}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Usable Roof Area</span>
                    <span className="font-bold text-foreground">{activeSurvey.usableRoofAreaSqFt} sq.ft</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Sanctioned Load & Phase</span>
                    <span className="font-bold text-foreground">
                      {activeSurvey.sanctionedLoadKw} kW ({activeSurvey.connectionPhase})
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Proposed Solar System</span>
                    <span className="font-bold text-solar-600 text-sm">
                      {activeSurvey.proposedCapacityKw ? `${activeSurvey.proposedCapacityKw} kWp` : '5 kWp'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border/40">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Installation Site Address</span>
                    <span className="font-medium text-foreground">
                      {activeSurvey.siteAddress?.addressLine1 ? `${activeSurvey.siteAddress.addressLine1}, ` : ''}
                      {activeSurvey.siteAddress?.city}, {activeSurvey.siteAddress?.state}
                      {activeSurvey.siteAddress?.postalCode ? ` - ${activeSurvey.siteAddress.postalCode}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Orientation & Azimuth</span>
                    <span className="font-medium text-foreground">
                      {activeSurvey.orientationAzimuth || 'South Facing (180° optimal solar window)'}
                    </span>
                  </div>
                </div>

                {activeSurvey.observations && (
                  <div className="text-xs pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground block">Surveyor Field Observations</span>
                    <p className="text-foreground italic mt-0.5">"{activeSurvey.observations}"</p>
                  </div>
                )}

                {Boolean(
                  activeSurvey.proposedCapacityKw &&
                  activeSurvey.sanctionedLoadKw &&
                  activeSurvey.proposedCapacityKw > activeSurvey.sanctionedLoadKw
                ) && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
                    <span className="text-sm">⚠️</span>
                    <span>
                      <strong>DISCOM Notice:</strong> Proposed capacity ({activeSurvey.proposedCapacityKw} kWp) exceeds sanctioned load ({activeSurvey.sanctionedLoadKw} kW). Utility Load Enhancement filing required.
                    </span>
                  </div>
                )}

                {/* Status Signoff Bar */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  {activeSurvey.status === SurveyStatus.COMPLETED ? (
                    <div className="flex items-center space-x-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                      <span>Site Feasibility Verified & Completed</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">
                        Status: <strong className="text-amber-600">{activeSurvey.status}</strong> (Pending verification)
                      </span>
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus(activeSurvey.id, SurveyStatus.COMPLETED)}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {updatingStatus ? 'Updating...' : 'Mark Survey Completed ✓'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Evidence Photos Subdocuments */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Camera className="w-4 h-4 text-solar-500" />
                    <span>Site Photos & Document Evidence ({activeSurvey.photos.length})</span>
                  </span>
                  {activeSurvey.photos.length > 0 && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Click any photo to view full resolution
                    </span>
                  )}
                </h3>

                {activeSurvey.photos.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20 text-muted-foreground text-xs space-y-1">
                    <Camera className="w-8 h-8 mx-auto text-solar-500 opacity-60" />
                    <p className="font-semibold text-foreground">No site photos attached yet</p>
                    <p className="text-[11px]">
                      Upload photos of rooftop, parapet walls, shadow obstacles, and electrical
                      panels below.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {activeSurvey.photos.map((p, idx) => (
                      <div
                        key={idx}
                        className="group relative border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition flex flex-col"
                      >
                        <div
                          className="h-36 bg-muted/40 relative overflow-hidden flex items-center justify-center cursor-pointer"
                          onClick={() => setLightboxPhoto(p)}
                        >
                          {isPdfPhoto(p) ? (
                            <div className="flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 w-full h-full">
                              <div className="p-2.5 bg-red-100 dark:bg-red-900/50 rounded-xl text-red-600 dark:text-red-400 mb-1.5 shadow-sm">
                                <FileText className="w-8 h-8" />
                              </div>
                              <span className="text-[11px] font-bold text-foreground truncate max-w-[140px]">
                                {p.fileName}
                              </span>
                              <span className="text-[9px] text-red-600 dark:text-red-400 font-semibold uppercase mt-0.5">
                                PDF Document
                              </span>
                            </div>
                          ) : (
                            <img
                              src={
                                p.dataUrl || `/api/v1/surveys/${activeSurvey.id}/photos/${idx}/view`
                              }
                              alt={p.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold space-x-1">
                            <Eye className="w-4 h-4" />
                            <span>{isPdfPhoto(p) ? 'View Document' : 'View Full Photo'}</span>
                          </div>
                        </div>
                        <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-solar-100 text-solar-800 dark:bg-solar-900/60 dark:text-solar-300 uppercase tracking-wide">
                                {p.category}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {p.fileSizeBytes ? `${Math.round(p.fileSizeBytes / 1024)} KB` : ''}
                              </span>
                            </div>
                            <p
                              className="text-xs font-semibold text-foreground truncate mt-1"
                              title={p.fileName}
                            >
                              {p.fileName}
                            </p>
                            {p.caption && (
                              <p
                                className="text-[11px] text-muted-foreground italic truncate"
                                title={p.caption}
                              >
                                "{p.caption}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach Photo Form */}
              <form onSubmit={handleAttachPhoto} className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center space-x-1.5">
                  <UploadCloud className="w-4 h-4 text-solar-500" />
                  <span>Upload New Rooftop Photo / Document</span>
                </h4>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Real Drag & Drop / File Selector Area */}
                {!photoPreviewUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const syntheticEvent = { target: { files: [file] } } as any;
                        handleFileChange(syntheticEvent);
                      }
                    }}
                    className="border-2 border-dashed border-border hover:border-solar-500 hover:bg-solar-50/10 cursor-pointer rounded-xl p-6 text-center transition space-y-2"
                  >
                    <Camera className="w-9 h-9 mx-auto text-solar-500" />
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Click to choose rooftop photo from computer/mobile or drag & drop here
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Supports JPEG, PNG, WebP, HEIC & PDF (Automatic client-side optimization for
                        fast upload)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-xl p-3 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {photoFile?.type === 'application/pdf' ||
                      photoFile?.name.toLowerCase().endsWith('.pdf') ? (
                        <div className="w-16 h-16 rounded-lg border bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex flex-col items-center justify-center shadow-sm">
                          <FileText className="w-7 h-7" />
                          <span className="text-[9px] font-bold">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={photoPreviewUrl}
                          alt="Upload preview"
                          className="w-16 h-16 object-cover rounded-lg border shadow-sm"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-foreground truncate max-w-xs">
                          {photoFile?.name || 'Selected File'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {photoFile?.size ? `${Math.round(photoFile.size / 1024)} KB` : 'Ready'}
                        </p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center mt-0.5">
                          <Check className="w-3 h-3 mr-1" /> File selected & ready
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition font-medium"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Photo Category
                    </label>
                    <select
                      value={photoCategory}
                      onChange={e => setPhotoCategory(e.target.value as SurveyPhotoCategory)}
                      className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      <option value={SurveyPhotoCategory.ROOF}>🏠 Rooftop & Civil Structure</option>
                      <option value={SurveyPhotoCategory.DISTRIBUTION_BOARD}>
                        ⚡ Electrical Distribution Board
                      </option>
                      <option value={SurveyPhotoCategory.METER}>
                        ⚡ Energy Meter & Service Line
                      </option>
                      <option value={SurveyPhotoCategory.EARTHING_PIT}>
                        ⚡ Earthing Pit & Grounding
                      </option>
                      <option value={SurveyPhotoCategory.SHADOW_OBSTRUCTION}>
                        🌳 Obstacle & Shadow Source (Trees/Chimneys)
                      </option>
                      <option value={SurveyPhotoCategory.OTHER}>
                        📄 Document / Other Evidence
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Caption / Observations
                    </label>
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={e => setPhotoCaption(e.target.value)}
                      placeholder="e.g. South azimuth unshaded zone, 3-phase meter board..."
                      className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={attachingPhoto || !photoPreviewUrl}
                    className="px-4 py-2 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {attachingPhoto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading Photo...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload & Attach Photo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="p-3 sm:p-4 border-t bg-card shrink-0 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveSurvey(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary rounded-lg transition cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/solar-designs?surveyId=${(activeSurvey as any)._id || activeSurvey.id}&capacity=${activeSurvey.proposedCapacityKw || 5}&leadId=${(activeSurvey as any).leadId?._id || activeSurvey.leadId || ''}&customerId=${(activeSurvey as any).customerId?._id || (activeSurvey as any).customerId || ''}`}
                className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-sm transition inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Proceed to PV Sizing (CAD) →</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Fullscreen Photo Viewer Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-card border rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b flex items-center justify-between bg-muted/40">
              <div>
                <h3 className="text-sm font-bold text-foreground font-mono">
                  {lightboxPhoto.fileName}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-solar-100 text-solar-800 dark:bg-solar-900/60 dark:text-solar-300 uppercase">
                  {lightboxPhoto.category}
                </span>
              </div>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-black/90 min-h-[300px]">
              {isPdfPhoto(lightboxPhoto) ? (
                <div className="w-full h-[70vh] flex flex-col bg-card rounded-xl p-4 text-center space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div className="flex items-center space-x-2 text-left">
                      <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground truncate max-w-sm">
                          {lightboxPhoto.fileName}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {lightboxPhoto.fileSizeBytes
                            ? `${Math.round(lightboxPhoto.fileSizeBytes / 1024)} KB • `
                            : ''}
                          PDF Survey Document
                        </p>
                      </div>
                    </div>
                    {lightboxPhoto.dataUrl && (
                      <a
                        href={lightboxPhoto.dataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={lightboxPhoto.fileName}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 shadow-sm transition"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download / Open
                      </a>
                    )}
                  </div>
                  {lightboxPhoto.dataUrl && (
                    <iframe
                      src={lightboxPhoto.dataUrl}
                      title={lightboxPhoto.fileName}
                      className="w-full flex-1 rounded-lg border bg-white"
                    />
                  )}
                </div>
              ) : (
                <img
                  src={lightboxPhoto.dataUrl || `/api/v1/surveys/${activeSurvey?.id}/photos/0/view`}
                  alt={lightboxPhoto.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
            {lightboxPhoto.caption && (
              <div className="p-3 border-t bg-muted/20 text-xs text-foreground italic">
                "{lightboxPhoto.caption}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
