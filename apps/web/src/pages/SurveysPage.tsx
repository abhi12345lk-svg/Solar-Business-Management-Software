import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Camera, AlertCircle, Layers, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/api.js';
import {
  SiteSurveyDto,
  SurveyStatus,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory
} from '@ins-solar/shared';

export const SurveysPage: React.FC = () => {
  const [surveys, setSurveys] = useState<SiteSurveyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Create Survey Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [leadId, setLeadId] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Rajasthan');
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
  const [photoFileName, setPhotoFileName] = useState('roof_aerial_01.jpg');

  const fetchSurveys = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const data = await apiClient<SiteSurveyDto[]>(`/surveys?${params.toString()}`);
      setSurveys(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load surveys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, [statusFilter]);

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

  const handleAttachPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;

    setAttachingPhoto(true);
    try {
      const storageKey = `surveys/${activeSurvey.surveyNumber}/${Date.now()}_${photoFileName}`;
      const payload = {
        photos: [
          {
            storageKey,
            fileName: photoFileName,
            fileSizeBytes: 2048500, // Safe metadata simulation
            mimeType: 'image/jpeg',
            category: photoCategory,
            caption: photoCaption.trim() || undefined
          }
        ]
      };

      const updated = await apiClient<SiteSurveyDto>(`/surveys/${activeSurvey.id}/photos`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setActiveSurvey(updated);
      setPhotoCaption('');
      fetchSurveys();
    } catch (err: any) {
      alert(err?.message || 'Failed to attach photo metadata.');
    } finally {
      setAttachingPhoto(false);
    }
  };

  const resetCreateForm = () => {
    setLeadId('');
    setAddressLine1('');
    setCity('');
    setState('Rajasthan');
    setPostalCode('');
    setObservations('');
    setCreateError(null);
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
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Site Survey</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search survey number, city, or state..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchSurveys()}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(SurveyStatus).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={fetchSurveys}
            className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition flex items-center space-x-1"
          >
            <Filter className="w-4 h-4 mr-1" />
            <span>Filter</span>
          </button>
        </div>
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
        ) : surveys.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Layers className="w-10 h-10 mx-auto text-solar-500 opacity-50" />
            <p className="font-semibold text-foreground">No site surveys recorded.</p>
            <p className="text-xs">
              Schedule a survey from a qualified lead to inspect rooftop area.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {surveys.map(srv => (
                  <tr key={srv.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-solar-600">
                      {srv.surveyNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {srv.leadCode || '—'}
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
                      {srv.proposedCapacityKw ? `${srv.proposedCapacityKw} kWp` : '—'}
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
                      <button
                        onClick={() => setActiveSurvey(srv)}
                        className="inline-flex items-center text-xs font-semibold text-solar-600 hover:text-solar-700 bg-solar-50 hover:bg-solar-100 px-2.5 py-1.5 rounded-md border border-solar-200 transition"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1" />
                        <span>Details & Photos ({srv.photos?.length || 0})</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Survey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">Schedule Site Survey</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSurvey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Lead ID (Mongoose ObjectId) *
                </label>
                <input
                  type="text"
                  required
                  value={leadId}
                  onChange={e => setLeadId(e.target.value)}
                  placeholder="e.g. 507f1f77bcf86cd799439011"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 font-mono"
                />
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
                    placeholder="Jaipur"
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">State *</label>
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

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
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
                  className="px-4 py-2 text-sm font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 shadow-sm disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground font-mono">
                  {activeSurvey.surveyNumber}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Status: <strong className="text-foreground">{activeSurvey.status}</strong> •
                  Usable Area: {activeSurvey.usableRoofAreaSqFt} sq.ft
                </p>
              </div>
              <button
                onClick={() => setActiveSurvey(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Evidence Photos Subdocuments */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-solar-500" />
                <span>Site Photos & Document Evidence ({activeSurvey.photos.length})</span>
              </h3>

              {activeSurvey.photos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/30 p-3 rounded-lg">
                  No site photos attached yet. Attach rooftop photos below.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSurvey.photos.map((p, idx) => (
                    <div key={idx} className="border bg-muted/30 p-3 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-solar-700 uppercase">{p.category}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {p.fileSizeBytes ? `${Math.round(p.fileSizeBytes / 1024)} KB` : ''}
                        </span>
                      </div>
                      <p className="font-mono text-muted-foreground truncate">{p.fileName}</p>
                      {p.caption && <p className="text-foreground italic">"{p.caption}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attach Photo Form */}
            <form onSubmit={handleAttachPhoto} className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Attach New Site Photo Metadata
              </h4>

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
                    {Object.values(SurveyPhotoCategory).map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Attachment File Name
                  </label>
                  <input
                    type="text"
                    required
                    value={photoFileName}
                    onChange={e => setPhotoFileName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 font-mono"
                  />
                </div>
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

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={attachingPhoto}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 shadow-sm disabled:opacity-50"
                >
                  {attachingPhoto ? 'Attaching...' : 'Attach Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
