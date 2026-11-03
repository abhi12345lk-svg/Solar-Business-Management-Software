import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Phone,
  AlertCircle,
  Sun,
  ShieldAlert,
  Loader2,
  Users,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { LeadDto, LeadStatus, LeadSource, LeadPriority, SolarRequirement } from '@ins-solar/shared';

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // New Lead Modal State
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [pinCode, setPinCode] = useState('');
  const [street, setStreet] = useState('');
  const [source, setSource] = useState<LeadSource>(LeadSource.WEBSITE);
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
      if (statusFilter !== 'ALL' && statusFilter !== 'PIPELINE') {
        params.set('status', statusFilter);
      }
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
  }, [statusFilter, priorityFilter]);

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
            `Notice: Phone matches ${res.matchingLeadsCount} existing lead(s) and ${res.matchingCustomersCount} customer(s). Family/shared numbers are permitted; review on conversion.`
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
        solarRequirement,
        estimatedCapacityKw: estimatedCapacityKw ? parseFloat(estimatedCapacityKw) : undefined,
        priority,
        notes: notes.trim() || undefined
      };

      await apiClient<LeadDto>('/leads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowModal(false);
      resetForm();
      fetchLeads();
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
    setCity('');
    setState('Rajasthan');
    setPinCode('');
    setStreet('');
    setNotes('');
    setDupWarning(null);
    setCreateError(null);
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.NEW:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case LeadStatus.CONTACTED:
        return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case LeadStatus.SURVEY_SCHEDULED:
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case LeadStatus.QUOTED:
        return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30';
      case LeadStatus.NEGOTIATION:
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case LeadStatus.CONVERTED:
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case LeadStatus.LOST:
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (statusFilter === 'PIPELINE') {
      return [
        LeadStatus.CONTACTED,
        LeadStatus.SURVEY_SCHEDULED,
        LeadStatus.QUOTED,
        LeadStatus.NEGOTIATION
      ].includes(lead.status);
    }
    return true;
  });

  const totalCount = leads.length;
  const newCount = leads.filter(l => l.status === LeadStatus.NEW).length;
  const inPipelineCount = leads.filter(l =>
    [
      LeadStatus.CONTACTED,
      LeadStatus.SURVEY_SCHEDULED,
      LeadStatus.QUOTED,
      LeadStatus.NEGOTIATION
    ].includes(l.status)
  ).length;
  const convertedCount = leads.filter(l => l.status === LeadStatus.CONVERTED).length;
  const lostCount = leads.filter(l => l.status === LeadStatus.LOST).length;
  const winRate = totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;

  const getActionConfig = (lead: LeadDto) => {
    switch (lead.status) {
      case LeadStatus.NEW:
        return {
          label: 'Qualify Lead →',
          to: `/leads/${lead.id}`,
          style:
            'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
        };
      case LeadStatus.CONTACTED:
        return {
          label: 'Book Survey →',
          to: `/surveys?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`,
          style:
            'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
        };
      case LeadStatus.SURVEY_SCHEDULED:
        return {
          label: 'Survey Stage →',
          to: `/surveys?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`,
          style:
            'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
        };
      case LeadStatus.QUOTED:
        return {
          label: 'View Proposal →',
          to: `/leads/${lead.id}`,
          style:
            'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
        };
      case LeadStatus.NEGOTIATION:
        return {
          label: 'Negotiation →',
          to: `/leads/${lead.id}`,
          style:
            'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
        };
      case LeadStatus.CONVERTED:
        return {
          label: 'Customer Won ✓',
          to: `/leads/${lead.id}`,
          style:
            'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
        };
      case LeadStatus.LOST:
        return {
          label: 'Dropped Inquiry',
          to: `/leads/${lead.id}`,
          style:
            'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
        };
      default:
        return {
          label: 'Details →',
          to: `/leads/${lead.id}`,
          style: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <span>CRM & Lead Pipeline</span>
            <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
              Lead & Customer Management
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Capture, qualify, assign, convert to customers, and schedule follow-up activities.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* Commercial Sales Pipeline KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-solar-50/80 dark:bg-solar-950/30 border-solar-300 dark:border-solar-800 ring-2 ring-solar-500/20 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Inquiries</span>
            <Users className="w-4 h-4 text-solar-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">All prospective leads</div>
        </button>

        <button
          onClick={() => setStatusFilter(LeadStatus.NEW)}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === LeadStatus.NEW
              ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">New Inquiries</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{newCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Awaiting initial call</div>
        </button>

        <button
          onClick={() => setStatusFilter('PIPELINE')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PIPELINE'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Pipeline</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inPipelineCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Survey / Quoted / Negot.</div>
        </button>

        <button
          onClick={() => setStatusFilter(LeadStatus.CONVERTED)}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === LeadStatus.CONVERTED
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Converted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {convertedCount}
            </span>
            {totalCount > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {winRate}% Won
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Became active customers</div>
        </button>

        <button
          onClick={() => setStatusFilter(LeadStatus.LOST)}
          className={`p-4 rounded-xl border text-left col-span-2 md:col-span-1 transition-all cursor-pointer ${
            statusFilter === LeadStatus.LOST
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Lost / Dropped</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{lostCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Pricing / roof / delay</div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search prospect name, phone, email, lead code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchLeads()}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(LeadStatus).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          >
            <option value="ALL">All Priorities</option>
            {Object.values(LeadPriority).map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            onClick={fetchLeads}
            className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition flex items-center space-x-1"
          >
            <Filter className="w-4 h-4 mr-1" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Leads Table View */}
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
                : error.includes('MONGODB_URI') || error.includes('Serverless')
                  ? 'Cloud Database Connection Pending'
                  : 'Unable to Load Leads'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {error.includes('Authentication required')
                ? 'Your workstation session has expired or is not active on the server. Please sign in to access live database records.'
                : error.includes('MONGODB_URI') || error.includes('Serverless')
                  ? 'Vercel cloud database (MONGODB_URI) is not configured yet. To connect your live database, add your MongoDB Atlas connection string in Vercel Project Settings > Environment Variables.'
                  : error}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {error.includes('Authentication required') ? (
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2.5 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-medium text-xs shadow-sm transition cursor-pointer"
                >
                  Sign In to Workstation
                </button>
              ) : (
                <button
                  onClick={fetchLeads}
                  className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-medium text-xs shadow-sm transition cursor-pointer"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <Sun className="w-12 h-12 mx-auto text-solar-400 opacity-50" />
            <p className="text-base font-medium text-foreground">No leads in this view</p>
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
              {filteredLeads.map(lead => {
                const action = getActionConfig(lead);
                return (
                  <div key={lead.id} className="p-4 hover:bg-muted/30 transition-colors space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-solar-600 block">
                          {lead.leadCode}
                        </span>
                        <h3 className="font-bold text-sm text-foreground truncate mt-0.5">
                          {lead.prospectName}
                        </h3>
                        {lead.companyName && (
                          <p className="text-xs text-muted-foreground truncate">{lead.companyName}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${getStatusBadge(
                          lead.status
                        )}`}
                      >
                        {lead.status}
                      </span>
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
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs gap-2">
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {lead.assignedEmployeeName
                          ? `Staff: ${lead.assignedEmployeeName}`
                          : 'Unassigned'}
                      </span>
                      <Link
                        to={`/leads/${lead.id}`}
                        className={`inline-flex items-center font-bold px-2.5 py-1 rounded-md border text-xs transition ${action.style}`}
                      >
                        <span>{action.label}</span>
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
                    <th className="py-3 px-4">Lead Code</th>
                    <th className="py-3 px-4">Prospect Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned To</th>
                    <th className="py-3 px-4 text-right">Pipeline Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLeads.map(lead => {
                    const action = getActionConfig(lead);
                    return (
                      <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="text-solar-600 hover:text-solar-700 hover:underline"
                          >
                            {lead.leadCode}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="hover:text-solar-600 hover:underline block"
                          >
                            {lead.prospectName}
                          </Link>
                          {lead.companyName && (
                            <span className="block text-xs text-muted-foreground">
                              {lead.companyName}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1 text-foreground">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{lead.prospectPhone}</span>
                          </div>
                          {lead.prospectEmail && (
                            <span className="text-xs text-muted-foreground">
                              {lead.prospectEmail}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {lead.location.city}, {lead.location.state}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          {lead.estimatedCapacityKw ? `${lead.estimatedCapacityKw} kWp` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                              lead.status
                            )}`}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {lead.assignedEmployeeName || (
                            <span className="italic text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/leads/${lead.id}`}
                            className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-md border transition cursor-pointer ${action.style}`}
                          >
                            <span>{action.label}</span>
                          </Link>
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

      {/* New Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Record New Solar Lead
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-sm font-semibold"
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
                      Phone (E.164 / 10 Digits) *
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
                      placeholder="e.g. 9876543210 or +919876543210"
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
                      placeholder="e.g. Jaipur"
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
                      placeholder="302001"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm font-bold bg-solar-600 text-white hover:bg-solar-700 rounded-lg transition shadow-sm disabled:opacity-50"
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
