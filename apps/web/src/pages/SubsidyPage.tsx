/**
 * INS Solar Business Management Software — Subsidy Registry Page
 *
 * Accounts & Financial ledger for Government Solar Subsidies (PM Surya Ghar Muft Bijli Yojana & State Subsidies):
 * - Clean financial summary in INR (Total Claims, In-Process, Sanctioned, DBT Credited)
 * - Direct benefit transfer (DBT) progression: Claim Registered -> Sanction Approved -> DBT Credited
 * - Streamlined, non-bloated table for Accounts Officers
 * - Seamless Register, Sanction, and DBT Disbursal flows
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  RefreshCw,
  Clock,
  Plus,
  FileCheck
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface SubsidyRecord {
  _id: string;
  applicationNumber: string;
  projectId?: {
    _id: string;
    projectCode: string;
    name: string;
  };
  customerId?: {
    _id: string;
    name: string;
    phone: string;
    primaryPhone?: string;
    customerCode?: string;
    billingAddress?: {
      city?: string;
      state?: string;
    };
  };
  schemeName: string;
  schemeVersion?: string;
  portalApplicationNumber?: string;
  systemCapacityKw: number;
  estimatedAmountPaise: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  disbursedAmountPaise: number;
  status: string;
  sanctionReference?: string;
  sanctionDate?: string;
  disbursements?: Array<{
    disbursementId: string;
    disbursementReference: string;
    amountPaise: number;
    disbursedAt: string;
    paymentMode: string;
    recipientAccount: string;
  }>;
  notes?: string;
  createdAt: string;
}

export const SubsidyPage: React.FC = () => {
  const [subsidies, setSubsidies] = useState<SubsidyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  // Selected Subsidy & Alerts
  const [selectedSubsidy, setSelectedSubsidy] = useState<SubsidyRecord | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Data for Register Modal
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loadingRegisterData, setLoadingRegisterData] = useState(false);

  // Register Form State
  const [registerForm, setRegisterForm] = useState({
    customerId: '',
    projectId: '',
    consumerName: '',
    consumerNumber: '',
    schemeName: 'PM Surya Ghar Muft Bijli Yojana',
    portalApplicationNumber: '',
    systemCapacityKw: 3.0,
    requestedAmountRupees: 78000,
    notes: ''
  });
  const [submittingRegister, setSubmittingRegister] = useState(false);

  // Record Sanction Form State
  const [sanctionForm, setSanctionForm] = useState({
    sanctionReference: '',
    sanctionDate: new Date().toISOString().split('T')[0],
    approvedAmountRupees: 78000,
    notes: ''
  });
  const [submittingSanction, setSubmittingSanction] = useState(false);

  // Record DBT Credit Form State
  const [disburseForm, setDisburseForm] = useState({
    disbursementReference: '',
    amountRupees: 78000,
    disbursedAt: new Date().toISOString().split('T')[0],
    recipientAccount: '',
    notes: ''
  });
  const [submittingDisburse, setSubmittingDisburse] = useState(false);

  // Currency Formatter
  const formatRupees = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(rupees);
  };

  // Helper for PM Surya Ghar Slab Amount
  const calculatePmSuryaGharSlab = (capacityKw: number): number => {
    if (capacityKw <= 0) return 0;
    if (capacityKw <= 1) return 30000;
    if (capacityKw <= 2) return 60000;
    return 78000; // Flat maximum cap for 3kW or higher under PM Surya Ghar
  };

  // Fetch Subsidies from API
  const fetchSubsidies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/subsidies?page=${page}&limit=${limit}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (schemeFilter) query += `&schemeName=${encodeURIComponent(schemeFilter)}`;

      const res = await apiClient<any>(query);
      const list = res?.applications || res?.data?.applications || (Array.isArray(res) ? res : []);
      const count = res?.total ?? res?.data?.total ?? list.length;
      setSubsidies(list);
      setTotal(count);
    } catch (err: any) {
      setError(err.message || 'Failed to load subsidy records.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, schemeFilter]);

  useEffect(() => {
    fetchSubsidies();
  }, [fetchSubsidies]);

  // Client-side Instant Search Filtering
  const filteredSubsidies = useMemo(() => {
    if (!searchTerm.trim()) return subsidies;
    const q = searchTerm.toLowerCase();
    return subsidies.filter(sub => {
      const appNo = sub.applicationNumber?.toLowerCase() || '';
      const portalNo = sub.portalApplicationNumber?.toLowerCase() || '';
      const sanctionRef = sub.sanctionReference?.toLowerCase() || '';
      const custName = sub.customerId?.name?.toLowerCase() || '';
      const custPhone = (sub.customerId?.phone || sub.customerId?.primaryPhone || '').toLowerCase();
      const projCode = sub.projectId?.projectCode?.toLowerCase() || '';
      const dbtUtr = (sub.disbursements || []).map(d => d.disbursementReference.toLowerCase()).join(' ');

      return (
        appNo.includes(q) ||
        portalNo.includes(q) ||
        sanctionRef.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q) ||
        projCode.includes(q) ||
        dbtUtr.includes(q)
      );
    });
  }, [subsidies, searchTerm]);

  // Financial aggregates
  const totalClaimsCount = subsidies.length;
  const totalRequestedPaise = subsidies.reduce((sum, s) => sum + (s.requestedAmountPaise || 0), 0);
  const totalSanctionedPaise = subsidies.reduce((sum, s) => sum + (s.approvedAmountPaise || 0), 0);
  const totalDisbursedPaise = subsidies.reduce((sum, s) => sum + (s.disbursedAmountPaise || 0), 0);

  // Open Register Modal & Pre-fetch Customers/Projects
  const handleOpenRegisterModal = async () => {
    setIsRegisterModalOpen(true);
    setLoadingRegisterData(true);

    try {
      // 1. Fetch Customers
      const custRes = await apiClient<any>('/customers?limit=100');
      const customers = custRes?.data || custRes?.customers || (Array.isArray(custRes) ? custRes : []);
      setCustomersList(customers);

      // Select default customer if exists
      const firstCustomer = customers[0];
      const initialCustomerId = firstCustomer?._id || '';
      const initialCustomerName = firstCustomer?.name || '';

      const defaultCap = 3.0;
      const defaultAmount = calculatePmSuryaGharSlab(defaultCap);
      const defaultPortalApp = `PMSG-CG-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      setRegisterForm({
        customerId: initialCustomerId,
        projectId: '',
        consumerName: initialCustomerName,
        consumerNumber: '',
        schemeName: 'PM Surya Ghar Muft Bijli Yojana',
        portalApplicationNumber: defaultPortalApp,
        systemCapacityKw: defaultCap,
        requestedAmountRupees: defaultAmount,
        notes: 'National Rooftop Solar Portal Claim'
      });
    } catch (err: any) {
      console.warn('Error loading customers for register modal:', err);
    } finally {
      setLoadingRegisterData(false);
    }
  };

  // Handle Customer Selection in Register Form
  const handleCustomerChange = (customerId: string) => {
    if (customerId === 'CUSTOM') {
      setRegisterForm(prev => ({
        ...prev,
        customerId: '',
        consumerName: '',
        consumerNumber: ''
      }));
      return;
    }

    const selected = customersList.find(c => c._id === customerId);
    if (selected) {
      setRegisterForm(prev => ({
        ...prev,
        customerId: selected._id,
        consumerName: selected.name || '',
        consumerNumber: selected.customerCode || ''
      }));
    }
  };

  // Submit New Subsidy Claim
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRegister(true);

    try {
      const payload: any = {
        schemeName: registerForm.schemeName,
        portalApplicationNumber: registerForm.portalApplicationNumber.trim(),
        systemCapacityKw: Number(registerForm.systemCapacityKw),
        estimatedAmountPaise: Math.round(Number(registerForm.requestedAmountRupees) * 100),
        requestedAmountPaise: Math.round(Number(registerForm.requestedAmountRupees) * 100),
        submissionDate: new Date().toISOString(),
        notes: registerForm.notes.trim() || undefined
      };

      if (registerForm.customerId) {
        payload.customerId = registerForm.customerId;
      }
      if (registerForm.projectId) {
        payload.projectId = registerForm.projectId;
      }
      if (registerForm.consumerName) {
        payload.consumerName = registerForm.consumerName;
      }
      if (registerForm.consumerNumber) {
        payload.consumerNumber = registerForm.consumerNumber;
      }

      await apiClient('/subsidies', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setActionSuccess(`Subsidy claim registered successfully for ${registerForm.consumerName || 'consumer'}!`);
      setIsRegisterModalOpen(false);
      fetchSubsidies();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to register subsidy claim: ${err.message || 'Error occurred'}`);
    } finally {
      setSubmittingRegister(false);
    }
  };

  // Open Record Sanction Modal
  const handleOpenSanctionModal = (sub: SubsidyRecord) => {
    setSelectedSubsidy(sub);
    const requestedRupees = (sub.requestedAmountPaise || 7800000) / 100;
    setSanctionForm({
      sanctionReference: `MNRE/PMSG/${new Date().getFullYear()}/${sub.portalApplicationNumber || Math.floor(100000 + Math.random() * 900000)}`,
      sanctionDate: new Date().toISOString().split('T')[0],
      approvedAmountRupees: requestedRupees,
      notes: 'Sanction letter issued on National Solar Portal'
    });
    setIsSanctionModalOpen(true);
  };

  // Submit Record Sanction
  const handleSanctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubsidy) return;
    setSubmittingSanction(true);

    try {
      const payload = {
        sanctionReference: sanctionForm.sanctionReference.trim(),
        sanctionDate: sanctionForm.sanctionDate,
        approvedAmountPaise: Math.round(Number(sanctionForm.approvedAmountRupees) * 100),
        notes: sanctionForm.notes.trim() || undefined
      };

      await apiClient(`/subsidies/${selectedSubsidy._id}/sanction`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setActionSuccess(`Sanction recorded! Approved amount: ₹${sanctionForm.approvedAmountRupees.toLocaleString('en-IN')}`);
      setIsSanctionModalOpen(false);
      setSelectedSubsidy(null);
      fetchSubsidies();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to record sanction: ${err.message || 'Error'}`);
    } finally {
      setSubmittingSanction(false);
    }
  };

  // Open Record DBT Disbursal Modal
  const handleOpenDisburseModal = (sub: SubsidyRecord) => {
    setSelectedSubsidy(sub);
    const approvedRupees = ((sub.approvedAmountPaise || sub.requestedAmountPaise || 7800000) - (sub.disbursedAmountPaise || 0)) / 100;
    const recipient = sub.customerId?.name ? `${sub.customerId.name} Bank A/C` : 'Consumer DBT Account';
    setDisburseForm({
      disbursementReference: `UTR${Date.now().toString().slice(-8)}`,
      amountRupees: approvedRupees > 0 ? approvedRupees : 78000,
      disbursedAt: new Date().toISOString().split('T')[0],
      recipientAccount: recipient,
      notes: 'Direct Benefit Transfer (DBT) credited by Central Government'
    });
    setIsDisburseModalOpen(true);
  };

  // Submit DBT Disbursal
  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubsidy) return;
    setSubmittingDisburse(true);

    try {
      const payload = {
        disbursementReference: disburseForm.disbursementReference.trim(),
        amountPaise: Math.round(Number(disburseForm.amountRupees) * 100),
        disbursedAt: disburseForm.disbursedAt,
        recipientAccount: disburseForm.recipientAccount.trim(),
        idempotencyKey: `dbt-${selectedSubsidy._id}-${Date.now()}`,
        notes: disburseForm.notes.trim() || undefined
      };

      await apiClient(`/subsidies/${selectedSubsidy._id}/disbursements`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setActionSuccess(`DBT transfer recorded successfully! UTR: ${disburseForm.disbursementReference}`);
      setIsDisburseModalOpen(false);
      setSelectedSubsidy(null);
      fetchSubsidies();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to record DBT credit: ${err.message || 'Error'}`);
    } finally {
      setSubmittingDisburse(false);
    }
  };

  // Open Detail Modal
  const handleOpenDetailModal = (sub: SubsidyRecord) => {
    setSelectedSubsidy(sub);
    setIsDetailModalOpen(true);
  };

  // Format Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'FULLY_DISBURSED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>DBT Credited</span>
          </span>
        );
      case 'PARTIALLY_DISBURSED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Partially Credited</span>
          </span>
        );
      case 'SANCTIONED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
            <FileCheck className="w-3.5 h-3.5" />
            <span>Sanctioned (Govt Approved)</span>
          </span>
        );
      case 'REJECTED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            <Clock className="w-3.5 h-3.5" />
            <span>In Process / Applied</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-solar-500/10 text-solar-600 border border-solar-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              Government Subsidy &amp; DBT Registry
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Accounts &amp; DBT
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track PM Surya Ghar Muft Bijli Yojana &amp; State Rooftop Subsidies, DISCOM sanctions, and Direct Benefit Transfer (DBT) credits.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenRegisterModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Subsidy Claim</span>
        </button>
      </div>

      {/* 2. Success Alert */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 3. Financial Summary KPI Cards (Clean, accounts-focused) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Claims</span>
            <Landmark className="w-4 h-4 text-solar-600" />
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">{totalClaimsCount}</p>
          <span className="text-[11px] text-muted-foreground">
            Total Value: {formatRupees(totalRequestedPaise)}
          </span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Pending / In Process</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
            {subsidies.filter(s => !['SANCTIONED', 'PARTIALLY_DISBURSED', 'FULLY_DISBURSED', 'REJECTED'].includes(s.status)).length}
          </p>
          <span className="text-[11px] text-muted-foreground">Awaiting DISCOM Sanction</span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Sanctioned Amount</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
            {formatRupees(totalSanctionedPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground">Approved by MNRE/Govt</span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">DBT Credited to Clients</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
            {formatRupees(totalDisbursedPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground">Transferred to Bank Accounts</span>
        </div>
      </div>

      {/* 4. Unified Simple Filter Bar (No clutter, No confusing tabs) */}
      <div className="bg-card border rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search consumer name, application #, portal reg #, or UTR..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20 text-foreground"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-background border rounded-xl focus:outline-none text-foreground font-medium"
          >
            <option value="">All Statuses</option>
            <option value="APPLIED">Pending Sanction / In Process</option>
            <option value="SANCTIONED">Sanctioned (Approved)</option>
            <option value="FULLY_DISBURSED">DBT Credited</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={schemeFilter}
            onChange={e => {
              setSchemeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-background border rounded-xl focus:outline-none text-foreground font-medium"
          >
            <option value="">All Schemes</option>
            <option value="PM Surya Ghar Muft Bijli Yojana">PM Surya Ghar Yojana</option>
            <option value="State Rooftop Subsidy">State Rooftop Subsidy</option>
          </select>

          <button
            type="button"
            onClick={fetchSubsidies}
            title="Refresh"
            className="p-2 rounded-xl border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5. Subsidies Table */}
      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin text-solar-500" />
            <span>Loading subsidy claims...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-destructive">
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchSubsidies}
              className="mt-2 text-xs text-solar-600 underline cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredSubsidies.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-solar-500/10 text-solar-600 mx-auto flex items-center justify-center font-bold">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No subsidy claims found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchTerm || statusFilter || schemeFilter
                  ? 'No records match your active search or filter.'
                  : 'Get started by registering a new PM Surya Ghar subsidy claim for a customer.'}
              </p>
            </div>
            {!searchTerm && !statusFilter && !schemeFilter && (
              <button
                type="button"
                onClick={handleOpenRegisterModal}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Claim</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Consumer &amp; Site</th>
                  <th className="py-3 px-4">Portal Application #</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Claimed Subsidy</th>
                  <th className="py-3 px-4">Sanction Status</th>
                  <th className="py-3 px-4">DBT Disbursal</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubsidies.map(sub => {
                  const customerName = sub.customerId?.name || 'Consumer (Solar Project)';
                  const customerPhone = sub.customerId?.phone || sub.customerId?.primaryPhone || '';
                  const city = sub.customerId?.billingAddress?.city || 'Raipur';
                  const isSanctioned = ['SANCTIONED', 'PARTIALLY_DISBURSED', 'FULLY_DISBURSED'].includes(sub.status);
                  const isDisbursed = sub.status === 'FULLY_DISBURSED';
                  const dbtRecords = sub.disbursements || [];
                  const latestUtr = dbtRecords.length > 0 ? dbtRecords[dbtRecords.length - 1]?.disbursementReference : null;

                  return (
                    <tr key={sub._id} className="hover:bg-muted/30 transition-colors">
                      {/* Consumer & Site */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{customerName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {customerPhone && <span>{customerPhone} • </span>}
                          <span>{city}</span>
                        </div>
                      </td>

                      {/* Portal Application # */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-foreground">
                          {sub.portalApplicationNumber || sub.applicationNumber}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {sub.schemeName?.replace(/_/g, ' ')}
                        </div>
                      </td>

                      {/* Capacity */}
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {sub.systemCapacityKw || 3} kWp
                      </td>

                      {/* Claimed Subsidy */}
                      <td className="py-3 px-4">
                        <span className="font-black text-foreground">
                          {formatRupees(sub.requestedAmountPaise)}
                        </span>
                      </td>

                      {/* Sanction Status */}
                      <td className="py-3 px-4">
                        {isSanctioned ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved {formatRupees(sub.approvedAmountPaise || sub.requestedAmountPaise)}</span>
                            </span>
                            {sub.sanctionReference && (
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[140px]">
                                Ref: {sub.sanctionReference}
                              </div>
                            )}
                          </div>
                        ) : sub.status === 'REJECTED' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>Pending Sanction</span>
                          </span>
                        )}
                      </td>

                      {/* DBT Disbursal */}
                      <td className="py-3 px-4">
                        {isDisbursed ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Credited {formatRupees(sub.disbursedAmountPaise || sub.approvedAmountPaise)}</span>
                            </span>
                            {latestUtr && (
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[140px]">
                                UTR: {latestUtr}
                              </div>
                            )}
                          </div>
                        ) : isSanctioned ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                            Ready for DBT
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!isSanctioned && sub.status !== 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenSanctionModal(sub)}
                              className="px-2.5 py-1 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                            >
                              Record Sanction
                            </button>
                          )}

                          {isSanctioned && !isDisbursed && (
                            <button
                              type="button"
                              onClick={() => handleOpenDisburseModal(sub)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                            >
                              Record DBT Credit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(sub)}
                            className="px-2.5 py-1 rounded-lg border bg-muted/60 hover:bg-muted text-foreground font-semibold text-xs transition cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {filteredSubsidies.length} of {total} claims
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1 rounded-lg border hover:bg-muted disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold">Page {page}</span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded-lg border hover:bg-muted disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. REGISTER SUBSIDY CLAIM MODAL                          */}
      {/* ========================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Register Subsidy Claim</h3>
                  <p className="text-[11px] text-muted-foreground">
                    PM Surya Ghar Muft Bijli Yojana Central DBT Claim Entry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingRegisterData ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-solar-500" />
                <span>Loading customer registry...</span>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                {/* Select Customer */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Select Customer / Consumer <span className="text-destructive">*</span>
                  </label>
                  {customersList.length > 0 ? (
                    <select
                      value={registerForm.customerId || (registerForm.consumerName ? 'CUSTOM' : '')}
                      onChange={e => handleCustomerChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border rounded-xl focus:ring-2 focus:ring-solar-500 text-foreground font-medium"
                    >
                      {customersList.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.primaryPhone || c.phone || 'No Phone'}) — {c.billingAddress?.city || 'Raipur'}
                        </option>
                      ))}
                      <option value="CUSTOM">+ Enter Custom Consumer Details</option>
                    </select>
                  ) : null}

                  {/* If custom or no customer in DB, let them type consumer name/number */}
                  {(!registerForm.customerId || customersList.length === 0) && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Consumer Full Name"
                          value={registerForm.consumerName}
                          onChange={e => setRegisterForm({ ...registerForm, consumerName: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground font-semibold"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Consumer BP / Service #"
                          value={registerForm.consumerNumber}
                          onChange={e => setRegisterForm({ ...registerForm, consumerNumber: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono text-foreground"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scheme & Capacity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Scheme Name
                    </label>
                    <select
                      value={registerForm.schemeName}
                      onChange={e => setRegisterForm({ ...registerForm, schemeName: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-solar-500"
                    >
                      <option value="PM Surya Ghar Muft Bijli Yojana">PM Surya Ghar Yojana (DBT)</option>
                      <option value="State Rooftop Subsidy">State Rooftop Subsidy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Capacity (kWp)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      required
                      value={registerForm.systemCapacityKw}
                      onChange={e => {
                        const cap = Number(e.target.value) || 0;
                        const est = calculatePmSuryaGharSlab(cap);
                        setRegisterForm({
                          ...registerForm,
                          systemCapacityKw: cap,
                          requestedAmountRupees: est
                        });
                      }}
                      className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                </div>

                {/* Portal Application Number & Requested Amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Portal Application Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 874788 or PMSG-CG-2026-..."
                      value={registerForm.portalApplicationNumber}
                      onChange={e =>
                        setRegisterForm({
                          ...registerForm,
                          portalApplicationNumber: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Requested Subsidy (₹) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min="1000"
                      required
                      value={registerForm.requestedAmountRupees}
                      onChange={e =>
                        setRegisterForm({
                          ...registerForm,
                          requestedAmountRupees: Number(e.target.value) || 0
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      PM Surya Ghar: ₹30k/kW (max ₹78,000 cap).
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Claim Notes &amp; Verification Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={registerForm.notes}
                    onChange={e => setRegisterForm({ ...registerForm, notes: e.target.value })}
                    placeholder="e.g. Net meter installed, commissioning report submitted on national portal"
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRegister}
                    className="px-4 py-2 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submittingRegister ? 'Registering...' : 'Register Subsidy Claim'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. RECORD SANCTION MODAL                                 */}
      {/* ========================================================= */}
      {isSanctionModalOpen && selectedSubsidy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Subsidy Sanction</h3>
                <p className="text-[11px] text-muted-foreground">
                  Confirm approval from MNRE / State DISCOM Portal
                </p>
              </div>
              <button
                onClick={() => setIsSanctionModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSanctionSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300">
                <div className="font-bold">
                  {selectedSubsidy.customerId?.name || 'Consumer'} • {selectedSubsidy.portalApplicationNumber}
                </div>
                <div className="text-[11px] mt-0.5">
                  Requested: {formatRupees(selectedSubsidy.requestedAmountPaise)} ({selectedSubsidy.systemCapacityKw || 3} kWp)
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Sanction Reference Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sanctionForm.sanctionReference}
                  onChange={e => setSanctionForm({ ...sanctionForm, sanctionReference: e.target.value })}
                  placeholder="e.g. MNRE/PMSG/2026/..."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Sanction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={sanctionForm.sanctionDate}
                    onChange={e => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Approved Amount (₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sanctionForm.approvedAmountRupees}
                    onChange={e =>
                      setSanctionForm({
                        ...sanctionForm,
                        approvedAmountRupees: Number(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Sanction Notes
                </label>
                <input
                  type="text"
                  value={sanctionForm.notes}
                  onChange={e => setSanctionForm({ ...sanctionForm, notes: e.target.value })}
                  placeholder="e.g. Approved under PM Surya Ghar National Portal"
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsSanctionModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSanction}
                  className="px-4 py-2 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingSanction ? 'Recording...' : 'Confirm Sanction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. RECORD DBT DISBURSAL MODAL                            */}
      {/* ========================================================= */}
      {isDisburseModalOpen && selectedSubsidy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Record DBT Credit</h3>
                <p className="text-[11px] text-muted-foreground">
                  Direct Benefit Transfer credited to consumer's bank account
                </p>
              </div>
              <button
                onClick={() => setIsDisburseModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <div className="font-bold">
                  {selectedSubsidy.customerId?.name || 'Consumer'} • Sanction Ref: {selectedSubsidy.sanctionReference || 'Govt Sanction'}
                </div>
                <div className="text-[11px] mt-0.5">
                  Sanctioned Amount: {formatRupees(selectedSubsidy.approvedAmountPaise || selectedSubsidy.requestedAmountPaise)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  DBT UTR / Bank Reference No. <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={disburseForm.disbursementReference}
                  onChange={e => setDisburseForm({ ...disburseForm, disbursementReference: e.target.value })}
                  placeholder="e.g. UTR9845661234 or CMS..."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Credited Date
                  </label>
                  <input
                    type="date"
                    required
                    value={disburseForm.disbursedAt}
                    onChange={e => setDisburseForm({ ...disburseForm, disbursedAt: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Amount Credited (₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={disburseForm.amountRupees}
                    onChange={e =>
                      setDisburseForm({
                        ...disburseForm,
                        amountRupees: Number(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Consumer Account / Remarks
                </label>
                <input
                  type="text"
                  value={disburseForm.recipientAccount}
                  onChange={e => setDisburseForm({ ...disburseForm, recipientAccount: e.target.value })}
                  placeholder="e.g. Credited via PFMS to Aadhaar-linked Bank A/C"
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDisburse}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingDisburse ? 'Saving...' : 'Confirm DBT Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. APPLICATION DETAILS MODAL                             */}
      {/* ========================================================= */}
      {isDetailModalOpen && selectedSubsidy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Subsidy Claim Details</h3>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {selectedSubsidy.applicationNumber} • {selectedSubsidy.portalApplicationNumber}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Current Status</span>
                  {renderStatusBadge(selectedSubsidy.status)}
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">System Capacity</span>
                  <span className="font-bold font-mono text-sm">{selectedSubsidy.systemCapacityKw || 3} kWp</span>
                </div>
              </div>

              {/* Financial Ledger Breakdown */}
              <div className="border rounded-xl p-3 space-y-2">
                <span className="font-bold text-xs text-foreground block">Subsidy Financial Ledger</span>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-muted/40 rounded-lg">
                    <span className="text-[10px] text-muted-foreground block">Claimed (Requested)</span>
                    <span className="font-black text-xs text-foreground">
                      {formatRupees(selectedSubsidy.requestedAmountPaise)}
                    </span>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-700 dark:text-blue-400">
                    <span className="text-[10px] block opacity-80">Govt Approved</span>
                    <span className="font-black text-xs">
                      {formatRupees(selectedSubsidy.approvedAmountPaise)}
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-700 dark:text-emerald-400">
                    <span className="text-[10px] block opacity-80">DBT Credited</span>
                    <span className="font-black text-xs">
                      {formatRupees(selectedSubsidy.disbursedAmountPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Consumer & Portal Details */}
              <div className="border rounded-xl p-3 space-y-2">
                <span className="font-bold text-xs text-foreground block">Consumer &amp; Portal Information</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Consumer Name:</span>
                    <span className="font-semibold">{selectedSubsidy.customerId?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone:</span>
                    <span className="font-semibold">{selectedSubsidy.customerId?.phone || selectedSubsidy.customerId?.primaryPhone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Portal Reg #:</span>
                    <span className="font-mono font-semibold">{selectedSubsidy.portalApplicationNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Scheme:</span>
                    <span className="font-semibold">{selectedSubsidy.schemeName}</span>
                  </div>
                  {selectedSubsidy.sanctionReference && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Sanction Reference:</span>
                      <span className="font-mono font-semibold">{selectedSubsidy.sanctionReference}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DBT Disbursal Transactions */}
              {selectedSubsidy.disbursements && selectedSubsidy.disbursements.length > 0 && (
                <div className="border rounded-xl p-3 space-y-2">
                  <span className="font-bold text-xs text-foreground block">DBT Disbursal Ledger</span>
                  <div className="space-y-1.5">
                    {selectedSubsidy.disbursements.map((d, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            UTR: {d.disbursementReference}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(d.disbursedAt).toLocaleDateString()} • {d.recipientAccount || 'DBT Account'}
                          </div>
                        </div>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {formatRupees(d.amountPaise)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t text-right">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs cursor-pointer"
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
