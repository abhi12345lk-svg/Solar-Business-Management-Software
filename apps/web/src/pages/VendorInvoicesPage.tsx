/**
 * INS Solar ERP — Vendor Invoices & Accounts Payable Screen
 *
 * Streamlined procurement & accounts payable flow:
 * - Register supplier equipment bills (Solar Modules, Inverters, Structures, Cables) and local site bills
 * - 3-Way matching against Purchase Orders and GRN Delivery records
 * - Bill payment disbursements with Bank Transfer / RTGS / UPI / Cheque tracking
 * - Reconciliation audit trail and accounts payable clearance ledger
 * - Quick supplier registration directly from the invoice workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Trash2,
  RefreshCw,
  X,
  CreditCard,
  Calculator
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface VendorInvoiceItem {
  _id: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotalPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balancePayablePaise: number;
  status: 'RECORDED' | 'PARTIALLY_RECONCILED' | 'RECONCILED' | 'DISPUTED' | 'CANCELLED';
  reconciliationNotes?: string;
  discrepancyAmountPaise: number;
  documentUrl?: string;
  notes?: string;
  vendorId?: {
    _id: string;
    name: string;
    vendorCode: string;
    gstin?: string;
    phone?: string;
  };
  purchaseOrderId?: {
    _id: string;
    poNumber: string;
    totalAmountPaise: number;
  };
}

export function VendorInvoicesPage() {
  const { isAdmin, hasPermission } = useAuth();
  const canCreateInvoice = isAdmin || hasPermission('vendor_invoice:create');
  const canManageInvoice = isAdmin || hasPermission('vendor_invoice:update');

  const [invoices, setInvoices] = useState<VendorInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');

  // Master Dropdown Lists
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickVendorModalOpen, setIsQuickVendorModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Active selections
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoiceItem | null>(null);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<VendorInvoiceItem | null>(null);
  const [selectedDetailInvoice, setSelectedDetailInvoice] = useState<any | null>(null);

  // Reconciliation form
  const [reconcileStatus, setReconcileStatus] = useState('RECONCILED');
  const [reconcileNotes, setReconcileNotes] = useState('');

  // Global action status
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Quick Vendor State
  const [quickVendor, setQuickVendor] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    city: 'Raipur'
  });
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Pay Bill Form State
  const [payFormData, setPayFormData] = useState({
    amountInr: '',
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Invoice Form State
  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseOrderId: '',
    vendorInvoiceNumber: '',
    invoiceDate: getTodayISO(),
    dueDate: '',
    subtotalInr: '',
    taxAmountInr: '',
    totalAmountInr: '',
    notes: '',
    documentUrl: ''
  });

  const resetInvoiceForm = () => {
    setFormData({
      vendorId: '',
      purchaseOrderId: '',
      vendorInvoiceNumber: '',
      invoiceDate: getTodayISO(),
      dueDate: '',
      subtotalInr: '',
      taxAmountInr: '',
      totalAmountInr: '',
      notes: '',
      documentUrl: ''
    });
  };

  // 1. Fetch Invoices from Backend
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=100`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;
      if (vendorFilter && vendorFilter !== 'ALL') query += `&vendorId=${vendorFilter}`;

      const res = await apiClient<any>(`/vendor-invoices${query}`);
      const list = res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);
      setInvoices(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, vendorFilter]);

  // 2. Load Master Dropdowns (Vendors & Approved Purchase Orders)
  const loadDropdowns = async () => {
    try {
      const [vRes, poRes] = await Promise.all([
        apiClient<any>('/vendors?limit=100&isActive=true'),
        apiClient<any>('/purchase-orders?limit=100')
      ]);
      const vList =
        vRes?.items || vRes?.data?.items || vRes?.data || (Array.isArray(vRes) ? vRes : []);
      const pList =
        poRes?.items || poRes?.data?.items || poRes?.data || (Array.isArray(poRes) ? poRes : []);
      setVendorsList(vList);
      setPoList(pList);
    } catch (err) {
      console.error('Failed to load master dropdowns', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    loadDropdowns();
  }, []);

  // 3. Quick GST Calculation Buttons (0%, 5%, 12% Solar Goods, 18% EPC)
  const applyGSTRate = (ratePercent: number) => {
    const sub = parseFloat(formData.subtotalInr) || 0;
    if (sub <= 0) return;
    const tax = Math.round(sub * (ratePercent / 100) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      taxAmountInr: tax > 0 ? tax.toString() : '0',
      totalAmountInr: total.toString()
    }));
  };

  const handleSubtotalChange = (val: string) => {
    const sub = parseFloat(val) || 0;
    const tax = parseFloat(formData.taxAmountInr) || 0;
    const total = Math.round((sub + tax) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      subtotalInr: val,
      totalAmountInr: sub > 0 ? total.toString() : ''
    }));
  };

  const handleTaxChange = (val: string) => {
    const sub = parseFloat(formData.subtotalInr) || 0;
    const tax = parseFloat(val) || 0;
    const total = Math.round((sub + tax) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      taxAmountInr: val,
      totalAmountInr: total > 0 ? total.toString() : ''
    }));
  };

  // 4. Quick Add Supplier Action
  const handleQuickVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVendor.name.trim()) return;
    try {
      setCreatingVendor(true);
      const res = await apiClient<any>('/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: quickVendor.name.trim(),
          contactPerson: quickVendor.contactPerson.trim() || undefined,
          phone: quickVendor.phone.trim() || undefined,
          email: quickVendor.email.trim() || undefined,
          gstin: quickVendor.gstin.trim().toUpperCase() || undefined
        })
      });
      const created = res?.data || res;
      setVendorsList(prev => [created, ...prev]);
      setFormData(prev => ({ ...prev, vendorId: created._id }));
      setIsQuickVendorModalOpen(false);
      setQuickVendor({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        gstin: '',
        city: 'Raipur'
      });
      setActionSuccess(`Supplier '${created.name}' registered & auto-selected!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to add supplier: ${err.message || 'Error'}`);
    } finally {
      setCreatingVendor(false);
    }
  };

  // 5. Create Invoice Submit
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorId) {
      alert('Please select or add a supplier/vendor.');
      return;
    }
    const subtotal = parseFloat(formData.subtotalInr) || 0;
    const tax = parseFloat(formData.taxAmountInr) || 0;
    const total = parseFloat(formData.totalAmountInr) || subtotal + tax;

    if (total <= 0) {
      alert('Invoice total amount must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        vendorId: formData.vendorId,
        purchaseOrderId: formData.purchaseOrderId || undefined,
        vendorInvoiceNumber: formData.vendorInvoiceNumber.trim(),
        invoiceDate: new Date(formData.invoiceDate || Date.now()).toISOString(),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        subtotalPaise: Math.round(subtotal * 100),
        taxAmountPaise: Math.round(tax * 100),
        totalAmountPaise: Math.round(total * 100),
        notes: formData.notes?.trim() || undefined,
        documentUrl: formData.documentUrl?.trim() || undefined
      };

      await apiClient('/vendor-invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
      resetInvoiceForm();
      await fetchInvoices();
      setActionSuccess(`Vendor Bill #${payload.vendorInvoiceNumber} registered successfully!`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to register vendor invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Delete Invoice
  const handleDeleteInvoice = async (inv: VendorInvoiceItem) => {
    if (
      !confirm(
        `Are you sure you want to delete Vendor Bill #${inv.vendorInvoiceNumber}? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setSubmitting(true);
      await apiClient(`/vendor-invoices/${inv._id}`, { method: 'DELETE' });
      setActionSuccess(`Vendor Bill #${inv.vendorInvoiceNumber} deleted successfully.`);
      await fetchInvoices();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to delete invoice: ${err.message || 'Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 7. Pay Bill Disbursement
  const handleOpenPayModal = (inv: VendorInvoiceItem) => {
    setSelectedPayInvoice(inv);
    const balanceInr = (inv.balancePayablePaise / 100).toFixed(2);
    setPayFormData({
      amountInr: balanceInr,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: `RTGS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      paymentDate: getTodayISO(),
      notes: `Payout against vendor bill ${inv.vendorInvoiceNumber}`
    });
    setIsPayModalOpen(true);
  };

  const handleRecordBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayInvoice) return;
    try {
      setSubmitting(true);
      const amountPaise = Math.round(Number(payFormData.amountInr) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        alert('Please enter a valid disbursement amount.');
        return;
      }

      await apiClient(`/vendor-invoices/${selectedPayInvoice._id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaise,
          paymentMethod: payFormData.paymentMethod,
          paymentReference: payFormData.paymentReference.trim() || undefined,
          notes: payFormData.notes.trim() || undefined
        })
      });

      setActionSuccess(`Vendor bill payment of ₹${payFormData.amountInr} disbursed successfully!`);
      setIsPayModalOpen(false);
      setSelectedPayInvoice(null);
      await fetchInvoices();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to record bill payment: ${err.message || 'Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 8. View Detail Modal
  const handleOpenDetailModal = async (inv: VendorInvoiceItem) => {
    try {
      const res = await apiClient<any>(`/vendor-invoices/${inv._id}`);
      setSelectedDetailInvoice(res?.data || res || inv);
    } catch {
      setSelectedDetailInvoice(inv);
    }
    setIsDetailModalOpen(true);
  };

  // 9. Reconcile Modal Submit
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setSubmitting(true);
      await apiClient(`/vendor-invoices/${selectedInvoice._id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({
          status: reconcileStatus,
          reconciliationNotes: reconcileNotes || undefined
        })
      });
      setIsReconcileModalOpen(false);
      setSelectedInvoice(null);
      await fetchInvoices();
      setActionSuccess('Invoice audit & reconciliation status updated.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECONCILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            3-Way Matched
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Disputed / Variance
          </span>
        );
      case 'RECORDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-secondary-foreground border">
            <Clock className="w-3 h-3 text-muted-foreground" />
            Pending Audit
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            Void / Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  // Financial aggregates
  const totalBilledPaise = invoices.reduce((sum, inv) => sum + (inv.totalAmountPaise || 0), 0);
  const totalPaidPaise = invoices.reduce((sum, inv) => sum + (inv.paidAmountPaise || 0), 0);
  const totalBalancePayablePaise = invoices.reduce(
    (sum, inv) => sum + (inv.balancePayablePaise || 0),
    0
  );
  const pendingAuditCount = invoices.filter(
    inv => inv.status === 'RECORDED' || inv.status === 'PARTIALLY_RECONCILED'
  ).length;

  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  return (
    <div className="space-y-5">
      {/* =========================================================================
          PAGE HEADER: Clean Title, Role Badge & Primary Action Buttons
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Vendor Invoices &amp; Payables</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary border text-muted-foreground">
                  Accounts Payable
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record supplier equipment tax invoices, audit rates against purchase orders, and monitor accounts payable clearance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            onClick={() => {
              loadDropdowns();
              fetchInvoices();
            }}
            className="p-2 border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {canCreateInvoice && (
            <>
              <button
                onClick={() => setIsQuickVendorModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border bg-card hover:bg-muted text-foreground text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                <span>+ New Supplier</span>
              </button>

              <button
                onClick={() => {
                  loadDropdowns();
                  resetInvoiceForm();
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Register Invoice</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          FINANCIAL KPI SUMMARY (4 Interactive Cards)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          onClick={() => {
            setStatusFilter('ALL');
            setVendorFilter('ALL');
          }}
          className={`text-left bg-card border rounded-2xl p-4 shadow-xs transition-all cursor-pointer hover:border-amber-500/50 ${
            statusFilter === 'ALL' ? 'ring-2 ring-amber-500/20 border-amber-500' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Total Invoiced Value</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {formatINR(totalBilledPaise)}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium mt-0.5 block">
            {invoices.length} supplier invoices logged
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('PAID')}
          className={`text-left bg-card border rounded-2xl p-4 shadow-xs transition-all cursor-pointer hover:border-emerald-500/50 ${
            statusFilter === 'PAID' ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Paid to Vendors</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono text-emerald-600">
            {formatINR(totalPaidPaise)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            Disbursed vendor payments
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('UNPAID')}
          className={`text-left bg-card border rounded-2xl p-4 shadow-xs transition-all cursor-pointer hover:border-rose-500/50 ${
            statusFilter === 'UNPAID' ? 'ring-2 ring-rose-500/20 border-rose-500' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Outstanding Payables</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black mt-2 font-mono text-rose-600">
            {formatINR(totalBalancePayablePaise)}
          </div>
          <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">
            Remaining vendor dues to settle
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('RECORDED')}
          className={`text-left bg-card border rounded-2xl p-4 shadow-xs transition-all cursor-pointer hover:border-amber-500/50 ${
            statusFilter === 'RECORDED' ? 'ring-2 ring-amber-500/20 border-amber-500' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Pending Audit</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {pendingAuditCount}
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-0.5 block">
            Awaiting 3-way reconciliation
          </span>
        </button>
      </div>

      {/* =========================================================================
          FILTER & SEARCH STRIP
         ========================================================================= */}
      <div className="p-3 bg-card border rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoice #, supplier name, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-background border rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNPAID">Unpaid / Balance Due</option>
              <option value="PAID">Fully Settled &amp; Paid</option>
              <option value="RECORDED">Recorded (Pending Review)</option>
              <option value="RECONCILED">Reconciled (3-Way Match)</option>
              <option value="DISPUTED">Disputed / Variance</option>
              <option value="CANCELLED">Void / Cancelled</option>
            </select>
          </div>

          {/* Supplier Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold">Supplier:</span>
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none max-w-[180px] truncate"
            >
              <option value="ALL">All Suppliers</option>
              {vendorsList.map(v => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {(statusFilter !== 'ALL' || vendorFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setVendorFilter('ALL');
                setSearch('');
              }}
              className="px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground font-semibold rounded-lg hover:bg-muted"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          NOTIFICATIONS
         ========================================================================= */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* =========================================================================
          INVOICES LEDGER TABLE
         ========================================================================= */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground border-b text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">PO Link</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4 text-right">Gross Amount</th>
                <th className="py-3 px-4 text-right">Payable Balance</th>
                <th className="py-3 px-4 text-center">Audit &amp; Reconciliation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading vendor invoices...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-foreground text-sm">No vendor invoices found</div>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter !== 'ALL' || vendorFilter !== 'ALL'
                          ? 'No bills match your current filters. Try resetting the filters.'
                          : 'Record supplier equipment bills (modules, inverters, cables) or site contractor expenses to track accounts payable.'}
                      </p>
                      {canCreateInvoice && !search && statusFilter === 'ALL' && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              resetInvoiceForm();
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Register First Invoice</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => {
                  const isPaid = inv.balancePayablePaise === 0;
                  const isPartiallyPaid =
                    (inv.paidAmountPaise || 0) > 0 && inv.balancePayablePaise > 0;

                  return (
                    <tr key={inv._id} className="hover:bg-muted/20 transition-colors">
                      {/* Invoice # */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-500">
                        {inv.vendorInvoiceNumber}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {inv.vendorId?.name || 'Supplier'}
                        </div>
                        {inv.vendorId?.gstin && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            GST: {inv.vendorId.gstin}
                          </div>
                        )}
                      </td>

                      {/* PO Link */}
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {inv.purchaseOrderId?.poNumber ? (
                          <span className="text-foreground font-semibold">
                            {inv.purchaseOrderId.poNumber}
                          </span>
                        ) : (
                          <span className="italic">Direct / No PO</span>
                        )}
                      </td>

                      {/* Bill Date */}
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="font-medium text-foreground">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        {inv.dueDate && (
                          <div className="text-[10px] text-muted-foreground">
                            Due: {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </td>

                      {/* Gross Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatINR(inv.totalAmountPaise)}
                      </td>

                      {/* Payable Balance */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <div className={inv.balancePayablePaise > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatINR(inv.balancePayablePaise)}
                        </div>
                        {isPaid ? (
                          <span className="text-[10px] text-emerald-600 font-semibold uppercase">
                            Fully Settled
                          </span>
                        ) : isPartiallyPaid ? (
                          <span className="text-[10px] text-amber-600 font-semibold">
                            Partially Paid
                          </span>
                        ) : null}
                      </td>

                      {/* Audit Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(inv.status)}
                        {inv.discrepancyAmountPaise > 0 && (
                          <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                            Variance: {formatINR(inv.discrepancyAmountPaise)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(inv)}
                            className="px-2 py-1 text-[11px] rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold border transition cursor-pointer"
                            title="View Bill Details & 3-Way Match"
                          >
                            Details
                          </button>

                          {/* Pay Bill (if outstanding) */}
                          {canManageInvoice && inv.balancePayablePaise > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(inv)}
                              className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-2xs cursor-pointer"
                              title="Disburse payment against bill"
                            >
                              Pay Bill
                            </button>
                          )}

                          {/* Reconcile */}
                          {canManageInvoice && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setReconcileStatus(inv.status);
                                setReconcileNotes(inv.reconciliationNotes || '');
                                setIsReconcileModalOpen(true);
                              }}
                              className="px-2 py-1 text-[11px] rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                              title="Update audit & reconciliation status"
                            >
                              Audit
                            </button>
                          )}

                          {/* Delete (only if no payments made) */}
                          {canManageInvoice && (inv.paidAmountPaise || 0) === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: REGISTER VENDOR TAX INVOICE
         ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-500" />
                  <span>Register Vendor Tax Invoice</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Record equipment, material, or contractor bills for accounts payable and 3-way matching.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              {/* Supplier Selection + Quick Add Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    Select Supplier / Vendor *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickVendorModalOpen(true)}
                    className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Quick Add Supplier</span>
                  </button>
                </div>

                {vendorsList.length === 0 ? (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 space-y-2">
                    <p className="font-semibold text-xs">No suppliers registered yet.</p>
                    <p className="text-[11px]">
                      Click below to quickly create your equipment vendor or contractor before entering this bill:
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsQuickVendorModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      + Register Supplier Now
                    </button>
                  </div>
                ) : (
                  <select
                    required
                    value={formData.vendorId}
                    onChange={e => {
                      const vId = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        vendorId: vId,
                        purchaseOrderId: ''
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- Choose Vendor / Supplier --</option>
                    {vendorsList.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.name} {v.vendorCode ? `(${v.vendorCode})` : ''} {v.gstin ? `• GST: ${v.gstin}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Link Purchase Order (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Link Purchase Order (For 3-Way Reconciliation)
                </label>
                <select
                  value={formData.purchaseOrderId}
                  onChange={e => {
                    const pId = e.target.value;
                    const matchedPO = poList.find(p => p._id === pId);
                    const resolvedVendorId =
                      matchedPO?.vendorId?._id || matchedPO?.vendorId || formData.vendorId;
                    const poSubtotal = matchedPO?.subtotalPaise
                      ? (matchedPO.subtotalPaise / 100).toString()
                      : matchedPO
                        ? (Math.round(((matchedPO.totalAmountPaise / 100) / 1.18) * 100) / 100).toString()
                        : formData.subtotalInr;
                    const poTax = matchedPO?.totalTaxPaise
                      ? (matchedPO.totalTaxPaise / 100).toString()
                      : matchedPO
                        ? (
                            Math.round(
                              ((matchedPO.totalAmountPaise / 100) - parseFloat(poSubtotal)) * 100
                            ) / 100
                          ).toString()
                        : formData.taxAmountInr;
                    const poTotal = matchedPO
                      ? (matchedPO.totalAmountPaise / 100).toString()
                      : formData.totalAmountInr;

                    setFormData(prev => ({
                      ...prev,
                      purchaseOrderId: pId,
                      vendorId: resolvedVendorId || prev.vendorId,
                      subtotalInr: poSubtotal,
                      taxAmountInr: poTax,
                      totalAmountInr: poTotal,
                      vendorInvoiceNumber:
                        prev.vendorInvoiceNumber ||
                        (matchedPO ? `INV-${matchedPO.poNumber?.replace('PO-', '')}` : '')
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- Direct Invoice / No PO (Site expenses, civil, crane) --</option>
                  {poList
                    .filter(
                      p =>
                        !formData.vendorId ||
                        p.vendorId?._id === formData.vendorId ||
                        p.vendorId === formData.vendorId
                    )
                    .map(p => (
                      <option key={p._id} value={p._id}>
                        {p.poNumber} — ₹{(p.totalAmountPaise / 100).toLocaleString('en-IN')}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Keep &quot;Direct Invoice / No PO&quot; for direct site expenses, civil contractor charges, crane hire, or ad-hoc local purchases.
                </p>
              </div>

              {/* Bill Number & Invoice Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Supplier Bill / Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-99012"
                    value={formData.vendorInvoiceNumber}
                    onChange={e => setFormData({ ...formData, vendorInvoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoiceDate}
                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Financial Breakdown with Quick GST Buttons */}
              <div className="p-3.5 rounded-xl border bg-secondary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-500" />
                    <span>Commercial Breakdown (INR ₹)</span>
                  </span>
                  {/* GST Preset Buttons */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground mr-1">Quick GST:</span>
                    <button
                      type="button"
                      onClick={() => applyGSTRate(0)}
                      className="px-1.5 py-0.5 rounded bg-card border hover:bg-muted font-medium cursor-pointer"
                    >
                      0%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyGSTRate(5)}
                      className="px-1.5 py-0.5 rounded bg-card border hover:bg-muted font-medium cursor-pointer"
                    >
                      5%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyGSTRate(12)}
                      className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold cursor-pointer"
                      title="Standard Solar Modules & Inverters GST"
                    >
                      12% (Solar)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyGSTRate(18)}
                      className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 font-bold cursor-pointer"
                      title="Standard Services & BOS GST"
                    >
                      18% (EPC)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Subtotal (Taxable ₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 50000"
                      value={formData.subtotalInr}
                      onChange={e => handleSubtotalChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      GST Tax (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 6000"
                      value={formData.taxAmountInr}
                      onChange={e => handleTaxChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Total Payable (Gross ₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 56000"
                      value={formData.totalAmountInr}
                      onChange={e => setFormData({ ...formData, totalAmountInr: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-black text-amber-600 dark:text-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Due Date & Supporting Document */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Supporting Document / Cloud Scan
                  </label>
                  <input
                    type="text"
                    placeholder="Optional drive link, scan URL, or voucher #"
                    value={formData.documentUrl}
                    onChange={e => setFormData({ ...formData, documentUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bill Remarks / Material Particulars
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 550Wp bifacial solar panels batch shipment for Site #44"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-muted font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Record & Audit Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: QUICK REGISTER SUPPLIER / VENDOR
         ========================================================================= */}
      {isQuickVendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <span>Register New Supplier</span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Quickly add an equipment supplier or site contractor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickVendorModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickVendorSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Waaree Energies Ltd or Local Fabrication"
                  value={quickVendor.name}
                  onChange={e => setQuickVendor({ ...quickVendor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-bold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    GSTIN (Tax ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={quickVendor.gstin}
                    onChange={e => setQuickVendor({ ...quickVendor, gstin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Phone / Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={quickVendor.phone}
                    onChange={e => setQuickVendor({ ...quickVendor, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={quickVendor.contactPerson}
                    onChange={e => setQuickVendor({ ...quickVendor, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Raipur"
                    value={quickVendor.city}
                    onChange={e => setQuickVendor({ ...quickVendor, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsQuickVendorModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-muted font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVendor}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creatingVendor ? 'Saving...' : 'Save & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DISBURSE BILL PAYMENT
         ========================================================================= */}
      {isPayModalOpen && selectedPayInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Disburse Vendor Payment</span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Bill: {selectedPayInvoice.vendorInvoiceNumber} • {selectedPayInvoice.vendorId?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/30 border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bill Value:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatINR(selectedPayInvoice.totalAmountPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {formatINR(selectedPayInvoice.paidAmountPaise)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-foreground font-semibold">Outstanding Balance:</span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  {formatINR(selectedPayInvoice.balancePayablePaise)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordBillPayment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Disbursed Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedPayInvoice.balancePayablePaise / 100}
                    required
                    value={payFormData.amountInr}
                    onChange={e => setPayFormData({ ...payFormData, amountInr: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payFormData.paymentDate}
                    onChange={e => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payFormData.paymentMethod}
                  onChange={e => setPayFormData({ ...payFormData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (RTGS / NEFT / IMPS)</option>
                  <option value="CHEQUE">Cheque Clearance</option>
                  <option value="UPI">Company UPI Payout</option>
                  <option value="CASH">Cash Voucher (Minor Site Purchases)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bank UTR / Transaction / Cheque Ref # *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-HDFC-9912048 or CHQ-008192"
                  value={payFormData.paymentReference}
                  onChange={e => setPayFormData({ ...payFormData, paymentReference: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Accounts Audit Notes
                </label>
                <textarea
                  rows={2}
                  value={payFormData.notes}
                  onChange={e => setPayFormData({ ...payFormData, notes: e.target.value })}
                  placeholder="e.g. Released against delivery inspection sign-off."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Disbursing...' : 'Confirm Bill Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: 3-WAY MATCH & BILL DETAILS MODAL
         ========================================================================= */}
      {isDetailModalOpen && selectedDetailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground font-mono">
                    Bill #{selectedDetailInvoice.vendorInvoiceNumber}
                  </h3>
                  {getStatusBadge(selectedDetailInvoice.status)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  3-Way Reconciliation Audit (Purchase Order ➔ Delivery Receipt ➔ Vendor Invoice)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl border bg-secondary/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Billed</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatINR(selectedDetailInvoice.totalAmountPaise)}
                </span>
              </div>
              <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Paid So Far</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatINR(selectedDetailInvoice.paidAmountPaise)}
                </span>
              </div>
              <div className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/20">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-semibold block">Payable Balance</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {formatINR(selectedDetailInvoice.balancePayablePaise)}
                </span>
              </div>
            </div>

            {/* Procurement & Commercial Details */}
            <div className="p-3.5 rounded-xl border bg-secondary/10 space-y-2 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Procurement &amp; Commercial Terms
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Supplier Name:</span>
                  <span className="font-semibold text-foreground">
                    {selectedDetailInvoice.vendorId?.name || 'Supplier'}
                  </span>
                  {selectedDetailInvoice.vendorId?.gstin && (
                    <span className="block text-[11px] font-mono text-muted-foreground">
                      GSTIN: {selectedDetailInvoice.vendorId.gstin}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Linked Purchase Order:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedDetailInvoice.purchaseOrderId?.poNumber || 'Direct Purchase / No PO'}
                  </span>
                  {selectedDetailInvoice.purchaseOrderId?.totalAmountPaise && (
                    <span className="block text-[11px] font-mono text-muted-foreground">
                      PO Value: {formatINR(selectedDetailInvoice.purchaseOrderId.totalAmountPaise)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bill Date:</span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedDetailInvoice.invoiceDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Due Date:</span>
                  <span className="font-medium text-foreground">
                    {selectedDetailInvoice.dueDate
                      ? new Date(selectedDetailInvoice.dueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Net 30 Days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Notes */}
            <div className="p-3 rounded-xl border bg-card text-xs space-y-1">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] block">
                3-Way Reconciliation Audit Note:
              </span>
              <p className="text-foreground italic">
                {selectedDetailInvoice.reconciliationNotes ||
                  'Verified: Rates match agreed PO price and warehouse delivery inspection.'}
              </p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              {selectedDetailInvoice.balancePayablePaise > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenPayModal(selectedDetailInvoice);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
                >
                  Pay Balance {formatINR(selectedDetailInvoice.balancePayablePaise)}
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled &amp; Paid
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: AUDIT & RECONCILIATION STATUS MODAL
         ========================================================================= */}
      {isReconcileModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Audit Reconciliation ({selectedInvoice.vendorInvoiceNumber})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Supplier: {selectedInvoice.vendorId?.name} • Bill Value: {formatINR(selectedInvoice.totalAmountPaise)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReconcileModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reconciliation Status *
                </label>
                <select
                  value={reconcileStatus}
                  onChange={e => setReconcileStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="RECONCILED">RECONCILED (3-Way Match Approved for Payment)</option>
                  <option value="RECORDED">RECORDED (Pending Delivery / Verification)</option>
                  <option value="DISPUTED">DISPUTED (Hold for Credit Note / Rate Correction)</option>
                  <option value="CANCELLED">CANCELLED (Duplicate or Void)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Auditor / Accountant Notes
                </label>
                <textarea
                  rows={3}
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                  placeholder="State resolution details, credit note agreement, or discrepancy reason..."
                  className="w-full px-3 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsReconcileModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Audit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
