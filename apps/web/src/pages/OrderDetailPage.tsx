/**
 * INS Solar Business Management Software — Sales Order Detail
 *
 * Displays authoritative snapshot of agreed commercial scope, financial totals,
 * payment milestones, stock reservation management, and coordinated cancellation controls.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  PackageCheck,
  AlertTriangle,
  Layers,
  Warehouse as WarehouseIcon,
  Ban
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface OrderDetail {
  _id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  reservationStatus: string;
  systemTopology: string;
  systemCapacityKwp: number;
  customerId: {
    _id: string;
    legalName: string;
    customerCode?: string;
    primaryPhone?: string;
    email?: string;
  };
  quotationRevisionId?: {
    _id: string;
    fullQuotationCode: string;
  };
  solarDesignId?: {
    _id: string;
    designNumber: string;
  };
  lineItems: Array<{
    itemType: string;
    productId?: {
      _id: string;
      name: string;
      sku?: string;
    };
    description: string;
    quantity: number;
    unit: string;
    unitRatePaise: number;
    discountPaise: number;
    taxableAmountPaise: number;
    gstRateBasisPoints: number;
    taxPaise: number;
    itemTotalPaise: number;
  }>;
  grossSubtotalPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;
  taxProfile: {
    profileName: string;
    profileCode: string;
    accountingNotice?: string;
  };
  paymentMilestones: Array<{
    name: string;
    percentage: number;
    description: string;
  }>;
  termsAndConditions: string[];
  cancellationReason?: string;
  cancelledAt?: string;
  notes?: string;
  createdAt: string;
}

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reservation Modal state
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  // Cancellation Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient(`/orders/${id}`);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const openReserveModal = async () => {
    setShowReserveModal(true);
    setReserveError(null);
    try {
      const data = await apiClient('/warehouses?isActive=true');
      setWarehouses(data.items || []);
      if (data.items && data.items.length > 0) {
        setSelectedWarehouseId(data.items[0]._id);
      }
    } catch {
      setReserveError('Failed to load active warehouses.');
    }
  };

  const handleReserveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedWarehouseId) return;
    setReserving(true);
    setReserveError(null);
    try {
      await apiClient(`/orders/${order._id}/reserve-stock`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: selectedWarehouseId
        })
      });
      setShowReserveModal(false);
      setActionSuccess('Stock reserved successfully from target warehouse.');
      fetchOrderDetail();
    } catch (err: any) {
      setReserveError(err.message || 'Failed to reserve stock.');
    } finally {
      setReserving(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !cancelReason.trim()) {
      setCancelError('Please specify a cancellation reason.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await apiClient(`/orders/${order._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          cancellationReason: cancelReason.trim()
        })
      });
      setShowCancelModal(false);
      setActionSuccess('Order cancelled and reserved stock returned to available inventory.');
      fetchOrderDetail();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex items-center justify-center space-x-2">
        <div className="w-5 h-5 border-2 border-solar-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading order details...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link
          to="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
        </Link>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{error || 'Sales Order not found.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
        </Link>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {order.status !== 'CANCELLED' && order.reservationStatus !== 'FULLY_RESERVED' && (
            <button
              onClick={openReserveModal}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <PackageCheck className="w-4 h-4 mr-1.5" />
              Reserve Stock
            </button>
          )}

          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                setShowCancelModal(true);
                setCancelError(null);
              }}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
            >
              <Ban className="w-4 h-4 mr-1.5" />
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Order Header Card */}
      <div className="p-6 rounded-2xl border bg-card backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                {order.orderNumber}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {order.status}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {order.reservationStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center space-x-4">
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Booked:{' '}
                {new Date(order.orderDate || order.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              <span>•</span>
              <span>Capacity: {order.systemCapacityKwp} kWp</span>
              <span>•</span>
              <span>Topology: {order.systemTopology}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-medium">Net Agreed Total</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Customer & Quotation Context */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">Customer Profile</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {order.customerId.legalName}
            </p>
            {order.customerId.primaryPhone && (
              <p className="text-xs text-muted-foreground">{order.customerId.primaryPhone}</p>
            )}
            {order.customerId.email && (
              <p className="text-xs text-muted-foreground">{order.customerId.email}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">
              Originating Quotation
            </p>
            {order.quotationRevisionId ? (
              <p className="text-sm font-semibold text-solar-500 mt-0.5">
                {order.quotationRevisionId.fullQuotationCode}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">Direct Order</p>
            )}
            <p className="text-xs text-muted-foreground">Agreed commercial snapshot applied</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">
              Solar Engineering Design
            </p>
            {order.solarDesignId ? (
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {order.solarDesignId.designNumber}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">Standard Technical Spec</p>
            )}
          </div>
        </div>

        {order.cancellationReason && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            <strong>Cancelled:</strong> {order.cancellationReason}
          </div>
        )}
      </div>

      {/* Agreed Commercial Scope Table */}
      <div className="border rounded-2xl bg-card overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-solar-500" />
            <h2 className="text-base font-semibold text-foreground">
              Agreed Bill of Materials & Line Items
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {order.lineItems.length} items snapshotted
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Qty</th>
                <th className="px-6 py-3">Unit Rate</th>
                <th className="px-6 py-3">Taxable Value</th>
                <th className="px-6 py-3">GST Rate</th>
                <th className="px-6 py-3">GST Amount</th>
                <th className="px-6 py-3 text-right">Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {item.description}
                    {item.productId?.sku && (
                      <span className="block text-xs text-muted-foreground">
                        SKU: {item.productId.sku}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-6 py-4">
                    ₹{(item.unitRatePaise / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4">
                    ₹{(item.taxableAmountPaise / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4">{(item.gstRateBasisPoints / 100).toFixed(1)}%</td>
                  <td className="px-6 py-4">₹{(item.taxPaise / 100).toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">
                    ₹{(item.itemTotalPaise / 100).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary & Payment Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Milestones */}
        <div className="p-6 rounded-2xl border bg-card space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-solar-500" />
            <h3 className="text-base font-semibold text-foreground">Agreed Payment Milestones</h3>
          </div>

          <div className="space-y-3">
            {order.paymentMilestones.map((m, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-muted/30 border flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">{m.percentage}%</span>
                  <p className="text-xs text-muted-foreground">
                    ₹
                    {(((order.netTotalPaise * m.percentage) / 100 / 100) | 0).toLocaleString(
                      'en-IN'
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commercial Totals */}
        <div className="p-6 rounded-2xl border bg-card space-y-3">
          <h3 className="text-base font-semibold text-foreground">Financial Summary</h3>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-muted-foreground">Gross Subtotal</span>
            <span className="font-medium text-foreground">
              ₹{(order.grossSubtotalPaise / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-muted-foreground">Total Discount</span>
            <span className="font-medium text-emerald-400">
              - ₹{(order.totalDiscountPaise / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-muted-foreground">Taxable Value</span>
            <span className="font-medium text-foreground">
              ₹{(order.taxableAmountPaise / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-muted-foreground">
              GST Taxes ({order.taxProfile.profileCode})
            </span>
            <span className="font-medium text-foreground">
              ₹{(order.totalTaxPaise / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-lg py-2 font-bold">
            <span className="text-foreground">Net Order Total</span>
            <span className="text-solar-500">
              ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Stock Reservation Modal */}
      {showReserveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <WarehouseIcon className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-foreground">Reserve Stock Allocation</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Atomically reserve physical materials from the chosen warehouse. This increases
              reserved stock and decreases available quantity without altering on-hand inventory.
            </p>

            {reserveError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                {reserveError}
              </div>
            )}

            <form onSubmit={handleReserveStock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Fulfillment Warehouse *
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {warehouses.map(wh => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} ({wh.code}) — {wh.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reserving || warehouses.length === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {reserving ? 'Reserving...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <Ban className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-foreground">Cancel Sales Order</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Cancelling this order will automatically release any active stock reservations. If
              materials have already been physically dispatched/issued, direct cancellation is
              strictly prohibited and a formal return process must be executed.
            </p>

            {cancelError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  required
                  placeholder="Document the commercial justification for cancelling this order..."
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted text-foreground"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
