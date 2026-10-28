/**
 * INS Solar Business Management Software — Customer Portal Payments Page
 *
 * Self-service portal view for solar customer payments and receipts:
 * - Payment realizations and verified status
 * - Download / print operational receipts
 * - Receivables statement and active order balances
 * - Redacts confidential employee notes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Printer, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api.js';

export const CustomerPaymentsPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'RECEIVABLES'>('PAYMENTS');
  const [payments, setPayments] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (activeTab === 'PAYMENTS') {
        const res = await apiClient<any>('/customer-portal/payments');
        const data = res?.data || res;
        setPayments(data.items || []);
      } else {
        const res = await apiClient<any>('/customer-portal/payments/receivables');
        setReceivables(res?.data || res);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load customer payment records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // View Receipt
  const openReceipt = async (paymentId: string) => {
    try {
      setLoading(true);
      const res = await apiClient<any>(`/customer-portal/payments/${paymentId}/receipt`);
      setReceiptData(res?.data || res);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(`Failed to load receipt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
              <Banknote className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Payments & Receipts Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Realized payments history, printable operational receipts, and active order balances.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-muted p-1 rounded-lg border text-xs font-medium">
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'PAYMENTS'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Payment Receipts
          </button>
          <button
            onClick={() => setActiveTab('RECEIVABLES')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'RECEIVABLES'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Receivables Statement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-solar-500 mb-2" />
          <span>Loading client records...</span>
        </div>
      ) : error ? (
        <div className="bg-card border rounded-xl p-12 text-center text-destructive">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <span>{error}</span>
        </div>
      ) : activeTab === 'PAYMENTS' ? (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {payments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Banknote className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold">No payments recorded</p>
              <p className="text-xs mt-1">
                Payments made towards your solar installations will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference (UTR)</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map(p => (
                    <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-solar-600">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{p.paymentMethod}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {p.transactionReference || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatINR(p.amountPaise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'VERIFIED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openReceipt(p._id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-muted hover:bg-muted/80 rounded text-xs font-medium transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : receivables ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total Invoiced
              </span>
              <p className="text-2xl font-bold mt-1">
                {formatINR(receivables.totalOrderValuePaise)}
              </p>
            </div>
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total Realized
              </span>
              <p className="text-2xl font-bold mt-1 text-emerald-600">
                {formatINR(receivables.totalAllocatedPaise)}
              </p>
            </div>
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Advance Credit
              </span>
              <p className="text-2xl font-bold mt-1 text-amber-600">
                {formatINR(receivables.totalUnallocatedCreditPaise)}
              </p>
            </div>
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Remaining Balance
              </span>
              <p className="text-2xl font-bold mt-1 text-solar-600">
                {formatINR(receivables.totalOutstandingPaise)}
              </p>
            </div>
          </div>

          {/* Orders breakdown */}
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b bg-muted/20">
              <h3 className="font-bold text-sm">Contracted Solar Orders</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="py-2.5 px-4">Order #</th>
                    <th className="py-2.5 px-4">Order Date</th>
                    <th className="py-2.5 px-4">Capacity</th>
                    <th className="py-2.5 px-4 text-right">Order Total</th>
                    <th className="py-2.5 px-4 text-right">Paid to Date</th>
                    <th className="py-2.5 px-4 text-right">Outstanding</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {receivables.orders?.map((ord: any) => (
                    <tr key={ord._id}>
                      <td className="py-3 px-4 font-mono font-medium">{ord.orderNumber}</td>
                      <td className="py-3 px-4">
                        {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {ord.systemCapacityKwp ? `${ord.systemCapacityKwp} kWp` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">{formatINR(ord.netTotalPaise)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">
                        {formatINR(ord.allocatedAmountPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-solar-600">
                        {formatINR(ord.outstandingBalancePaise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            ord.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : ord.paymentStatus === 'PARTIALLY_PAID'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Printable Receipt Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold">{receiptData.company?.companyName}</h2>
                <p className="text-xs text-muted-foreground">Operational Payment Realization</p>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-solar-500/10 text-solar-700 rounded border border-solar-500/20">
                {receiptData.receiptNumber}
              </span>
            </div>

            <div className="my-4 p-4 bg-muted/40 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-xs text-muted-foreground">Realized Amount</span>
                <p className="text-2xl font-bold mt-0.5">{formatINR(receiptData.amountPaise)}</p>
              </div>
              <div className="text-right text-xs">
                <p>Date: {new Date(receiptData.paymentDate).toLocaleDateString('en-IN')}</p>
                <p className="font-mono mt-0.5">Mode: {receiptData.paymentMethod}</p>
              </div>
            </div>

            {receiptData.allocations?.length > 0 && (
              <div className="mb-4">
                <span className="text-xs font-bold uppercase text-muted-foreground block mb-2">
                  Order Allocations
                </span>
                <div className="border rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="py-2 px-3 text-left">Order #</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receiptData.allocations.map((a: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono">{a.orderNumber}</td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatINR(a.allocatedAmountPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Legal Notice:</p>
              <p>{receiptData.disclaimer}</p>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border rounded-lg text-xs font-medium hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
