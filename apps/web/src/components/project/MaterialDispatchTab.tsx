/**
 * INS Solar Business Management Software — Material Dispatch Component
 *
 * Operational material dispatch and stock issue tracker between warehouse and site:
 * - Material summary (contracted vs issued vs remaining)
 * - Dispatch slips ledger with serialized equipment tracking
 * - Safe dispatch reversal/cancellation with reason auditing
 * - Create dispatch slip dialog with warehouse & serial number allocation
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  PackageCheck,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  ShieldAlert,
  X
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole } from '@ins-solar/shared';

interface MaterialSummaryItem {
  productId: string;
  name: string;
  sku: string;
  contractedQuantity: number;
  totalIssuedQuantity: number;
  deliveredQuantity?: number;
  inTransitQuantity?: number;
  remainingQuantity: number;
  isFullyDispatched?: boolean;
  isFullyDelivered?: boolean;
  deliveryStatus?: string;
}

interface DispatchLineItem {
  productId: {
    _id: string;
    name: string;
    sku: string;
  };
  requestedQuantity: number;
  issuedQuantity: number;
  serialNumbers?: string[];
}

interface MaterialDispatchItem {
  _id: string;
  dispatchNumber: string;
  projectId: string;
  sourceWarehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  destinationSiteAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  lineItems: DispatchLineItem[];
  status: 'DRAFT' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  dispatchedAt?: string;
  deliveredAt?: string;
  deliveryNotes?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
}

interface WarehouseOption {
  _id: string;
  name: string;
  code: string;
}

interface MaterialDispatchTabProps {
  projectId: string;
  isTerminal?: boolean;
}

export const MaterialDispatchTab: React.FC<MaterialDispatchTabProps> = ({
  projectId,
  isTerminal = false
}) => {
  const [dispatches, setDispatches] = useState<MaterialDispatchItem[]>([]);
  const [summary, setSummary] = useState<MaterialSummaryItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Dispatch Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<
    Array<{ productId: string; requestedQuantity: number; serialsText: string }>
  >([]);

  // Cancel Dispatch Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [dispatchToCancel, setDispatchToCancel] = useState<MaterialDispatchItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Delivery Acknowledgement Modal State
  const [acknowledgeModalOpen, setAcknowledgeModalOpen] = useState(false);
  const [dispatchToAcknowledge, setDispatchToAcknowledge] = useState<MaterialDispatchItem | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  // Pre-dispatch Payment Guard & Override State
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {}
  const canOverride = !user || [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_HEAD].includes(user.role as any);

  const [overridePaymentBlock, setOverridePaymentBlock] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dispatchesRes, summaryRes, warehousesRes] = await Promise.all([
        apiClient<any>(`/dispatches?projectId=${projectId}`).catch(() => []),
        apiClient<any>(`/dispatches/projects/${projectId}/summary`).catch(() => ({ materialSummary: [] })),
        apiClient<any>('/warehouses').catch(() => [])
      ]);

      const dispatchesList = Array.isArray(dispatchesRes)
        ? dispatchesRes
        : (dispatchesRes as any)?.dispatches || (dispatchesRes as any)?.items || [];

      const summaryList =
        (summaryRes as any)?.materialSummary || (summaryRes as any)?.items || [];

      const whList = Array.isArray(warehousesRes)
        ? warehousesRes
        : (warehousesRes as any)?.warehouses || (warehousesRes as any)?.items || [];

      setDispatches(dispatchesList);
      setSummary(summaryList);
      setWarehouses(whList);
    } catch (err: any) {
      console.warn('Material dispatch fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleOpenCreateModal = () => {
    setDispatchError(null);
    setOverridePaymentBlock(false);
    setOverrideReason('');
    if (warehouses.length > 0 && !sourceWarehouseId) {
      setSourceWarehouseId(warehouses[0]!._id);
    }
    // Pre-populate with order products if available
    if (summary.length > 0) {
      setLines(
        summary
          .filter(s => s.remainingQuantity > 0)
          .map(s => ({
            productId: s.productId,
            requestedQuantity: s.remainingQuantity,
            serialsText: ''
          }))
      );
    } else {
      setLines([{ productId: '', requestedQuantity: 1, serialsText: '' }]);
    }
    setCreateModalOpen(true);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      { productId: summary[0]?.productId || '', requestedQuantity: 1, serialsText: '' }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);
    if (!sourceWarehouseId) {
      setDispatchError('Please select a source fulfillment warehouse.');
      return;
    }
    if (lines.length === 0) {
      setDispatchError('At least one material line item is required.');
      return;
    }

    if (overridePaymentBlock && overrideReason.trim().length < 10) {
      setDispatchError('A comprehensive managerial reason (minimum 10 characters) is required to override the payment block.');
      return;
    }

    try {
      setSubmitting(true);
      const lineItemsPayload = lines.map(l => ({
        productId: l.productId,
        requestedQuantity: Number(l.requestedQuantity),
        serialNumbers: l.serialsText
          .split(/[\n,]/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
      }));

      await apiClient('/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          sourceWarehouseId,
          vehicleNumber: vehicleNumber.trim() || undefined,
          driverName: driverName.trim() || undefined,
          driverPhone: driverPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          lineItems: lineItemsPayload,
          overridePaymentBlock,
          overrideReason: overridePaymentBlock ? overrideReason.trim() : undefined
        })
      });

      setCreateModalOpen(false);
      setVehicleNumber('');
      setDriverName('');
      setDriverPhone('');
      setNotes('');
      setOverridePaymentBlock(false);
      setOverrideReason('');
      setDispatchError(null);
      fetchData();
    } catch (err: any) {
      setDispatchError(err?.message || 'Failed to issue material dispatch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchToCancel || !cancellationReason.trim()) {
      alert('A valid reason is strictly required to cancel a dispatch slip.');
      return;
    }

    try {
      setCancelling(true);
      await apiClient(`/dispatches/${dispatchToCancel._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          cancellationReason: cancellationReason.trim()
        })
      });

      setCancelModalOpen(false);
      setDispatchToCancel(null);
      setCancellationReason('');
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel dispatch slip.');
    } finally {
      setCancelling(false);
    }
  };

  const handleAcknowledgeDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchToAcknowledge) return;
    try {
      setAcknowledging(true);
      setError(null);
      await apiClient(`/dispatches/${dispatchToAcknowledge._id}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ deliveryNotes: deliveryNotes.trim() || undefined })
      });
      setAcknowledgeModalOpen(false);
      setDispatchToAcknowledge(null);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to acknowledge delivery.');
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-solar-600 mb-2"></div>
        <p>Loading dispatch and inventory records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & New Dispatch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center">
            <Truck className="w-5 h-5 mr-2 text-solar-600" />
            Material Issue & Site Dispatch
          </h2>
          <p className="text-xs text-muted-foreground">
            Ledger of physical goods transferred from warehouse inventory to installation site.
          </p>
        </div>

        {!isTerminal && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Issue Material Dispatch
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Contracted vs Issued Material Summary Cards */}
      {summary.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            BOM & Contracted Material Fulfillment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map(item => {
              const deliveredQty = item.deliveredQuantity ?? 0;
              const inTransitQty =
                item.inTransitQuantity ?? Math.max(0, item.totalIssuedQuantity - deliveredQty);
              const deliveredPercent =
                item.contractedQuantity > 0
                  ? Math.min(100, Math.round((deliveredQty / item.contractedQuantity) * 100))
                  : 0;
              const issuedPercent =
                item.contractedQuantity > 0
                  ? Math.min(100, Math.round((item.totalIssuedQuantity / item.contractedQuantity) * 100))
                  : 0;
              const isFullyDeliv =
                item.isFullyDelivered ?? (item.contractedQuantity > 0 && deliveredQty >= item.contractedQuantity);

              return (
                <div
                  key={item.productId}
                  className="bg-card border rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="font-mono text-xs text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                        isFullyDeliv
                          ? 'bg-emerald-100 text-emerald-800'
                          : deliveredQty > 0
                            ? 'bg-blue-100 text-blue-800'
                            : item.totalIssuedQuantity > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isFullyDeliv
                        ? '100% Delivered'
                        : deliveredQty > 0
                          ? `${deliveredPercent}% Delivered`
                          : item.totalIssuedQuantity > 0
                            ? `${issuedPercent}% In Transit`
                            : 'Pending Dispatch'}
                    </span>
                  </div>

                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                    <div
                      className="h-2 bg-emerald-500"
                      style={{ width: `${deliveredPercent}%` }}
                      title={`Delivered: ${deliveredQty}`}
                    />
                    {issuedPercent > deliveredPercent && (
                      <div
                        className="h-2 bg-amber-400"
                        style={{ width: `${Math.min(100 - deliveredPercent, issuedPercent - deliveredPercent)}%` }}
                        title={`In Transit: ${inTransitQty}`}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-4 text-center text-xs pt-1 border-t">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Contracted</span>
                      <span className="font-semibold text-foreground">
                        {item.contractedQuantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Delivered</span>
                      <span className="font-semibold text-emerald-600">
                        {deliveredQty}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">In Transit</span>
                      <span className="font-semibold text-amber-600">
                        {inTransitQty}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Pending</span>
                      <span
                        className={`font-semibold ${item.remainingQuantity > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}
                      >
                        {item.remainingQuantity}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dispatches Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <h3 className="text-sm font-bold text-foreground flex items-center">
            <PackageCheck className="w-4 h-4 mr-2 text-solar-600" />
            Dispatch Slips Ledger ({dispatches.length})
          </h3>
        </div>

        {dispatches.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm space-y-1">
            <p>No material dispatches have been issued for this project yet.</p>
            <p className="text-xs">
              Issue materials from warehouse inventory to begin site installation execution.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {dispatches.map(disp => {
              const isCancelled = disp.status === 'CANCELLED';

              return (
                <div key={disp._id} className="p-5 hover:bg-muted/10 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm font-bold text-foreground bg-muted px-2.5 py-1 rounded border">
                        {disp.dispatchNumber}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isCancelled
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : disp.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {disp.status === 'DELIVERED' ? 'DELIVERED TO SITE' : disp.status}
                      </span>
                      {disp.dispatchedAt && (
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(disp.dispatchedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {!isCancelled && !isTerminal && (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {disp.status === 'DISPATCHED' && (
                          <button
                            onClick={() => {
                              setDispatchToAcknowledge(disp);
                              setDeliveryNotes('');
                              setAcknowledgeModalOpen(true);
                            }}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5 mr-1" />
                            Acknowledge Delivery
                          </button>
                        )}
                        {disp.status !== 'DELIVERED' && (
                          <button
                            onClick={() => {
                              setDispatchToCancel(disp);
                              setCancellationReason('');
                              setCancelModalOpen(true);
                            }}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Cancel & Return Stock
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {disp.deliveredAt && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-1">
                      <span><strong>On-Site Delivery Acknowledged:</strong> {new Date(disp.deliveredAt).toLocaleString()}</span>
                      {disp.deliveryNotes && <span className="text-emerald-700">Remarks: &quot;{disp.deliveryNotes}&quot;</span>}
                    </div>
                  )}

                  {/* Warehouse & Vehicle Details */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">Source Warehouse:</strong>{' '}
                      {disp.sourceWarehouseId?.name} ({disp.sourceWarehouseId?.code})
                    </span>
                    {disp.vehicleNumber && (
                      <span>
                        <strong className="text-foreground">Vehicle:</strong> {disp.vehicleNumber}
                      </span>
                    )}
                    {disp.driverName && (
                      <span>
                        <strong className="text-foreground">Driver:</strong> {disp.driverName}{' '}
                        {disp.driverPhone ? `(${disp.driverPhone})` : ''}
                      </span>
                    )}
                  </div>

                  {isCancelled && disp.cancellationReason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      <strong>Cancellation Reason:</strong> {disp.cancellationReason}
                    </div>
                  )}

                  {/* Line Items & Serial Numbers */}
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Dispatched Items:
                    </span>
                    <div className="space-y-1.5">
                      {disp.lineItems.map((li, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1 border-b last:border-b-0"
                        >
                          <div>
                            <span className="font-semibold text-foreground">
                              {li.productId?.name || 'Product'}
                            </span>{' '}
                            <span className="font-mono text-muted-foreground text-[11px]">
                              ({li.productId?.sku})
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 pt-1 sm:pt-0">
                            <span className="font-bold text-foreground">
                              Qty: {li.issuedQuantity}
                            </span>
                            {li.serialNumbers && li.serialNumbers.length > 0 && (
                              <div className="flex items-center flex-wrap gap-1">
                                {li.serialNumbers.map((sn, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="font-mono text-[10px] bg-card px-1.5 py-0.5 rounded border text-muted-foreground"
                                  >
                                    SN: {sn}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Material Dispatch Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-lg font-bold text-foreground flex items-center">
                <Truck className="w-5 h-5 mr-2 text-solar-600" />
                Issue Installation Material Dispatch
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Source Warehouse <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={sourceWarehouseId}
                    onChange={e => setSourceWarehouseId(e.target.value)}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    placeholder="e.g. GJ-01-AB-1234"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  ></input>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Driver Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="e.g. Authorized Dispatch Receiver"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Driver Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={e => setDriverPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Material Line Items <span className="text-destructive">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-solar-600 hover:text-solar-700 font-semibold flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 bg-muted/30 border rounded-lg space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <select
                          required
                          value={line.productId}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.productId = e.target.value;
                            setLines(newLines);
                          }}
                          className="w-full text-xs rounded border bg-background px-2.5 py-1.5 text-foreground"
                        >
                          <option value="">Select Product...</option>
                          {summary.map(s => (
                            <option key={s.productId} value={s.productId}>
                              {s.name} ({s.sku}) — {s.remainingQuantity} remaining
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          required
                          min={1}
                          value={line.requestedQuantity}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx]!.requestedQuantity = Number(e.target.value);
                            setLines(newLines);
                          }}
                          placeholder="Qty"
                          className="w-full text-xs rounded border bg-background px-2.5 py-1.5 text-foreground"
                        />
                      </div>

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-rose-600 hover:text-rose-700 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={line.serialsText}
                        onChange={e => {
                          const newLines = [...lines];
                          newLines[idx]!.serialsText = e.target.value;
                          setLines(newLines);
                        }}
                        placeholder="Serial numbers (comma-separated, e.g. SN1234, SN1235)"
                        className="w-full text-xs rounded border bg-background px-2.5 py-1 text-foreground font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Dispatch Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional delivery instructions or gate pass notes..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              {dispatchError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg space-y-2.5">
                  <div className="font-semibold flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                    <span>{dispatchError}</span>
                  </div>
                  {canOverride && (
                    <div className="pt-2 border-t border-destructive/20 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
                        <input
                          type="checkbox"
                          checked={overridePaymentBlock}
                          onChange={e => setOverridePaymentBlock(e.target.checked)}
                          className="rounded border-border text-solar-600 focus:ring-solar-500"
                        />
                        <span>Managerial Override: Authorize urgent material dispatch despite pending advance</span>
                      </label>
                      {overridePaymentBlock && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground block">
                            Mandatory Managerial Reason (Minimum 10 characters):
                          </label>
                          <input
                            type="text"
                            required
                            minLength={10}
                            value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            placeholder="e.g. Client verified cheque in transit / owner approved immediate dispatch"
                            className="w-full text-xs rounded border border-border bg-background px-3 py-1.5 text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Generating Slip...' : 'Issue Dispatch Slip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Dispatch Confirmation Modal */}
      {cancelModalOpen && dispatchToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-2 text-rose-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-lg font-bold text-foreground">Cancel Dispatch Slip</h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Cancelling dispatch{' '}
              <span className="font-mono font-bold text-foreground">
                {dispatchToCancel.dispatchNumber}
              </span>{' '}
              will record compensating stock return movements and restore the physical on-hand and
              available quantities in the warehouse.
            </p>

            <form onSubmit={handleCancelDispatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  placeholder="Provide detailed justification (e.g. damaged during transport, site access delay)..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
                >
                  {cancelling ? 'Reversing Stock...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delivery Acknowledgement Modal */}
      {acknowledgeModalOpen && dispatchToAcknowledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 text-emerald-600">
              <PackageCheck className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-lg font-bold text-foreground">Acknowledge Site Delivery</h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Confirm that all hardware items and serialized components under dispatch slip{' '}
              <span className="font-mono font-bold text-foreground">
                {dispatchToAcknowledge.dispatchNumber}
              </span>{' '}
              have arrived safely at the rooftop installation site.
            </p>

            <form onSubmit={handleAcknowledgeDelivery} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Site Delivery Remarks / Condition (Optional)
                </label>
                <textarea
                  rows={3}
                  value={deliveryNotes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  placeholder="e.g. Received 20 solar modules, 1 inverter, and mounting structure in intact condition. Verified serial barcodes on-site."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setAcknowledgeModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={acknowledging}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{acknowledging ? 'Confirming...' : 'Confirm Safe Delivery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
