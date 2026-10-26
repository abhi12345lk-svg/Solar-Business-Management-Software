import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface PurchaseOrderItem {
  _id: string;
  poNumber: string;
  orderDate: string;
  status: string;
  totalAmountPaise: number;
  isInterState: boolean;
  vendorId?: {
    _id: string;
    name: string;
    vendorCode: string;
  };
  destinationWarehouseId?: {
    _id: string;
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
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // PO Form State
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<
    Array<{ productId: string; orderedQuantity: number; unitPurchaseRateInr: number; gstRate: number }>
  >([{ productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=50&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;

      const res = await apiClient(`/purchase-orders${query}`);
      const list = res.data?.items || res.data || [];
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
        apiClient('/vendors?limit=100&isActive=true'),
        apiClient('/warehouses?limit=100'),
        apiClient('/catalog/products?limit=100&isActive=true')
      ]);
      setVendorsList(vRes.data?.items || vRes.data || []);
      setWarehousesList(wRes.data || []);
      setProductsList(pRes.data?.products || pRes.data?.items || pRes.data || []);
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

  const handleAddLine = () => {
    setLineItems([...lineItems, { productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }]);
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
      const prod = productsList.find(p => p._id === value);
      if (prod && prod.standardPurchaseRatePaise) {
        target.unitPurchaseRateInr = prod.standardPurchaseRatePaise / 100;
      }
    }
    setLineItems(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setLineItems([{ productId: '', orderedQuantity: 1, unitPurchaseRateInr: 0, gstRate: 12 }]);
      await fetchPOs();
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">Draft</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pending Approval</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Approved</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Partially Received</span>;
      case 'FULLY_RECEIVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Fully Received</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">{status}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const estimatedTotalInr = lineItems.reduce((acc, line) => {
    const base = Number(line.orderedQuantity || 0) * Number(line.unitPurchaseRateInr || 0);
    const tax = base * (Number(line.gstRate || 0) / 100);
    return acc + base + tax;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground text-sm">
            Raise procurement orders, manage approval workflows, track vendor fulfillment and outstanding quantities.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search PO number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
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
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* PO Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Warehouse Depot</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Total Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map(po => (
                  <tr key={po._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      <Link to={`/purchase-orders/${po._id}`} className="hover:underline text-primary">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{po.vendorId?.name || '—'}</div>
                      <div className="text-xs font-mono text-muted-foreground">{po.vendorId?.vendorCode}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      {po.destinationWarehouseId?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      {new Date(po.orderDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      ₹{(po.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/purchase-orders/${po._id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        View Details
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-card rounded-xl border border-border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Raise Purchase Order
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Select Vendor *
                  </label>
                  <select
                    required
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsList.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.name} ({v.vendorCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Destination Warehouse *
                  </label>
                  <select
                    required
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Choose Receiving Depot --</option>
                    {warehousesList.map(w => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="interstate"
                  checked={isInterState}
                  onChange={e => setIsInterState(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="interstate" className="text-xs text-foreground cursor-pointer">
                  Inter-State Procurement (Apply IGST instead of CGST+SGST)
                </label>
              </div>

              {/* Line Items Editor */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Ordered Hardware Line Items
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-secondary/20 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Product</label>
                        <select
                          required
                          value={line.productId}
                          onChange={e => handleLineChange(idx, 'productId', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                          <option value="">-- Choose Product SKU --</option>
                          {productsList.map(p => (
                            <option key={p._id} value={p._id}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Qty</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={line.orderedQuantity}
                          onChange={e => handleLineChange(idx, 'orderedQuantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Rate (₹)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={line.unitPurchaseRateInr}
                          onChange={e => handleLineChange(idx, 'unitPurchaseRateInr', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">GST%</label>
                        <select
                          value={line.gstRate}
                          onChange={e => handleLineChange(idx, 'gstRate', Number(e.target.value))}
                          className="w-full px-1 py-1.5 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commercial Estimation Summary */}
              <div className="p-3 rounded-lg border border-border bg-card flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Estimated PO Total (with GST):</span>
                <span className="text-base font-bold text-foreground">
                  ₹{estimatedTotalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commercial Notes</label>
                <textarea
                  rows={2}
                  placeholder="Terms, delivery dispatch schedule, freight considerations..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary/40 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Draft PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
