import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Building2,
  Boxes,
  ShieldCheck,
  Send,
  Ban,
  PackageCheck
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface PurchaseOrderDetail {
  _id: string;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: string;
  isInterState: boolean;
  subtotalPaise: number;
  totalDiscountPaise: number;
  totalTaxPaise: number;
  totalAmountPaise: number;
  revision: number;
  notes?: string;
  termsAndConditions?: string;
  vendorId?: {
    _id: string;
    name: string;
    vendorCode: string;
    phone?: string;
    email?: string;
    gstin?: string;
  };
  destinationWarehouseId?: {
    _id: string;
    name: string;
    code: string;
    city?: string;
  };
  approval?: {
    requiresApproval: boolean;
    approvalThresholdPaise: number;
    approvedBy?: {
      firstName: string;
      lastName: string;
    };
    approvedAt?: string;
    rejectionReason?: string;
  };
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  lineItems: Array<{
    productId: string;
    sku: string;
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    rejectedQuantity: number;
    outstandingQuantity: number;
    unitPurchaseRatePaise: number;
    gstRate: number;
    totalTaxPaise: number;
    totalAmountPaise: number;
    uom: string;
  }>;
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals State
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // GRN Form State
  const [grnLineItems, setGrnLineItems] = useState<
    Array<{
      productId: string;
      sku: string;
      deliveredQuantity: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      rejectionReason: string;
      serialNumbersText: string;
    }>
  >([]);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const fetchPODetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<any>(`/purchase-orders/${id}`);
      const data = res?.data ?? res;
      setPo(data);

      // Pre-fill GRN line items with outstanding quantities
      if (data && data.lineItems) {
        setGrnLineItems(
          data.lineItems.map((l: any) => ({
            productId: l.productId,
            sku: l.sku,
            deliveredQuantity: l.outstandingQuantity,
            acceptedQuantity: l.outstandingQuantity,
            rejectedQuantity: 0,
            rejectionReason: '',
            serialNumbersText: ''
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPODetails();
  }, [id]);

  const handleSubmitForApproval = async () => {
    try {
      setActionLoading(true);
      await apiClient(`/purchase-orders/${id}/submit`, { method: 'POST' });
      await fetchPODetails();
    } catch (err: any) {
      alert(err.message || 'Failed to submit PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePO = async () => {
    try {
      setActionLoading(true);
      await apiClient(`/purchase-orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Approved by authorized officer' })
      });
      await fetchPODetails();
    } catch (err: any) {
      alert(err.message || 'Failed to approve PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient(`/purchase-orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason })
      });
      setIsRejectModalOpen(false);
      setRejectionReason('');
      await fetchPODetails();
    } catch (err: any) {
      alert(err.message || 'Failed to reject PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await apiClient(`/purchase-orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });
      setIsCancelModalOpen(false);
      setCancelReason('');
      await fetchPODetails();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        purchaseOrderId: id,
        deliveryChallanNumber: deliveryChallanNumber || undefined,
        vehicleNumber: vehicleNumber || undefined,
        lineItems: grnLineItems.map(item => ({
          productId: item.productId,
          deliveredQuantity: Number(item.deliveredQuantity),
          acceptedQuantity: Number(item.acceptedQuantity),
          rejectedQuantity: Number(item.rejectedQuantity),
          rejectionReason: item.rejectionReason || undefined,
          serialNumbers: item.serialNumbersText
            ? item.serialNumbersText
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            : undefined
        }))
      };

      await apiClient('/goods-receipts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsGrnModalOpen(false);
      await fetchPODetails();
      alert('Goods Receipt Note (GRN) created successfully! Warehouse stock updated.');
    } catch (err: any) {
      alert(err.message || 'Failed to create Goods Receipt Note');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading purchase order details...
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive space-y-4">
        <p className="font-semibold">{error || 'Purchase Order not found.'}</p>
        <Link to="/purchase-orders" className="text-sm underline">
          ← Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const isEligibleForReceipt = po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED';
  const hasReceivedAny = (po.lineItems || []).some(l => l.receivedQuantity > 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            to="/purchase-orders"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {po.poNumber}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground">
              Rev. {po.revision}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created on {new Date(po.orderDate).toLocaleDateString('en-IN')} by{' '}
            {po.createdBy?.firstName} {po.createdBy?.lastName}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {po.status === 'DRAFT' && (
            <button
              onClick={handleSubmitForApproval}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </button>
          )}

          {po.status === 'PENDING_APPROVAL' && (
            <>
              <button
                onClick={handleApprovePO}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve PO
              </button>
              <button
                onClick={() => setIsRejectModalOpen(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-destructive text-destructive font-medium text-xs hover:bg-destructive/10 transition"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}

          {isEligibleForReceipt && (
            <button
              onClick={() => setIsGrnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition"
            >
              <PackageCheck className="w-4 h-4" />
              Receive Goods (GRN)
            </button>
          )}

          {!hasReceivedAny &&
            (po.status === 'DRAFT' ||
              po.status === 'PENDING_APPROVAL' ||
              po.status === 'APPROVED') && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-medium transition"
              >
                <Ban className="w-4 h-4" />
                Cancel Order
              </button>
            )}
        </div>
      </div>

      {/* Info Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Vendor Box */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            Vendor Details
          </div>
          <div className="font-semibold text-foreground text-sm">{po.vendorId?.name || '—'}</div>
          <div className="text-xs font-mono text-muted-foreground">{po.vendorId?.vendorCode}</div>
          {po.vendorId?.gstin && (
            <div className="text-xs font-mono text-foreground">GSTIN: {po.vendorId.gstin}</div>
          )}
        </div>

        {/* Destination Warehouse */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Boxes className="w-4 h-4 text-primary" />
            Receiving Depot
          </div>
          <div className="font-semibold text-foreground text-sm">
            {po.destinationWarehouseId?.name || '—'}
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {po.destinationWarehouseId?.code}
          </div>
          <div className="text-xs text-foreground">
            Location: {po.destinationWarehouseId?.city || 'India'}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Commercial Total
          </div>
          <div className="text-2xl font-bold text-foreground">
            ₹{(po.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>Taxable: ₹{(po.subtotalPaise / 100).toFixed(2)}</span>
            <span>
              Tax ({po.isInterState ? 'IGST' : 'CGST+SGST'}): ₹{(po.totalTaxPaise / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border font-semibold text-sm text-foreground flex justify-between items-center">
          <span>Ordered Hardware Specifications</span>
          <span className="text-xs text-muted-foreground">Status: {po.status}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">SKU / Item</th>
                <th className="py-3 px-4 text-center">Ordered</th>
                <th className="py-3 px-4 text-center">Received</th>
                <th className="py-3 px-4 text-center">Rejected</th>
                <th className="py-3 px-4 text-center">Outstanding</th>
                <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {po.lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-foreground">{item.productName}</div>
                    <div className="text-xs font-mono text-muted-foreground">{item.sku}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-medium">
                    {item.orderedQuantity} {item.uom}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-medium">
                    {item.receivedQuantity}
                  </td>
                  <td className="py-3 px-4 text-center text-red-500 font-medium">
                    {item.rejectedQuantity}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-foreground">
                    {item.outstandingQuantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    ₹{(item.unitPurchaseRatePaise / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                    ₹{(item.totalAmountPaise / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receipt (GRN) Modal */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-card rounded-xl border border-border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-primary" />
                Goods Receipt Note (GRN) Entry
              </h2>
              <button
                onClick={() => setIsGrnModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Delivery Challan / Bill of Lading
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DC-99812"
                    value={deliveryChallanNumber}
                    onChange={e => setDeliveryChallanNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Transport Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-01-AB-1234"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Received Quantities & Quality Inspection
                </h3>

                {grnLineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2"
                  >
                    <div className="font-medium text-foreground text-xs">{item.sku}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-0.5">
                          Delivered Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.deliveredQuantity}
                          onChange={e => {
                            const updated = [...grnLineItems];
                            const target = updated[idx];
                            if (!target) return;
                            const val = Number(e.target.value);
                            target.deliveredQuantity = val;
                            target.acceptedQuantity = val - target.rejectedQuantity;
                            setGrnLineItems(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-0.5">
                          Accepted Qty (Stock In)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.acceptedQuantity}
                          onChange={e => {
                            const updated = [...grnLineItems];
                            const target = updated[idx];
                            if (!target) return;
                            target.acceptedQuantity = Number(e.target.value);
                            setGrnLineItems(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs text-emerald-600 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-0.5">
                          Rejected Qty (Damaged)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.rejectedQuantity}
                          onChange={e => {
                            const updated = [...grnLineItems];
                            const target = updated[idx];
                            if (!target) return;
                            target.rejectedQuantity = Number(e.target.value);
                            target.acceptedQuantity =
                              target.deliveredQuantity - Number(e.target.value);
                            setGrnLineItems(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs text-red-500 font-semibold"
                        />
                      </div>
                    </div>

                    {item.rejectedQuantity > 0 && (
                      <div>
                        <input
                          type="text"
                          placeholder="Reason for rejection (e.g. Casing crack, dent, testing fail)..."
                          value={item.rejectionReason}
                          onChange={e => {
                            const updated = [...grnLineItems];
                            const target = updated[idx];
                            if (!target) return;
                            target.rejectionReason = e.target.value;
                            setGrnLineItems(updated);
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-destructive/40 bg-background text-xs text-destructive"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">
                        Serial Numbers (Comma-separated barcodes for solar panels/inverters)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SN-001, SN-002, SN-003"
                        value={item.serialNumbersText}
                        onChange={e => {
                          const updated = [...grnLineItems];
                          const target = updated[idx];
                          if (!target) return;
                          target.serialNumbersText = e.target.value;
                          setGrnLineItems(updated);
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-input bg-background text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Confirm Goods Receipt & Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Reject Purchase Order</h2>
            <form onSubmit={handleRejectPO} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State technical or financial reason for rejection..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition"
                >
                  Reject Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Cancel Purchase Order</h2>
            <form onSubmit={handleCancelPO} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for cancelling order..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
