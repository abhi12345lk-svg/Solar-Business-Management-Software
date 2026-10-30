/**
 * INS Solar Business Management Software — Customer Payments & Receivables Register Page
 *
 * Operational receivables ledger:
 * - Customer payments intake with atomic REC sequence numbers and integer-paise financial precision
 * - Payment verification flow confirming bank realization
 * - Multi-order allocation adhering to customer boundary and order collectible ceilings
 * - Audited payment reversals (cascading allocation reversal) and unallocated fund refunds
 * - Receivables statements with 30/60/90 days aging analysis
 * - Printable operational payment receipts with legal disclaimer (non-tax invoice)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Banknote,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Undo2,
  Split,
  Hash,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface PaymentAllocationItem {
  _id: string;
  allocationNumber: string;
  salesOrderId: {
    _id: string;
    orderNumber: string;
    netTotalPaise?: number;
    systemCapacityKwp?: number;
  };
  allocatedAmountPaise: number;
  allocationDate: string;
  status: string;
  reversalReason?: string;
}

interface CustomerPaymentRecord {
  _id: string;
  receiptNumber: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  status: 'RECORDED' | 'VERIFIED' | 'REVERSED' | 'REFUNDED';
  allocatedAmountPaise: number;
  unallocatedAmountPaise: number;
  refundAmountPaise?: number;
  notes?: string;
  internalNotes?: string;
  customerId: {
    _id: string;
    name: string;
    customerCode?: string;
    primaryPhone?: string;
    email?: string;
    billingAddress?: any;
    gstin?: string;
  };
  recordedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  verifiedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  verifiedAt?: string;
  verificationNotes?: string;
  reversalReason?: string;
  refundReference?: string;
  refundReason?: string;
  allocations?: PaymentAllocationItem[];
  createdAt: string;
}

interface ReceivablesStatement {
  customer: {
    _id: string;
    name: string;
    customerCode?: string;
    primaryPhone?: string;
    email?: string;
  };
  totalOrderValuePaise: number;
  totalPaidPaise: number;
  totalAllocatedPaise: number;
  totalUnallocatedCreditPaise: number;
  totalOutstandingPaise: number;
  orders: Array<{
    _id: string;
    orderNumber: string;
    orderDate?: string;
    systemCapacityKwp?: number;
    netTotalPaise: number;
    allocatedAmountPaise: number;
    outstandingBalancePaise: number;
    paymentStatus: string;
  }>;
  aging: {
    current0To30Paise: number;
    overdue31To60Paise: number;
    overdue61To90Paise: number;
    overdueAbove90Paise: number;
  };
}

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPaymentRecord | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Receivables Statement Drawer/Modal
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementData, setStatementData] = useState<ReceivablesStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Form states
  const [recordForm, setRecordForm] = useState({
    customerId: '',
    amountRupees: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    notes: '',
    internalNotes: '',
    autoVerify: false
  });

  const [verifyForm, setVerifyForm] = useState({
    verificationNotes: ''
  });

  const [allocateForm, setAllocateForm] = useState({
    salesOrderId: '',
    amountRupees: '',
    notes: ''
  });

  const [reverseReason, setReverseReason] = useState('');

  const [refundForm, setRefundForm] = useState({
    refundAmountRupees: '',
    refundReference: '',
    refundReason: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch payments list
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (statusFilter) params.append('status', statusFilter);
      if (methodFilter) params.append('paymentMethod', methodFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await apiClient<any>(`/payments?${params.toString()}`);
      const data = res?.data || res;
      setPayments(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer payments.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, searchTerm]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const amountPaise = Math.round(parseFloat(recordForm.amountRupees) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        alert('Please enter a valid positive payment amount.');
        return;
      }

      await apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: recordForm.customerId.trim(),
          amountPaise,
          paymentDate: recordForm.paymentDate ? new Date(recordForm.paymentDate) : new Date(),
          paymentMethod: recordForm.paymentMethod,
          transactionReference: recordForm.transactionReference.trim() || undefined,
          notes: recordForm.notes.trim() || undefined,
          internalNotes: recordForm.internalNotes.trim() || undefined,
          autoVerify: recordForm.autoVerify
        })
      });

      setShowRecordModal(false);
      setRecordForm({
        customerId: '',
        amountRupees: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: '',
        notes: '',
        internalNotes: '',
        autoVerify: false
      });
      fetchPayments();
    } catch (err: any) {
      alert(`Error recording payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Verify Payment
  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      await apiClient(`/payments/${selectedPayment._id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationNotes: verifyForm.verificationNotes.trim() || undefined
        })
      });
      setShowVerifyModal(false);
      setSelectedPayment(null);
      setVerifyForm({ verificationNotes: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error verifying payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Allocate Payment
  const handleAllocatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      const allocatedAmountPaise = Math.round(parseFloat(allocateForm.amountRupees) * 100);
      if (isNaN(allocatedAmountPaise) || allocatedAmountPaise <= 0) {
        alert('Please enter a valid positive allocation amount.');
        return;
      }

      await apiClient(`/payments/${selectedPayment._id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: allocateForm.salesOrderId.trim(),
          allocatedAmountPaise,
          notes: allocateForm.notes.trim() || undefined
        })
      });

      setShowAllocateModal(false);
      setSelectedPayment(null);
      setAllocateForm({ salesOrderId: '', amountRupees: '', notes: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error allocating payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reverse Payment
  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    if (!reverseReason.trim()) {
      alert('Please provide a mandatory reason for reversing this payment.');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient(`/payments/${selectedPayment._id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({
          reversalReason: reverseReason.trim()
        })
      });
      setShowReverseModal(false);
      setSelectedPayment(null);
      setReverseReason('');
      fetchPayments();
    } catch (err: any) {
      alert(`Error reversing payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Refund Payment
  const handleRefundPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      const refundAmountPaise = Math.round(parseFloat(refundForm.refundAmountRupees) * 100);
      if (isNaN(refundAmountPaise) || refundAmountPaise <= 0) {
        alert('Please enter a valid positive refund amount.');
        return;
      }

      await apiClient(`/payments/${selectedPayment._id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          refundAmountPaise,
          refundReference: refundForm.refundReference.trim(),
          refundReason: refundForm.refundReason.trim()
        })
      });

      setShowRefundModal(false);
      setSelectedPayment(null);
      setRefundForm({ refundAmountRupees: '', refundReference: '', refundReason: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error processing refund: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // View Operational Receipt
  const openReceiptModal = async (paymentId: string) => {
    try {
      setLoading(true);
      const res = await apiClient<any>(`/payments/${paymentId}/receipt`);
      setReceiptData(res?.data || res);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(`Failed to load receipt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // View Customer Receivables Statement
  const openCustomerStatement = async (customerId: string) => {
    try {
      setStatementLoading(true);
      setShowStatementModal(true);
      const res = await apiClient<any>(`/payments/receivables/customers/${customerId}`);
      setStatementData(res?.data || res);
    } catch (err: any) {
      alert(`Failed to load customer receivables statement: ${err.message}`);
      setShowStatementModal(false);
    } finally {
      setStatementLoading(false);
    }
  };

  // Format INR Currency
  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  // KPI Calculations
  const totalVerifiedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.amountPaise || 0), 0);

  const totalUnallocatedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.unallocatedAmountPaise || 0), 0);

  const totalAllocatedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.allocatedAmountPaise || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-xl p-6 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
              <Banknote className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center">
              <span>Customer Payments & Receivables Ledger</span>
              <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
                Accounts & Receivables
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Operational realization, atomic receipt sequences, order allocations, and receivables
            aging statements.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center space-x-2 bg-solar-600 hover:bg-solar-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Realized Collections
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{formatINR(totalVerifiedPaise)}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Active realized customer funds
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Allocated to Orders
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Split className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatINR(totalAllocatedPaise)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Applied towards sales milestones
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unallocated Credits
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatINR(totalUnallocatedPaise)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Available for future allocations or refund
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Ledger Records
            </span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{total}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Payments & adjustments on register
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card border rounded-xl p-4 shadow-sm items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search receipt #, customer, UTR..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="">All Statuses</option>
            <option value="RECORDED">RECORDED (Draft/Pending)</option>
            <option value="VERIFIED">VERIFIED (Realized)</option>
            <option value="REVERSED">REVERSED (Bounced/Void)</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>

          <select
            value={methodFilter}
            onChange={e => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="NEFT_RTGS">Direct RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="CASH">Cash</option>
            <option value="PAYMENT_GATEWAY">Payment Gateway</option>
            <option value="DEMAND_DRAFT">Demand Draft</option>
          </select>

          <button
            onClick={() => fetchPayments()}
            className="p-2 border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh payments list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mr-2 text-solar-500" />
            <span>Loading payments ledger...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-12 text-destructive">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            <Banknote className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold">No customer payment records found</p>
            <p className="text-sm mt-1">
              Record inbound customer advances, milestones, or filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Date & Method</th>
                  <th className="py-3.5 px-4">Transaction Ref</th>
                  <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                  <th className="py-3.5 px-4 text-center">Allocation Quota</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {payments.map(payment => {
                  const isVerified = payment.status === 'VERIFIED';
                  const isRecorded = payment.status === 'RECORDED';
                  const isReversed = payment.status === 'REVERSED';
                  const isRefunded = payment.status === 'REFUNDED';
                  const hasUnallocated = (payment.unallocatedAmountPaise || 0) > 0;

                  return (
                    <tr key={payment._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-solar-600">
                        {payment.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {payment.customerId?.name || 'Customer'}
                          </p>
                          <button
                            onClick={() => openCustomerStatement(payment.customerId?._id)}
                            className="text-xs text-solar-600 hover:underline flex items-center mt-0.5"
                          >
                            <span>Statement</span>
                            <ArrowUpRight className="w-3 h-3 ml-0.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {payment.paymentMethod}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {payment.transactionReference || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium">
                        {formatINR(payment.amountPaise)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs text-emerald-600 font-medium">
                            Alloc: {formatINR(payment.allocatedAmountPaise)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Unalloc: {formatINR(payment.unallocatedAmountPaise)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : isRecorded
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : isRefunded
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Receipt view */}
                          <button
                            onClick={() => openReceiptModal(payment._id)}
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Verify Button (if RECORDED) */}
                          {isRecorded && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowVerifyModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                              title="Verify Bank Realization"
                            >
                              Verify
                            </button>
                          )}

                          {/* Allocate Button (if VERIFIED and has unallocated) */}
                          {isVerified && hasUnallocated && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setAllocateForm({
                                  salesOrderId: '',
                                  amountRupees: (payment.unallocatedAmountPaise / 100).toFixed(2),
                                  notes: ''
                                });
                                setShowAllocateModal(true);
                              }}
                              className="px-2 py-1 bg-solar-600 hover:bg-solar-700 text-white rounded text-xs font-medium transition-colors"
                              title="Allocate to Order"
                            >
                              Allocate
                            </button>
                          )}

                          {/* Reverse Button */}
                          {!isReversed && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setReverseReason('');
                                setShowReverseModal(true);
                              }}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded"
                              title="Reverse Payment"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Refund Button (if VERIFIED and has unallocated) */}
                          {isVerified && hasUnallocated && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRefundForm({
                                  refundAmountRupees: (
                                    payment.unallocatedAmountPaise / 100
                                  ).toFixed(2),
                                  refundReference: '',
                                  refundReason: ''
                                });
                                setShowRefundModal(true);
                              }}
                              className="p-1.5 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 rounded"
                              title="Refund Unallocated Funds"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
              payments
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Record Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Record Customer Payment</h2>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Customer ID / Code <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Customer Code (e.g. CUST-2026-00001) or ID"
                  value={recordForm.customerId}
                  onChange={e => setRecordForm({ ...recordForm, customerId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Amount (INR ₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000.00"
                    value={recordForm.amountRupees}
                    onChange={e => setRecordForm({ ...recordForm, amountRupees: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Payment Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.paymentDate}
                    onChange={e => setRecordForm({ ...recordForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    value={recordForm.paymentMethod}
                    onChange={e => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="NEFT_RTGS">Direct RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYMENT_GATEWAY">Payment Gateway</option>
                    <option value="DEMAND_DRAFT">Demand Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Transaction Ref / UTR</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR20261025..."
                    value={recordForm.transactionReference}
                    onChange={e =>
                      setRecordForm({ ...recordForm, transactionReference: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Public Notes (Included on Receipt)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Milestone 1 advance for rooftop solar installation"
                  value={recordForm.notes}
                  onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Confidential Internal Notes{' '}
                  <span className="text-muted-foreground font-normal">(Staff Only)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal audit notes, bank account matching details..."
                  value={recordForm.internalNotes}
                  onChange={e => setRecordForm({ ...recordForm, internalNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="autoVerify"
                  checked={recordForm.autoVerify}
                  onChange={e => setRecordForm({ ...recordForm, autoVerify: e.target.checked })}
                  className="rounded text-solar-600 focus:ring-solar-500"
                />
                <label htmlFor="autoVerify" className="text-xs font-medium cursor-pointer">
                  Auto-Verify on recording (funds already credited in company bank account)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Verify Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showVerifyModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-2">Verify Customer Payment</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Confirm bank clearance for receipt{' '}
              <strong className="font-mono text-foreground">{selectedPayment.receiptNumber}</strong>{' '}
              of {formatINR(selectedPayment.amountPaise)}.
            </p>

            <form onSubmit={handleVerifyPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Verification Clearance Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Bank statement line matched on 27-Oct-2026 at 11:30 AM"
                  value={verifyForm.verificationNotes}
                  onChange={e => setVerifyForm({ verificationNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Verifying...' : 'Confirm Realization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Allocate Payment to Order */}
      {/* ------------------------------------------------------------- */}
      {showAllocateModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-1">Allocate Funds to Sales Order</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receipt:{' '}
              <span className="font-mono text-foreground font-semibold">
                {selectedPayment.receiptNumber}
              </span>{' '}
              | Available Unallocated:{' '}
              <span className="text-emerald-600 font-semibold">
                {formatINR(selectedPayment.unallocatedAmountPaise)}
              </span>
            </p>

            <form onSubmit={handleAllocatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Sales Order ID <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Sales Order Code (e.g. SO-2026-00001) or ID"
                  value={allocateForm.salesOrderId}
                  onChange={e => setAllocateForm({ ...allocateForm, salesOrderId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Must belong to customer: <strong>{selectedPayment.customerId?.name}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Allocation Amount (INR ₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(selectedPayment.unallocatedAmountPaise / 100).toFixed(2)}
                  required
                  value={allocateForm.amountRupees}
                  onChange={e => setAllocateForm({ ...allocateForm, amountRupees: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Allocation Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Milestone 1 solar inverter dispatch advance"
                  value={allocateForm.notes}
                  onChange={e => setAllocateForm({ ...allocateForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Allocating...' : 'Allocate Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Reverse Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showReverseModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center space-x-2 text-destructive mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-lg font-bold">Reverse Customer Payment</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Reversing receipt{' '}
              <strong className="font-mono text-foreground">{selectedPayment.receiptNumber}</strong>{' '}
              will automatically <strong>cascade-reverse all active order allocations</strong> and
              restore order outstanding balances.
            </p>

            <form onSubmit={handleReversePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Mandatory Reversal Audit Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Cheque returned unpaid due to signature mismatch..."
                  value={reverseReason}
                  onChange={e => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: Refund Unallocated Funds Modal */}
      {/* ------------------------------------------------------------- */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-1">Refund Unallocated Credit</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receipt:{' '}
              <span className="font-mono font-semibold text-foreground">
                {selectedPayment.receiptNumber}
              </span>{' '}
              | Maximum Available:{' '}
              <strong className="text-emerald-600">
                {formatINR(selectedPayment.unallocatedAmountPaise)}
              </strong>
            </p>

            <form onSubmit={handleRefundPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Amount (INR ₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(selectedPayment.unallocatedAmountPaise / 100).toFixed(2)}
                  required
                  value={refundForm.refundAmountRupees}
                  onChange={e =>
                    setRefundForm({ ...refundForm, refundAmountRupees: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Reference / Bank UTR <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC-OUT-991203..."
                  value={refundForm.refundReference}
                  onChange={e => setRefundForm({ ...refundForm, refundReference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Customer cancelled grid tie application..."
                  value={refundForm.refundReason}
                  onChange={e => setRefundForm({ ...refundForm, refundReason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Processing...' : 'Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: Printable Operational Payment Receipt */}
      {/* ------------------------------------------------------------- */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-2xl max-w-2xl w-full p-8 shadow-2xl max-h-[95vh] overflow-y-auto">
            {/* Header & Print Action */}
            <div className="flex justify-between items-start pb-6 border-b">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">
                      {receiptData.company?.companyName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {receiptData.company?.legalEntityName}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                  <p>
                    GSTIN: <span className="font-mono">{receiptData.company?.gstin}</span> | PAN:{' '}
                    <span className="font-mono">{receiptData.company?.pan}</span>
                  </p>
                  <p>
                    Email: {receiptData.company?.contactEmail} | Phone:{' '}
                    {receiptData.company?.contactPhone}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-solar-500/10 text-solar-700 dark:text-solar-300 font-mono text-xs font-bold rounded-lg border border-solar-500/20">
                  {receiptData.receiptNumber}
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  Date: {new Date(receiptData.paymentDate).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b text-xs">
              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                  Received From (Customer)
                </span>
                <p className="font-bold text-sm text-foreground mt-0.5">
                  {receiptData.customer?.name}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {receiptData.customer?.primaryPhone || '—'}
                </p>
                <p className="text-muted-foreground">{receiptData.customer?.email || '—'}</p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                  Payment Mode & Reference
                </span>
                <p className="font-medium text-foreground mt-0.5">{receiptData.paymentMethod}</p>
                <p className="font-mono text-muted-foreground mt-0.5">
                  Ref: {receiptData.transactionReference || 'N/A'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-semibold">
                  Status: {receiptData.status}
                </span>
              </div>
            </div>

            {/* Realized Amount Block */}
            <div className="my-6 p-4 bg-muted/30 border rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Total Realized Amount
                </span>
                <p className="text-3xl font-extrabold text-foreground mt-0.5">
                  {formatINR(receiptData.amountPaise)}
                </p>
              </div>
              <div className="text-right text-xs space-y-1">
                <p>
                  Allocated:{' '}
                  <strong className="text-emerald-600">
                    {formatINR(receiptData.allocatedAmountPaise)}
                  </strong>
                </p>
                <p>
                  Unallocated Credit:{' '}
                  <strong className="text-amber-600">
                    {formatINR(receiptData.unallocatedAmountPaise)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Allocations Breakdown */}
            {receiptData.allocations?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Sales Order Allocations
                </h4>
                <div className="border rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-left">Allocation #</th>
                        <th className="py-2 px-3 text-left">Sales Order</th>
                        <th className="py-2 px-3 text-left">Plant Sizing</th>
                        <th className="py-2 px-3 text-right">Allocated (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receiptData.allocations.map((a: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono">{a.allocationNumber}</td>
                          <td className="py-2 px-3 font-mono font-medium">{a.orderNumber}</td>
                          <td className="py-2 px-3">
                            {a.systemCapacityKwp ? `${a.systemCapacityKwp} kWp` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatINR(a.allocatedAmountPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {receiptData.notes && (
              <div className="mb-4 text-xs">
                <span className="font-semibold text-muted-foreground">Notes:</span>
                <p className="text-foreground mt-0.5 italic">{receiptData.notes}</p>
              </div>
            )}

            {/* Operational Legal Disclaimer */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Notice of Fund Realization:</p>
              <p>{receiptData.disclaimer}</p>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 7: Receivables Statement & Aging Breakdown */}
      {/* ------------------------------------------------------------- */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold">Customer Receivables & Aging Statement</h2>
                {statementData?.customer && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Customer:{' '}
                    <strong className="text-foreground">{statementData.customer.name}</strong> (
                    {statementData.customer.customerCode || 'N/A'})
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowStatementModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            {statementLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-solar-500 mb-2" />
                <span>Generating receivables statement...</span>
              </div>
            ) : statementData ? (
              <div className="space-y-6 mt-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Total Invoiced
                    </span>
                    <p className="text-lg font-bold mt-1 text-foreground">
                      {formatINR(statementData.totalOrderValuePaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Total Realized
                    </span>
                    <p className="text-lg font-bold mt-1 text-emerald-600">
                      {formatINR(statementData.totalAllocatedPaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Unallocated Credit
                    </span>
                    <p className="text-lg font-bold mt-1 text-amber-600">
                      {formatINR(statementData.totalUnallocatedCreditPaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Net Outstanding
                    </span>
                    <p className="text-lg font-bold mt-1 text-destructive">
                      {formatINR(statementData.totalOutstandingPaise)}
                    </p>
                  </div>
                </div>

                {/* Aging Buckets */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Receivables Aging Analysis
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        Current (0–30 Days)
                      </span>
                      <strong className="text-sm text-emerald-700 dark:text-emerald-300">
                        {formatINR(statementData.aging?.current0To30Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        31–60 Days Overdue
                      </span>
                      <strong className="text-sm text-amber-700 dark:text-amber-300">
                        {formatINR(statementData.aging?.overdue31To60Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        61–90 Days Overdue
                      </span>
                      <strong className="text-sm text-orange-700 dark:text-orange-300">
                        {formatINR(statementData.aging?.overdue61To90Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        &gt;90 Days Overdue
                      </span>
                      <strong className="text-sm text-destructive">
                        {formatINR(statementData.aging?.overdueAbove90Paise)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Orders Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Contracted Orders Balance
                  </h4>
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b text-muted-foreground">
                        <tr>
                          <th className="py-2 px-3 text-left">Order #</th>
                          <th className="py-2 px-3 text-left">Order Date</th>
                          <th className="py-2 px-3 text-right">Order Total</th>
                          <th className="py-2 px-3 text-right">Allocated</th>
                          <th className="py-2 px-3 text-right">Outstanding</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {statementData.orders?.map(order => (
                          <tr key={order._id}>
                            <td className="py-2 px-3 font-mono font-medium">{order.orderNumber}</td>
                            <td className="py-2 px-3">
                              {order.orderDate
                                ? new Date(order.orderDate).toLocaleDateString('en-IN')
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatINR(order.netTotalPaise)}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-600">
                              {formatINR(order.allocatedAmountPaise)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-destructive">
                              {formatINR(order.outstandingBalancePaise)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  order.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : order.paymentStatus === 'PARTIALLY_PAID'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {order.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-4 border-t mt-6">
              <button
                type="button"
                onClick={() => setShowStatementModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
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
