/**
 * INS Solar Business Management Software — Sales Orders Directory
 *
 * Provides responsive order management, filtering by status and stock reservation,
 * quick order creation from accepted quotation revisions, and financial metric overviews.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  PackageCheck,
  Plus
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface OrderItem {
  _id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  reservationStatus: string;
  systemCapacityKwp: number;
  netTotalPaise: number;
  customerId?: {
    _id: string;
    legalName: string;
    customerCode?: string;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reservationFilter, setReservationFilter] = useState('');

  // Order creation from quotation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptedQuotations, setAcceptedQuotations] = useState<any[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (reservationFilter) params.append('reservationStatus', reservationFilter);

      const endpoint = `/orders?${params.toString()}`;
      const data = await apiClient(endpoint);
      setOrders(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, reservationFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setCreateError(null);
    setLoadingQuotations(true);
    try {
      const data = await apiClient('/quotations?status=ACCEPTED&limit=50');
      setAcceptedQuotations(data.items || []);
      if (data.items && data.items.length > 0) {
        setSelectedQuoteId(data.items[0]._id);
      }
    } catch {
      setCreateError('Failed to fetch accepted quotations.');
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteId) {
      setCreateError('Please select an eligible accepted quotation.');
      return;
    }

    setCreatingOrder(true);
    setCreateError(null);
    try {
      const newOrder = await apiClient('/orders', {
        method: 'POST',
        body: JSON.stringify({
          quotationId: selectedQuoteId,
          quotationRevisionId: selectedQuoteId,
          notes: orderNotes.trim() || undefined
        })
      });
      setShowCreateModal(false);
      navigate(`/orders/${newOrder._id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to convert quotation to sales order.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" /> In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3 mr-1" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/30">
            {status}
          </span>
        );
    }
  };

  const getReservationBadge = (status: string) => {
    switch (status) {
      case 'FULLY_RESERVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <PackageCheck className="w-3 h-3 mr-1 text-indigo-400" /> Fully Reserved
          </span>
        );
      case 'PARTIALLY_RESERVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Partially Reserved
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Released
          </span>
        );
      case 'NONE':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            No Allocation
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-6 h-6 text-solar-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales Orders</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track confirmed customer solar projects, commercial snapshots, and inventory
            reservations.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-500 text-white font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Order from Quotation
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase">Total Orders</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{orders.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <p className="text-xs font-medium text-emerald-400 uppercase">Confirmed</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">
            {orders.filter(o => o.status === 'CONFIRMED').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <p className="text-xs font-medium text-amber-400 uppercase">In Progress</p>
          <p className="text-2xl font-bold mt-1 text-amber-400">
            {orders.filter(o => o.status === 'IN_PROGRESS').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <p className="text-xs font-medium text-indigo-400 uppercase">Stock Allocated</p>
          <p className="text-2xl font-bold mt-1 text-indigo-400">
            {orders.filter(o => o.reservationStatus === 'FULLY_RESERVED').length}
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card/40 backdrop-blur-sm flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order number (e.g. ORD-2026-00001)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <select
            value={reservationFilter}
            onChange={e => setReservationFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
          >
            <option value="">All Allocations</option>
            <option value="NONE">No Allocation</option>
            <option value="PARTIALLY_RESERVED">Partially Reserved</option>
            <option value="FULLY_RESERVED">Fully Reserved</option>
            <option value="RELEASED">Released</option>
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Order Number</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Capacity</th>
                <th className="px-6 py-3">Net Agreed Total</th>
                <th className="px-6 py-3">Order Status</th>
                <th className="px-6 py-3">Stock Allocation</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-solar-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    No sales orders found matching your filters.
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order._id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      <Link
                        to={`/orders/${order._id}`}
                        className="text-solar-500 hover:text-solar-400 flex items-center group"
                      >
                        <span>{order.orderNumber}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        {order.customerId?.legalName || 'N/A'}
                      </div>
                      {order.customerId?.customerCode && (
                        <div className="text-xs text-muted-foreground">
                          {order.customerId.customerCode}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {order.systemCapacityKwp} kWp
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      ₹{(order.netTotalPaise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4">{getReservationBadge(order.reservationStatus)}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(order.orderDate || order.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/orders/${order._id}`}
                        className="inline-flex items-center text-xs font-medium text-solar-500 hover:text-solar-400"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order From Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-solar-500" />
              <h2 className="text-lg font-bold text-foreground">
                Convert Accepted Quotation to Sales Order
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Select an accepted quotation revision. The agreed BOM scope, unit rates, milestones,
              and financial totals will be immutably snapshotted onto the sales order.
            </p>

            {createError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Eligible Accepted Quotation *
                </label>
                {loadingQuotations ? (
                  <p className="text-xs text-muted-foreground">Loading accepted quotations...</p>
                ) : acceptedQuotations.length === 0 ? (
                  <div className="p-3 bg-muted/40 rounded-lg text-xs text-amber-400 border border-amber-500/20">
                    No accepted quotations found eligible for conversion. Please approve and accept
                    a quotation first.
                  </div>
                ) : (
                  <select
                    value={selectedQuoteId}
                    onChange={e => setSelectedQuoteId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    {acceptedQuotations.map(q => (
                      <option key={q._id} value={q._id}>
                        {q.fullQuotationCode} — {q.customerId?.legalName || 'Client'} (
                        {q.systemCapacityKwp} kWp, ₹
                        {(q.netTotalPaise / 100).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Order Booking Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Special fulfillment directives, dispatch priorities, etc."
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrder || acceptedQuotations.length === 0}
                  className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {creatingOrder ? 'Converting...' : 'Generate Sales Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
