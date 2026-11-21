/**
 * INS Solar Business Management Software — Expense Register & Management Page
 *
 * Operational expense ledger:
 * - Expense intake with atomic EXP sequence numbers and integer-paise financial precision
 * - Configurable company approval thresholds (> ₹5,000 mandates manager approval)
 * - Anti-self-approval enforcement with clear UI guards
 * - Category-level allocation (Labor, Freight, Crane, Civil, Liaison, Consumables, Overhead)
 * - Integrated Registered Vendor Directory & Solar Project linking
 * - Payment disbursement recording with multi-mode auditing
 * - Audited cancellation workflow and CSV export
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  IndianRupee,
  Clock,
  ShieldCheck,
  Ban,
  ExternalLink,
  Download
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

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
  const { user } = useAuth();

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

  // Reference Lists
  const [projectsList, setProjectsList] = useState<Array<{ _id: string; projectCode: string; name: string }>>([]);
  const [vendorsList, setVendorsList] = useState<Array<{ _id: string; companyName: string }>>([]);

  // Form State: Record Expense
  const [recordForm, setRecordForm] = useState({
    category: 'INSTALLATION_LABOR',
    expenseDate: new Date().toISOString().split('T')[0],
    description: '',
    amountRupees: '',
    taxAmountRupees: '0',
    vendorId: '',
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

      const res = await apiClient<any>(`/expenses?${params.toString()}`);

      if (res) {
        const list = Array.isArray(res) ? res : res?.data?.data || res?.data || res?.items || [];
        setExpenses(Array.isArray(list) ? list : []);
        setTotalPages(res.totalPages || res?.data?.totalPages || 1);
        setTotalCount(res.total ?? res?.data?.total ?? list.length);
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

  // Load Projects and Vendors for clean selection
  useEffect(() => {
    apiClient<any>('/projects?limit=100')
      .then(res => {
        const list = res?.projects || res?.data?.projects || res?.items || res?.data?.items || (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        setProjectsList(Array.isArray(list) ? list : []);
      })
      .catch(() => {});

    apiClient<any>('/vendors?limit=100&isActive=true')
      .then(res => {
        const list = res?.vendors || res?.data?.vendors || res?.items || res?.data?.items || (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        setVendorsList(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

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
          expenseDate: recordForm.expenseDate ? new Date(recordForm.expenseDate) : undefined,
          description: recordForm.description.trim(),
          amountPaise,
          taxAmountPaise: isNaN(taxAmountPaise) ? 0 : taxAmountPaise,
          vendorId: recordForm.vendorId.trim() || undefined,
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
        expenseDate: new Date().toISOString().split('T')[0],
        description: '',
        amountRupees: '',
        taxAmountRupees: '0',
        vendorId: '',
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
      const remainingPaise = activeExpense.totalAmountPaise - (activeExpense.paidAmountPaise || 0);
      const paidPaise = paymentForm.paidAmountRupees
        ? Math.round(parseFloat(paymentForm.paidAmountRupees) * 100)
        : remainingPaise;

      if (isNaN(paidPaise) || paidPaise <= 0) {
        throw new Error('Please enter a valid disbursement amount greater than ₹0.');
      }

      if (paidPaise > remainingPaise) {
        throw new Error(`Disbursement amount cannot exceed remaining balance of ${formatPaise(remainingPaise)}.`);
      }

      if (!paymentForm.paymentReference.trim()) {
        throw new Error('Payment reference (UTR / Cheque / Transaction ID) is required.');
      }

      await apiClient(`/expenses/${activeExpense._id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMode: paymentForm.paymentMode,
          paymentReference: paymentForm.paymentReference.trim(),
          paidAmountPaise: paidPaise,
          notes: paymentForm.notes.trim() || undefined
        })
      });

      setSuccessMsg(`Payment of ${formatPaise(paidPaise)} recorded against ${activeExpense.expenseNumber}.`);
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

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      setError('No expense records available to export.');
      return;
    }

    const headers = [
      'Expense #',
      'Expense Date',
      'Category',
      'Payee / Vendor',
      'Project Code',
      'Project Name',
      'Description',
      'Base Amount (INR)',
      'GST / Tax (INR)',
      'Total Amount (INR)',
      'Paid Amount (INR)',
      'Remaining Balance (INR)',
      'Approval Status',
      'Disbursement Status',
      'Payment Mode',
      'Reference / UTR',
      'Notes'
    ];

    const rows = expenses.map(exp => [
      `"${exp.expenseNumber || ''}"`,
      `"${new Date(exp.expenseDate).toLocaleDateString('en-IN')}"`,
      `"${CATEGORY_LABELS[exp.category] || exp.category}"`,
      `"${(exp.payeeName || exp.vendorId?.companyName || 'Direct').replace(/"/g, '""')}"`,
      `"${exp.projectId?.projectCode || 'N/A'}"`,
      `"${(exp.projectId?.name || 'General Overhead').replace(/"/g, '""')}"`,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
      ((exp.amountPaise || 0) / 100).toFixed(2),
      ((exp.taxAmountPaise || 0) / 100).toFixed(2),
      ((exp.totalAmountPaise || 0) / 100).toFixed(2),
      ((exp.paidAmountPaise || 0) / 100).toFixed(2),
      (((exp.totalAmountPaise || 0) - (exp.paidAmountPaise || 0)) / 100).toFixed(2),
      `"${exp.status}"`,
      `"${exp.paymentStatus}"`,
      `"${exp.paymentMode || ''}"`,
      `"${(exp.paymentReference || '').replace(/"/g, '""')}"`,
      `"${(exp.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Expenses_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMsg('Expense register exported to CSV successfully.');
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
            Paid / Settled
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

  const getPaymentStatusBadge = (paymentStatus: string, paidAmountPaise?: number) => {
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
            Partial {paidAmountPaise ? `(${formatPaise(paidAmountPaise)})` : ''}
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

  const isPrivilegedFiscalRole =
    user?.role === 'SUPERADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'ACCOUNTS_OFFICER';

  // Live financial preview in modal
  const basePaisePreview = Math.round((parseFloat(recordForm.amountRupees) || 0) * 100);
  const taxPaisePreview = Math.round((parseFloat(recordForm.taxAmountRupees) || 0) * 100);
  const totalPaisePreview = basePaisePreview + taxPaisePreview;
  const isAboveThreshold = basePaisePreview > 500000;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Receipt className="w-6 h-6 mr-2 text-solar-600" />
            <span>Site Expenses &amp; Labor</span>
            <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Site Work &amp; Overheads
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track direct site costs (Installation labor wages, crane hire, transport, civil works, DISCOM liaison) and overheads.
          </p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => fetchExpenses()}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={expenses.length === 0}
            className="inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
            title="Export filtered expense register to CSV"
          >
            <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export CSV
          </button>
          <button
            onClick={() => setRecordModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Record Expense
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
          <button onClick={() => setError(null)} className="font-bold ml-2 cursor-pointer">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Recorded Expenses
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(totalAmountPaise)}</p>
          <p className="text-xs text-muted-foreground">{totalCount} total entries</p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending Approval
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(pendingApprovalPaise)}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            {pendingApprovalCount} pending manager action
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center">
            <IndianRupee className="w-3.5 h-3.5 mr-1" /> Approved & Unpaid
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(approvedUnpaidPaise)}</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
            {approvedUnpaidCount} ready for disbursement
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Disbursed / Paid
          </span>
          <p className="text-2xl font-bold text-foreground">{formatPaise(paidPaise)}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{paidCount} transactions completed</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
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
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-solar-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
            title="Filter by operational category"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Approval Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
            title="Filter by approval status"
          >
            <option value="">All Approval Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved (Awaiting Payment)</option>
            <option value="PAID">Paid / Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Disbursement Status Filter */}
          <select
            value={selectedPaymentStatus}
            onChange={e => {
              setSelectedPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
            title="Filter by disbursement status"
          >
            <option value="">All Disbursement States</option>
            <option value="UNPAID">Unpaid (₹0 paid)</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Fully Disbursed</option>
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
              className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Expense Register Table */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left text-sm text-foreground min-w-[800px]">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground font-semibold">
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
                expenses.map(exp => {
                  const isSubmitter = !!(user && exp.submittedBy && (
                    exp.submittedBy._id === user.id ||
                    exp.submittedBy._id === (user as any).userId ||
                    (exp.submittedBy as any).id === user.id ||
                    (exp.submittedBy as any).id === (user as any).userId
                  ));

                  const isBlockedBySelfApproval = !isPrivilegedFiscalRole && isSubmitter;

                  return (
                    <tr key={exp._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-solar-600 whitespace-nowrap">
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
                        <span className="inline-flex items-center text-xs font-medium bg-muted px-2 py-0.5 rounded whitespace-nowrap">
                          <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
                          {CATEGORY_LABELS[exp.category] || exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-foreground truncate">
                          {exp.payeeName || exp.vendorId?.companyName || 'Direct Expense'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {exp.description}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {exp.projectId ? (
                          <div className="text-xs">
                            <Link
                              to={`/projects/${(exp.projectId as any)._id || exp.projectId}?tab=costing`}
                              className="font-mono font-semibold text-solar-600 hover:text-solar-700 hover:underline inline-flex items-center gap-1"
                              title="Open Project Costing & Profitability Tab"
                            >
                              <span>{exp.projectId.projectCode || 'PROJ'}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Link>
                            <span className="block text-muted-foreground truncate max-w-[140px]">
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
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Base: {formatPaise(exp.amountPaise)} + Tax: {formatPaise(exp.taxAmountPaise)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(exp.status)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getPaymentStatusBadge(exp.paymentStatus, exp.paidAmountPaise)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setActiveExpense(exp);
                              setDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs border rounded-lg hover:bg-muted font-medium transition-colors cursor-pointer"
                          >
                            View
                          </button>

                          {exp.status === 'PENDING_APPROVAL' && (
                            <>
                              {isBlockedBySelfApproval ? (
                                <span
                                  className="px-2 py-1 text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded font-medium cursor-not-allowed"
                                  title="Anti-self-approval rule: Field staff cannot approve their own expense submission. Another manager or admin must approve."
                                >
                                  Awaiting Peer
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActiveExpense(exp);
                                    setApproveModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveExpense(exp);
                                  setRejectModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors cursor-pointer"
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
                              className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors cursor-pointer"
                            >
                              Disburse
                            </button>
                          )}

                          {exp.status !== 'PAID' &&
                            exp.paymentStatus !== 'PAID' &&
                            exp.status !== 'CANCELLED' &&
                            exp.status !== 'REJECTED' && (
                              <button
                                onClick={() => {
                                  setActiveExpense(exp);
                                  setCancelModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 font-medium transition-colors cursor-pointer"
                              >
                                Cancel
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

        {/* Pagination */}
        <div className="py-3 px-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {expenses.length} of {totalCount} records
          </span>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1 border rounded hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1 border rounded hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: RECORD EXPENSE (WITH LIVE THRESHOLD & VENDOR SELECTION)
         ========================================================================= */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0 overflow-y-auto">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="border-b pb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center">
                  <Receipt className="w-5 h-5 mr-2 text-solar-600" /> Record New Expense
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record operational, site, civil, or vendor expenses with automatic threshold auditing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordModalOpen(false)}
                className="text-muted-foreground hover:text-foreground font-bold p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={recordForm.category}
                    onChange={e => setRecordForm({ ...recordForm, category: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
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
                    Expense Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.expenseDate}
                    onChange={e => setRecordForm({ ...recordForm, expenseDate: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                  />
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Live Financial & Approval Summary Card */}
              <div className="p-3 bg-muted/40 border rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Base: <strong className="text-foreground">{formatPaise(basePaisePreview)}</strong></span>
                  <span>GST: <strong className="text-foreground">{formatPaise(taxPaisePreview)}</strong></span>
                  <span>Total: <strong className="text-solar-600 font-bold text-sm">{formatPaise(totalPaisePreview)}</strong></span>
                </div>
                <div className="pt-1.5 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Routing Threshold:</span>
                  {basePaisePreview <= 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">Enter amount to preview approval route</span>
                  ) : isPrivilegedFiscalRole ? (
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Directly Approved ({user?.role === 'ACCOUNTS_OFFICER' ? 'Accounts Officer' : 'Admin'} Fiscal Authority)
                    </span>
                  ) : isAboveThreshold ? (
                    <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Routes to Manager Approval (&gt; ₹5,000 threshold)
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Auto-Approved on Submit (≤ ₹5,000 threshold)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Registered Vendor (Optional)
                  </label>
                  <select
                    value={recordForm.vendorId}
                    onChange={e => {
                      const vId = e.target.value;
                      const matched = vendorsList.find(v => v._id === vId);
                      setRecordForm(prev => ({
                        ...prev,
                        vendorId: vId,
                        payeeName: matched ? matched.companyName : prev.payeeName
                      }));
                    }}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
                  >
                    <option value="">Direct Contractor / Ad-hoc Payee</option>
                    {vendorsList.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Payee / Individual Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Crane Services or Raju Sharma"
                    value={recordForm.payeeName}
                    onChange={e => setRecordForm({ ...recordForm, payeeName: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Linked Solar Project (Optional)
                </label>
                <select
                  value={recordForm.projectId}
                  onChange={e => setRecordForm({ ...recordForm, projectId: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
                >
                  <option value="">General Overhead (Company / Office)</option>
                  {projectsList.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.projectCode} • {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Receipt / Voucher Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VOUCHER-2026-089 or Cash Bill Ref"
                    value={recordForm.evidenceKey}
                    onChange={e => setRecordForm({ ...recordForm, evidenceKey: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="Additional context or bill reference..."
                    value={recordForm.notes}
                    onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-xl text-sm font-semibold hover:bg-solar-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'Recording...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: APPROVE EXPENSE
         ========================================================================= */}
      {approveModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
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
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: REJECT EXPENSE
         ========================================================================= */}
      {rejectModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center text-rose-600">
              <Ban className="w-5 h-5 mr-2" /> Reject Expense
            </h3>
            <p className="text-sm text-muted-foreground">
              Reject expense{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>
              . A documented reason is required for audit trail.
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
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Rejecting...' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DISBURSE / PAY EXPENSE
         ========================================================================= */}
      {payModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> Disburse Payment
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record bank transfer, UPI, cheque, or cash disbursement against{' '}
                <span className="font-mono font-bold text-foreground">
                  {activeExpense.expenseNumber}
                </span>
                .
              </p>
            </div>

            {/* Balance Card */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Remaining Unpaid Balance:</span>
              <span className="font-bold text-blue-700 dark:text-blue-400 font-mono text-sm">
                {formatPaise(activeExpense.totalAmountPaise - (activeExpense.paidAmountPaise || 0))}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
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
                  min="1"
                  placeholder="Full remaining balance"
                  value={paymentForm.paidAmountRupees}
                  onChange={e =>
                    setPaymentForm({ ...paymentForm, paidAmountRupees: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes / Bank Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Paid from HDFC current account"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !paymentForm.paymentReference.trim()}
                onClick={handleRecordPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Recording...' : 'Record Disbursement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: CANCEL EXPENSE
         ========================================================================= */}
      {cancelModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center text-destructive">
              <XCircle className="w-5 h-5 mr-2" /> Cancel Expense
            </h3>
            <p className="text-sm text-muted-foreground">
              Cancel expense{' '}
              <span className="font-mono font-bold text-foreground">
                {activeExpense.expenseNumber}
              </span>
              . This action is permanent and recorded in the audit logs.
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
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting || !cancellationReason.trim()}
                onClick={handleCancel}
                className="px-4 py-2 bg-destructive text-white rounded-xl text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: DETAIL & AUDIT HISTORY
         ========================================================================= */}
      {detailModalOpen && activeExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0 overflow-y-auto">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono font-bold text-lg text-solar-600">
                  {activeExpense.expenseNumber}
                </span>
                <span className="ml-2.5">{getStatusBadge(activeExpense.status)}</span>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-muted-foreground hover:text-foreground font-bold p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Category</span>
                  <span className="font-semibold text-foreground">
                    {CATEGORY_LABELS[activeExpense.category] || activeExpense.category}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Expense Date</span>
                  <span className="font-semibold text-foreground">
                    {new Date(activeExpense.expenseDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Payee / Vendor</span>
                  <span className="font-semibold text-foreground">
                    {activeExpense.payeeName || activeExpense.vendorId?.companyName || 'Direct'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Project Allocation</span>
                  <span className="font-semibold text-foreground">
                    {activeExpense.projectId ? (
                      activeExpense.projectId.projectCode || activeExpense.projectId.name || 'Project'
                    ) : (
                      'General Overhead'
                    )}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <span className="text-xs text-muted-foreground block">Description</span>
                <p className="font-medium text-foreground">{activeExpense.description}</p>
              </div>

              <div className="border rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-muted-foreground block">Base Amount</span>
                  <span className="font-bold text-foreground font-mono">
                    {formatPaise(activeExpense.amountPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Tax (GST)</span>
                  <span className="font-bold text-foreground font-mono">
                    {formatPaise(activeExpense.taxAmountPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Amount</span>
                  <span className="font-bold text-solar-600 text-sm font-mono">
                    {formatPaise(activeExpense.totalAmountPaise)}
                  </span>
                </div>
              </div>

              {activeExpense.paymentReference && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs space-y-1 text-blue-900 dark:text-blue-300">
                  <span className="font-bold block text-blue-950 dark:text-blue-200">Disbursement Metadata</span>
                  <div>Mode: {activeExpense.paymentMode}</div>
                  <div>Reference / UTR: <span className="font-mono font-bold">{activeExpense.paymentReference}</span></div>
                  <div>Paid to Date: {formatPaise(activeExpense.paidAmountPaise)}</div>
                </div>
              )}

              {activeExpense.evidenceKey && (
                <div className="p-2.5 border rounded-xl text-xs flex items-center justify-between">
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
                <div className="border-t pt-2.5 space-y-1.5">
                  <span className="text-xs font-bold text-foreground block">Audit Trail</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto text-xs">
                    {activeExpense.statusHistory.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-muted/30 rounded-lg flex justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {h.fromStatus} → {h.toStatus}
                          </span>
                          {h.notes && (
                            <span className="text-muted-foreground ml-1">({h.notes})</span>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {new Date(h.changedAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer"
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
