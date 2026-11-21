import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  ArrowRight,
  Trash2,
  AlertCircle,
  Package
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface PurchaseOrderItem {
  _id?: string;
  id?: string;
  poNumber: string;
  orderDate: string;
  status: string;
  totalAmountPaise: number;
  isInterState: boolean;
  vendorId?: {
    _id?: string;
    id?: string;
    name: string;
    vendorCode: string;
  };
  destinationWarehouseId?: {
    _id?: string;
    id?: string;
    name: string;
    code: string;
  };
  approval?: {
    requiresApproval: boolean;
    approvedAt?: string;
  };
  lineItems: Array<{
    sku: string;
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    outstandingQuantity: number;
  }>;
}

export function PurchaseOrdersPage() {
  const [searchParams] = useSearchParams();
  const paramVendorId = searchParams.get('vendorId');
  const paramAction = searchParams.get('action');

  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // PO Form State
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<
    Array<{
      productId: string;
      orderedQuantity: number;
      unitPurchaseRateInr: number;
      gstRate: number;
    }>
  >([{ productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=50&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;

      const res = await apiClient<any>(`/purchase-orders${query}`);
      const list = res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [vRes, wRes, pRes] = await Promise.all([
        apiClient<any>('/vendors?limit=100&isActive=true'),
        apiClient<any>('/warehouses?limit=100'),
        apiClient<any>('/catalog/products?limit=100&isActive=true')
      ]);
      const vList =
        vRes?.items || vRes?.data?.items || vRes?.data || (Array.isArray(vRes) ? vRes : []);
      const wList =
        wRes?.items || wRes?.data?.data || wRes?.data || (Array.isArray(wRes) ? wRes : []);
      const pList =
        pRes?.items || pRes?.data?.data || pRes?.data || (Array.isArray(pRes) ? pRes : []);

      setVendorsList(vList);
      setWarehousesList(wList);
      setProductsList(pList);

      if (wList.length > 0 && !warehouseId) {
        setWarehouseId(wList[0].id || wList[0]._id);
      }
    } catch (err) {
      console.error('Failed to load master dropdowns', err);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [search, statusFilter]);

  useEffect(() => {
    if (isModalOpen) {
      loadDropdowns();
    }
  }, [isModalOpen]);

  // If query string asks to create PO for a specific vendor
  useEffect(() => {
    if (paramAction === 'new' || paramVendorId) {
      if (paramVendorId) {
        setVendorId(paramVendorId);
      }
      setIsModalOpen(true);
    }
  }, [paramAction, paramVendorId]);

  const handleAddLine = () => {
    setLineItems([
      ...lineItems,
      { productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== idx));
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    const target = updated[index];
    if (!target) return;
    (target as any)[field] = value;

    // Auto-populate standard purchase rate from product catalog if product selected
    if (field === 'productId') {
      const prod = productsList.find(p => (p.id || p._id) === value);
      if (prod && prod.standardPurchaseRatePaise) {
        target.unitPurchaseRateInr = prod.standardPurchaseRatePaise / 100;
      }
      if (prod && prod.taxProfileCode) {
        if (prod.taxProfileCode === 'GST_18') target.gstRate = 18;
        else if (prod.taxProfileCode === 'GST_5') target.gstRate = 5;
        else if (prod.taxProfileCode === 'GST_28') target.gstRate = 28;
        else target.gstRate = 12;
      }
    }
    setLineItems(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!vendorId) {
      setModalError('Please select a supplier / vendor.');
      return;
    }
    if (!warehouseId) {
      setModalError('Please select a receiving destination warehouse.');
      return;
    }
    const invalidLine = lineItems.find(l => !l.productId || Number(l.orderedQuantity) <= 0);
    if (invalidLine) {
      setModalError(
        'Please choose a valid product SKU and quantity greater than zero for all line items.'
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        vendorId,
        destinationWarehouseId: warehouseId,
        isInterState,
        notes: notes || undefined,
        lineItems: lineItems.map(item => ({
          productId: item.productId,
          orderedQuantity: Number(item.orderedQuantity),
          unitPurchaseRatePaise: Math.round(Number(item.unitPurchaseRateInr) * 100),
          discountPaise: 0,
          gstRate: Number(item.gstRate)
        }))
      };

      await apiClient('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
      setVendorId('');
      setWarehouseId('');
      setNotes('');
      setModalError(null);
      setLineItems([{ productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }]);
      await fetchPOs();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border">
            Draft
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Approved
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">
            Partially Received
          </span>
        );
      case 'FULLY_RECEIVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
            Fully Received
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
            {status}
          </span>
        );
    }
  };

  const baseSubtotalInr = lineItems.reduce((acc, line) => {
    return acc + Number(line.orderedQuantity || 0) * Number(line.unitPurchaseRateInr || 0);
  }, 0);

  const totalGstInr = lineItems.reduce((acc, line) => {
    const base = Number(line.orderedQuantity || 0) * Number(line.unitPurchaseRateInr || 0);
    return acc + base * (Number(line.gstRate || 0) / 100);
  }, 0);

  const estimatedTotalInr = baseSubtotalInr + totalGstInr;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-solar-600" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Procure solar panels, string inverters, and BOS materials from authorized vendors.
          </p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setModalError(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-solar-600 text-white font-semibold text-sm hover:bg-solar-500 shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Raise Purchase Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search PO number or vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-solar-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Filter Status:
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-solar-500 cursor-pointer"
          >
            <option value="ALL">All POs</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="FULLY_RECEIVED">Fully Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PO Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">PO Number</th>
                <th className="py-3 px-4 font-semibold">Supplier / Vendor</th>
                <th className="py-3 px-4 font-semibold">Receiving Warehouse</th>
                <th className="py-3 px-4 font-semibold">Order Date</th>
                <th className="py-3 px-4 font-semibold">Total Value (₹)</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground text-xs">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs space-y-2">
                    <p className="font-semibold text-sm text-foreground">No purchase orders found</p>
                    <p>Click "Raise Purchase Order" to procure hardware from your registered solar suppliers.</p>
                  </td>
                </tr>
              ) : (
                orders.map(po => {
                  const poId = po._id || po.id || '';
                  const totalRupees = (po.totalAmountPaise || 0) / 100;
                  return (
                    <tr key={poId} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        <Link
                          to={`/purchase-orders/${poId}`}
                          className="hover:underline text-solar-600 dark:text-solar-400"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {po.vendorId?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground">
                        {po.destinationWarehouseId?.name || 'Central Depot'}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {po.orderDate ? new Date(po.orderDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-foreground">
                        ₹
                        {totalRupees.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(po.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/purchase-orders/${poId}`}
                          className="inline-flex items-center gap-1 text-xs text-solar-600 hover:text-solar-700 font-semibold cursor-pointer"
                        >
                          <span>Manage PO</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spacious Clean Raise Purchase Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-3xl bg-card rounded-2xl border border-border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-solar-600" />
                  Raise Purchase Order (PO)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Procure modules, inverters, cables, and BOS mounting hardware into inventory depot.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setModalError(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-sm">
              {modalError && (
                <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Vendor & Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Select Supplier / Vendor *
                  </label>
                  <select
                    required
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsList.map(v => {
                      const id = v.id || v._id;
                      return (
                        <option key={id} value={id}>
                          {v.name} ({v.vendorCode || 'VEN'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Destination Warehouse Depot *
                  </label>
                  <select
                    required
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Receiving Depot --</option>
                    {warehousesList.map(w => {
                      const id = w.id || w._id;
                      return (
                        <option key={id} value={id}>
                          {w.name} ({w.code || 'WH'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Inter-State Tax Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/30 border border-border/80">
                <input
                  type="checkbox"
                  id="interstate"
                  checked={isInterState}
                  onChange={e => setIsInterState(e.target.checked)}
                  className="rounded border-input text-solar-600 focus:ring-solar-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="interstate" className="text-xs text-foreground cursor-pointer font-medium">
                  Inter-State Procurement (Apply Integrated GST [IGST] instead of Intra-state CGST + SGST)
                </label>
              </div>

              {/* Line Items Editor */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-solar-600" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Ordered Solar Hardware Items
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs text-solar-600 dark:text-solar-400 font-bold bg-solar-500/10 hover:bg-solar-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Product Line</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineItems.map((line, idx) => {
                    const lineSubtotal = Number(line.orderedQuantity || 0) * Number(line.unitPurchaseRateInr || 0);
                    const lineGst = lineSubtotal * (Number(line.gstRate || 0) / 100);
                    const lineTotal = lineSubtotal + lineGst;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-border bg-secondary/20 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                      >
                        <div className="sm:col-span-5">
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Product SKU / Item *
                          </label>
                          <select
                            required
                            value={line.productId}
                            onChange={e => handleLineChange(idx, 'productId', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Choose Product SKU --</option>
                            {productsList.map(p => {
                              const id = p.id || p._id;
                              return (
                                <option key={id} value={id}>
                                  {p.sku} — {p.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Qty
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={line.orderedQuantity}
                            onChange={e =>
                              handleLineChange(idx, 'orderedQuantity', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs font-mono focus:ring-2 focus:ring-solar-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={line.unitPurchaseRateInr}
                            onChange={e =>
                              handleLineChange(idx, 'unitPurchaseRateInr', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs font-mono focus:ring-2 focus:ring-solar-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            GST Rate
                          </label>
                          <select
                            value={line.gstRate}
                            onChange={e => handleLineChange(idx, 'gstRate', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer"
                          >
                            <option value="5">5% (Solar Components)</option>
                            <option value="12">12% (Standard Solar PV)</option>
                            <option value="18">18% (Cables & BOS)</option>
                            <option value="28">28% (Specialized Goods)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1 text-right flex items-center justify-end">
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-2 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Line subtotal helper */}
                        <div className="sm:col-span-12 text-[11px] text-muted-foreground flex justify-between border-t border-border/40 pt-1.5">
                          <span>
                            Base: ₹{lineSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + GST ({line.gstRate}%): ₹{lineGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="font-semibold text-foreground">
                            Line Total: ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Commercial Estimation Summary */}
              <div className="p-4 rounded-xl border border-solar-500/30 bg-solar-500/5 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxable Base Value:</span>
                  <span className="font-mono">
                    ₹{baseSubtotalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{isInterState ? 'IGST (Integrated Tax)' : 'CGST + SGST (Intra-State)'}:</span>
                  <span className="font-mono">
                    ₹{totalGstInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1.5">
                  <span>Estimated Total PO Value (with GST):</span>
                  <span className="text-base text-solar-600 font-mono">
                    ₹{estimatedTotalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Commercial Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Commercial Notes & Freight Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Delivery terms: CIF Raipur Central Depot. Inspection certificate & packing list required before dispatch."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-secondary text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-solar-600 text-white text-xs font-bold hover:bg-solar-500 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Generating PO...' : 'Create Draft PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
