/**
 * INS Solar Business Management Software — Customer GST Tax Invoices Screen
 *
 * Implements Indian GST statutory compliance:
 * - Sequential numbering (INV-YYYY-NNNNN)
 * - HSN/SAC itemization (8541 solar PV modules, 8504 solar inverters, 9954 EPC turnkey services)
 * - Intra-state (CGST+SGST) vs Inter-state (IGST) tax calculation
 * - Customer billing/installation address binding & place of supply
 * - Payment reconciliation & balance due tracking
 * - High-fidelity print-ready GST Tax Invoice preview & PDF generation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  TrendingUp,
  Ban
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface InvoiceLineItem {
  itemType: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  unitRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  itemTotalPaise: number;
}

interface CustomerInvoiceItem {
  _id: string;
  invoiceNumber: string;
  orderId: any;
  orderNumber: string;
  customerId: any;
  customerCode?: string;
  customerName: string;
  customerGstin?: string;
  customerPan?: string;
  customerBillingAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    stateCode?: string;
  };
  customerInstallationAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  companyName: string;
  companyGstin?: string;
  companyPan?: string;
  companyAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    stateCode?: string;
  };
  placeOfSupply: string;
  stateCode: string;
  isInterState: boolean;
  systemCapacityKwp?: number;
  systemTopology?: string;
  invoiceDate: string;
  dueDate?: string;
  invoiceType: string;
  milestoneIndex?: number;
  milestoneName?: string;
  percentageBilled?: number;
  lineItems: InvoiceLineItem[];
  grossSubtotalPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;
  amountPaidPaise: number;
  balanceDuePaise: number;
  status: string;
  termsAndConditions?: string[];
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
}

// Convert numbers to Indian Rupees Words
function convertToWords(num: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(num);
  if (n === 0) return 'Zero Rupees Only';

  const inWords = (n: number): string => {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + 'Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      }
    }
    return str;
  };

  return inWords(n).trim() + ' Rupees Only';
}

export function CustomerInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<CustomerInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Preview Modal
  const [activeInvoice, setActiveInvoice] = useState<CustomerInvoiceItem | null>(null);

  // Create Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState('TAX_INVOICE');
  const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState<number | undefined>(undefined);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Cancellation Modal State
  const [invoiceToCancel, setInvoiceToCancel] = useState<CustomerInvoiceItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '100');
      if (statusFilter !== 'ALL') {
        queryParams.set('status', statusFilter);
      }
      if (search.trim()) {
        queryParams.set('search', search.trim());
      }

      const res = await apiClient<any>(`/customer-invoices?${queryParams.toString()}`);
      setInvoices(res.data?.invoices || res.invoices || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer invoices.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const loadConfirmedOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await apiClient<any>('/orders?status=CONFIRMED&limit=100');
      const orderList = res.data?.orders || res.orders || [];
      setOrders(orderList);
      if (orderList.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orderList[0]._id);
      }
    } catch {
      // Non-fatal fallback
    } finally {
      setOrdersLoading(false);
    }
  };

  const openCreateModal = () => {
    setCreateError(null);
    setSelectedOrderId('');
    setSelectedInvoiceType('TAX_INVOICE');
    setSelectedMilestoneIndex(undefined);
    setInvoiceDueDate('');
    setInvoiceNotes('');
    setShowCreateModal(true);
    loadConfirmedOrders();
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setCreateError('Please select a confirmed Sales Order.');
      return;
    }

    setCreatingInvoice(true);
    setCreateError(null);

    try {
      const payload: any = {
        orderId: selectedOrderId,
        invoiceType: selectedInvoiceType,
        dueDate: invoiceDueDate ? new Date(invoiceDueDate).toISOString() : undefined,
        notes: invoiceNotes.trim() || undefined
      };

      if (selectedInvoiceType === 'MILESTONE_INVOICE') {
        if (selectedMilestoneIndex === undefined) {
          setCreateError('Please select a milestone stage.');
          setCreatingInvoice(false);
          return;
        }
        payload.milestoneIndex = selectedMilestoneIndex;
      }

      const res = await apiClient<any>('/customer-invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const created = res.data || res;
      setSuccessMessage(`GST Tax Invoice ${created.invoiceNumber || ''} created successfully!`);
      setShowCreateModal(false);
      fetchInvoices();
      setActiveInvoice(created);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to generate customer invoice.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToCancel) return;
    if (cancellationReason.trim().length < 5) {
      setCancelError('Please provide a reason of at least 5 characters.');
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      await apiClient(`/customer-invoices/${invoiceToCancel._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          cancellationReason: cancellationReason.trim()
        })
      });
      setSuccessMessage(`Invoice ${invoiceToCancel.invoiceNumber} has been successfully cancelled.`);
      setInvoiceToCancel(null);
      setCancellationReason('');
      fetchInvoices();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel invoice.');
    } finally {
      setCancelling(false);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const active = invoices.filter(inv => inv.status !== 'CANCELLED');
    const totalInvoicedPaise = active.reduce((sum, inv) => sum + (inv.netTotalPaise || 0), 0);
    const totalPaidPaise = active.reduce((sum, inv) => sum + (inv.amountPaidPaise || 0), 0);
    const totalBalanceDuePaise = active.reduce((sum, inv) => sum + (inv.balanceDuePaise || 0), 0);

    return {
      totalInvoicedPaise,
      totalPaidPaise,
      totalBalanceDuePaise,
      count: active.length
    };
  }, [invoices]);

  const selectedOrderObj = useMemo(() => {
    return orders.find(o => o._id === selectedOrderId);
  }, [orders, selectedOrderId]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Receipt className="w-6 h-6 text-solar-500" />
              Customer GST Tax Invoices
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Statutory Billing
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compliant Indian GST Tax Invoices (HSN 8541/8504/9954), dual CGST/SGST vs IGST taxation, and payment reconciliation.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Tax Invoice</span>
        </button>
      </div>

      {/* Success & Error Banners */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Financial Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Invoiced</span>
            <Receipt className="w-4 h-4 text-solar-500" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-foreground">
            ₹{((metrics.totalInvoicedPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.count} Statutory Invoices Issued</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Customer Payments Received</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-emerald-600">
            ₹{((metrics.totalPaidPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Reconciled via Bank & Cash Receipts</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Outstanding Balance Due</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-amber-600">
            ₹{((metrics.totalBalanceDuePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pending milestone receivables</p>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Collection Efficiency</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-indigo-600">
            {metrics.totalInvoicedPaise > 0
              ? `${Math.round((metrics.totalPaidPaise / metrics.totalInvoicedPaise) * 100)}%`
              : '0%'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Realized Inflow Ratio</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Invoice #, Customer, or Order..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-solar-600 text-white font-semibold'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Sales Order</th>
                <th className="py-3 px-4">GST Profile</th>
                <th className="py-3 px-4 text-right">Net Total (₹)</th>
                <th className="py-3 px-4 text-right">Paid (₹)</th>
                <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-spin text-solar-500" />
                      <span>Loading customer tax invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">No customer GST invoices found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generate a new GST Tax Invoice from confirmed Sales Orders to begin billing.
                    </p>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <span className="text-solar-600 dark:text-solar-400">{inv.invoiceNumber}</span>
                      {inv.invoiceType === 'MILESTONE_INVOICE' && (
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          Stage: {inv.milestoneName || `#${(inv.milestoneIndex ?? 0) + 1}`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-foreground">{inv.customerName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {inv.customerGstin ? `GSTIN: ${inv.customerGstin}` : 'B2C Consumer'}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {inv.orderNumber}
                      {inv.systemCapacityKwp && (
                        <span className="block text-[10px] text-muted-foreground">
                          {inv.systemCapacityKwp} kWp ({inv.systemTopology || 'Solar'})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inv.isInterState
                            ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}
                      >
                        {inv.isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra)'}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">POS: {inv.placeOfSupply}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      ₹{((inv.netTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                      ₹{((inv.amountPaidPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                      ₹{((inv.balanceDuePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : inv.status === 'CANCELLED'
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}
                      >
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveInvoice(inv)}
                          className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="View & Print Official GST Tax Invoice"
                        >
                          <Printer className="w-3.5 h-3.5 text-solar-500" />
                          <span>View Tax Invoice</span>
                        </button>
                        {inv.status !== 'CANCELLED' && ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(user?.role || '') && (
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceToCancel(inv);
                              setCancellationReason('');
                              setCancelError(null);
                            }}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Cancel statutory invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW TAX INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-solar-500" />
                <h3 className="font-bold text-base text-foreground">Generate Customer GST Tax Invoice</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* Select Sales Order */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Confirmed Sales Order <span className="text-rose-500">*</span>
                </label>
                {ordersLoading ? (
                  <p className="text-xs text-muted-foreground">Loading confirmed orders...</p>
                ) : (
                  <select
                    value={selectedOrderId}
                    onChange={e => {
                      setSelectedOrderId(e.target.value);
                      setSelectedMilestoneIndex(undefined);
                    }}
                    required
                    className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                  >
                    <option value="">-- Choose Sales Order --</option>
                    {orders.map(o => (
                      <option key={o._id} value={o._id}>
                        {o.orderNumber} — {(o.customerId as any)?.name || 'Customer'} (₹{((o.netTotalPaise || 0) / 100).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedOrderObj && (
                <div className="p-3 rounded-lg bg-muted/40 border border-border/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-semibold text-foreground">{(selectedOrderObj.customerId as any)?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">System Capacity:</span>
                    <span className="font-semibold text-foreground">{selectedOrderObj.systemCapacityKwp} kWp ({selectedOrderObj.systemTopology || 'Solar'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Value:</span>
                    <span className="font-mono font-bold text-foreground">₹{((selectedOrderObj.netTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Invoice Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Invoice Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceType('TAX_INVOICE')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer ${
                      selectedInvoiceType === 'TAX_INVOICE'
                        ? 'border-solar-500 bg-solar-500/10 text-solar-700 dark:text-solar-300'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <p className="font-bold">Full Statutory Tax Invoice</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Itemized panels, inverters & services scope</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceType('MILESTONE_INVOICE')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer ${
                      selectedInvoiceType === 'MILESTONE_INVOICE'
                        ? 'border-solar-500 bg-solar-500/10 text-solar-700 dark:text-solar-300'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <p className="font-bold">Milestone Advance Invoice</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Progress billing per milestone schedule</p>
                  </button>
                </div>
              </div>

              {/* Milestone Selector if Milestone Invoice */}
              {selectedInvoiceType === 'MILESTONE_INVOICE' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Select Milestone Stage <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedMilestoneIndex ?? ''}
                    onChange={e => setSelectedMilestoneIndex(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                  >
                    <option value="">-- Choose Milestone --</option>
                    {(selectedOrderObj?.paymentMilestones || []).map((m: any, idx: number) => (
                      <option key={idx} value={idx}>
                        Stage #{idx + 1}: {m.name} ({m.percentage}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Due Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Payment Due Date</label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={e => setInvoiceDueDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Invoice Notes / Remarks</label>
                  <input
                    type="text"
                    value={invoiceNotes}
                    onChange={e => setInvoiceNotes(e.target.value)}
                    placeholder="e.g. EPC Turnkey Contract Milestone"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-solar-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-input text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingInvoice}
                  className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingInvoice && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>{creatingInvoice ? 'Generating Sequence...' : 'Issue GST Tax Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {invoiceToCancel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-base text-foreground">Cancel Statutory Tax Invoice</h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceToCancel(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              You are about to cancel statutory GST Tax Invoice <span className="font-mono font-bold text-foreground">{invoiceToCancel.invoiceNumber}</span>.
              This action will be permanently recorded in the security audit trail.
            </p>

            {cancelError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelInvoice} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Sales order scope revised or duplicated invoice error"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInvoiceToCancel(null)}
                  className="px-3 py-1.5 rounded-lg border border-input text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {cancelling && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>{cancelling ? 'Cancelling...' : 'Confirm Cancellation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUTORY GST TAX INVOICE PRINT-READY MODAL */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Top Control Bar (Hidden during print) */}
            <div className="print:hidden flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-solar-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Tax Invoice Preview — {activeInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-md bg-solar-500 hover:bg-solar-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Statutory Document Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-[12px] leading-relaxed font-sans bg-white text-slate-900">
              {/* Header: Company & Tax Invoice Badge */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    {activeInvoice.companyName}
                  </h2>
                  <p className="text-slate-600 font-medium">Solar EPC, Rooftop Turnkey Systems & Energy Solutions</p>
                  <p className="text-slate-600 mt-1">
                    {activeInvoice.companyAddress?.addressLine1 || 'Raipur Operations Headquarters'}, {activeInvoice.companyAddress?.city || 'Raipur'}, {activeInvoice.companyAddress?.state || 'Chhattisgarh'} - {activeInvoice.companyAddress?.postalCode || '492001'}
                  </p>
                  <p className="font-mono text-slate-800 font-semibold mt-0.5">
                    GSTIN: <span className="font-bold">{activeInvoice.companyGstin || '22AAACI1234F1Z5'}</span> | PAN: <span className="font-bold">{activeInvoice.companyPan || 'AAACI1234F'}</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-extrabold text-sm uppercase tracking-wider mb-2">
                    TAX INVOICE
                  </div>
                  <p className="text-slate-500 text-[11px] font-semibold">ORIGINAL FOR RECIPIENT</p>
                  <p className="font-mono text-slate-900 font-bold text-base mt-1">
                    {activeInvoice.invoiceNumber}
                  </p>
                  <p className="text-slate-600 font-medium">
                    Date:{' '}
                    {new Date(activeInvoice.invoiceDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block">Sales Order Ref:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Place of Supply:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.placeOfSupply} ({activeInvoice.stateCode})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">System Capacity:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.systemCapacityKwp || '—'} kWp ({activeInvoice.systemTopology || 'Solar'})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tax Scheme:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra)'}</span>
                </div>
              </div>

              {/* Customer & Installation Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-200 rounded p-4">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b pb-1 mb-1.5">
                    Billed To (Customer)
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">{activeInvoice.customerName}</p>
                  <p className="text-slate-600">
                    {activeInvoice.customerBillingAddress?.addressLine1 || 'Customer Address'}, {activeInvoice.customerBillingAddress?.city || ''}, {activeInvoice.customerBillingAddress?.state || ''} - {activeInvoice.customerBillingAddress?.postalCode || ''}
                  </p>
                  <p className="font-mono text-slate-700 mt-1 font-semibold">
                    GSTIN: {activeInvoice.customerGstin || 'Consumer (Unregistered)'}
                  </p>
                  {activeInvoice.customerPan && (
                    <p className="font-mono text-slate-700">PAN: {activeInvoice.customerPan}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b pb-1 mb-1.5">
                    Installation Site Address
                  </h4>
                  <p className="text-slate-700">
                    {activeInvoice.customerInstallationAddress?.addressLine1 || activeInvoice.customerBillingAddress?.addressLine1 || 'On-site installation'}
                  </p>
                  <p className="text-slate-700">
                    {activeInvoice.customerInstallationAddress?.city || activeInvoice.customerBillingAddress?.city || ''}, {activeInvoice.customerInstallationAddress?.state || activeInvoice.customerBillingAddress?.state || ''}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-8">#</th>
                      <th className="py-2 px-2.5">Description of Goods / Services</th>
                      <th className="py-2 px-2.5 text-center">HSN/SAC</th>
                      <th className="py-2 px-2.5 text-center">Qty</th>
                      <th className="py-2 px-2.5 text-right">Unit Rate (₹)</th>
                      <th className="py-2 px-2.5 text-right">Taxable (₹)</th>
                      {activeInvoice.isInterState ? (
                        <th className="py-2 px-2.5 text-right">IGST (₹)</th>
                      ) : (
                        <>
                          <th className="py-2 px-2.5 text-right">CGST (₹)</th>
                          <th className="py-2 px-2.5 text-right">SGST (₹)</th>
                        </>
                      )}
                      <th className="py-2 px-2.5 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeInvoice.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2.5 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-medium text-slate-900">{item.description}</td>
                        <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-700">
                          {item.hsnSacCode}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono">
                          {((item.unitRatePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold">
                          {((item.taxableAmountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {activeInvoice.isInterState ? (
                          <td className="py-2 px-2.5 text-right font-mono">
                            {((item.igstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span className="block text-[9px] text-slate-500">{(item.gstRateBasisPoints || 0) / 100}%</span>
                          </td>
                        ) : (
                          <>
                            <td className="py-2 px-2.5 text-right font-mono">
                              {((item.cgstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              <span className="block text-[9px] text-slate-500">{(item.gstRateBasisPoints || 0) / 200}%</span>
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono">
                              {((item.sgstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              <span className="block text-[9px] text-slate-500">{(item.gstRateBasisPoints || 0) / 200}%</span>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                          {((item.itemTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals & Tax Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* Left: In Words & Bank Details */}
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      Amount in Words:
                    </span>
                    <p className="font-bold text-slate-900 italic mt-0.5">
                      {convertToWords((activeInvoice.netTotalPaise || 0) / 100)}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold mb-1">
                      Bank Details for Direct RTGS / NEFT:
                    </span>
                    <p><span className="text-slate-600">Bank Name:</span> <span className="font-bold">HDFC Bank Limited</span></p>
                    <p><span className="text-slate-600">Account Name:</span> <span className="font-bold">INS Solar Private Limited</span></p>
                    <p><span className="text-slate-600">Account Number:</span> <span className="font-mono font-bold">50200088991122</span></p>
                    <p><span className="text-slate-600">IFSC Code:</span> <span className="font-mono font-bold">HDFC0001234</span></p>
                  </div>
                </div>

                {/* Right: Integer Paise Totals */}
                <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Value:</span>
                    <span>₹{((activeInvoice.taxableAmountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {activeInvoice.isInterState ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Total IGST:</span>
                      <span>₹{((activeInvoice.totalIgstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Total CGST:</span>
                        <span>₹{((activeInvoice.totalCgstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total SGST:</span>
                        <span>₹{((activeInvoice.totalSgstPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-sm text-slate-900">
                    <span>Invoice Total:</span>
                    <span>₹{((activeInvoice.netTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold pt-0.5">
                    <span>Amount Received:</span>
                    <span>₹{((activeInvoice.amountPaidPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-amber-600">
                    <span>Balance Due:</span>
                    <span>₹{((activeInvoice.balanceDuePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Declarations */}
              <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 items-end">
                <div className="text-[10px] text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">Terms & Conditions:</p>
                  <p>1. Goods once sold will not be taken back without prior authorization.</p>
                  <p>2. Warranties on solar equipment are subject to manufacturer terms.</p>
                  <p>3. This is a computer generated statutory GST Tax Invoice.</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-slate-900 text-xs">For {activeInvoice.companyName}</p>
                  <div className="h-12"></div>
                  <p className="font-bold text-slate-800 border-t border-slate-300 inline-block pt-1 text-[11px]">
                    Authorized Signatory
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CustomerInvoicesPage;
