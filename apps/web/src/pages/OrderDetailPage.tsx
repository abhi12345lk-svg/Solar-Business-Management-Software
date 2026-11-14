/**
 * INS Solar Business Management Software — Sales Order Detail
 *
 * Displays authoritative snapshot of agreed commercial scope, financial totals,
 * payment milestones, stock reservation management, and coordinated cancellation controls.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  PackageCheck,
  AlertTriangle,
  Layers,
  Warehouse as WarehouseIcon,
  Ban,
  FolderKanban,
  User,
  CreditCard
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
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // EPC Project Handover state
  const [linkedProject, setLinkedProject] = useState<any | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

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

  // Live Receivables & Payment Reconciliation State
  const [receivables, setReceivables] = useState<{
    orderTotalPaise: number;
    allocatedAmountPaise: number;
    outstandingBalancePaise: number;
    paymentStatus: string;
    activeAllocations: any[];
  } | null>(null);

  const fetchReceivables = async () => {
    if (!id) return;
    try {
      const res = await apiClient<any>(`/payments/receivables/orders/${id}`);
      setReceivables(res);
    } catch (err) {
      console.warn('Failed to fetch order receivables:', err);
    }
  };

  const fetchOrderDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient(`/orders/${id}`);
      setOrder(data);
      fetchReceivables();
    } catch (err: any) {
      setError(err.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    fetchReceivables();
  }, [id]);

  // Check if an EPC project has already been launched for this order
  useEffect(() => {
    if (order) {
      apiClient<any>(`/projects?limit=100`)
        .then(res => {
          const list = res?.items || res?.data || (Array.isArray(res) ? res : []);
          const match = list.find(
            (p: any) => p.orderId?._id === order._id || p.orderId === order._id
          );
          if (match) setLinkedProject(match);
        })
        .catch(() => {});
    }
  }, [order]);

  const handleInitializeProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setCreatingProject(true);
    setProjectError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const custId = (order.customerId as any)?._id || (order.customerId as any)?.id || order.customerId;
      const custName = (order.customerId as any)?.legalName || 'Client';
      const orderId = (order as any)?._id || (order as any)?.id || id;
      const quotId = (order.quotationRevisionId as any)?._id || (order.quotationRevisionId as any)?.id || order.quotationRevisionId || undefined;
      const designId = (order.solarDesignId as any)?._id || (order.solarDesignId as any)?.id || order.solarDesignId || undefined;

      const newProj = await apiClient<any>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: `${custName} — ${order.systemCapacityKwp} kWp Rooftop Solar`,
          customerId: custId,
          orderId: orderId,
          quotationId: quotId,
          solarDesignId: designId,
          systemCapacityKwp: order.systemCapacityKwp,
          systemTopology: order.systemTopology || 'ON_GRID',
          plannedStartDate: today,
          targetCompletionDate: targetDate,
          priority: 'HIGH',
          notes: `10-Stage EPC Project initiated from confirmed sales order ${order.orderNumber}`
        })
      });
      setShowCreateProjectModal(false);
      setActionSuccess(`EPC Project successfully initialized: ${newProj.projectCode || ''}`);
      navigate(`/projects/${newProj._id || newProj.id}`);
    } catch (err: any) {
      setProjectError(err.message || 'Failed to initialize EPC project.');
    } finally {
      setCreatingProject(false);
    }
  };

  const [reopening, setReopening] = useState(false);

  const openReserveModal = async () => {
    setShowReserveModal(true);
    setReserveError(null);
    try {
      const res = await apiClient<any>('/warehouses?isActive=true');
      const list = res?.data || res?.items || (Array.isArray(res) ? res : []);
      setWarehouses(list);
      if (list && list.length > 0) {
        setSelectedWarehouseId(list[0]._id);
      } else {
        setReserveError('No active warehouses found. Please configure a warehouse first.');
      }
    } catch {
      setReserveError('Failed to load active warehouses.');
    }
  };

  const handleReopenOrder = async () => {
    if (!order) return;
    setReopening(true);
    setActionSuccess(null);
    try {
      const orderId = (order as any)?._id || (order as any)?.id || id;
      await apiClient(`/orders/${orderId}/reopen`, { method: 'POST' });
      setActionSuccess('Sales Order reopened successfully and returned to Confirmed status.');
      fetchOrderDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen order.');
    } finally {
      setReopening(false);
    }
  };

  const handleReserveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = (order as any)?._id || (order as any)?.id || id;
    const warehouseId = selectedWarehouseId || warehouses[0]?._id;
    if (!orderId) {
      setReserveError('Sales order ID is missing.');
      return;
    }
    if (!warehouseId) {
      setReserveError('Please select a valid fulfillment warehouse.');
      return;
    }
    setReserving(true);
    setReserveError(null);
    try {
      await apiClient(`/orders/${orderId}/reserve-stock`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId
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
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* 1. Back button & Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Orders Directory
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
              {order.orderNumber}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                order.status === 'CONFIRMED'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : order.status === 'COMPLETED'
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                    : 'bg-destructive/10 text-destructive border border-destructive/30'
              }`}
            >
              {order.status}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                order.reservationStatus === 'FULLY_RESERVED'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : order.reservationStatus === 'PARTIALLY_RESERVED'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              Stock: {order.reservationStatus}
            </span>

            {/* Live Payment Status Badge */}
            {receivables && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  receivables.paymentStatus === 'PAID'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : receivables.paymentStatus === 'PARTIALLY_PAID'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                Payment: {receivables.paymentStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Collect / Reconcile Payment in Accounts */}
          <Link
            to={`/payments?orderId=${order._id}&customerId=${(order.customerId as any)?._id || order.customerId}`}
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition-colors shadow-xs"
            title="Record payment or view 3-stage milestone reconciliation in Accounts"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            <span>Record Payment / Milestones</span>
          </Link>
          {order.status !== 'CANCELLED' &&
            (linkedProject ? (
              <Link
                to={`/projects/${linkedProject._id || linkedProject.id}`}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
              >
                <FolderKanban className="w-3.5 h-3.5 mr-1.5" />
                <span>View EPC Project ({linkedProject.projectCode})</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowCreateProjectModal(true);
                  setProjectError(null);
                }}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 mr-1.5" />
                <span>Initialize EPC Project</span>
              </button>
            ))}

          {order.status !== 'CANCELLED' && order.reservationStatus !== 'FULLY_RESERVED' && (
            <button
              onClick={openReserveModal}
              className="inline-flex items-center px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <PackageCheck className="w-3.5 h-3.5 mr-1.5" />
              <span>Reserve Stock</span>
            </button>
          )}

          {order.status === 'CANCELLED' && (
            <button
              onClick={handleReopenOrder}
              disabled={reopening}
              className="inline-flex items-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>{reopening ? 'Reopening...' : 'Reopen Order ↺'}</span>
            </button>
          )}

          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                setShowCancelModal(true);
                setCancelError(null);
              }}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border text-xs font-medium transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5 mr-1" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sleek 1-Line Lifecycle Progress Stepper */}
      <div className="bg-card border border-border/80 rounded-xl px-4 py-2.5 shadow-xs">
        <div className="flex items-center justify-between gap-1 text-xs">
          {[
            {
              step: 1,
              label: 'Order Confirmed',
              done: true,
              active: order.status === 'CONFIRMED' && order.reservationStatus === 'NONE'
            },
            {
              step: 2,
              label: 'Stock Allocation',
              done: order.reservationStatus === 'FULLY_RESERVED' || order.reservationStatus === 'PARTIALLY_RESERVED',
              active: order.status === 'CONFIRMED' && order.reservationStatus !== 'FULLY_RESERVED'
            },
            {
              step: 3,
              label: 'EPC Execution',
              done: !!linkedProject,
              active: !!linkedProject && order.status !== 'COMPLETED'
            },
            {
              step: 4,
              label: 'Commissioned',
              done: order.status === 'COMPLETED',
              active: order.status === 'COMPLETED'
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

      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {order.cancellationReason && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-500 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 shrink-0" />
            <span>
              <strong>Order Cancelled:</strong> {order.cancellationReason}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReopenOrder}
            disabled={reopening}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
          >
            {reopening ? 'Reopening...' : 'Reopen Order ↺'}
          </button>
        </div>
      )}

      {/* 3. Balanced 2-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Customer & Technical Specs, BOM Table, Payment Milestones */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer & Technical Specifications Card */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/70 pb-2.5">
              <User className="w-3.5 h-3.5 text-solar-500" />
              Customer & System Specifications
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Customer</span>
                <span className="font-semibold text-foreground text-xs line-clamp-1">
                  {order.customerId.legalName}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  {order.customerId.customerCode || '—'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Contact</span>
                <span className="font-medium text-foreground text-xs block">
                  {order.customerId.primaryPhone || '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {order.customerId.email || '—'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">System Topology & Size</span>
                <span className="font-bold text-foreground text-xs">
                  {order.systemCapacityKwp} kWp
                </span>
                <span className="text-[10px] font-bold text-solar-600 dark:text-solar-400 block">
                  {order.systemTopology}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Originating Quotation</span>
                {order.quotationRevisionId ? (
                  <Link
                    to={`/quotations/${order.quotationRevisionId._id || (order.quotationRevisionId as any).id}`}
                    className="font-mono text-xs font-bold text-solar-600 hover:underline block truncate"
                  >
                    {order.quotationRevisionId.fullQuotationCode}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs block">Direct Sales Order</span>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>
                    Booked:{' '}
                    {new Date(order.orderDate || order.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Agreed Bill of Materials & Scope */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-solar-500" />
                Agreed Bill of Materials & Work Scope
              </h2>
              <span className="text-[11px] text-muted-foreground font-medium">
                {order.lineItems.length} line item(s)
              </span>
            </div>

            {/* Mobile View: BOM Line Item Cards */}
            <div className="block md:hidden divide-y divide-border">
              {order.lineItems.map((item, idx) => (
                <div key={idx} className="py-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground text-xs">{item.description}</div>
                      {item.productId?.sku && (
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          SKU: {item.productId.sku}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-secondary text-secondary-foreground font-mono">
                      {item.quantity} {item.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Unit Rate</span>
                      <span className="font-medium text-foreground">
                        ₹{(item.unitRatePaise / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Taxable Value</span>
                      <span className="font-medium text-foreground">
                        ₹{(item.taxableAmountPaise / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">
                      GST ({(item.gstRateBasisPoints / 100).toFixed(0)}%): ₹{(item.taxPaise / 100).toLocaleString('en-IN')}
                    </span>
                    <span className="font-bold text-foreground text-xs">
                      ₹{(item.itemTotalPaise / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-left font-medium">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 text-center font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Rate</th>
                    <th className="pb-2 text-center font-medium">GST %</th>
                    <th className="pb-2 text-right font-medium">Taxable (₹)</th>
                    <th className="pb-2 text-right font-medium">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {order.lineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="py-2.5 text-foreground font-medium pr-2">
                        <span>{item.description}</span>
                        {item.productId?.sku && (
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            SKU: {item.productId.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-center font-mono">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">
                        ₹{(item.unitRatePaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-center font-mono text-muted-foreground">
                        {(item.gstRateBasisPoints / 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">
                        ₹{(item.taxableAmountPaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-foreground">
                        ₹{(item.itemTotalPaise / 100).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agreed Payment Milestones & Live Collection Status */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-solar-500" />
                <span>Payment Milestones &amp; Commercial Conditions</span>
              </h2>
              <Link
                to={`/payments?orderId=${order._id}&customerId=${(order.customerId as any)?._id || order.customerId}`}
                className="text-[11px] font-bold text-solar-600 hover:text-solar-700 flex items-center gap-1"
              >
                <span>Reconcile in Accounts ➔</span>
              </Link>
            </div>

            {/* Total Payment Collection Progress Bar */}
            {receivables && (
              <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground">Payment Collection Progress:</span>
                  <span className="font-mono text-emerald-600 font-bold">
                    ₹{((receivables.allocatedAmountPaise || 0) / 100).toLocaleString('en-IN')} / ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')} (
                    {order.netTotalPaise > 0 ? Math.round(((receivables.allocatedAmountPaise || 0) / order.netTotalPaise) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-solar-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${order.netTotalPaise > 0 ? Math.min(100, Math.round(((receivables.allocatedAmountPaise || 0) / order.netTotalPaise) * 100)) : 0}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Balance Outstanding: <strong className="text-destructive font-mono">₹{((receivables.outstandingBalancePaise || 0) / 100).toLocaleString('en-IN')}</strong></span>
                  <span>Ledger Status: <strong className="text-foreground">{receivables.paymentStatus.replace(/_/g, ' ')}</strong></span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(() => {
                let accumulatedAllocated = (receivables?.allocatedAmountPaise || 0) / 100;
                const milestones = order.paymentMilestones && order.paymentMilestones.length > 0
                  ? order.paymentMilestones
                  : [
                      { name: 'Booking Advance', percentage: 20, description: 'Upon confirmation of order' },
                      { name: 'Pre-Dispatch', percentage: 70, description: 'Prior to material dispatch from warehouse' },
                      { name: 'Commissioning', percentage: 10, description: 'Post physical installation and net-meter testing' }
                    ];

                return milestones.map((m, idx) => {
                  const targetRupees = Math.round((order.netTotalPaise * m.percentage) / 100 / 100);
                  const paidRupees = Math.min(targetRupees, Math.max(0, accumulatedAllocated));
                  accumulatedAllocated -= paidRupees;
                  const balanceRupees = Math.max(0, targetRupees - paidRupees);
                  const isPaid = paidRupees >= targetRupees && targetRupees > 0;
                  const isPartial = paidRupees > 0 && !isPaid;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition shadow-2xs ${
                        isPaid
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : isPartial
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-secondary/30 border-border'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-foreground flex items-center justify-between">
                          <span>{m.name || `Milestone ${idx + 1}`}</span>
                          <span className="text-solar-600 dark:text-solar-400 font-extrabold">{m.percentage}%</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                          {m.description || '—'}
                        </div>
                        <div className="text-sm font-mono font-black text-foreground mt-2 pt-1 border-t border-border/50">
                          ₹{targetRupees.toLocaleString('en-IN')}
                        </div>

                        {/* Real-time Status */}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Realized:</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : isPartial
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {isPaid ? '✓ Paid' : isPartial ? `⚡ Paid: ₹${paidRupees.toLocaleString('en-IN')}` : '⏳ Pending'}
                          </span>
                        </div>

                        {balanceRupees > 0 && (
                          <div className="text-[10px] text-destructive font-semibold mt-1">
                            Pending: ₹{balanceRupees.toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>

                      {/* Action button if pending */}
                      {!isPaid && (
                        <Link
                          to={`/payments?orderId=${order._id}&customerId=${(order.customerId as any)?._id || order.customerId}&milestone=${idx + 1}`}
                          className="mt-3 w-full py-1.5 px-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-semibold text-[11px] text-center flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Record Receipt</span>
                        </Link>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {(order.termsAndConditions || []).length > 0 && (
              <div className="pt-2 text-[11px] space-y-1 text-muted-foreground border-t border-border/50">
                <span className="font-semibold text-foreground text-xs block">Commercial Terms:</span>
                {(order.termsAndConditions || []).map((term, i) => (
                  <div key={i}>• {term}</div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Receipts & Allocations Ledger */}
          {receivables?.activeAllocations && receivables.activeAllocations.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Realized Payment Receipts ({receivables.activeAllocations.length})</span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  Total Credited: ₹{((receivables.allocatedAmountPaise || 0) / 100).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40 border-b text-muted-foreground">
                    <tr>
                      <th className="py-2 px-3 text-left">Receipt #</th>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-3 text-left">Method</th>
                      <th className="py-2 px-3 text-left">Reference / Notes</th>
                      <th className="py-2 px-3 text-right">Amount Allocated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {receivables.activeAllocations.map((alloc: any) => {
                      const pay = alloc.paymentId;
                      return (
                        <tr key={alloc._id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                            {pay?.receiptNumber || alloc.allocationNumber || 'REC'}
                          </td>
                          <td className="py-2.5 px-3">
                            {pay?.paymentDate ? new Date(pay.paymentDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted">
                              {pay?.paymentMethod === 'CHEQUE'
                                ? '🏦 Cheque'
                                : pay?.paymentMethod === 'CASH'
                                  ? '💵 Cash'
                                  : pay?.paymentMethod === 'UPI'
                                    ? '📱 UPI'
                                    : '🏛️ ' + (pay?.paymentMethod || 'Bank Transfer')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {pay?.transactionReference || alloc.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                            ₹{((alloc.allocatedAmountPaise || 0) / 100).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Commercial Financial Summary + Operations Fulfillment Status */}
        <div className="lg:col-span-5 space-y-4">
          {/* Commercial Financial Summary Card */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Commercial Pricing & Tax Summary
              </h2>
              <span className="text-[11px] text-muted-foreground">INR (₹)</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Gross Subtotal</span>
                <span className="font-mono text-foreground font-medium">
                  ₹{(order.grossSubtotalPaise / 100).toLocaleString('en-IN')}
                </span>
              </div>

              {order.totalDiscountPaise > 0 && (
                <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400">
                  <span>Additional Discount</span>
                  <span className="font-mono font-medium">
                    - ₹{(order.totalDiscountPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Taxable Value</span>
                <span className="font-mono text-foreground font-medium">
                  ₹{(order.taxableAmountPaise / 100).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="py-2 px-3 rounded-lg bg-secondary/30 border border-border space-y-1.5 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">GST Taxes ({order.taxProfile?.profileCode || 'GST-EPC'})</span>
                  <span className="font-mono text-foreground">
                    ₹{(order.totalTaxPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
                {order.taxProfile?.profileName && (
                  <div className="text-[10px] text-muted-foreground italic">
                    {order.taxProfile.profileName}
                  </div>
                )}
              </div>

              <div className="pt-2.5 border-t border-border flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">Net Agreed Total</span>
                  <span className="text-[10px] text-muted-foreground">All applicable taxes included</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-solar-600 dark:text-solar-400 font-mono tracking-tight">
                    ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Operations & Fulfillment Status Card */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/70 pb-2.5">
              <FolderKanban className="w-3.5 h-3.5 text-solar-500" />
              Fulfillment & Operations Handover
            </h2>

            {/* 1. Stock Allocation Item */}
            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-foreground">Inventory Stock Allocation</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    order.reservationStatus === 'FULLY_RESERVED'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : order.reservationStatus === 'PARTIALLY_RESERVED'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {order.reservationStatus}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {order.reservationStatus === 'FULLY_RESERVED'
                  ? 'All solar modules and inverters are allocated and reserved in warehouse inventory.'
                  : order.reservationStatus === 'PARTIALLY_RESERVED'
                    ? 'Some physical materials are allocated. Additional hardware reservation required.'
                    : 'Physical materials are not reserved yet. Reserve stock before dispatching hardware.'}
              </p>

              {order.status !== 'CANCELLED' && order.reservationStatus !== 'FULLY_RESERVED' && (
                <button
                  type="button"
                  onClick={openReserveModal}
                  className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Reserve Stock Now</span>
                </button>
              )}
            </div>

            {/* 2. 10-Stage EPC Project Item */}
            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-solar-500" />
                  <span className="text-xs font-bold text-foreground">10-Stage EPC Project</span>
                </div>
                {linkedProject ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {linkedProject.currentStage || 'ACTIVE'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                    NOT INITIATED
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {linkedProject
                  ? `Active EPC Execution under project ${linkedProject.projectCode}. Linear DISCOM liaisons, installation checklist & commissioning enabled.`
                  : 'Start linear engineering, DISCOM liaison, Net Metering approval, and site execution pipeline.'}
              </p>

              {order.status !== 'CANCELLED' && (
                linkedProject ? (
                  <Link
                    to={`/projects/${linkedProject._id || linkedProject.id}`}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Open EPC Project ({linkedProject.projectCode}) →</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProjectModal(true);
                      setProjectError(null);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Launch 10-Stage EPC Project →</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Notes & Directives Card */}
          {order.notes && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Order Notes & Directives
              </span>
              <p className="text-foreground text-xs leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Reservation Modal */}
      {showReserveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
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
              <div className="bg-secondary/30 p-2.5 rounded-lg border text-xs space-y-1.5">
                <div className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider">
                  Hardware Scope to Allocate:
                </div>
                {order.lineItems.map((li, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-foreground">{li.description}</span>
                    <span className="font-mono font-bold text-solar-600 dark:text-solar-400">
                      {li.quantity} {li.unit}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Fulfillment Warehouse *
                </label>
                {warehouses.length > 0 ? (
                  <select
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {warehouses.map(wh => (
                      <option key={wh._id} value={wh._id}>
                        {wh.name} ({wh.code}) {wh.address?.city ? `— ${wh.address.city}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-secondary/40 rounded-lg text-xs text-muted-foreground border">
                    Loading warehouses or none available...
                  </div>
                )}
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
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {reserving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Reserving Materials...</span>
                    </>
                  ) : (
                    <span>Confirm Reservation</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Initialize EPC Project Modal */}
      {showCreateProjectModal && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2.5 border-b pb-3">
              <div className="p-2 rounded-lg bg-solar-500/10 text-solar-600">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Launch 10-Stage EPC Project Execution
                </h3>
                <p className="text-xs text-muted-foreground">
                  Initialize linear engineering, Net Metering DISCOM liaison, material dispatch, and
                  commissioning pipeline.
                </p>
              </div>
            </div>

            {projectError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {projectError}
              </div>
            )}

            <div className="space-y-2.5 bg-secondary/30 p-3 rounded-lg border text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Originating Order:</span>
                <span className="font-mono font-bold text-foreground">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client Legal Entity:</span>
                <span className="font-bold text-foreground">{order.customerId?.legalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solar Capacity:</span>
                <span className="font-bold text-solar-600 dark:text-solar-400">
                  {order.systemCapacityKwp} kWp
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Topology:</span>
                <span className="font-semibold">{order.systemTopology}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract Total:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Project will start at <strong>Stage 1 (Engineering Design)</strong> with all 10
                standard milestone blockers, QA checklists, and Net Metering utility compliance
                gates enabled.
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateProjectModal(false)}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitializeProject}
                disabled={creatingProject}
                className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {creatingProject ? 'Initializing Project...' : 'Launch EPC Execution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
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
