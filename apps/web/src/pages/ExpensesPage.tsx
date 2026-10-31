/**
 * INS Solar Business Management Software — Expense Register & Management Page
 *
 * Operational expense ledger:
 * - Expense intake with atomic EXP sequence numbers and integer-paise financial precision
 * - Configurable company approval thresholds (> ₹5,000 mandates manager approval)
 * - Anti-self-approval enforcement
 * - Category-level allocation (Labor, Freight, Crane, Civil, Liaison, Consumables, Overhead)
 * - Payment disbursement recording
 * - Audited cancellation workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  XCircle,
  CreditCard,
  Tag,
  DollarSign,
  Clock,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface ExpenseRecord {
  _id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  payeeName?: string;
  description: string;
  amountPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paymentMode?: string;
  paymentReference?: string;
  paymentDate?: string;
  paidAmountPaise: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
  requiresApproval: boolean;
  notes?: string;
  evidenceKey?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  vendorId?: { _id: string; companyName: string };
  projectId?: { _id: string; projectCode: string; name: string };
  submittedBy?: { _id: string; firstName: string; lastName: string; employeeCode: string };
  approvedBy?: { _id: string; firstName: string; lastName: string; employeeCode: string };
  statusHistory?: Array<{
    fromStatus: string;
    toStatus: string;
    changedAt: string;
    notes?: string;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL_FUEL: 'Travel & Fuel',
  FREIGHT_LOGISTICS: 'Freight & Logistics',
  CRANE_EQUIPMENT_HIRE: 'Crane & Equipment',
  CIVIL_FOUNDATION_WORKS: 'Civil Works',
  INSTALLATION_LABOR: 'Installation Labor',
  LIAISON_DISCOM_APPROVALS: 'DISCOM Liaison',
  CONSUMABLES_ELECTRICAL: 'Electrical Consumables',
  WARRANTY_SERVICE: 'Warranty & Service',
  OFFICE_OVERHEAD: 'Office Overhead',
  MARKETING_SALES: 'Marketing & Sales',
  MISCELLANEOUS: 'Miscellaneous'
};

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('');

  // Active Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord | null>(null);

  // Form State: Record Expense
  const [recordForm, setRecordForm] = useState({
    category: 'INSTALLATION_LABOR',
    description: '',
    amountRupees: '',
    taxAmountRupees: '0',
    payeeName: '',
    projectId: '',
    notes: '',
    evidenceKey: ''
  });

  // Action Form States
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    paymentMode: 'BANK_TRANSFER',
    paymentReference: '',
    paidAmountRupees: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedPaymentStatus) params.append('paymentStatus', selectedPaymentStatus);

      const res = await apiClient<{
        data: ExpenseRecord[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/expenses?${params.toString()}`);

      if (res) {
        setExpenses(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.total || 0);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedCategory, selectedStatus, selectedPaymentStatus]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Aggregate metrics
  const totalAmountPaise = expenses.reduce((sum, e) => sum + (e.totalAmountPaise || 0), 0);
  const pendingApprovalCount = expenses.filter(e => e.status === 'PENDING_APPROVAL').length;
  const pendingApprovalPaise = expenses
    .filter(e => e.status === 'PENDING_APPROVAL')
    .reduce((sum, e) => sum + (e.totalAmountPaise || 0), 0);
  const approvedUnpaidCount = expenses.filter(
    e =>
      (e.status === 'APPROVED' || e.paymentStatus === 'PARTIALLY_PAID') &&
      e.paymentStatus !== 'PAID'
  ).length;
  const approvedUnpaidPaise = expenses
    .filter(
      e =>
        (e.status === 'APPROVED' || e.paymentStatus === 'PARTIALLY_PAID') &&
        e.paymentStatus !== 'PAID'
    )
    .reduce((sum, e) => sum + (e.totalAmountPaise - (e.paidAmountPaise || 0)), 0);
  const paidCount = expenses.filter(e => e.paymentStatus === 'PAID').length;
  const paidPaise = expenses.reduce((sum, e) => sum + (e.paidAmountPaise || 0), 0);

  const formatPaise = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const amountPaise = Math.round(parseFloat(recordForm.amountRupees) * 100);
      const taxAmountPaise = Math.round(parseFloat(recordForm.taxAmountRupees || '0') * 100);

      if (isNaN(amountPaise) || amountPaise <= 0) {
        throw new Error('Please enter a valid positive expense amount.');
      }

      await apiClient('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: recordForm.category,
          description: recordForm.description,
          amountPaise,
          taxAmountPaise: isNaN(taxAmountPaise) ? 0 : taxAmountPaise,
          payeeName: recordForm.payeeName.trim() || undefined,
          projectId: recordForm.projectId.trim() || undefined,
          notes: recordForm.notes.trim() || undefined,
          evidenceKey: recordForm.evidenceKey.trim() || undefined
        })
      });

      setSuccessMsg('Expense recorded successfully.');
      setRecordModalOpen(false);
      setRecordForm({
        category: 'INSTALLATION_LABOR',
        description: '',
        amountRupees: '',
        taxAmountRupees: '0',
        payeeName: '',
        projectId: '',
        notes: '',
        evidenceKey: ''
      });
      fetchExpenses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!activeExpense) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient(`/expenses/${activeExpense._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvalNotes: approvalNotes.trim() || undefined
        })
      });
      setSuccessMsg(`Expense ${activeExpense.expenseNumber} approved successfully.`);
      setApproveModalOpen(false);
      setApprovalNotes('');
      fetchExpenses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to approve expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeExpense) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!rejectionReason.trim()) {
        throw new Error('Please provide a reason for rejecting this expense.');
      }
      await apiClient(`/expenses/${activeExpense._id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim()
        })
      });
      setSuccessMsg(`Expense ${activeExpense.expenseNumber} rejected.`);
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchExpenses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to reject expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!activeExpense) return;
    setSubmitting(true);
    setError(null);
    try {
      const paidPaise = paymentForm.paidAmountRupees
        ? Math.round(parseFloat(paymentForm.paidAmountRupees) * 100)
        : activeExpense.totalAmountPaise - (activeExpense.paidAmountPaise || 0);

      await apiClient(`/expenses/${activeExpense._id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMode: paymentForm.paymentMode,
          paymentReference: paymentForm.paymentReference.trim(),
          paidAmountPaise: paidPaise,
          notes: paymentForm.notes.trim() || undefined
        })
      });

      setSuccessMsg(`Payment recorded against ${activeExpense.expenseNumber}.`);
      setPayModalOpen(false);
      setPaymentForm({
        paymentMode: 'BANK_TRANSFER',
        paymentReference: '',
        paidAmountRupees: '',
        notes: ''
      });
      fetchExpenses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeExpense) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!cancellationReason.trim()) {
        throw new Error('Please provide a documented reason for cancelling this expense.');
      }
      await apiClient(`/expenses/${activeExpense._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          cancellationReason: cancellationReason.trim()
        })
      });
      setSuccessMsg(`Expense ${activeExpense.expenseNumber} cancelled.`);
      setCancelModalOpen(false);
      setCancellationReason('');
      fetchExpenses();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to cancel expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Approved
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Pending Approval
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Paid
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Disbursed
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Partial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Receipt className="w-6 h-6 mr-2 text-solar-600" />
            <span>Operational Expense Management</span>
            <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
              Project Costing & Profitability
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track project budgets, direct site expenses, civil works, and profitability
            disbursements.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchExpenses()}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setRecordModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Expense
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Recorded Expenses
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(totalAmountPaise)}</p>
          <p className="text-xs text-muted-foreground">{totalCount} total entries</p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending Approval
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(pendingApprovalPaise)}</p>
          <p className="text-xs text-amber-700 font-medium">
            {pendingApprovalCount} pending manager action
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center">
            <DollarSign className="w-3.5 h-3.5 mr-1" /> Approved & Unpaid
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(approvedUnpaidPaise)}</p>
          <p className="text-xs text-blue-700 font-medium">
            {approvedUnpaidCount} ready for disbursement
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Disbursed / Paid
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(paidPaise)}</p>
          <p className="text-xs text-emerald-700 font-medium">{paidCount} transactions completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search expense #, payee, desc..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background text-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={e => {
              setSelectedPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
          >
            <option value="">All Payment States</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>

          {(searchTerm || selectedCategory || selectedStatus || selectedPaymentStatus) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedStatus('');
                setSelectedPaymentStatus('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Expense Register Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Expense #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Payee / Description</th>
                <th className="py-3 px-4">Project Link</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Disbursement</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-600" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No expense records found matching current criteria.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-solar-600">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center text-xs font-medium bg-muted px-2 py-0.5 rounded">
                        <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
                        {CATEGORY_LABELS[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium truncate">
                        {exp.payeeName || 'Direct Expense'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {exp.description}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {exp.projectId ? (
                        <div className="text-xs">
                          <span className="font-mono font-semibold text-foreground">
                            {exp.projectId.projectCode}
                          </span>
                          <span className="block text-muted-foreground truncate max-w-[120px]">
                            {exp.projectId.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          General Overhead
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-bold text-foreground">
                        {formatPaise(exp.totalAmountPaise)}
                      </div>
                      {exp.taxAmountPaise > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Base: {formatPaise(exp.amountPaise)} + Tax:{' '}
                          {formatPaise(exp.taxAmountPaise)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(exp.status)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getPaymentStatusBadge(exp.paymentStatus)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setActiveExpense(exp);
                            setDetailModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs border rounded hover:bg-muted font-medium"
                        >
                          View
                        </button>

                        {exp.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => {
                                setActiveExpense(exp);
                                setApproveModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setActiveExpense(exp);
                                setRejectModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {exp.status === 'APPROVED' && exp.paymentStatus !== 'PAID' && (
                          <button
                            onClick={() => {
                              setActiveExpense(exp);
                              setPaymentForm({
                                paymentMode: 'BANK_TRANSFER',
                                paymentReference: '',
                                paidAmountRupees: (
                                  (exp.totalAmountPaise - (exp.paidAmountPaise || 0)) /
                                  100
                                ).toString(),
                                notes: ''
                              });
                              setPayModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                          >
                            Disburse
                          </button>
                        )}

                        {exp.paymentStatus !== 'PAID' && exp.status !== 'CANCELLED' && (
                          <button
                            onClick={() => {
                              setActiveExpense(exp);
                              setCancelModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 font-medium"
                          >
                            Cancel
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

        {/* Pagination */}
        <div className="py-3 px-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {expenses.length} of {totalCount} records
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1 border rounded hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1 border rounded hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Record Expense */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-solar-600" /> Record New Expense
            </h3>
            <p className="text-xs text-muted-foreground">
              Amounts greater than ₹5,000 will automatically route to manager approval.
            </p>

            <form onSubmit={handleRecordExpense} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  value={recordForm.category}
                  onChange={e => setRecordForm({ ...recordForm, category: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Description & Business Purpose <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Scaffolding rental and transport charges for rooftop install"
                  value={recordForm.description}
                  onChange={e => setRecordForm({ ...recordForm, description: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Base Amount (₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 4500"
                    value={recordForm.amountRupees}
                    onChange={e => setRecordForm({ ...recordForm, amountRupees: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    GST / Tax Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={recordForm.taxAmountRupees}
                    onChange={e =>
                      setRecordForm({ ...recordForm, taxAmountRupees: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Payee Name / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Crane Services"
                    value={recordForm.payeeName}
                    onChange={e => setRecordForm({ ...recordForm, payeeName: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Project ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Project MongoDB ID"
                    value={recordForm.projectId}
                    onChange={e => setRecordForm({ ...recordForm, projectId: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Evidence File Storage Key (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. evidence/expenses/receipt-001.pdf"
                  value={recordForm.evidenceKey}
                  onChange={e => setRecordForm({ ...recordForm, evidenceKey: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Additional context or bill reference..."
                  value={recordForm.notes}
                  onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Approve Expense */}
      {approveModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" /> Approve Expense
            </h3>
            <p className="text-sm text-muted-foreground">
              Approve expense{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>{' '}
              for{' '}
              <span className="font-bold text-foreground">
                {formatPaise(activeExpense.totalAmountPaise)}
              </span>
              ?
            </p>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Approval Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Verified with project engineer and site photos"
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Expense */}
      {rejectModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center text-red-600">
              <Ban className="w-5 h-5 mr-2" /> Reject Expense
            </h3>
            <p className="text-sm text-muted-foreground">
              Reject expense{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>
              . A documented reason is required.
            </p>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Receipt lacks vendor GSTIN and details do not match site report"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Rejecting...' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Disburse / Pay Expense */}
      {payModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> Disburse Payment
            </h3>
            <p className="text-xs text-muted-foreground">
              Record bank transfer, UPI or cash payment against{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>
              .
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Payment Reference / UTR <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR123456789 or Cheque #88210"
                  value={paymentForm.paymentReference}
                  onChange={e =>
                    setPaymentForm({ ...paymentForm, paymentReference: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Disbursed Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Full remaining balance"
                  value={paymentForm.paidAmountRupees}
                  onChange={e =>
                    setPaymentForm({ ...paymentForm, paidAmountRupees: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Paid from HDFC current account"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !paymentForm.paymentReference.trim()}
                onClick={handleRecordPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record Disbursement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancel Expense */}
      {cancelModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center text-destructive">
              <XCircle className="w-5 h-5 mr-2" /> Cancel Expense
            </h3>
            <p className="text-sm text-muted-foreground">
              Cancel expense{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>
              . This action is permanent and preserved in audit logs.
            </p>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Cancellation Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Duplicate claim entered by site coordinator"
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting || !cancellationReason.trim()}
                onClick={handleCancel}
                className="px-4 py-2 bg-destructive text-white rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail & Audit History */}
      {detailModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono font-bold text-lg text-solar-600">
                  {activeExpense.expenseNumber}
                </span>
                <span className="ml-2">{getStatusBadge(activeExpense.status)}</span>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Category</span>
                  <span className="font-semibold text-foreground">
                    {CATEGORY_LABELS[activeExpense.category] || activeExpense.category}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Expense Date</span>
                  <span className="font-semibold text-foreground">
                    {new Date(activeExpense.expenseDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Payee / Vendor</span>
                  <span className="font-semibold text-foreground">
                    {activeExpense.payeeName || activeExpense.vendorId?.companyName || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Project</span>
                  <span className="font-semibold text-foreground">
                    {activeExpense.projectId ? activeExpense.projectId.projectCode : 'Overhead'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block">Description</span>
                <p className="font-medium text-foreground">{activeExpense.description}</p>
              </div>

              <div className="border rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-muted-foreground block">Base Amount</span>
                  <span className="font-bold text-foreground">
                    {formatPaise(activeExpense.amountPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Tax (GST)</span>
                  <span className="font-bold text-foreground">
                    {formatPaise(activeExpense.taxAmountPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Amount</span>
                  <span className="font-bold text-solar-600 text-sm">
                    {formatPaise(activeExpense.totalAmountPaise)}
                  </span>
                </div>
              </div>

              {activeExpense.paymentReference && (
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs space-y-1 text-blue-900">
                  <span className="font-bold block">Disbursement Metadata</span>
                  <div>Mode: {activeExpense.paymentMode}</div>
                  <div>Reference / UTR: {activeExpense.paymentReference}</div>
                  <div>Paid: {formatPaise(activeExpense.paidAmountPaise)}</div>
                </div>
              )}

              {activeExpense.evidenceKey && (
                <div className="p-2 border rounded text-xs flex items-center justify-between">
                  <span className="font-mono text-muted-foreground truncate max-w-[280px]">
                    {activeExpense.evidenceKey}
                  </span>
                  <span className="text-emerald-600 font-semibold text-[11px]">
                    Evidence Attached
                  </span>
                </div>
              )}

              {/* Status History */}
              {activeExpense.statusHistory && activeExpense.statusHistory.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <span className="text-xs font-bold text-foreground block">Audit History</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                    {activeExpense.statusHistory.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 bg-muted/30 rounded flex justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {h.fromStatus} → {h.toStatus}
                          </span>
                          {h.notes && (
                            <span className="text-muted-foreground ml-1">({h.notes})</span>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(h.changedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
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
