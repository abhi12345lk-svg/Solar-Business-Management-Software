import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface GoodsReceiptItem {
  _id: string;
  grnNumber: string;
  receiptDate: string;
  status: string;
  deliveryChallanNumber?: string;
  vehicleNumber?: string;
  purchaseOrderId?: {
    _id: string;
    poNumber: string;
    status: string;
  };
  vendorId?: {
    _id: string;
    name: string;
    vendorCode: string;
    gstin?: string;
  };
  destinationWarehouseId?: {
    _id: string;
    name: string;
    code: string;
  };
  receivedBy?: {
    firstName: string;
    lastName: string;
  };
  lineItems: Array<{
    sku: string;
    productName: string;
    orderedQuantity: number;
    deliveredQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    rejectionReason?: string;
    serialNumbers?: string[];
  }>;
}

export function GoodsReceiptsPage() {
  const [grnList, setGrnList] = useState<GoodsReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient('/goods-receipts?limit=50');
      const list = res.data?.items || res.data || [];
      setGrnList(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load Goods Receipt Notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGRNs();
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const filteredGRNs = grnList.filter(g => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      g.grnNumber.toLowerCase().includes(s) ||
      g.purchaseOrderId?.poNumber.toLowerCase().includes(s) ||
      g.vendorId?.name.toLowerCase().includes(s) ||
      g.destinationWarehouseId?.name.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-primary" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-muted-foreground text-sm">
            Audited warehouse intake records, QA inspection reports, and serial-tracked inventory
            movements.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search GRN, PO number, or vendor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* GRN Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">GRN Number</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4">Receipt Date</th>
                <th className="py-3 px-4">Received By</th>
                <th className="py-3 px-4 text-center">Items Intake</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading Goods Receipt Notes...
                  </td>
                </tr>
              ) : filteredGRNs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No Goods Receipt Notes found.
                  </td>
                </tr>
              ) : (
                filteredGRNs.map(grn => {
                  const isExpanded = expandedRow === grn._id;
                  const totalAccepted = grn.lineItems.reduce(
                    (acc, l) => acc + l.acceptedQuantity,
                    0
                  );
                  const totalRejected = grn.lineItems.reduce(
                    (acc, l) => acc + l.rejectedQuantity,
                    0
                  );

                  return (
                    <React.Fragment key={grn._id}>
                      <tr className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {grn.grnNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {grn.purchaseOrderId ? (
                            <Link
                              to={`/purchase-orders/${grn.purchaseOrderId._id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {grn.purchaseOrderId.poNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">
                            {grn.vendorId?.name || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground">
                          {grn.destinationWarehouseId?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground">
                          {new Date(grn.receiptDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {grn.receivedBy?.firstName} {grn.receivedBy?.lastName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs font-semibold text-emerald-600">
                            +{totalAccepted}
                          </span>
                          {totalRejected > 0 && (
                            <span className="text-xs font-semibold text-red-500 ml-1">
                              ({totalRejected} rej)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => toggleRow(grn._id)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium p-1 rounded"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Line Items */}
                      {isExpanded && (
                        <tr className="bg-secondary/10">
                          <td colSpan={8} className="p-4 border-b border-border">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>Challan: {grn.deliveryChallanNumber || 'N/A'}</span>
                                <span>Vehicle: {grn.vehicleNumber || 'N/A'}</span>
                              </div>

                              <div className="rounded-lg border border-border bg-card overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                                    <tr>
                                      <th className="py-2 px-3">Item SKU / Name</th>
                                      <th className="py-2 px-3 text-center">Delivered</th>
                                      <th className="py-2 px-3 text-center text-emerald-600">
                                        Accepted (Stock In)
                                      </th>
                                      <th className="py-2 px-3 text-center text-red-500">
                                        Rejected
                                      </th>
                                      <th className="py-2 px-3">Rejection Remarks</th>
                                      <th className="py-2 px-3 font-mono">Serial Numbers</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {grn.lineItems.map((line, lIdx) => (
                                      <tr key={lIdx}>
                                        <td className="py-2 px-3 font-medium text-foreground">
                                          {line.sku} — {line.productName}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          {line.deliveredQuantity}
                                        </td>
                                        <td className="py-2 px-3 text-center text-emerald-600 font-semibold">
                                          +{line.acceptedQuantity}
                                        </td>
                                        <td className="py-2 px-3 text-center text-red-500 font-semibold">
                                          {line.rejectedQuantity}
                                        </td>
                                        <td className="py-2 px-3 text-muted-foreground italic">
                                          {line.rejectionReason || '—'}
                                        </td>
                                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                                          {line.serialNumbers && line.serialNumbers.length > 0
                                            ? line.serialNumbers.join(', ')
                                            : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
