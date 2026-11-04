import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Phone,
  AlertCircle,
  Sun,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { LeadDto, LeadStatus, LeadSource, LeadPriority, SolarRequirement } from '@ins-solar/shared';

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // New Lead Modal State (The only modal on this page)
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [city, setCity] = useState('Raipur');
  const [state, setState] = useState('Chhattisgarh');
  const [pinCode, setPinCode] = useState('');
  const [street, setStreet] = useState('');
  const [source, setSource] = useState<LeadSource>(LeadSource.WEBSITE);
  const [reference, setReference] = useState('');
  const [solarRequirement, setSolarRequirement] = useState<SolarRequirement>(
    SolarRequirement.RESIDENTIAL
  );
  const [estimatedCapacityKw, setEstimatedCapacityKw] = useState<string>('5');
  const [priority, setPriority] = useState<LeadPriority>(LeadPriority.MEDIUM);
  const [notes, setNotes] = useState('');

  // Duplicate phone warning state
  const [checkingDup, setCheckingDup] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const data = await apiClient<LeadDto[]>(`/leads?${params.toString()}`);
      setLeads(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  // Direct Inline Status Update
  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingId(leadId);
    setStatusNotification(null);
    try {
      const updated = await apiClient<LeadDto>(`/leads/${leadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });

      // Update lead in local state
      setLeads(prev => prev.map(l => (l.id === leadId ? updated : l)));

      const statusLabels: Record<string, string> = {
        [LeadStatus.NEW]: 'New',
        [LeadStatus.FOLLOW_UP]: 'Follow Up',
        [LeadStatus.PAYMENT_PENDING]: 'Payment Pending',
        [LeadStatus.CONVERTED]: 'Converted'
      };

      setStatusNotification({
        message: `Status updated to ${statusLabels[newStatus] || newStatus}`,
        type: 'success'
      });

      setTimeout(() => {
        setStatusNotification(null);
      }, 3500);
    } catch (err: any) {
      setStatusNotification({
        message: err?.message || 'Failed to update lead status.',
        type: 'error'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle phone change and advisory duplicate check
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProspectPhone(val);

    if (val.trim().length >= 10) {
      setCheckingDup(true);
      try {
        const res = await apiClient<{
          isDuplicate: boolean;
          matchingLeadsCount: number;
          matchingCustomersCount: number;
        }>(`/leads/check-duplicate?phone=${encodeURIComponent(val.trim())}`);

        if (res.isDuplicate) {
          setDupWarning(
            `Notice: Phone matches ${res.matchingLeadsCount} existing lead(s) and ${res.matchingCustomersCount} customer(s).`
          );
        } else {
          setDupWarning(null);
        }
      } catch {
        setDupWarning(null);
      } finally {
        setCheckingDup(false);
      }
    } else {
      setDupWarning(null);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      let formattedPhone = prospectPhone.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`;
      }

      const payload = {
        prospectName: prospectName.trim(),
        prospectPhone: formattedPhone,
        prospectEmail: prospectEmail.trim() || undefined,
        location: {
          city: city.trim(),
          state: state.trim(),
          pinCode: pinCode.trim() || undefined,
          street: street.trim() || undefined
        },
        source,
        reference: reference.trim() || undefined,
        solarRequirement,
        estimatedCapacityKw: estimatedCapacityKw ? parseFloat(estimatedCapacityKw) : undefined,
        priority,
        notes: notes.trim() || undefined
      };

      const newLead = await apiClient<LeadDto>('/leads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      resetForm();
      setLeads(prev => [newLead, ...prev.filter(l => l.id !== newLead.id)]);
      setStatusNotification({
        message: `Lead for ${newLead.prospectName} added successfully!`,
        type: 'success'
      });
      setTimeout(() => setStatusNotification(null), 3500);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create lead.';
      if (msg.includes('E11000') || msg.includes('duplicate key')) {
        setCreateError(
          'A lead with this phone number or code already exists. Please retry or verify details.'
        );
      } else {
        setCreateError(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setProspectName('');
    setProspectPhone('');
    setProspectEmail('');
    setCity('Raipur');
    setState('Chhattisgarh');
    setPinCode('');
    setStreet('');
    setReference('');
    setNotes('');
    setDupWarning(null);
    setCreateError(null);
  };

  // Badge styling for statuses
  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.NEW:
        return 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case LeadStatus.FOLLOW_UP:
        return 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case LeadStatus.PAYMENT_PENDING:
        return 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case LeadStatus.CONVERTED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case LeadStatus.LOST:
        return 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  // Filter leads based on the exact 4 statuses
  const filteredLeads = leads.filter(lead => {
    if (statusFilter === LeadStatus.NEW) {
      return lead.status === LeadStatus.NEW;
    }
    if (statusFilter === LeadStatus.FOLLOW_UP) {
      return lead.status === LeadStatus.FOLLOW_UP;
    }
    if (statusFilter === LeadStatus.PAYMENT_PENDING) {
      return lead.status === LeadStatus.PAYMENT_PENDING;
    }
    if (statusFilter === LeadStatus.CONVERTED) {
      return lead.status === LeadStatus.CONVERTED;
    }
    return true;
  });

  const totalCount = leads.length;
  const newCount = leads.filter(l => l.status === LeadStatus.NEW).length;
  const followUpCount = leads.filter(l => l.status === LeadStatus.FOLLOW_UP).length;
  const paymentPendingCount = leads.filter(l => l.status === LeadStatus.PAYMENT_PENDING).length;
  const convertedCount = leads.filter(l => l.status === LeadStatus.CONVERTED).length;

  return (
    <div className="space-y-6">
      {/* Status feedback notification banner */}
      {statusNotification && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-xs transition-all ${
            statusNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{statusNotification.message}</span>
          </div>
          <button
            onClick={() => setStatusNotification(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Add Lead Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <span>Inquiries & Leads</span>
            <span className="text-xs ml-2.5 px-2.5 py-0.5 rounded-full font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
              Rarebox CRM
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record prospective solar clients and manage lead statuses in one simple view.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Sleek Filter & Search Strip (Exact 4 Statuses: New, Follow Up, Payment Pending, Converted) */}
      <div className="p-2.5 bg-card border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs">
        {/* Quick Filter Tabs */}
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 border border-border text-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Inquiries ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(LeadStatus.NEW)}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === LeadStatus.NEW
                ? 'bg-background text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            New ({newCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(LeadStatus.FOLLOW_UP)}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === LeadStatus.FOLLOW_UP
                ? 'bg-background text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Follow Up ({followUpCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(LeadStatus.PAYMENT_PENDING)}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === LeadStatus.PAYMENT_PENDING
                ? 'bg-background text-purple-600 dark:text-purple-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Payment Pending ({paymentPendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(LeadStatus.CONVERTED)}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              statusFilter === LeadStatus.CONVERTED
                ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Converted ({convertedCount})
          </button>
        </div>

        {/* Live Search & Priority Filter */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, phone, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-background border rounded-lg text-muted-foreground cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            {Object.values(LeadPriority).map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </form>
      </div>

      {/* Leads Table View (Clean, Direct, No Action Buttons) */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
            <p>Loading prospective leads...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3 max-w-xl mx-auto">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
            <h3 className="text-base font-bold text-foreground">
              {error.includes('Authentication required')
                ? 'Sign-In Required'
                : 'Unable to Load Leads'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={fetchLeads}
                className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-medium text-xs shadow-sm transition cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <Sun className="w-12 h-12 mx-auto text-solar-400 opacity-50" />
            <p className="text-base font-medium text-foreground">No inquiries in this view</p>
            <p className="text-sm">Try resetting filters or record a new prospect inquiry.</p>
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setSearch('');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="block md:hidden divide-y">
              {filteredLeads.map((lead, index) => {
                const isUpdating = updatingId === lead.id;
                return (
                  <div key={lead.id} className="p-4 hover:bg-muted/30 transition-colors space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-muted-foreground block">
                          S.No. {index + 1}
                        </span>
                        <h3 className="font-bold text-sm text-foreground truncate mt-0.5">
                          {lead.prospectName}
                        </h3>
                        {lead.companyName && (
                          <p className="text-xs text-muted-foreground truncate">{lead.companyName}</p>
                        )}
                      </div>

                      {/* Direct Mobile Status Dropdown */}
                      <div className="relative shrink-0">
                        <select
                          disabled={isUpdating}
                          value={lead.status}
                          onChange={e => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                          className={`text-xs font-bold py-1 px-2.5 pr-6 rounded-lg border cursor-pointer appearance-none ${getStatusBadge(
                            lead.status
                          )}`}
                        >
                          <option value={LeadStatus.NEW}>New</option>
                          <option value={LeadStatus.FOLLOW_UP}>Follow Up</option>
                          <option value={LeadStatus.PAYMENT_PENDING}>Payment Pending</option>
                          <option value={LeadStatus.CONVERTED}>Converted</option>
                          {![
                            LeadStatus.NEW,
                            LeadStatus.FOLLOW_UP,
                            LeadStatus.PAYMENT_PENDING,
                            LeadStatus.CONVERTED
                          ].includes(lead.status) && (
                            <option value={lead.status}>{lead.status}</option>
                          )}
                        </select>
                        <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <a
                        href={`tel:${lead.prospectPhone}`}
                        className="flex items-center text-foreground hover:text-solar-600 font-medium"
                      >
                        <Phone className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                        <span>{lead.prospectPhone}</span>
                      </a>
                      {lead.location?.city && <span>📍 {lead.location.city}</span>}
                      {lead.estimatedCapacityKw && (
                        <span className="font-semibold text-solar-600">
                          ⚡ {lead.estimatedCapacityKw} kWp
                        </span>
                      )}
                      {lead.reference && (
                        <span className="font-medium text-foreground">
                          👤 Ref: {lead.reference}
                        </span>
                      )}
                    </div>

                    {lead.notes && (
                      <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg">
                        {lead.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) - Clean, Direct, No Action Buttons */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">S.No.</th>
                    <th className="py-3 px-4">Prospect Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLeads.map((lead, index) => {
                    const isUpdating = updatingId === lead.id;
                    return (
                      <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-center text-muted-foreground w-16">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <span className="font-bold block">
                            {lead.prospectName}
                          </span>
                          {lead.companyName && (
                            <span className="block text-xs text-muted-foreground">
                              {lead.companyName}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1 text-foreground">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <a
                              href={`tel:${lead.prospectPhone}`}
                              className="hover:text-solar-600 font-medium"
                            >
                              {lead.prospectPhone}
                            </a>
                          </div>
                          {lead.prospectEmail && (
                            <span className="text-xs text-muted-foreground block">
                              {lead.prospectEmail}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {lead.location.city}, {lead.location.state}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {lead.reference ? (
                            <span className="font-medium text-foreground bg-muted/60 px-2.5 py-1 rounded-md border inline-block">
                              {lead.reference}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-xs">Direct</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          {lead.estimatedCapacityKw ? `${lead.estimatedCapacityKw} kWp` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-muted-foreground">
                          {lead.solarRequirement || 'Residential'}
                        </td>
                        <td className="py-3.5 px-4">
                          {/* Direct Interactive Status Selector */}
                          <div className="relative inline-block">
                            <select
                              disabled={isUpdating}
                              value={lead.status}
                              onChange={e =>
                                handleStatusChange(lead.id, e.target.value as LeadStatus)
                              }
                              className={`text-xs font-bold py-1.5 px-3 pr-7 rounded-lg border shadow-2xs transition cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-solar-500 ${getStatusBadge(
                                lead.status
                              )} ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              <option value={LeadStatus.NEW}>New</option>
                              <option value={LeadStatus.FOLLOW_UP}>Follow Up</option>
                              <option value={LeadStatus.PAYMENT_PENDING}>Payment Pending</option>
                              <option value={LeadStatus.CONVERTED}>Converted</option>
                              {![
                                LeadStatus.NEW,
                                LeadStatus.FOLLOW_UP,
                                LeadStatus.PAYMENT_PENDING,
                                LeadStatus.CONVERTED
                              ].includes(lead.status) && (
                                <option value={lead.status}>{lead.status}</option>
                              )}
                            </select>
                            {isUpdating ? (
                              <Loader2 className="w-3 h-3 animate-spin text-solar-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate">
                          {lead.notes || '—'}
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

      {/* New Lead Creation Modal (The only modal: opened only by clicking "+ Add Lead") */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Record New Solar Lead
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {createError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {dupWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm rounded-lg flex items-start space-x-2">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{dupWarning}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Prospect Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={prospectName}
                      onChange={e => setProspectName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Phone (10 Digits) *
                      {checkingDup && (
                        <span className="text-[10px] text-muted-foreground ml-2 animate-pulse">
                          (Checking duplicate...)
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={prospectPhone}
                      onChange={handlePhoneChange}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={prospectEmail}
                      onChange={e => setProspectEmail(e.target.value)}
                      placeholder="prospect@example.com"
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
                      placeholder="e.g. Raipur"
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
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      placeholder="492001"
                      maxLength={6}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Capacity (kWp)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={estimatedCapacityKw}
                      onChange={e => setEstimatedCapacityKw(e.target.value)}
                      placeholder="5.0"
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Lead Source
                    </label>
                    <select
                      value={source}
                      onChange={e => setSource(e.target.value as LeadSource)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      {Object.values(LeadSource).map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Reference / Referred By
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder="e.g. Ramesh Sharma, Channel Partner, Direct..."
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Requirement Type
                    </label>
                    <select
                      value={solarRequirement}
                      onChange={e => setSolarRequirement(e.target.value as SolarRequirement)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      {Object.values(SolarRequirement).map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as LeadPriority)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    >
                      {Object.values(LeadPriority).map(p => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Inquiry Remarks & Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes regarding electricity bill, shadow constraints, consumer subsidy..."
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t bg-card shrink-0 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm font-bold bg-solar-600 text-white hover:bg-solar-700 rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
