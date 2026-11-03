import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertTriangle,
  User,
  Download,
  Send,
  History,
  Info,
  ShoppingCart,
  Sun,
  Zap,
  TrendingUp,
  Landmark
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { QuotationStatus, SolarTopology, QuotationItemType } from '@ins-solar/shared';

interface LineItem {
  _id?: string;
  itemType: QuotationItemType;
  description: string;
  quantity: number;
  unit: string;
  unitRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  taxPaise?: number;
  itemTotalPaise?: number;
  totalAmountPaise?: number;
}

interface TaxComponent {
  componentName: string;
  rateBasisPoints: number;
  taxAmountPaise: number;
}

interface QuotationDetail {
  _id?: string;
  id?: string;
  quotationNumber: string;
  revisionNumber: number;
  fullQuotationCode: string;
  parentQuotationId?: string;
  isLatestRevision: boolean;
  status: QuotationStatus;
  systemTopology: SolarTopology;
  systemCapacityKwp: number;
  customerId: any;
  leadId?: any;
  solarDesignId?: any;
  lineItems: LineItem[];
  subtotalPaise?: number;
  grossSubtotalPaise?: number;
  additionalDiscountPaise: number;
  totalDiscountPaise: number;
  discountPercent: number;
  requiresDiscountApproval: boolean;
  discountApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
  discountApprovedBy?: {
    firstName?: string;
    lastName?: string;
  };
  discountApprovedAt?: string;
  discountRemarks?: string;
  discountRejectionReason?: string;
  taxableAmountPaise: number;
  totalTaxPaise?: number;
  totalTaxAmountPaise?: number;
  cgstAmountPaise?: number;
  sgstAmountPaise?: number;
  igstAmountPaise?: number;
  taxComponents?: TaxComponent[];
  netTotalPaise: number;
  taxProfile: {
    profileName: string;
    profileCode: string;
    effectiveDate: string;
    isInterState: boolean;
    accountingNotice: string;
  };
  paymentMilestones?: {
    name?: string;
    milestoneName?: string;
    percentage: number;
    description?: string;
    dueTrigger?: string;
  }[];
  termsAndConditions?: string[];
  validUntil: string;
  isAccepted: boolean;
  acceptedAt?: string;
  decisionIpAddress?: string;
  customerNotes?: string;
  rejectionReason?: string;
  createdBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const QuotationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Approval Form State
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);
  const [sending, setSending] = useState(false);

  // Revision Modal State
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState(
    'Client requested revised inverter specifications'
  );
  const [revising, setRevising] = useState(false);

  // Document Preview Modal State
  const [showDocPreview, setShowDocPreview] = useState(false);

  // Customer Simulation State
  const [submittingCustomerAction, setSubmittingCustomerAction] = useState(false);

  // Sales Order Handover State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingOrder, setConvertingOrder] = useState(false);
  const [existingOrder, setExistingOrder] = useState<any | null>(null);

  // Robust quotation ID resolver (supports both _id and id safely)
  const quotationId = (quotation as any)?._id || (quotation as any)?.id || id || '';

  // Check if an order already exists for this quotation revision
  useEffect(() => {
    if (quotation && quotation.status === QuotationStatus.ACCEPTED) {
      const qId = (quotation as any)?._id || (quotation as any)?.id || id;
      if (!qId) return;
      apiClient<any>(`/orders?limit=100`)
        .then(res => {
          const list = res?.items || res?.data || (Array.isArray(res) ? res : []);
          const match = list.find(
            (o: any) =>
              o.quotationRevisionId?._id === qId ||
              o.quotationRevisionId?.id === qId ||
              o.quotationRevisionId === qId ||
              o.quotationId?._id === qId ||
              o.quotationId?.id === qId ||
              o.quotationId === qId
          );
          if (match) setExistingOrder(match);
        })
        .catch(() => {});
    }
  }, [quotation, id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotation) return;
    setConvertingOrder(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const qId = (quotation as any)?._id || (quotation as any)?.id || id;
      const parentId = (quotation as any).parentQuotationId || qId;
      const newOrder = await apiClient<any>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          quotationId: parentId,
          quotationRevisionId: qId,
          notes: `Sales Order generated from accepted proposal ${quotation.fullQuotationCode}`
        })
      });
      setShowConvertModal(false);
      setActionMessage(`Sales Order generated successfully: ${newOrder.orderNumber}`);
      navigate(`/orders/${newOrder._id || newOrder.id}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate sales order.');
    } finally {
      setConvertingOrder(false);
    }
  };

  const fetchQuotation = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<QuotationDetail>(`/quotations/${id}`);
      setQuotation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quotation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const handleApproveDiscount = async () => {
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setProcessingApproval(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${qId}/approve-discount`, {
        method: 'POST',
        body: JSON.stringify({
          isApproved: true,
          remarks: approvalRemarks.trim() || 'Commercial discount approved by management.'
        })
      });
      setActionMessage('Commercial discount approved successfully.');
      fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve discount.');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleRejectDiscount = async () => {
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setProcessingApproval(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${qId}/reject-discount`, {
        method: 'POST',
        body: JSON.stringify({
          isApproved: false,
          rejectionReason:
            approvalRemarks.trim() || 'Discount exceeds permissible commercial margins.'
        })
      });
      setActionMessage(
        'Commercial discount rejected. Quotation reverted to draft for pricing adjustment.'
      );
      fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject discount.');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleMarkAsSent = async () => {
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setSending(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${qId}/send`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setActionMessage('Quotation marked as sent and issued to customer.');
      await fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark quotation as sent.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setRevising(true);
    setActionError(null);

    try {
      const reasonText = revisionNotes.trim() || 'Client requested revised specifications';
      const newRev = await apiClient(`/quotations/${qId}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          reasonForRevision: reasonText,
          revisionNotes: reasonText
        })
      });

      setShowRevisionModal(false);
      setActionMessage(`Revision created successfully: ${newRev.fullQuotationCode}`);
      navigate(`/quotations/${newRev._id || newRev.id}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create new revision.');
    } finally {
      setRevising(false);
    }
  };

  const handleCustomerAccept = async () => {
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setSubmittingCustomerAction(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${qId}/customer-decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'ACCEPT',
          notes: 'Proposal formally accepted and signed via workstation.'
        })
      });
      setActionMessage('Quotation accepted successfully.');
      fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Customer acceptance failed.');
    } finally {
      setSubmittingCustomerAction(false);
    }
  };

  const handleCustomerReject = async () => {
    const qId = (quotation as any)?._id || (quotation as any)?.id || id;
    if (!qId) return;
    setSubmittingCustomerAction(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${qId}/customer-decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'REJECT',
          rejectionReason: 'Declined by customer upon commercial review.'
        })
      });
      setActionMessage('Quotation declined by customer.');
      fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Customer rejection failed.');
    } finally {
      setSubmittingCustomerAction(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Loading quotation proposal...
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="space-y-4">
        <Link
          to="/quotations"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Quotations
        </Link>
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error || 'Quotation not found.'}
        </div>
      </div>
    );
  }

  const grossPaise = quotation.grossSubtotalPaise ?? quotation.subtotalPaise ?? 0;
  const grossRs = (grossPaise / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
  const discountRs = (
    (quotation.totalDiscountPaise ?? quotation.additionalDiscountPaise ?? 0) / 100
  ).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
  const taxableRs = ((quotation.taxableAmountPaise ?? 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
  const totalTax = quotation.totalTaxPaise ?? quotation.totalTaxAmountPaise ?? 0;
  const taxRs = (totalTax / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
  const netRs = ((quotation.netTotalPaise ?? 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });

  // Solar Domain ROI & Yield Calculations
  const capacityKwp = quotation.systemCapacityKwp || 5.0;
  const estimatedMonthlyUnits = Math.round(capacityKwp * 120);
  const estimatedAnnualUnits = estimatedMonthlyUnits * 12;
  const estimatedMonthlySavings = Math.round(estimatedMonthlyUnits * 7.5);
  const estimatedAnnualSavings = estimatedMonthlySavings * 12;
  const centralSubsidyEstimated =
    quotation.systemTopology === SolarTopology.ON_GRID ||
    quotation.systemTopology === SolarTopology.HYBRID
      ? capacityKwp <= 2
        ? capacityKwp * 30000
        : 78000
      : 0;
  const netTotalPaiseVal = quotation.netTotalPaise || 0;
  const effectiveCostRs = Math.max(
    0,
    netTotalPaiseVal / 100 - centralSubsidyEstimated
  ).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const taxComponentsList: TaxComponent[] =
    quotation.taxComponents && quotation.taxComponents.length > 0
      ? quotation.taxComponents
      : [
          ...((quotation.cgstAmountPaise || 0) > 0
            ? [
                {
                  componentName: 'CGST (Central GST)',
                  rateBasisPoints: quotation.taxProfile?.isInterState ? 0 : 900,
                  taxAmountPaise: quotation.cgstAmountPaise || 0
                }
              ]
            : []),
          ...((quotation.sgstAmountPaise || 0) > 0
            ? [
                {
                  componentName: 'SGST (State GST)',
                  rateBasisPoints: quotation.taxProfile?.isInterState ? 0 : 900,
                  taxAmountPaise: quotation.sgstAmountPaise || 0
                }
              ]
            : []),
          ...((quotation.igstAmountPaise || 0) > 0
            ? [
                {
                  componentName: 'IGST (Integrated GST)',
                  rateBasisPoints: 1800,
                  taxAmountPaise: quotation.igstAmountPaise || 0
                }
              ]
            : [])
        ];

  if (taxComponentsList.length === 0 && totalTax > 0) {
    taxComponentsList.push({
      componentName: 'GST (Total Tax)',
      rateBasisPoints: 1800,
      taxAmountPaise: totalTax
    });
  }

  const customerName =
    typeof quotation.customerId === 'object'
      ? (quotation.customerId as any)?.legalName ||
        (quotation.customerId as any)?.name ||
        (quotation.customerId as any)?.companyName ||
        'Direct Customer'
      : 'Direct Customer';

  const customerPhone =
    typeof quotation.customerId === 'object'
      ? (quotation.customerId as any)?.primaryPhone || ''
      : '';

  const customerEmail =
    typeof quotation.customerId === 'object'
      ? (quotation.customerId as any)?.email || ''
      : '';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* 1. Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <Link
            to="/quotations"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Quotations Directory
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
              {quotation.fullQuotationCode}
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground border border-border">
              R{quotation.revisionNumber}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                quotation.status === QuotationStatus.ACCEPTED
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : quotation.status === QuotationStatus.SENT
                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                    : quotation.status === QuotationStatus.REJECTED
                      ? 'bg-destructive/10 text-destructive border border-destructive/30'
                      : 'bg-solar-500/10 text-solar-700 dark:text-solar-300 border border-solar-500/30'
              }`}
            >
              {quotation.status === QuotationStatus.ACCEPTED
                ? 'Accepted'
                : quotation.status === QuotationStatus.SENT
                  ? 'Sent to Client'
                  : quotation.status === QuotationStatus.REJECTED
                    ? 'Declined'
                    : 'Draft'}
            </span>
          </div>
        </div>

        {/* Quick Header Buttons */}
        <div className="flex items-center gap-2">
          {quotation.status === QuotationStatus.ACCEPTED &&
            (existingOrder ? (
              <Link
                to={`/orders/${existingOrder._id || existingOrder.id}`}
                className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                <span>View Sales Order ({existingOrder.orderNumber}) →</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowConvertModal(true)}
                disabled={convertingOrder}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                <span>Generate Confirmed Sales Order →</span>
              </button>
            ))}

          {(quotation.status === QuotationStatus.DRAFT ||
            quotation.status === QuotationStatus.APPROVED) && (
            <>
              <button
                type="button"
                onClick={handleMarkAsSent}
                disabled={sending}
                className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>{sending ? 'Issuing...' : 'Mark as Sent'}</span>
              </button>
              <button
                type="button"
                onClick={handleCustomerAccept}
                disabled={submittingCustomerAction}
                className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Accept Proposal ✓</span>
              </button>
            </>
          )}

          {quotation.status === QuotationStatus.SENT && (
            <>
              <button
                type="button"
                onClick={handleCustomerAccept}
                disabled={submittingCustomerAction}
                className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Client Accepted ✓</span>
              </button>
              <button
                type="button"
                onClick={handleCustomerReject}
                disabled={submittingCustomerAction}
                className="inline-flex items-center px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>Decline</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                disabled={revising}
                className="inline-flex items-center px-3 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                <span>Revise (R{quotation.revisionNumber + 1})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowDocPreview(true)}
            className="inline-flex items-center px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>View Proposal PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek 1-Line Lifecycle Progress Stepper */}
      <div className="bg-card border border-border/80 rounded-xl px-4 py-2.5 shadow-xs">
        <div className="flex items-center justify-between gap-1 text-xs">
          {[
            {
              step: 1,
              label: 'Draft Proposal',
              done: true,
              active: quotation.status === QuotationStatus.DRAFT
            },
            {
              step: 2,
              label: 'Sent to Client',
              done: [QuotationStatus.SENT, QuotationStatus.ACCEPTED].includes(quotation.status),
              active: quotation.status === QuotationStatus.SENT
            },
            {
              step: 3,
              label: 'Client Accepted',
              done: quotation.status === QuotationStatus.ACCEPTED,
              active: quotation.status === QuotationStatus.ACCEPTED && !existingOrder
            },
            {
              step: 4,
              label: 'Sales Order & EPC',
              done: !!existingOrder,
              active: !!existingOrder
            }
          ].map((s, idx, arr) => (
            <React.Fragment key={s.step}>
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                  s.active
                    ? 'bg-solar-500/10 text-solar-900 dark:text-solar-200 font-bold'
                    : s.done
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s.done
                      ? 'bg-emerald-500 text-white'
                      : s.active
                        ? 'bg-solar-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.done ? '✓' : s.step}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${s.done ? 'bg-emerald-500/60' : 'bg-border'}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Action Banners */}
      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {quotation.status === QuotationStatus.REJECTED && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Proposal Declined:</strong> {quotation.rejectionReason || 'Customer requested revision.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRevisionModal(true)}
            disabled={revising}
            className="px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            Create Revision (R{quotation.revisionNumber + 1})
          </button>
        </div>
      )}

      {/* Main Grid: Details & Commercial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Customer, BOM, Milestones */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer & Technical Summary Card */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/70 pb-2.5">
              <User className="w-3.5 h-3.5 text-solar-500" />
              Customer & System Specifications
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Customer</span>
                <span className="font-semibold text-foreground text-xs line-clamp-1">
                  {customerName}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  {typeof quotation.customerId === 'object'
                    ? (quotation.customerId as any)?.customerCode || '—'
                    : '—'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Contact</span>
                <span className="font-medium text-foreground block truncate">
                  {customerPhone || '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {customerEmail || '—'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Topology & Capacity</span>
                <span className="font-bold text-foreground text-xs">
                  {quotation.systemCapacityKwp} kWp
                </span>
                <span className="text-[10px] text-solar-600 dark:text-solar-400 font-medium block">
                  {quotation.systemTopology}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Proposal Validity</span>
                <span className="font-semibold text-foreground text-xs block">
                  {new Date(quotation.validUntil).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  30 Days Commercial Validity
                </span>
              </div>
            </div>
          </div>

          {/* Bill of Materials (Line items) */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 text-solar-500" />
                Bill of Materials & Work Scope
              </h2>
              <span className="text-[11px] text-muted-foreground font-medium">
                {(quotation.lineItems || []).length} line item(s)
              </span>
            </div>

            {/* Mobile BOM Cards (< md) */}
            <div className="block md:hidden divide-y divide-border">
              {(quotation.lineItems || []).map((item, idx) => {
                const rate = ((item.unitRatePaise || 0) / 100).toLocaleString('en-IN');
                const taxable = ((item.taxableAmountPaise || 0) / 100).toLocaleString('en-IN');
                const itemTotal =
                  item.itemTotalPaise ??
                  (item as any).totalAmountPaise ??
                  item.taxableAmountPaise ??
                  0;
                const total = (itemTotal / 100).toLocaleString('en-IN');
                const gstPercent = ((item.gstRateBasisPoints || 0) / 100).toFixed(0);

                return (
                  <div key={idx} className="py-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary text-secondary-foreground uppercase">
                          {item.itemType}
                        </span>
                        <h4 className="font-semibold text-xs text-foreground mt-0.5">
                          {item.description}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-foreground">
                          ₹{total}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          GST {gstPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/30 px-2 py-1 rounded">
                      <span>Qty: {item.quantity} {item.unit}</span>
                      <span>Rate: ₹{rate}</span>
                      <span>Taxable: ₹{taxable}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop BOM Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium text-center">Qty</th>
                    <th className="py-2 font-medium text-right">Unit Rate (₹)</th>
                    <th className="py-2 font-medium text-right">GST %</th>
                    <th className="py-2 font-medium text-right">Taxable (₹)</th>
                    <th className="py-2 font-medium text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(quotation.lineItems || []).map((item, idx) => {
                    const rate = ((item.unitRatePaise || 0) / 100).toLocaleString('en-IN');
                    const taxable = ((item.taxableAmountPaise || 0) / 100).toLocaleString('en-IN');
                    const itemTotal =
                      item.itemTotalPaise ??
                      (item as any).totalAmountPaise ??
                      item.taxableAmountPaise ??
                      0;
                    const total = (itemTotal / 100).toLocaleString('en-IN');
                    const gstPercent = ((item.gstRateBasisPoints || 0) / 100).toFixed(0);

                    return (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium">
                            {item.itemType}
                          </span>
                        </td>
                        <td className="py-2 font-medium text-foreground">{item.description}</td>
                        <td className="py-2 text-center text-muted-foreground">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 text-right font-mono text-muted-foreground">
                          ₹{rate}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">{gstPercent}%</td>
                        <td className="py-2 text-right font-mono text-muted-foreground">
                          ₹{taxable}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold text-foreground">
                          ₹{total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Milestones & Commercial Conditions */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/70 pb-2">
              <Calendar className="w-3.5 h-3.5 text-solar-500" />
              Payment Milestones & Terms
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(quotation.paymentMilestones || []).map((m: any, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-secondary/30 rounded-lg border border-border text-xs"
                >
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>{m.name || m.milestoneName || `Milestone ${idx + 1}`}</span>
                    <span className="text-solar-600 dark:text-solar-400 font-bold">{m.percentage}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {m.description || m.dueTrigger || '—'}
                  </p>
                </div>
              ))}
            </div>

            {(quotation.termsAndConditions || []).length > 0 && (
              <div className="pt-1.5 text-[11px] space-y-1 text-muted-foreground">
                <span className="font-semibold text-foreground text-xs block">Commercial Terms:</span>
                {(quotation.termsAndConditions || []).map((term, i) => (
                  <div key={i}>• {term}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Pricing Summary + Performance Yield */}
        <div className="lg:col-span-5 space-y-4">
          {/* Managerial Discount Approval (ONLY when pending) */}
          {quotation.requiresDiscountApproval && quotation.discountApprovalStatus === 'PENDING' && (
            <div className="bg-card border border-amber-500/30 rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Manager Approval Required ({quotation.discountPercent.toFixed(1)}% Discount)
                </div>
              </div>
              <input
                type="text"
                placeholder="Managerial remarks / margin justification..."
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApproveDiscount}
                  disabled={processingApproval}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-xs cursor-pointer"
                >
                  Approve Discount
                </button>
                <button
                  type="button"
                  onClick={handleRejectDiscount}
                  disabled={processingApproval}
                  className="flex-1 py-1.5 bg-destructive hover:bg-destructive/90 text-white rounded font-medium text-xs shadow-xs cursor-pointer"
                >
                  Reject Discount
                </button>
              </div>
            </div>
          )}

          {/* Commercial Pricing & Tax Summary Card */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/70 pb-2 flex items-center justify-between">
              <span>Commercial Pricing & Tax Summary</span>
              <span className="text-[10px] font-mono text-muted-foreground font-normal">
                INR (₹)
              </span>
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Subtotal</span>
                <span className="font-mono font-medium text-foreground">₹{grossRs}</span>
              </div>

              {quotation.additionalDiscountPaise > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Additional Discount ({quotation.discountPercent.toFixed(1)}%)</span>
                  <span className="font-mono font-medium">- ₹{discountRs}</span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border">
                <span className="font-medium text-foreground">Taxable Value</span>
                <span className="font-mono font-semibold text-foreground">₹{taxableRs}</span>
              </div>

              {/* Tax components */}
              <div className="bg-secondary/30 p-2.5 rounded-lg space-y-1 border border-border">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                  GST Breakdown:
                </div>
                {taxComponentsList.map((c, i) => {
                  const compRs = (c.taxAmountPaise / 100).toLocaleString('en-IN');
                  return (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span>
                        {c.componentName} ({(c.rateBasisPoints / 100).toFixed(1)}%)
                      </span>
                      <span className="font-mono text-foreground">₹{compRs}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-[11px] pt-1 border-t border-border font-semibold">
                  <span>Total Tax</span>
                  <span className="font-mono">₹{taxRs}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-foreground pt-1.5 border-t border-border">
                <span>Net Payable Total</span>
                <span className="font-mono text-base font-black text-solar-600 dark:text-solar-400">
                  ₹{netRs}
                </span>
              </div>

              {/* PM Surya Ghar DBT Subsidy Pill (Cleanly embedded in Pricing) */}
              {centralSubsidyEstimated > 0 && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                      PM Surya Ghar DBT Subsidy
                    </span>
                    <span className="font-mono font-bold">
                      - ₹{centralSubsidyEstimated.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20 text-xs font-bold text-foreground">
                    <span>Effective Net Investment:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300 font-black">
                      ₹{effectiveCostRs}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CA / Tax Policy Notice */}
            <div className="p-2 bg-muted/30 rounded text-[10px] text-muted-foreground border border-border flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{quotation.taxProfile?.accountingNotice || 'Standard commercial quotation terms apply.'}</span>
            </div>
          </div>

          {/* Solar Generation Yield & ROI (Compact 2-grid) */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-2.5">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/70 pb-2">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Solar Yield & ROI</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {capacityKwp} kWp
              </span>
            </h2>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-secondary/30 rounded-lg border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Est. Monthly Yield</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  ~{estimatedMonthlyUnits.toLocaleString('en-IN')} kWh
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  ~{estimatedAnnualUnits.toLocaleString('en-IN')} u/yr
                </div>
              </div>

              <div className="p-2.5 bg-secondary/30 rounded-lg border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span>Est. Bill Savings</span>
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{estimatedMonthlySavings.toLocaleString('en-IN')}/mo
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  ₹{estimatedAnnualSavings.toLocaleString('en-IN')}/yr
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revise Quotation Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-solar-500" />
              Create Quotation Revision (R{quotation.revisionNumber + 1})
            </h3>
            <p className="text-xs text-muted-foreground">
              Creates an immutable successor revision without overwriting historical version{' '}
              {quotation.fullQuotationCode}.
            </p>

            <form onSubmit={handleCreateRevision} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Revision Reason & Engineering Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={revisionNotes}
                  onChange={e => setRevisionNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  className="px-4 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-medium rounded-md shadow"
                >
                  {revising ? 'Generating Revision...' : 'Confirm Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Confirmed Sales Order Modal */}
      {showConvertModal && quotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2.5 border-b pb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Generate Confirmed Sales Order
                </h3>
                <p className="text-xs text-muted-foreground">
                  Convert accepted quotation into a binding commercial contract and reservation
                  docket.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 bg-secondary/30 p-3 rounded-lg border text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proposal Code:</span>
                <span className="font-mono font-bold text-foreground">
                  {quotation.fullQuotationCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-bold text-foreground">
                  {quotation.customerId?.legalName ||
                    (quotation.customerId as any)?.name ||
                    (quotation.customerId as any)?.companyName ||
                    'Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Commercial Total:</span>
                <span className="font-mono font-bold text-solar-600 dark:text-solar-400">
                  ₹{netRs}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Line Items BOM:</span>
                <span className="font-semibold">{quotation.lineItems?.length || 0} Products</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Milestones:</span>
                <span className="font-semibold">
                  {quotation.paymentMilestones?.length || 0} Stages
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                Sales Order generation will lock this commercial pricing and enable warehouse
                hardware reservation and 10-stage EPC project execution.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={convertingOrder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {convertingOrder ? 'Creating Sales Order...' : 'Confirm & Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Document Preview Modal */}
      {showDocPreview && quotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between bg-muted/40 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="w-4 h-4 text-solar-500 shrink-0" />
                <h3 className="text-sm font-bold text-foreground truncate">
                  Proposal — {quotation.fullQuotationCode}
                </h3>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <a
                  href={`/api/v1/quotations/${quotationId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs bg-solar-600 text-white rounded hover:bg-solar-700 font-medium inline-flex items-center gap-1 shadow-sm"
                >
                  <Download className="w-3 h-3" />
                  <span>Print / Open</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowDocPreview(false)}
                  className="px-2.5 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 p-2 overflow-hidden">
              <iframe
                src={`/api/v1/quotations/${quotationId}/pdf`}
                className="w-full h-full border border-border rounded bg-white shadow-sm"
                title="Proposal Document"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
