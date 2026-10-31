import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertTriangle,
  User,
  Download,
  Send,
  History,
  Info
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
  _id: string;
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

  // Revision Modal State
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState(
    'Client requested revised inverter specifications'
  );
  const [revising, setRevising] = useState(false);

  // Document Preview Modal State
  const [showDocPreview, setShowDocPreview] = useState(false);

  // Customer Simulation State
  const [customerDecisionNotes, setCustomerDecisionNotes] = useState('');
  const [submittingCustomerAction, setSubmittingCustomerAction] = useState(false);

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
    if (!quotation) return;
    setProcessingApproval(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${quotation._id}/approve-discount`, {
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
    if (!quotation) return;
    setProcessingApproval(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${quotation._id}/reject-discount`, {
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
    if (!quotation) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${quotation._id}/send`, {
        method: 'POST'
      });
      setActionMessage('Quotation marked as sent and issued to customer.');
      fetchQuotation();
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark quotation as sent.');
    }
  };

  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotation) return;
    setRevising(true);
    setActionError(null);

    try {
      const reasonText = revisionNotes.trim() || 'Client requested revised specifications';
      const newRev = await apiClient(`/quotations/${quotation._id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          reasonForRevision: reasonText,
          revisionNotes: reasonText
        })
      });

      setShowRevisionModal(false);
      setActionMessage(`Revision created successfully: ${newRev.fullQuotationCode}`);
      navigate(`/quotations/${newRev._id}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create new revision.');
    } finally {
      setRevising(false);
    }
  };

  const handleCustomerAccept = async () => {
    if (!quotation) return;
    setSubmittingCustomerAction(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${quotation._id}/customer-decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'ACCEPT',
          notes: customerDecisionNotes.trim() || 'Proposal formally accepted and signed via workstation.'
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
    if (!quotation) return;
    setSubmittingCustomerAction(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient(`/quotations/${quotation._id}/customer-decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'REJECT',
          rejectionReason:
            customerDecisionNotes.trim() || 'Declined by customer.'
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

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/quotations"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Quotations Directory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {quotation.fullQuotationCode}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-solar-50 text-solar-700 dark:bg-solar-950/60 dark:text-solar-300 border border-solar-200 dark:border-solar-800">
              Revision R{quotation.revisionNumber}
            </span>
            {quotation.isLatestRevision && (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
                Latest Active Revision
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download/View PDF Action */}
          <button
            type="button"
            onClick={() => setShowDocPreview(true)}
            className="inline-flex items-center px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            View Proposal Document
          </button>

          {/* Mark As Sent Action */}
          {(quotation.status === QuotationStatus.DRAFT ||
            quotation.status === QuotationStatus.APPROVED) && (
            <button
              type="button"
              onClick={handleMarkAsSent}
              className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Mark as Sent
            </button>
          )}

          {/* Create Revision Action */}
          <button
            type="button"
            onClick={() => setShowRevisionModal(true)}
            className="inline-flex items-center px-3 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            Revise Quotation (R{quotation.revisionNumber + 1})
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Grid: Details & Commercial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer, BOM, Milestones */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Technical Summary Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
              <User className="w-4 h-4 text-solar-500" />
              Customer & System Specifications
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Customer Name</span>
                <span className="font-medium text-foreground text-sm">
                  {typeof quotation.customerId === 'object'
                    ? (quotation.customerId as any)?.legalName ||
                      (quotation.customerId as any)?.name ||
                      (quotation.customerId as any)?.companyName ||
                      'Direct Customer'
                    : 'Direct Customer'}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono block">
                  {typeof quotation.customerId === 'object'
                    ? (quotation.customerId as any)?.customerCode || '—'
                    : '—'}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">Contact</span>
                <span className="font-medium text-foreground">
                  {typeof quotation.customerId === 'object'
                    ? (quotation.customerId as any)?.primaryPhone || '—'
                    : '—'}
                </span>
                <span className="text-muted-foreground block">
                  {typeof quotation.customerId === 'object'
                    ? (quotation.customerId as any)?.email || '—'
                    : '—'}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">System Topology & Size</span>
                <span className="font-bold text-foreground text-sm">
                  {quotation.systemCapacityKwp} kWp
                </span>
                <span className="text-solar-600 dark:text-solar-400 font-medium block">
                  {quotation.systemTopology}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">Validity Date</span>
                <span className="font-medium text-foreground">
                  {new Date(quotation.validUntil).toLocaleDateString()}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block">Commercial Status</span>
                <span className="font-semibold text-foreground">{quotation.status}</span>
              </div>

              {quotation.solarDesignId && (
                <div>
                  <span className="text-muted-foreground block">Linked Solar Design</span>
                  <span className="font-mono font-medium text-solar-600">
                    {quotation.solarDesignId.designNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bill of Materials (Line items) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-solar-500" />
                Bill of Materials & Work Scope
              </h2>
              <span className="text-xs text-muted-foreground">
                {(quotation.lineItems || []).length} line item(s)
              </span>
            </div>

            <div className="overflow-x-auto">
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
                      item.itemTotalPaise ?? (item as any).totalAmountPaise ?? item.taxableAmountPaise ?? 0;
                    const total = (itemTotal / 100).toLocaleString('en-IN');
                    const gstPercent = (((item.gstRateBasisPoints || 0) / 100)).toFixed(0);

                    return (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium">
                            {item.itemType}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-foreground">{item.description}</td>
                        <td className="py-2.5 text-center">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">
                          ₹{rate}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">{gstPercent}%</td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">
                          ₹{taxable}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-foreground">
                          ₹{total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Milestones & Terms */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
              <Calendar className="w-4 h-4 text-solar-500" />
              Payment Milestones & Commercial Conditions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(quotation.paymentMilestones || []).map((m: any, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-secondary/30 rounded-lg border border-border text-xs"
                >
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>{m.name || m.milestoneName || `Milestone ${idx + 1}`}</span>
                    <span className="text-solar-600 font-bold">{m.percentage}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {m.description || m.dueTrigger || '—'}
                  </p>
                </div>
              ))}
            </div>

            {(quotation.termsAndConditions || []).length > 0 && (
              <div className="pt-2 text-xs space-y-1 text-muted-foreground">
                <div className="font-semibold text-foreground">Commercial Terms:</div>
                {(quotation.termsAndConditions || []).map((term, i) => (
                  <div key={i}>• {term}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Financial Breakdown, Discount Approval & Customer Review */}
        <div className="space-y-6">
          {/* Financial Calculation Summary Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              Financial Breakdown (Integer Paise Engine)
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Subtotal</span>
                <span className="font-mono font-medium text-foreground">₹{grossRs}</span>
              </div>

              {quotation.additionalDiscountPaise > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Additional Discount ({quotation.discountPercent.toFixed(1)}%)</span>
                  <span className="font-mono font-medium">- ₹{discountRs}</span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border">
                <span className="font-medium text-foreground">Taxable Value</span>
                <span className="font-mono font-semibold text-foreground">₹{taxableRs}</span>
              </div>

              {/* Tax components */}
              <div className="bg-secondary/30 p-2.5 rounded-lg space-y-1.5 border border-border">
                <div className="text-[11px] font-semibold text-muted-foreground">
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

              <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                <span>Net Payable Total</span>
                <span className="font-mono text-solar-600 dark:text-solar-400">₹{netRs}</span>
              </div>
            </div>

            {/* CA / Tax Policy Notice */}
            <div className="p-2.5 bg-muted/40 rounded text-[11px] text-muted-foreground border border-border flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{quotation.taxProfile.accountingNotice}</span>
            </div>
          </div>

          {/* Discount Approval Workflow Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-solar-500" />
                <span>Commercial Discount Control</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Policy: &gt; 5% Approval
              </span>
            </h2>

            {quotation.requiresDiscountApproval ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-800 dark:text-amber-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Discount: {quotation.discountPercent.toFixed(1)}% (Exceeds 5.0% Limit)
                  </div>
                  <p className="text-[11px] mt-1">
                    Approval Status: <strong>{quotation.discountApprovalStatus}</strong>
                  </p>
                  {quotation.discountApprovedBy && (
                    <p className="text-[11px] mt-0.5">
                      Decided by: {quotation.discountApprovedBy.firstName}{' '}
                      {quotation.discountApprovedBy.lastName}
                    </p>
                  )}
                  {quotation.discountRemarks && (
                    <p className="text-[11px] mt-0.5 italic">
                      Remarks: {quotation.discountRemarks}
                    </p>
                  )}
                  {quotation.discountRejectionReason && (
                    <p className="text-[11px] mt-0.5 text-destructive">
                      Rejection Reason: {quotation.discountRejectionReason}
                    </p>
                  )}
                </div>

                {/* Manager Actions (if pending) */}
                {quotation.discountApprovalStatus === 'PENDING' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Managerial Decision Remarks / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="Rationale for margin concession..."
                        value={approvalRemarks}
                        onChange={e => setApprovalRemarks(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleApproveDiscount}
                        disabled={processingApproval}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-sm transition-colors"
                      >
                        Approve Discount
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectDiscount}
                        disabled={processingApproval}
                        className="flex-1 py-1.5 bg-destructive hover:bg-destructive/90 text-white rounded font-medium text-xs shadow-sm transition-colors"
                      >
                        Reject Discount
                      </button>
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      * Anti-Self-Approval rule enforced on server. Proposal creators cannot
                      authorize their own discounts.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-secondary/30 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  Discount is within standard commercial policy (≤ 5%). No escalation required.
                </span>
              </div>
            )}
          </div>

          {/* Customer Review & Acceptance Status Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
              <CheckCircle2 className="w-4 h-4 text-solar-500" />
              Customer Digital Acceptance
            </h2>

            {quotation.isAccepted ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Proposal Formally Accepted
                </div>
                <div>Accepted At: {new Date(quotation.acceptedAt!).toLocaleString()}</div>
                <div>
                  Digital Sign IP: {quotation.decisionIpAddress || 'Authenticated Portal Session'}
                </div>
                {quotation.customerNotes && <div>Notes: {quotation.customerNotes}</div>}
              </div>
            ) : quotation.status === QuotationStatus.REJECTED ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Declined by Customer
                </div>
                <div>Reason: {quotation.rejectionReason}</div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">
                  Record customer quotation decision or digital acceptance approval:
                </p>

                <input
                  type="text"
                  placeholder="Acceptance notes or customer remarks..."
                  value={customerDecisionNotes}
                  onChange={e => setCustomerDecisionNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCustomerAccept}
                    disabled={submittingCustomerAction}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-sm"
                  >
                    Accept Proposal
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomerReject}
                    disabled={submittingCustomerAction}
                    className="flex-1 py-1.5 bg-destructive hover:bg-destructive/90 text-white rounded font-medium text-xs shadow-sm"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revise Quotation Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
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

      {/* Proposal Document Preview Modal */}
      {showDocPreview && quotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-solar-500" />
                <h3 className="text-sm font-bold text-foreground">
                  Proposal Document — {quotation.fullQuotationCode}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/v1/quotations/${quotation._id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs bg-solar-600 text-white rounded hover:bg-solar-700 font-medium inline-flex items-center gap-1 shadow-sm"
                >
                  <Download className="w-3 h-3" />
                  Open in New Window / Print
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
                src={`/api/v1/quotations/${quotation._id}/pdf`}
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
