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
  FolderKanban
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

      const newProj = await apiClient<any>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: `${order.customerId.legalName} — ${order.systemCapacityKwp} kWp Rooftop Solar`,
          customerId: order.customerId._id,
          orderId: order._id,
          quotationId: order.quotationRevisionId?._id,
          solarDesignId: order.solarDesignId?._id,
          systemCapacityKwp: order.systemCapacityKwp,
          systemTopology: order.systemTopology || 'ON_GRID',
          plannedStartDate: today,
          targetCompletionDate: targetDate,
          priority: 'HIGH',
          notes: `10-Stage EPC Project initiated from confirmed sales order ${order.orderNumber}`
        })
      });
      setShowCreateProjectModal(false);
      setActionSuccess(`EPC Project successfully initialized: ${newProj.projectCode}`);
      navigate(`/projects/${newProj._id}`);
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
      await apiClient(`/orders/${order._id}/reopen`, { method: 'POST' });
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
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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

      {/* 3. Next Stage Action Guidance Card */}
      <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Next Stage Workflow Action
          </span>
          {order.status === 'CANCELLED' ? (
            <p className="text-xs text-rose-500 font-medium">
              This sales order was marked as cancelled. Reopen it to resume material allocation and EPC operations.
            </p>
          ) : linkedProject ? (
            <p className="text-xs text-foreground font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>EPC Execution is active under Project <strong>{linkedProject.projectCode}</strong> ({linkedProject.currentStage || 'Stage 1'}).</span>
            </p>
          ) : order.reservationStatus === 'FULLY_RESERVED' ? (
            <p className="text-xs text-foreground font-medium">
              Physical materials are reserved in fulfillment warehouse. Ready to launch 10-Stage EPC Project Execution.
            </p>
          ) : (
            <p className="text-xs text-foreground font-medium">
              Reserve physical hardware (solar modules, inverters) from fulfillment depot before dispatching materials.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.status === 'CANCELLED' ? (
            <button
              type="button"
              onClick={handleReopenOrder}
              disabled={reopening}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {reopening ? 'Reopening...' : 'Reopen Sales Order ↺'}
            </button>
          ) : linkedProject ? (
            <Link
              to={`/projects/${linkedProject._id || linkedProject.id}`}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <FolderKanban className="w-4 h-4" />
              <span>Open EPC Project ({linkedProject.projectCode}) →</span>
            </Link>
          ) : (
            <>
              {order.reservationStatus !== 'FULLY_RESERVED' && (
                <button
                  type="button"
                  onClick={openReserveModal}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Reserve Stock Allocation</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCreateProjectModal(true);
                  setProjectError(null);
                }}
                className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Launch 10-Stage EPC Execution →</span>
              </button>
            </>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Order Header Card */}
      <div className="p-5 sm:p-6 rounded-xl border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
                {order.orderNumber}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {order.status}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                {order.reservationStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
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
              <span className="font-semibold text-foreground">Capacity: {order.systemCapacityKwp} kWp</span>
              <span>•</span>
              <span className="text-solar-600 font-medium">Topology: {order.systemTopology}</span>
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[11px] text-muted-foreground uppercase font-semibold">Net Agreed Contract Total</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-solar-600 dark:text-solar-400 tracking-tight font-mono">
              ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Customer & Quotation Context */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t text-xs">
          <div>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Customer Profile</p>
            <p className="text-xs font-semibold text-foreground mt-0.5">
              {order.customerId.legalName}
            </p>
            {order.customerId.primaryPhone && (
              <p className="text-muted-foreground">{order.customerId.primaryPhone}</p>
            )}
            {order.customerId.email && (
              <p className="text-muted-foreground">{order.customerId.email}</p>
            )}
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
              Originating Quotation
            </p>
            {order.quotationRevisionId ? (
              <p className="text-xs font-bold text-solar-600 dark:text-solar-400 font-mono mt-0.5">
                {order.quotationRevisionId.fullQuotationCode}
              </p>
            ) : (
              <p className="text-muted-foreground mt-0.5">Direct Order</p>
            )}
            <p className="text-muted-foreground text-[10px]">Agreed commercial snapshot applied</p>
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
              Solar Engineering Design
            </p>
            {order.solarDesignId ? (
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {order.solarDesignId.designNumber}
              </p>
            ) : (
              <p className="text-muted-foreground mt-0.5">Standard Technical Spec</p>
            )}
          </div>
        </div>

        {order.cancellationReason && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center justify-between gap-2">
            <div>
              <strong>Order Cancelled:</strong> {order.cancellationReason}
            </div>
            <button
              type="button"
              onClick={handleReopenOrder}
              disabled={reopening}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shrink-0 transition-colors cursor-pointer"
            >
              {reopening ? 'Reopening...' : 'Reopen Order ↺'}
            </button>
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

        {/* Mobile View: BOM Line Item Cards */}
        <div className="block md:hidden divide-y divide-border">
          {order.lineItems.map((item, idx) => (
            <div key={idx} className="p-4 space-y-2.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground text-sm">{item.description}</div>
                  {item.productId?.sku && (
                    <span className="text-[11px] font-mono text-muted-foreground block">
                      SKU: {item.productId.sku}
                    </span>
                  )}
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-secondary text-secondary-foreground font-mono">
                  {item.quantity} {item.unit}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Unit Rate
                  </span>
                  <span className="font-medium text-foreground">
                    ₹{(item.unitRatePaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Taxable Value
                  </span>
                  <span className="font-medium text-foreground">
                    ₹{(item.taxableAmountPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50 bg-muted/20 -mx-4 -mb-4 p-3 rounded-b-lg">
                <span className="text-[11px] text-muted-foreground">
                  GST ({(item.gstRateBasisPoints / 100).toFixed(1)}%): ₹
                  {(item.taxPaise / 100).toLocaleString('en-IN')}
                </span>
                <span className="font-bold text-foreground text-sm">
                  ₹{(item.itemTotalPaise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
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
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {reserving ? 'Reserving...' : 'Confirm Reservation'}
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
