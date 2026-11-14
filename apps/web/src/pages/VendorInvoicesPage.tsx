import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

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
  status: string;
  reconciliationNotes?: string;
  discrepancyAmountPaise: number;
  vendorId?: {
    _id: string;
    name: string;
    vendorCode: string;
    gstin?: string;
  };
  purchaseOrderId?: {
    _id: string;
    poNumber: string;
    totalAmountPaise: number;
  };
}

export function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState<VendorInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoiceItem | null>(null);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<VendorInvoiceItem | null>(null);
  const [selectedDetailInvoice, setSelectedDetailInvoice] = useState<any | null>(null);
  const [reconcileStatus, setReconcileStatus] = useState('RECONCILED');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Pay Bill Form State
  const [payFormData, setPayFormData] = useState({
    amountInr: '',
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Form State
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseOrderId: '',
    vendorInvoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    subtotalInr: 0,
    taxAmountInr: 0,
    totalAmountInr: 0,
    notes: '',
    documentUrl: ''
  });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=50&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;

      const res = await apiClient<any>(`/vendor-invoices${query}`);
      const list = res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);
      setInvoices(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [vRes, poRes] = await Promise.all([
        apiClient<any>('/vendors?limit=100&isActive=true'),
        apiClient<any>('/purchase-orders?limit=100')
      ]);
      const vList =
        vRes?.items || vRes?.data?.items || vRes?.data || (Array.isArray(vRes) ? vRes : []);
      const poList =
        poRes?.items || poRes?.data?.items || poRes?.data || (Array.isArray(poRes) ? poRes : []);
      setVendorsList(vList);
      setPoList(poList);
    } catch (err) {
      console.error('Failed to load master dropdowns', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter]);

  useEffect(() => {
    if (isModalOpen) {
      loadDropdowns();
    }
  }, [isModalOpen]);

  const handleSubtotalChange = (sub: number, tax: number) => {
    setFormData(prev => ({
      ...prev,
      subtotalInr: sub,
      taxAmountInr: tax,
      totalAmountInr: sub + tax
    }));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        vendorId: formData.vendorId,
        purchaseOrderId: formData.purchaseOrderId || undefined,
        vendorInvoiceNumber: formData.vendorInvoiceNumber.trim(),
        invoiceDate: new Date(formData.invoiceDate || Date.now()).toISOString(),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        subtotalPaise: Math.round(Number(formData.subtotalInr) * 100),
        taxAmountPaise: Math.round(Number(formData.taxAmountInr) * 100),
        totalAmountPaise: Math.round(Number(formData.totalAmountInr) * 100),
        notes: formData.notes || undefined,
        documentUrl: formData.documentUrl || undefined
      };

      await apiClient('/vendor-invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
      setFormData({
        vendorId: '',
        purchaseOrderId: '',
        vendorInvoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        subtotalInr: 0,
        taxAmountInr: 0,
        totalAmountInr: 0,
        notes: '',
        documentUrl: ''
      });
      await fetchInvoices();
      setActionSuccess('Vendor Tax Invoice registered successfully with 3-way reconciliation audit!');
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to register vendor invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPayModal = (inv: VendorInvoiceItem) => {
    setSelectedPayInvoice(inv);
    const balanceInr = (inv.balancePayablePaise / 100).toFixed(2);
    setPayFormData({
      amountInr: balanceInr,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: `RTGS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      paymentDate: new Date().toISOString().split('T')[0],
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

  const handleOpenDetailModal = async (inv: VendorInvoiceItem) => {
    try {
      const res = await apiClient<any>(`/vendor-invoices/${inv._id}`);
      setSelectedDetailInvoice(res || inv);
    } catch {
      setSelectedDetailInvoice(inv);
    }
    setIsDetailModalOpen(true);
  };

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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            Reconciled (3-Way Match)
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            Disputed / Variance
          </span>
        );
      case 'RECORDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            <Clock className="w-3 h-3" />
            Recorded
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
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
  const pendingReconcileCount = invoices.filter(
    inv => inv.status !== 'RECONCILED' && inv.status !== 'CANCELLED'
  ).length;

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-xl p-6 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
              <Receipt className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
              <span>Vendor Invoices & Payables</span>
              <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
                Accounts Payable
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Record supplier equipment tax invoices, audit rates against purchase orders, and monitor
            accounts payable clearance.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-medium text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Register Invoice</span>
        </button>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Invoiced Value
            </span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{formatINR(totalBilledPaise)}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {invoices.length} supplier invoices logged
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paid to Vendors
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{formatINR(totalPaidPaise)}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Disbursed vendor payments
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding Payables
            </span>
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-rose-600">
            {formatINR(totalBalancePayablePaise)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Remaining vendor dues to settle
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Audit Pending
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{pendingReconcileCount}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Awaiting bill reconciliation
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Filter Status:
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="RECORDED">Recorded</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="DISPUTED">Disputed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">PO Link</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4">Gross Amount</th>
                <th className="py-3 px-4">Payable Balance</th>
                <th className="py-3 px-4">Audit &amp; Reconciliation Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading vendor invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No vendor invoices recorded.
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {inv.vendorInvoiceNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{inv.vendorId?.name || '—'}</div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {inv.vendorId?.vendorCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {inv.purchaseOrderId?.poNumber || 'Direct / None'}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      ₹
                      {(inv.totalAmountPaise / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-primary">
                      ₹
                      {(inv.balancePayablePaise / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(inv.status)}
                      {inv.discrepancyAmountPaise > 0 && (
                        <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                          Diff: ₹{(inv.discrepancyAmountPaise / 100).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(inv)}
                          className="px-2.5 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-semibold border transition"
                          title="View 3-Way Match & Delivery Reconciliation"
                        >
                          3-Way Match
                        </button>
                        {inv.balancePayablePaise > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(inv)}
                            className="px-2.5 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-2xs"
                            title="Disburse Payment against Bill"
                          >
                            Pay Bill
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setReconcileStatus(inv.status);
                            setReconcileNotes(inv.reconciliationNotes || '');
                            setIsReconcileModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground font-medium"
                        >
                          Reconcile
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Register Vendor Tax Invoice
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Select Vendor *
                  </label>
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
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsList.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.name} ({v.vendorCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Link Purchase Order
                  </label>
                  <select
                    value={formData.purchaseOrderId}
                    onChange={e => {
                      const pId = e.target.value;
                      const matchedPO = poList.find(p => p._id === pId);
                      const resolvedVendorId = matchedPO?.vendorId?._id || matchedPO?.vendorId || formData.vendorId;
                      const poSubtotal = matchedPO?.subtotalPaise
                        ? matchedPO.subtotalPaise / 100
                        : matchedPO ? Math.round((matchedPO.totalAmountPaise / 100) / 1.18 * 100) / 100 : formData.subtotalInr;
                      const poTax = matchedPO?.totalTaxPaise
                        ? matchedPO.totalTaxPaise / 100
                        : matchedPO ? Math.round(((matchedPO.totalAmountPaise / 100) - poSubtotal) * 100) / 100 : formData.taxAmountInr;
                      const poTotal = matchedPO
                        ? matchedPO.totalAmountPaise / 100
                        : formData.totalAmountInr;

                      setFormData(prev => ({
                        ...prev,
                        purchaseOrderId: pId,
                        vendorId: resolvedVendorId || prev.vendorId,
                        subtotalInr: poSubtotal,
                        taxAmountInr: poTax,
                        totalAmountInr: poTotal,
                        vendorInvoiceNumber: prev.vendorInvoiceNumber || (matchedPO ? `INV-${matchedPO.poNumber?.replace('PO-', '')}` : '')
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  >
                    <option value="">-- Direct Invoice / No PO --</option>
                    {poList
                      .filter(p => !formData.vendorId || (p.vendorId?._id === formData.vendorId || p.vendorId === formData.vendorId))
                      .map(p => (
                        <option key={p._id} value={p._id}>
                          {p.poNumber} — ₹{(p.totalAmountPaise / 100).toLocaleString('en-IN')}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Supplier Bill Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-99012"
                    value={formData.vendorInvoiceNumber}
                    onChange={e =>
                      setFormData({ ...formData, vendorInvoiceNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoiceDate}
                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                    Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.subtotalInr}
                    onChange={e =>
                      handleSubtotalChange(Number(e.target.value), formData.taxAmountInr)
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                    Tax (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.taxAmountInr}
                    onChange={e =>
                      handleSubtotalChange(formData.subtotalInr, Number(e.target.value))
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
                    Total Payable (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.totalAmountInr}
                    onChange={e =>
                      setFormData({ ...formData, totalAmountInr: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs font-bold text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Supporting Document URL / Cloud Scan
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.documentUrl}
                  onChange={e => setFormData({ ...formData, documentUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Record Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {isReconcileModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Reconciliation Review</h2>
            <div className="p-3 rounded-lg border border-border bg-secondary/20 text-xs space-y-1">
              <div>
                Invoice:{' '}
                <span className="font-mono font-medium">{selectedInvoice.vendorInvoiceNumber}</span>
              </div>
              <div>
                Vendor: <span className="font-medium">{selectedInvoice.vendorId?.name}</span>
              </div>
              <div>
                Billed Amount:{' '}
                <span className="font-semibold">
                  ₹{(selectedInvoice.totalAmountPaise / 100).toFixed(2)}
                </span>
              </div>
              {selectedInvoice.purchaseOrderId && (
                <div>
                  PO Agreed:{' '}
                  <span className="font-semibold">
                    ₹{(selectedInvoice.purchaseOrderId.totalAmountPaise / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reconciliation Status
                </label>
                <select
                  value={reconcileStatus}
                  onChange={e => setReconcileStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                >
                  <option value="RECONCILED">RECONCILED (Approved for Payable Ledger)</option>
                  <option value="DISPUTED">
                    DISPUTED (Hold for Credit Note / Rate Correction)
                  </option>
                  <option value="RECORDED">RECORDED (Pending QA/Delivery verification)</option>
                  <option value="CANCELLED">CANCELLED (Duplicate or Void)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Auditor / Accountant Notes
                </label>
                <textarea
                  rows={3}
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                  placeholder="State reason for resolution, credit note details..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReconcileModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                >
                  Save Reconciliation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Vendor Bill Modal */}
      {isPayModalOpen && selectedPayInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span className="p-1 rounded bg-emerald-500/10 text-emerald-600 font-bold">₹</span>
                  <span>Disburse Vendor Payment</span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Bill: {selectedPayInvoice.vendorInvoiceNumber} • {selectedPayInvoice.vendorId?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bill Value:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{(selectedPayInvoice.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{((selectedPayInvoice.paidAmountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground font-semibold">Outstanding Balance:</span>
                <span className="font-mono font-bold text-primary">
                  ₹{(selectedPayInvoice.balancePayablePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-primary"
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
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (RTGS / NEFT / IMPS)</option>
                  <option value="CHEQUE">Cheque Clearance</option>
                  <option value="UPI">Company UPI Payout</option>
                  <option value="CASH">Cash Voucher (Minor Hardware/Consumables)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bank UTR / Transaction / Cheque Ref *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-HDFC-9912048 or CHQ-008192"
                  value={payFormData.paymentReference}
                  onChange={e => setPayFormData({ ...payFormData, paymentReference: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-primary"
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
                  placeholder="e.g. Released against Waaree modules delivery inspection sign-off."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border hover:bg-muted text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Disbursing...' : 'Confirm Bill Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Way Match & Details Modal */}
      {isDetailModalOpen && selectedDetailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
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
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Vendor & Financial Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Billed</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  ₹{(selectedDetailInvoice.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Paid So Far</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  ₹{((selectedDetailInvoice.paidAmountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border bg-primary/5 border-primary/20">
                <span className="text-[10px] text-primary uppercase font-semibold block">Payable Balance</span>
                <span className="font-mono font-bold text-primary text-sm">
                  ₹{(selectedDetailInvoice.balancePayablePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Vendor & PO Details */}
            <div className="p-3.5 rounded-xl border bg-secondary/10 space-y-2 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Procurement &amp; Commercial Terms
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Vendor Name:</span>
                  <span className="font-semibold text-foreground">
                    {selectedDetailInvoice.vendorId?.name || 'Vendor'}
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
                      PO Value: ₹{(selectedDetailInvoice.purchaseOrderId.totalAmountPaise / 100).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bill Date:</span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedDetailInvoice.invoiceDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Due Date:</span>
                  <span className="font-medium text-foreground">
                    {selectedDetailInvoice.dueDate ? new Date(selectedDetailInvoice.dueDate).toLocaleDateString('en-IN') : 'Net 30 Days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Reconciliation Audit Trail */}
            <div className="p-3 rounded-xl border bg-card text-xs space-y-1">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] block">
                3-Way Reconciliation Audit Note:
              </span>
              <p className="text-foreground italic">
                {selectedDetailInvoice.reconciliationNotes || 'Verified: Rates match agreed PO price and warehouse GRN delivery inspection.'}
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
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                >
                  Pay Balance ₹{(selectedDetailInvoice.balancePayablePaise / 100).toLocaleString('en-IN')}
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled &amp; Paid
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-muted hover:bg-muted/80 text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
