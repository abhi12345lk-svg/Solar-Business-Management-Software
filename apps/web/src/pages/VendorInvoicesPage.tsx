import React, { useState, useEffect } from 'react';
import { Receipt, Search, Plus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
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
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoiceItem | null>(null);
  const [reconcileStatus, setReconcileStatus] = useState('RECONCILED');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

      const res = await apiClient(`/vendor-invoices${query}`);
      const list = res.data?.items || res.data || [];
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
        apiClient('/vendors?limit=100&isActive=true'),
        apiClient('/purchase-orders?limit=100')
      ]);
      setVendorsList(vRes.data?.items || vRes.data || []);
      setPoList(poRes.data?.items || poRes.data || []);
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
    } catch (err: any) {
      setError(err.message || 'Failed to register vendor invoice');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" />
            Vendor Invoices & Payables
          </h1>
          <p className="text-muted-foreground text-sm">
            Record supplier tax invoices, perform automated 3-way matching against POs & GRNs, and
            monitor accounts payable balances.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Register Invoice
        </button>
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

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Invoices Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">PO Link</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4">Gross Amount</th>
                <th className="py-3 px-4">Payable Balance</th>
                <th className="py-3 px-4">3-Way Match Status</th>
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
                      <button
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setReconcileStatus(inv.status);
                          setReconcileNotes(inv.reconciliationNotes || '');
                          setIsReconcileModalOpen(true);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Reconcile
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Select Vendor *
                  </label>
                  <select
                    required
                    value={formData.vendorId}
                    onChange={e => setFormData({ ...formData, vendorId: e.target.value })}
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
                      setFormData({
                        ...formData,
                        purchaseOrderId: pId,
                        subtotalInr: matchedPO
                          ? matchedPO.subtotalPaise / 100
                          : formData.subtotalInr,
                        taxAmountInr: matchedPO
                          ? matchedPO.totalTaxPaise / 100
                          : formData.taxAmountInr,
                        totalAmountInr: matchedPO
                          ? matchedPO.totalAmountPaise / 100
                          : formData.totalAmountInr
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  >
                    <option value="">-- Direct Invoice / No PO --</option>
                    {poList.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.poNumber} — ₹{(p.totalAmountPaise / 100).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-border bg-secondary/20">
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
    </div>
  );
}
