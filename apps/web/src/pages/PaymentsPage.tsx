/**
 * INS Solar Business Management Software — Customer Payments & Receivables Register Page
 *
 * Operational receivables ledger:
 * - Customer payments intake with atomic REC sequence numbers and integer-paise financial precision
 * - Payment verification flow confirming bank realization
 * - Multi-order allocation adhering to customer boundary and order collectible ceilings
 * - Audited payment reversals (cascading allocation reversal) and unallocated fund refunds
 * - Receivables statements with 30/60/90 days aging analysis
 * - Printable operational payment receipts with legal disclaimer (non-tax invoice)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Undo2,
  Split,
  Hash,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Edit3,
  Calculator
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface PaymentAllocationItem {
  _id: string;
  allocationNumber: string;
  salesOrderId: {
    _id: string;
    orderNumber: string;
    netTotalPaise?: number;
    systemCapacityKwp?: number;
  };
  allocatedAmountPaise: number;
  allocationDate: string;
  status: string;
  reversalReason?: string;
}

interface CustomerPaymentRecord {
  _id: string;
  receiptNumber: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  status: 'RECORDED' | 'VERIFIED' | 'REVERSED' | 'REFUNDED';
  allocatedAmountPaise: number;
  unallocatedAmountPaise: number;
  refundAmountPaise?: number;
  notes?: string;
  internalNotes?: string;
  customerId: {
    _id: string;
    name: string;
    customerCode?: string;
    primaryPhone?: string;
    email?: string;
    billingAddress?: any;
    gstin?: string;
  };
  recordedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  verifiedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  verifiedAt?: string;
  verificationNotes?: string;
  reversalReason?: string;
  refundReference?: string;
  refundReason?: string;
  allocations?: PaymentAllocationItem[];
  createdAt: string;
}

interface ReceivablesStatement {
  customer: {
    _id: string;
    name: string;
    customerCode?: string;
    primaryPhone?: string;
    email?: string;
  };
  totalOrderValuePaise: number;
  totalPaidPaise: number;
  totalAllocatedPaise: number;
  totalUnallocatedCreditPaise: number;
  totalOutstandingPaise: number;
  orders: Array<{
    _id: string;
    orderNumber: string;
    orderDate?: string;
    systemCapacityKwp?: number;
    netTotalPaise: number;
    allocatedAmountPaise: number;
    outstandingBalancePaise: number;
    paymentStatus: string;
  }>;
  aging: {
    current0To30Paise: number;
    overdue31To60Paise: number;
    overdue61To90Paise: number;
    overdueAbove90Paise: number;
  };
}

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPaymentRecord | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Receivables Statement Drawer/Modal
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementData, setStatementData] = useState<ReceivablesStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const paramOrderId = searchParams.get('orderId');
  const paramCustomerId = searchParams.get('customerId');
  const paramMilestone = searchParams.get('milestone');

  // Edit Payment Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPaymentForm, setEditPaymentForm] = useState({
    id: '',
    receiptNumber: '',
    amountRupees: '',
    customerName: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    paymentDate: '',
    notes: '',
    internalNotes: ''
  });

  // 3-Stage Milestone Payment Calculator State
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneCustomerId, setMilestoneCustomerId] = useState('');
  const [milestoneOrderId, setMilestoneOrderId] = useState('');
  const [milestoneOrders, setMilestoneOrders] = useState<any[]>([]);
  const [loadingMilestoneOrders, setLoadingMilestoneOrders] = useState(false);
  const [milestoneContractTotalRupees, setMilestoneContractTotalRupees] = useState<number>(385260);
  const [isEditingMilestones, setIsEditingMilestones] = useState(false);
  const [milestoneStages, setMilestoneStages] = useState([
    {
      id: 'm1',
      name: 'Booking Advance',
      percentage: 20,
      description: 'Upon confirmation of order / token advance',
      amountRupees: 77052,
      paidRupees: 0,
      paymentMethod: 'CHEQUE',
      paymentRef: '',
      bankName: '',
      status: 'PENDING',
      notes: ''
    },
    {
      id: 'm2',
      name: 'Pre-Dispatch',
      percentage: 70,
      description: 'Prior to material dispatch from warehouse',
      amountRupees: 269682,
      paidRupees: 0,
      paymentMethod: 'BANK_TRANSFER',
      paymentRef: '',
      bankName: '',
      status: 'PENDING',
      notes: ''
    },
    {
      id: 'm3',
      name: 'Commissioning',
      percentage: 10,
      description: 'Post physical installation and net-meter testing',
      amountRupees: 38526,
      paidRupees: 0,
      paymentMethod: 'CASH',
      paymentRef: '',
      bankName: '',
      status: 'PENDING',
      notes: ''
    }
  ]);

  // Form states
  const [recordForm, setRecordForm] = useState({
    customerId: '',
    salesOrderId: '',
    amountRupees: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    notes: '',
    internalNotes: '',
    autoVerify: true,
    milestoneStage: 'NONE',
    chequeNumber: '',
    bankName: '',
    chequeDate: new Date().toISOString().split('T')[0],
    cashVoucherRef: ''
  });

  const [verifyForm, setVerifyForm] = useState({
    verificationNotes: ''
  });

  const [allocateForm, setAllocateForm] = useState({
    salesOrderId: '',
    amountRupees: '',
    notes: ''
  });

  const [reverseReason, setReverseReason] = useState('');

  const [refundForm, setRefundForm] = useState({
    refundAmountRupees: '',
    refundReference: '',
    refundReason: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Customer dropdown list for recording payments
  const [customersList, setCustomersList] = useState<
    Array<{ _id: string; name: string; customerCode?: string; primaryPhone?: string; city?: string }>
  >([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Customer orders for allocation
  const [customerOrders, setCustomerOrders] = useState<
    Array<{
      _id: string;
      orderNumber: string;
      netTotalPaise?: number;
      allocatedAmountPaise?: number;
      systemCapacityKwp?: number;
    }>
  >([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchCustomersList = async () => {
    try {
      setLoadingCustomers(true);
      const res = await apiClient<any>('/customers?limit=150');
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : res?.data || []);
      setCustomersList(
        items.map((c: any) => ({
          _id: c._id || c.id,
          name: c.name || 'Unnamed Client',
          customerCode: c.customerCode || '',
          primaryPhone: c.primaryPhone || '',
          city: c.installationAddress?.city || ''
        }))
      );
    } catch (err) {
      console.warn('Failed to load customers for payment dropdown:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchCustomerOrders = async (customerId?: string) => {
    if (!customerId) return;
    try {
      setLoadingOrders(true);
      const res = await apiClient<any>(`/orders?customerId=${customerId}&limit=50`);
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : res?.data || []);
      setCustomerOrders(items);
    } catch (err) {
      console.warn('Failed to load customer orders:', err);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleContractTotalChange = (newTotal: number) => {
    setMilestoneContractTotalRupees(newTotal);
    setMilestoneStages(prev =>
      prev.map(stage => {
        const amt = Math.round((newTotal * stage.percentage) / 100);
        return {
          ...stage,
          amountRupees: amt,
          status: stage.paidRupees >= amt ? 'PAID' : stage.paidRupees > 0 ? 'PARTIALLY_PAID' : 'PENDING'
        };
      })
    );
  };

  const handleUpdateMilestoneStage = (index: number, field: string, val: any) => {
    setMilestoneStages(prev => {
      const next = [...prev];
      const target = { ...next[index]! };
      if (field === 'percentage') {
        const pct = Math.max(0, Math.min(100, Number(val) || 0));
        target.percentage = pct;
        target.amountRupees = Math.round((milestoneContractTotalRupees * pct) / 100);
      } else if (field === 'amountRupees') {
        const amt = Math.max(0, Number(val) || 0);
        target.amountRupees = amt;
        target.percentage = milestoneContractTotalRupees > 0 ? Math.round((amt / milestoneContractTotalRupees) * 100) : 0;
      } else if (field === 'paidRupees') {
        target.paidRupees = Math.max(0, Number(val) || 0);
      } else {
        (target as any)[field] = val;
      }
      target.status = target.paidRupees >= target.amountRupees ? 'PAID' : target.paidRupees > 0 ? 'PARTIALLY_PAID' : 'PENDING';
      next[index] = target;
      return next;
    });
  };

  const syncMilestonesWithOrder = async (orderId: string) => {
    if (!orderId) return;
    try {
      setLoadingMilestoneOrders(true);
      const res = await apiClient<any>(`/payments/receivables/orders/${orderId}`);
      if (!res) return;

      const order = res.order;
      const orderTotalRupees = Math.round((res.orderTotalPaise || order?.netTotalPaise || 0) / 100);
      const totalAllocatedRupees = Math.round((res.allocatedAmountPaise || 0) / 100);
      const activeAllocations = res.activeAllocations || [];

      setMilestoneContractTotalRupees(orderTotalRupees);

      const milestones = (order?.paymentMilestones && order.paymentMilestones.length > 0)
        ? order.paymentMilestones
        : [
            { name: 'Booking Advance', percentage: 20, description: 'Upon confirmation of order / token advance' },
            { name: 'Pre-Dispatch', percentage: 70, description: 'Prior to material dispatch from warehouse' },
            { name: 'Commissioning', percentage: 10, description: 'Post physical installation and net-meter testing' }
          ];

      let remainingAllocated = totalAllocatedRupees;

      const syncedStages = milestones.map((m: any, idx: number) => {
        const targetAmt = Math.round((orderTotalRupees * m.percentage) / 100);
        const paidForThisStage = Math.min(targetAmt, Math.max(0, remainingAllocated));
        remainingAllocated -= paidForThisStage;

        const alloc = activeAllocations[idx];
        const paymentRec = alloc?.paymentId;

        return {
          id: `m${idx + 1}`,
          name: m.name || `Milestone ${idx + 1}`,
          percentage: m.percentage,
          description: m.description || '',
          amountRupees: targetAmt,
          paidRupees: paidForThisStage,
          paymentMethod: paymentRec?.paymentMethod || (idx === 0 ? 'CHEQUE' : idx === 1 ? 'BANK_TRANSFER' : 'CASH'),
          paymentRef: paymentRec?.transactionReference || (paymentRec?.receiptNumber ? `REC: ${paymentRec.receiptNumber}` : ''),
          bankName: '',
          status: paidForThisStage >= targetAmt && targetAmt > 0 ? 'PAID' : paidForThisStage > 0 ? 'PARTIALLY_PAID' : 'PENDING',
          notes: ''
        };
      });

      setMilestoneStages(syncedStages);
    } catch (err) {
      console.warn('Failed to sync milestones with order:', err);
    } finally {
      setLoadingMilestoneOrders(false);
    }
  };

  const handleMilestoneCustomerChange = async (cId: string) => {
    setMilestoneCustomerId(cId);
    setMilestoneOrderId('');
    if (!cId) {
      setMilestoneOrders([]);
      return;
    }
    try {
      setLoadingMilestoneOrders(true);
      const res = await apiClient<any>(`/orders?customerId=${cId}&limit=20`);
      const list = res?.items || res?.data?.items || (Array.isArray(res) ? res : res?.data || []);
      setMilestoneOrders(list);
      if (list.length > 0) {
        const firstOrder = list[0];
        setMilestoneOrderId(firstOrder._id);
        await syncMilestonesWithOrder(firstOrder._id);
      } else {
        setMilestoneStages(prev =>
          prev.map(s => ({
            ...s,
            paidRupees: 0,
            status: 'PENDING'
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load milestone orders:', err);
    } finally {
      setLoadingMilestoneOrders(false);
    }
  };

  const handleQuickRecordMilestone = (stage: (typeof milestoneStages)[0], index: number) => {
    const remainingDue = Math.max(0, stage.amountRupees - stage.paidRupees);
    setRecordForm({
      customerId: milestoneCustomerId || (customersList[0]?._id || ''),
      salesOrderId: milestoneOrderId || '',
      amountRupees: remainingDue > 0 ? remainingDue.toString() : stage.amountRupees.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: stage.paymentMethod,
      transactionReference: stage.paymentRef || (stage.paymentMethod === 'CHEQUE' ? 'CHQ-' : stage.paymentMethod === 'CASH' ? 'CASH-REC-' : 'UTR-'),
      notes: `Milestone ${index + 1}: ${stage.name} (${stage.percentage}%) - ${stage.description}`,
      internalNotes: `Auto-generated from 3-Stage Milestone Payment Calculator. Bank/Ref: ${stage.bankName || stage.paymentRef}`,
      autoVerify: true,
      milestoneStage: `MILESTONE_${index + 1}`,
      chequeNumber: stage.paymentMethod === 'CHEQUE' ? stage.paymentRef : '',
      bankName: stage.bankName || '',
      chequeDate: new Date().toISOString().split('T')[0],
      cashVoucherRef: stage.paymentMethod === 'CASH' ? stage.paymentRef : ''
    });
    setShowMilestoneModal(false);
    setShowRecordModal(true);
  };

  const handleOpenEditPayment = (p: CustomerPaymentRecord) => {
    setEditPaymentForm({
      id: p._id,
      receiptNumber: p.receiptNumber,
      amountRupees: (p.amountPaise / 100).toFixed(2),
      customerName: p.customerId?.name || 'Client',
      paymentMethod: p.paymentMethod || 'BANK_TRANSFER',
      transactionReference: p.transactionReference || '',
      paymentDate: p.paymentDate ? (new Date(p.paymentDate).toISOString().split('T')[0] ?? '') : '',
      notes: p.notes || '',
      internalNotes: p.internalNotes || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentForm.id) return;
    try {
      setSubmitting(true);
      await apiClient(`/payments/${editPaymentForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paymentMethod: editPaymentForm.paymentMethod,
          transactionReference: editPaymentForm.transactionReference.trim() || undefined,
          paymentDate: editPaymentForm.paymentDate ? new Date(editPaymentForm.paymentDate) : undefined,
          notes: editPaymentForm.notes.trim() || undefined,
          internalNotes: editPaymentForm.internalNotes.trim() || undefined
        })
      });
      setShowEditModal(false);
      fetchPayments();
    } catch (err: any) {
      alert(`Failed to update payment: ${err.message || 'Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCustomersList();
  }, []);

  // Handle URL navigation params (orderId, customerId from Sales Order / Admin)
  useEffect(() => {
    if (paramCustomerId) {
      setMilestoneCustomerId(paramCustomerId);
      fetchCustomerOrders(paramCustomerId);
      apiClient<any>(`/orders?customerId=${paramCustomerId}&limit=20`)
        .then(res => {
          const list = res?.items || res?.data?.items || (Array.isArray(res) ? res : res?.data || []);
          setMilestoneOrders(list);
          const targetOrderId = paramOrderId || list[0]?._id;
          if (targetOrderId) {
            setMilestoneOrderId(targetOrderId);
            syncMilestonesWithOrder(targetOrderId);
          }
          if (paramMilestone) {
            const mIdx = Math.max(0, parseInt(paramMilestone, 10) - 1);
            const stage = milestoneStages[mIdx] || milestoneStages[0];
            if (stage) {
              setTimeout(() => handleQuickRecordMilestone(stage, mIdx), 200);
            }
          } else {
            setShowMilestoneModal(true);
          }
        })
        .catch(console.warn);
    } else if (paramOrderId) {
      setMilestoneOrderId(paramOrderId);
      syncMilestonesWithOrder(paramOrderId);
      setShowMilestoneModal(true);
    }
  }, [paramCustomerId, paramOrderId, paramMilestone]);

  // Fetch payments list
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (statusFilter) params.append('status', statusFilter);
      if (methodFilter) params.append('paymentMethod', methodFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await apiClient<any>(`/payments?${params.toString()}`);
      const data = res?.data || res;
      setPayments(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer payments.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, searchTerm]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const amountPaise = Math.round(parseFloat(recordForm.amountRupees) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        alert('Please enter a valid positive payment amount.');
        return;
      }

      let resolvedRef = recordForm.transactionReference.trim();
      if (!resolvedRef) {
        if (recordForm.paymentMethod === 'CHEQUE' && recordForm.chequeNumber.trim()) {
          resolvedRef = `CHQ: ${recordForm.chequeNumber.trim()}${recordForm.bankName.trim() ? ` (${recordForm.bankName.trim()})` : ''}`;
        } else if (recordForm.paymentMethod === 'CASH' && recordForm.cashVoucherRef.trim()) {
          resolvedRef = `CASH: ${recordForm.cashVoucherRef.trim()}`;
        }
      }

      const createdRes: any = await apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: recordForm.customerId.trim(),
          amountPaise,
          paymentDate: recordForm.paymentDate ? new Date(recordForm.paymentDate) : new Date(),
          paymentMethod: recordForm.paymentMethod,
          transactionReference: resolvedRef || undefined,
          notes: recordForm.notes.trim() || undefined,
          internalNotes: recordForm.internalNotes.trim() || undefined,
          autoVerify: recordForm.autoVerify
        })
      });

      const pData = createdRes?.data || createdRes;

      // Automatically allocate to the linked Sales Order!
      if (pData?._id && recordForm.salesOrderId && recordForm.autoVerify) {
        try {
          await apiClient(`/payments/${pData._id}/allocate`, {
            method: 'POST',
            body: JSON.stringify({
              salesOrderId: recordForm.salesOrderId,
              allocatedAmountPaise: amountPaise,
              notes: recordForm.notes || 'Milestone payment allocation'
            })
          });
        } catch (allocErr) {
          console.warn('Auto-allocation to order skipped:', allocErr);
        }
      }

      if (recordForm.salesOrderId) {
        syncMilestonesWithOrder(recordForm.salesOrderId);
      }

      setShowRecordModal(false);
      setRecordForm({
        customerId: '',
        salesOrderId: '',
        amountRupees: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: '',
        notes: '',
        internalNotes: '',
        autoVerify: true,
        milestoneStage: 'NONE',
        chequeNumber: '',
        bankName: '',
        chequeDate: new Date().toISOString().split('T')[0],
        cashVoucherRef: ''
      });
      fetchPayments();
    } catch (err: any) {
      alert(`Error recording payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Verify Payment
  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      await apiClient(`/payments/${selectedPayment._id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationNotes: verifyForm.verificationNotes.trim() || undefined
        })
      });
      setShowVerifyModal(false);
      setSelectedPayment(null);
      setVerifyForm({ verificationNotes: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error verifying payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Allocate Payment
  const handleAllocatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      const allocatedAmountPaise = Math.round(parseFloat(allocateForm.amountRupees) * 100);
      if (isNaN(allocatedAmountPaise) || allocatedAmountPaise <= 0) {
        alert('Please enter a valid positive allocation amount.');
        return;
      }

      await apiClient(`/payments/${selectedPayment._id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: allocateForm.salesOrderId.trim(),
          allocatedAmountPaise,
          notes: allocateForm.notes.trim() || undefined
        })
      });

      setShowAllocateModal(false);
      setSelectedPayment(null);
      setAllocateForm({ salesOrderId: '', amountRupees: '', notes: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error allocating payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reverse Payment
  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    if (!reverseReason.trim()) {
      alert('Please provide a mandatory reason for reversing this payment.');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient(`/payments/${selectedPayment._id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({
          reversalReason: reverseReason.trim()
        })
      });
      setShowReverseModal(false);
      setSelectedPayment(null);
      setReverseReason('');
      fetchPayments();
    } catch (err: any) {
      alert(`Error reversing payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Refund Payment
  const handleRefundPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      const refundAmountPaise = Math.round(parseFloat(refundForm.refundAmountRupees) * 100);
      if (isNaN(refundAmountPaise) || refundAmountPaise <= 0) {
        alert('Please enter a valid positive refund amount.');
        return;
      }

      await apiClient(`/payments/${selectedPayment._id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          refundAmountPaise,
          refundReference: refundForm.refundReference.trim(),
          refundReason: refundForm.refundReason.trim()
        })
      });

      setShowRefundModal(false);
      setSelectedPayment(null);
      setRefundForm({ refundAmountRupees: '', refundReference: '', refundReason: '' });
      fetchPayments();
    } catch (err: any) {
      alert(`Error processing refund: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // View Operational Receipt
  const openReceiptModal = async (paymentId: string) => {
    try {
      setLoading(true);
      const res = await apiClient<any>(`/payments/${paymentId}/receipt`);
      setReceiptData(res?.data || res);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(`Failed to load receipt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // View Customer Receivables Statement
  const openCustomerStatement = async (customerId: string) => {
    try {
      setStatementLoading(true);
      setShowStatementModal(true);
      const res = await apiClient<any>(`/payments/receivables/customers/${customerId}`);
      setStatementData(res?.data || res);
    } catch (err: any) {
      alert(`Failed to load customer receivables statement: ${err.message}`);
      setShowStatementModal(false);
    } finally {
      setStatementLoading(false);
    }
  };

  // Format INR Currency
  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  // KPI Calculations
  const totalVerifiedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.amountPaise || 0), 0);

  const totalUnallocatedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.unallocatedAmountPaise || 0), 0);

  const totalAllocatedPaise = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.allocatedAmountPaise || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-xl p-6 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
              <Banknote className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center">
              <span>Customer Payments & Receivables Ledger</span>
              <span className="text-xs ml-2.5 px-2 py-0.5 rounded font-semibold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
                Accounts & Receivables
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Customer advance intake, milestone receipts, bank realization verification, and
            receivables aging schedule.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowMilestoneModal(true)}
            className="flex items-center space-x-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border px-3.5 py-2 rounded-lg font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Calculate and reconcile 3-stage milestone payments (Booking Advance, Pre-Dispatch, Commissioning)"
          >
            <Clock className="w-3.5 h-3.5 text-solar-500" />
            <span>3-Stage Milestone Calculator</span>
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center space-x-1.5 bg-solar-600 hover:bg-solar-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Realized Collections
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{formatINR(totalVerifiedPaise)}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Active realized customer funds
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Allocated to Orders
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Split className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatINR(totalAllocatedPaise)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Applied towards sales milestones
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unallocated Credits
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatINR(totalUnallocatedPaise)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Available for future allocations or refund
          </span>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Ledger Records
            </span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{total}</p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Payments & adjustments on register
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card border rounded-xl p-4 shadow-sm items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search receipt #, customer, UTR..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="">All Statuses</option>
            <option value="RECORDED">RECORDED (Draft/Pending)</option>
            <option value="VERIFIED">VERIFIED (Realized)</option>
            <option value="REVERSED">REVERSED (Bounced/Void)</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>

          <select
            value={methodFilter}
            onChange={e => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="NEFT_RTGS">Direct RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="CASH">Cash</option>
            <option value="PAYMENT_GATEWAY">Payment Gateway</option>
            <option value="DEMAND_DRAFT">Demand Draft</option>
          </select>

          <button
            onClick={() => fetchPayments()}
            className="p-2 border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh payments list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mr-2 text-solar-500" />
            <span>Loading payments ledger...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-12 text-destructive">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            <Banknote className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold">No customer payment records found</p>
            <p className="text-sm mt-1">
              Record inbound customer advances, milestones, or filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Date & Method</th>
                  <th className="py-3.5 px-4">Transaction Ref</th>
                  <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                  <th className="py-3.5 px-4 text-center">Allocation Quota</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {payments.map(payment => {
                  const isVerified = payment.status === 'VERIFIED';
                  const isRecorded = payment.status === 'RECORDED';
                  const isReversed = payment.status === 'REVERSED';
                  const isRefunded = payment.status === 'REFUNDED';
                  const hasUnallocated = (payment.unallocatedAmountPaise || 0) > 0;

                  return (
                    <tr key={payment._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-solar-600">
                        {payment.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {payment.customerId?.name || 'Customer'}
                          </p>
                          <button
                            onClick={() => openCustomerStatement(payment.customerId?._id)}
                            className="text-xs text-solar-600 hover:underline flex items-center mt-0.5"
                          >
                            <span>Statement</span>
                            <ArrowUpRight className="w-3 h-3 ml-0.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-medium text-foreground">{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                          <span className="text-[11px] font-semibold text-foreground px-1.5 py-0.5 rounded bg-muted/60 w-fit">
                            {payment.paymentMethod === 'CHEQUE'
                              ? '🏦 Cheque'
                              : payment.paymentMethod === 'CASH'
                                ? '💵 Cash'
                                : payment.paymentMethod === 'UPI'
                                  ? '📱 UPI'
                                  : '🏛️ ' + payment.paymentMethod.replace(/_/g, ' ')}
                          </span>
                          {payment.notes && (payment.notes.includes('Milestone') || payment.notes.includes('Advance') || payment.notes.includes('Dispatch') || payment.notes.includes('Commissioning')) && (
                            <span className="text-[10px] text-solar-700 dark:text-solar-400 font-semibold truncate max-w-[170px]" title={payment.notes}>
                              {payment.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {payment.transactionReference || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium">
                        {formatINR(payment.amountPaise)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs text-emerald-600 font-medium">
                            Alloc: {formatINR(payment.allocatedAmountPaise)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Unalloc: {formatINR(payment.unallocatedAmountPaise)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : isRecorded
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : isRefunded
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Receipt view */}
                          <button
                            onClick={() => openReceiptModal(payment._id)}
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit payment metadata */}
                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPayment(payment)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-solar-600 cursor-pointer"
                              title="Edit Payment Details (Method, Ref, Date, Notes)"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Verify Button (if RECORDED) */}
                          {isRecorded && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowVerifyModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                              title="Verify Bank Realization"
                            >
                              Verify
                            </button>
                          )}

                          {/* Allocate Button (if VERIFIED and has unallocated) */}
                          {isVerified && hasUnallocated && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setAllocateForm({
                                  salesOrderId: '',
                                  amountRupees: (payment.unallocatedAmountPaise / 100).toFixed(2),
                                  notes: ''
                                });
                                fetchCustomerOrders(payment.customerId?._id);
                                setShowAllocateModal(true);
                              }}
                              className="px-2 py-1 bg-solar-600 hover:bg-solar-700 text-white rounded text-xs font-medium transition-colors"
                              title="Allocate to Order"
                            >
                              Allocate
                            </button>
                          )}

                          {/* Reverse Button */}
                          {!isReversed && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setReverseReason('');
                                setShowReverseModal(true);
                              }}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded"
                              title="Reverse Payment"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Refund Button (if VERIFIED and has unallocated) */}
                          {isVerified && hasUnallocated && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRefundForm({
                                  refundAmountRupees: (
                                    payment.unallocatedAmountPaise / 100
                                  ).toFixed(2),
                                  refundReference: '',
                                  refundReason: ''
                                });
                                setShowRefundModal(true);
                              }}
                              className="p-1.5 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 rounded"
                              title="Refund Unallocated Funds"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
              payments
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Record Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Record Customer Payment</h2>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold">
                    Select Customer / Client <span className="text-destructive">*</span>
                  </label>
                  {loadingCustomers && (
                    <span className="text-[10px] text-muted-foreground flex items-center">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin mr-1" /> Loading clients...
                    </span>
                  )}
                </div>
                {customersList.length > 0 ? (
                  <select
                    required
                    value={recordForm.customerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setRecordForm({ ...recordForm, customerId: cId });
                      if (cId) fetchCustomerOrders(cId);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="">-- Choose Client from Directory --</option>
                    {customersList.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.customerCode ? `(${c.customerCode})` : ''} {c.city ? `• ${c.city}` : ''} {c.primaryPhone ? `• 📞 ${c.primaryPhone}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter Customer Code (e.g. CUST-2026-00001) or ID"
                    value={recordForm.customerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setRecordForm({ ...recordForm, customerId: cId });
                      if (cId) fetchCustomerOrders(cId);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                )}
                <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                  <span>Client will be credited and an official receipt generated.</span>
                  {customersList.length > 0 && <span>{customersList.length} clients available</span>}
                </div>
              </div>

              {/* Sales Order Selection */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Link to Sales Order <span className="text-muted-foreground font-normal">(Instant ledger credit)</span>
                </label>
                <select
                  value={recordForm.salesOrderId}
                  onChange={e => {
                    const oId = e.target.value;
                    setRecordForm({ ...recordForm, salesOrderId: oId });
                    if (oId) syncMilestonesWithOrder(oId);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                >
                  <option value="">-- No Order Linked (Unallocated Credit) --</option>
                  {(customerOrders.length > 0 ? customerOrders : milestoneOrders).map(o => (
                    <option key={o._id} value={o._id}>
                      {o.orderNumber} • {o.systemCapacityKwp || 0} kWp RTS
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Milestone Quick Selector */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center justify-between">
                  <span>Solar Project Milestone Stage</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Auto-sets amount & stage note</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const m1 = milestoneStages[0];
                      const rem = m1 ? Math.max(0, m1.amountRupees - m1.paidRupees) : 0;
                      setRecordForm({
                        ...recordForm,
                        milestoneStage: 'MILESTONE_1',
                        amountRupees: rem > 0 ? rem.toString() : m1 ? m1.amountRupees.toString() : recordForm.amountRupees,
                        notes: 'Milestone 1: Booking Advance (20%) - Order confirmation'
                      });
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      recordForm.milestoneStage === 'MILESTONE_1'
                        ? 'bg-solar-500/10 border-solar-500 text-solar-700 dark:text-solar-300 ring-2 ring-solar-500/20'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Stage 1 (20%)</div>
                    <div className="text-xs font-semibold text-foreground truncate">Booking Advance</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const m2 = milestoneStages[1];
                      const rem = m2 ? Math.max(0, m2.amountRupees - m2.paidRupees) : 0;
                      setRecordForm({
                        ...recordForm,
                        milestoneStage: 'MILESTONE_2',
                        amountRupees: rem > 0 ? rem.toString() : m2 ? m2.amountRupees.toString() : recordForm.amountRupees,
                        notes: 'Milestone 2: Pre-Dispatch (70%) - Prior to warehouse dispatch'
                      });
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      recordForm.milestoneStage === 'MILESTONE_2'
                        ? 'bg-solar-500/10 border-solar-500 text-solar-700 dark:text-solar-300 ring-2 ring-solar-500/20'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Stage 2 (70%)</div>
                    <div className="text-xs font-semibold text-foreground truncate">Pre-Dispatch</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const m3 = milestoneStages[2];
                      const rem = m3 ? Math.max(0, m3.amountRupees - m3.paidRupees) : 0;
                      setRecordForm({
                        ...recordForm,
                        milestoneStage: 'MILESTONE_3',
                        amountRupees: rem > 0 ? rem.toString() : m3 ? m3.amountRupees.toString() : recordForm.amountRupees,
                        notes: 'Milestone 3: Commissioning (10%) - Post net-meter testing'
                      });
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      recordForm.milestoneStage === 'MILESTONE_3'
                        ? 'bg-solar-500/10 border-solar-500 text-solar-700 dark:text-solar-300 ring-2 ring-solar-500/20'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Stage 3 (10%)</div>
                    <div className="text-xs font-semibold text-foreground truncate">Commissioning</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordForm({ ...recordForm, milestoneStage: 'NONE' })}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      recordForm.milestoneStage === 'NONE'
                        ? 'bg-solar-500/10 border-solar-500 text-solar-700 dark:text-solar-300 ring-2 ring-solar-500/20'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Ad-hoc</div>
                    <div className="text-xs font-semibold text-foreground truncate">Other / Lump-sum</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Amount (INR ₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000.00"
                    value={recordForm.amountRupees}
                    onChange={e => setRecordForm({ ...recordForm, amountRupees: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Payment Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.paymentDate}
                    onChange={e => setRecordForm({ ...recordForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    value={recordForm.paymentMethod}
                    onChange={e => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="NEFT_RTGS">Direct RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYMENT_GATEWAY">Payment Gateway</option>
                    <option value="DEMAND_DRAFT">Demand Draft</option>
                  </select>
                </div>

                {recordForm.paymentMethod === 'CHEQUE' ? (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Cheque Number <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 881920"
                      value={recordForm.chequeNumber}
                      onChange={e => setRecordForm({ ...recordForm, chequeNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                    />
                  </div>
                ) : recordForm.paymentMethod === 'CASH' ? (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Cash Receipt / Voucher Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. CASH-VOUCHER-102"
                      value={recordForm.cashVoucherRef}
                      onChange={e => setRecordForm({ ...recordForm, cashVoucherRef: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Transaction Ref / UTR</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR20261025..."
                      value={recordForm.transactionReference}
                      onChange={e =>
                        setRecordForm({ ...recordForm, transactionReference: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                    />
                  </div>
                )}
              </div>

              {/* Conditional Cheque Bank & Date fields */}
              {recordForm.paymentMethod === 'CHEQUE' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 border border-border/80 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Drawee Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India, HDFC"
                      value={recordForm.bankName}
                      onChange={e => setRecordForm({ ...recordForm, bankName: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Cheque Issue Date</label>
                    <input
                      type="date"
                      value={recordForm.chequeDate}
                      onChange={e => setRecordForm({ ...recordForm, chequeDate: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Public Notes (Included on Receipt)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Milestone 1 advance for rooftop solar installation"
                  value={recordForm.notes}
                  onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Confidential Internal Notes{' '}
                  <span className="text-muted-foreground font-normal">(Staff Only)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal audit notes, bank account matching details..."
                  value={recordForm.internalNotes}
                  onChange={e => setRecordForm({ ...recordForm, internalNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="autoVerify"
                  checked={recordForm.autoVerify}
                  onChange={e => setRecordForm({ ...recordForm, autoVerify: e.target.checked })}
                  className="rounded text-solar-600 focus:ring-solar-500"
                />
                <label htmlFor="autoVerify" className="text-xs font-medium cursor-pointer">
                  Auto-Verify on recording (funds already credited in company bank account)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Verify Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showVerifyModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">Verify Customer Payment</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Confirm bank clearance for receipt{' '}
              <strong className="font-mono text-foreground">{selectedPayment.receiptNumber}</strong>{' '}
              of {formatINR(selectedPayment.amountPaise)}.
            </p>

            <form onSubmit={handleVerifyPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Verification Clearance Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Bank statement line matched on 27-Oct-2026 at 11:30 AM"
                  value={verifyForm.verificationNotes}
                  onChange={e => setVerifyForm({ verificationNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Verifying...' : 'Confirm Realization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Allocate Payment to Order */}
      {/* ------------------------------------------------------------- */}
      {showAllocateModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">Allocate Funds to Sales Order</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receipt:{' '}
              <span className="font-mono text-foreground font-semibold">
                {selectedPayment.receiptNumber}
              </span>{' '}
              | Available Unallocated:{' '}
              <span className="text-emerald-600 font-semibold">
                {formatINR(selectedPayment.unallocatedAmountPaise)}
              </span>
            </p>

            <form onSubmit={handleAllocatePayment} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold">
                    Select Sales Order <span className="text-destructive">*</span>
                  </label>
                  {loadingOrders && (
                    <span className="text-[10px] text-muted-foreground flex items-center">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin mr-1" /> Loading orders...
                    </span>
                  )}
                </div>
                {customerOrders.length > 0 ? (
                  <select
                    required
                    value={allocateForm.salesOrderId}
                    onChange={e => setAllocateForm({ ...allocateForm, salesOrderId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="">-- Choose Sales Order --</option>
                    {customerOrders.map(o => {
                      const balance = Math.max(0, (o.netTotalPaise || 0) - (o.allocatedAmountPaise || 0));
                      return (
                        <option key={o._id} value={o._id}>
                          {o.orderNumber} • {o.systemCapacityKwp || 0} kWp RTS • Outstanding: ₹{(balance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter Sales Order Code or ID"
                    value={allocateForm.salesOrderId}
                    onChange={e => setAllocateForm({ ...allocateForm, salesOrderId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                )}
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Customer: <strong>{selectedPayment.customerId?.name || 'Client'}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Allocation Amount (INR ₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(selectedPayment.unallocatedAmountPaise / 100).toFixed(2)}
                  required
                  value={allocateForm.amountRupees}
                  onChange={e => setAllocateForm({ ...allocateForm, amountRupees: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Allocation Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Milestone 1 solar inverter dispatch advance"
                  value={allocateForm.notes}
                  onChange={e => setAllocateForm({ ...allocateForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Allocating...' : 'Allocate Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Reverse Payment Modal */}
      {/* ------------------------------------------------------------- */}
      {showReverseModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-2 text-destructive mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-lg font-bold">Reverse Customer Payment</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Reversing receipt{' '}
              <strong className="font-mono text-foreground">{selectedPayment.receiptNumber}</strong>{' '}
              will automatically <strong>cascade-reverse all active order allocations</strong> and
              restore order outstanding balances.
            </p>

            <form onSubmit={handleReversePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Mandatory Reversal Audit Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Cheque returned unpaid due to signature mismatch..."
                  value={reverseReason}
                  onChange={e => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: Refund Unallocated Funds Modal */}
      {/* ------------------------------------------------------------- */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">Refund Unallocated Credit</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receipt:{' '}
              <span className="font-mono font-semibold text-foreground">
                {selectedPayment.receiptNumber}
              </span>{' '}
              | Maximum Available:{' '}
              <strong className="text-emerald-600">
                {formatINR(selectedPayment.unallocatedAmountPaise)}
              </strong>
            </p>

            <form onSubmit={handleRefundPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Amount (INR ₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(selectedPayment.unallocatedAmountPaise / 100).toFixed(2)}
                  required
                  value={refundForm.refundAmountRupees}
                  onChange={e =>
                    setRefundForm({ ...refundForm, refundAmountRupees: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Reference / Bank UTR <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC-OUT-991203..."
                  value={refundForm.refundReference}
                  onChange={e => setRefundForm({ ...refundForm, refundReference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Refund Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Customer cancelled grid tie application..."
                  value={refundForm.refundReason}
                  onChange={e => setRefundForm({ ...refundForm, refundReason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Processing...' : 'Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: Printable Operational Payment Receipt */}
      {/* ------------------------------------------------------------- */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-2xl w-full p-8 shadow-2xl max-h-[95vh] overflow-y-auto">
            {/* Header & Print Action */}
            <div className="flex justify-between items-start pb-6 border-b">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-solar-500/10 rounded-lg text-solar-600">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">
                      {receiptData.company?.companyName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {receiptData.company?.legalEntityName}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                  <p>
                    GSTIN: <span className="font-mono">{receiptData.company?.gstin}</span> | PAN:{' '}
                    <span className="font-mono">{receiptData.company?.pan}</span>
                  </p>
                  <p>
                    Email: {receiptData.company?.contactEmail} | Phone:{' '}
                    {receiptData.company?.contactPhone}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-solar-500/10 text-solar-700 dark:text-solar-300 font-mono text-xs font-bold rounded-lg border border-solar-500/20">
                  {receiptData.receiptNumber}
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  Date: {new Date(receiptData.paymentDate).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b text-xs">
              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                  Received From (Customer)
                </span>
                <p className="font-bold text-sm text-foreground mt-0.5">
                  {receiptData.customer?.name}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {receiptData.customer?.primaryPhone || '—'}
                </p>
                <p className="text-muted-foreground">{receiptData.customer?.email || '—'}</p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                  Payment Mode & Reference
                </span>
                <p className="font-medium text-foreground mt-0.5">{receiptData.paymentMethod}</p>
                <p className="font-mono text-muted-foreground mt-0.5">
                  Ref: {receiptData.transactionReference || 'N/A'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-semibold">
                  Status: {receiptData.status}
                </span>
              </div>
            </div>

            {/* Realized Amount Block */}
            <div className="my-6 p-4 bg-muted/30 border rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Total Realized Amount
                </span>
                <p className="text-3xl font-extrabold text-foreground mt-0.5">
                  {formatINR(receiptData.amountPaise)}
                </p>
              </div>
              <div className="text-right text-xs space-y-1">
                <p>
                  Allocated:{' '}
                  <strong className="text-emerald-600">
                    {formatINR(receiptData.allocatedAmountPaise)}
                  </strong>
                </p>
                <p>
                  Unallocated Credit:{' '}
                  <strong className="text-amber-600">
                    {formatINR(receiptData.unallocatedAmountPaise)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Allocations Breakdown */}
            {receiptData.allocations?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Sales Order Allocations
                </h4>
                <div className="border rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-left">Allocation #</th>
                        <th className="py-2 px-3 text-left">Sales Order</th>
                        <th className="py-2 px-3 text-left">Plant Sizing</th>
                        <th className="py-2 px-3 text-right">Allocated (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receiptData.allocations.map((a: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono">{a.allocationNumber}</td>
                          <td className="py-2 px-3 font-mono font-medium">{a.orderNumber}</td>
                          <td className="py-2 px-3">
                            {a.systemCapacityKwp ? `${a.systemCapacityKwp} kWp` : '—'}
                          </td>
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

            {/* Notes */}
            {receiptData.notes && (
              <div className="mb-4 text-xs">
                <span className="font-semibold text-muted-foreground">Notes:</span>
                <p className="text-foreground mt-0.5 italic">{receiptData.notes}</p>
              </div>
            )}

            {/* Operational Legal Disclaimer */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Notice of Fund Realization:</p>
              <p>{receiptData.disclaimer}</p>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 7: Receivables Statement & Aging Breakdown */}
      {/* ------------------------------------------------------------- */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold">Customer Receivables & Aging Statement</h2>
                {statementData?.customer && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Customer:{' '}
                    <strong className="text-foreground">{statementData.customer.name}</strong> (
                    {statementData.customer.customerCode || 'N/A'})
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowStatementModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            {statementLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-solar-500 mb-2" />
                <span>Generating receivables statement...</span>
              </div>
            ) : statementData ? (
              <div className="space-y-6 mt-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Total Invoiced
                    </span>
                    <p className="text-lg font-bold mt-1 text-foreground">
                      {formatINR(statementData.totalOrderValuePaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Total Realized
                    </span>
                    <p className="text-lg font-bold mt-1 text-emerald-600">
                      {formatINR(statementData.totalAllocatedPaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Unallocated Credit
                    </span>
                    <p className="text-lg font-bold mt-1 text-amber-600">
                      {formatINR(statementData.totalUnallocatedCreditPaise)}
                    </p>
                  </div>
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Net Outstanding
                    </span>
                    <p className="text-lg font-bold mt-1 text-destructive">
                      {formatINR(statementData.totalOutstandingPaise)}
                    </p>
                  </div>
                </div>

                {/* Aging Buckets */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Receivables Aging Analysis
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        Current (0–30 Days)
                      </span>
                      <strong className="text-sm text-emerald-700 dark:text-emerald-300">
                        {formatINR(statementData.aging?.current0To30Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        31–60 Days Overdue
                      </span>
                      <strong className="text-sm text-amber-700 dark:text-amber-300">
                        {formatINR(statementData.aging?.overdue31To60Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        61–90 Days Overdue
                      </span>
                      <strong className="text-sm text-orange-700 dark:text-orange-300">
                        {formatINR(statementData.aging?.overdue61To90Paise)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">
                        &gt;90 Days Overdue
                      </span>
                      <strong className="text-sm text-destructive">
                        {formatINR(statementData.aging?.overdueAbove90Paise)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Orders Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Contracted Orders Balance
                  </h4>
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b text-muted-foreground">
                        <tr>
                          <th className="py-2 px-3 text-left">Order #</th>
                          <th className="py-2 px-3 text-left">Order Date</th>
                          <th className="py-2 px-3 text-right">Order Total</th>
                          <th className="py-2 px-3 text-right">Allocated</th>
                          <th className="py-2 px-3 text-right">Outstanding</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {statementData.orders?.map(order => (
                          <tr key={order._id}>
                            <td className="py-2 px-3 font-mono font-medium">{order.orderNumber}</td>
                            <td className="py-2 px-3">
                              {order.orderDate
                                ? new Date(order.orderDate).toLocaleDateString('en-IN')
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatINR(order.netTotalPaise)}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-600">
                              {formatINR(order.allocatedAmountPaise)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-destructive">
                              {formatINR(order.outstandingBalancePaise)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  order.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : order.paymentStatus === 'PARTIALLY_PAID'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {order.paymentStatus}
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

            <div className="flex justify-end pt-4 border-t mt-6">
              <button
                type="button"
                onClick={() => setShowStatementModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 8: 3-Stage Milestone Payment Calculator & Reconciliation */}
      {/* ------------------------------------------------------------- */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-solar-500/10 text-solar-600">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    PAYMENT MILESTONES & COMMERCIAL CONDITIONS
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-9">
                  Standard Solar EPC 3-stage billing: 20% Booking Advance, 70% Pre-Dispatch, 10% Handover / Commissioning with live multi-mode calculation (Cheque / Cash / Bank Transfer).
                </p>
              </div>
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="text-muted-foreground hover:text-foreground text-base p-1.5 rounded-md hover:bg-muted font-medium cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Client & Contract Value Selector Bar */}
              <div className="p-4 bg-muted/40 border rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">
                    Select Client / Project
                  </label>
                  <select
                    value={milestoneCustomerId}
                    onChange={e => handleMilestoneCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="">-- Choose Client --</option>
                    {customersList.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.customerCode ? `(${c.customerCode})` : ''} {c.city ? `• ${c.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">
                    Sales Order / Proposal
                  </label>
                  <select
                    value={milestoneOrderId}
                    onChange={e => {
                      const oId = e.target.value;
                      setMilestoneOrderId(oId);
                      if (oId) {
                        syncMilestonesWithOrder(oId);
                      }
                    }}
                    disabled={!milestoneCustomerId || loadingMilestoneOrders}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-solar-500/20 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingMilestoneOrders ? 'Loading client orders...' : milestoneOrders.length === 0 ? '-- No order linked (Using Default) --' : '-- Select Order --'}
                    </option>
                    {milestoneOrders.map(o => (
                      <option key={o._id} value={o._id}>
                        {o.orderNumber} • {o.systemCapacityKwp || 0} kWp • ₹{Math.round((o.netTotalPaise || 0) / 100).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Total Contract Value (₹)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsEditingMilestones(!isEditingMilestones)}
                      className="text-[11px] text-solar-600 hover:text-solar-700 font-semibold cursor-pointer"
                    >
                      {isEditingMilestones ? '🔒 Lock Standard' : '✏️ Custom Percentages'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={milestoneContractTotalRupees}
                      onChange={e => handleContractTotalChange(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm bg-background font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                      placeholder="e.g. 385260"
                    />
                  </div>
                </div>
              </div>

              {/* 3 Milestone Cards - Matching User Screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {milestoneStages.map((stage, idx) => {
                  const balanceDue = Math.max(0, stage.amountRupees - stage.paidRupees);
                  const isPaid = stage.paidRupees >= stage.amountRupees && stage.amountRupees > 0;
                  const isPartial = stage.paidRupees > 0 && !isPaid;

                  return (
                    <div
                      key={stage.id}
                      className={`border rounded-xl p-4 flex flex-col justify-between transition-all shadow-2xs ${
                        isPaid
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : isPartial
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-card border-border/80'
                      }`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-foreground">{stage.name}</h3>
                          {isEditingMilestones ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={stage.percentage}
                                onChange={e => handleUpdateMilestoneStage(idx, 'percentage', e.target.value)}
                                className="w-12 px-1 py-0.5 text-center text-xs border rounded bg-background font-bold"
                              />
                              <span className="text-xs font-bold text-solar-600">%</span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-bold text-solar-700 dark:text-solar-300 bg-solar-500/10 rounded-full border border-solar-500/20">
                              {stage.percentage}%
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground mt-1 min-h-[32px]">{stage.description}</p>

                        {/* Amount Due */}
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Milestone Target Amount
                          </div>
                          {isEditingMilestones ? (
                            <div className="flex items-center mt-1">
                              <span className="text-xs font-bold mr-1">₹</span>
                              <input
                                type="number"
                                min="0"
                                value={stage.amountRupees}
                                onChange={e => handleUpdateMilestoneStage(idx, 'amountRupees', e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-background font-bold"
                              />
                            </div>
                          ) : (
                            <div className="text-xl font-extrabold text-foreground mt-0.5">
                              ₹{stage.amountRupees.toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* Payment Method & Paid Inputs */}
                        <div className="mt-3.5 space-y-2.5 pt-3 border-t bg-muted/20 p-2.5 rounded-lg border border-border/50 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              Payment Method
                            </label>
                            <select
                              value={stage.paymentMethod}
                              onChange={e => handleUpdateMilestoneStage(idx, 'paymentMethod', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-solar-500"
                            >
                              <option value="CHEQUE">🏦 Cheque</option>
                              <option value="BANK_TRANSFER">🏛️ Bank Transfer / RTGS</option>
                              <option value="UPI">📱 UPI / QR</option>
                              <option value="CASH">💵 Cash Voucher</option>
                              <option value="DEMAND_DRAFT">📄 Demand Draft</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              {stage.paymentMethod === 'CHEQUE'
                                ? 'Cheque No. & Bank'
                                : stage.paymentMethod === 'CASH'
                                  ? 'Cash Receipt / Voucher #'
                                  : 'UTR / Txn Reference'}
                            </label>
                            <input
                              type="text"
                              value={stage.paymentRef}
                              onChange={e => handleUpdateMilestoneStage(idx, 'paymentRef', e.target.value)}
                              placeholder={
                                stage.paymentMethod === 'CHEQUE'
                                  ? 'e.g. CHQ-881920 (SBI)'
                                  : stage.paymentMethod === 'CASH'
                                    ? 'e.g. CASH-VOUCHER-042'
                                    : 'e.g. UTR-HDFC-9912048'
                              }
                              className="w-full px-2 py-1 border rounded bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-solar-500"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Realized / Paid (₹)
                              </label>
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                Bal: ₹{balanceDue.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs font-semibold text-muted-foreground">₹</span>
                              <input
                                type="number"
                                min="0"
                                value={stage.paidRupees}
                                onChange={e => handleUpdateMilestoneStage(idx, 'paidRupees', e.target.value)}
                                className="w-full pl-6 pr-2 py-1 border rounded bg-background font-bold text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-solar-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer / Status & Action */}
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Stage Status
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : isPartial
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {isPaid ? '✓ Paid' : isPartial ? '⚡ Partially Paid' : '⏳ Pending'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuickRecordMilestone(stage, idx)}
                          className="w-full py-1.5 px-3 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Record Receipt Entry</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Project Reconciliation Summary Bar */}
              {(() => {
                const totalTarget = milestoneStages.reduce((sum, s) => sum + s.amountRupees, 0);
                const totalPaid = milestoneStages.reduce((sum, s) => sum + s.paidRupees, 0);
                const totalBalance = Math.max(0, totalTarget - totalPaid);
                const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalPaid / totalTarget) * 100)) : 0;

                return (
                  <div className="p-4 bg-muted/30 border rounded-xl space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                      <div className="border-r border-border/50 pr-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Contract Value
                        </span>
                        <div className="text-base font-extrabold text-foreground mt-0.5">
                          ₹{totalTarget.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="border-r border-border/50 pr-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Total Realized (Paid)
                        </span>
                        <div className="text-base font-extrabold text-emerald-600 mt-0.5">
                          ₹{totalPaid.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="border-r border-border/50 pr-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Pending Receivable
                        </span>
                        <div className="text-base font-extrabold text-destructive mt-0.5">
                          ₹{totalBalance.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Recovery Progress
                        </span>
                        <div className="text-base font-extrabold text-solar-600 mt-0.5">
                          {progressPct}% Realized
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-solar-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Commercial Terms Footer matching User Screenshot */}
              <div className="p-4 bg-card border rounded-xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-solar-600" />
                  <span>Commercial Terms & Solar EPC Conditions:</span>
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Prices are valid for 30 days from proposal generation.</li>
                  <li>Statutory net metering approvals and CEIG clearance subject to local DISCOM norms.</li>
                  <li>
                    <strong className="text-foreground">Pre-Dispatch Milestone (70%):</strong> Material dispatch release from warehouse is strictly subject to clearance of 70% pre-dispatch payment.
                  </li>
                  <li>
                    <strong className="text-foreground">Commissioning Retention (10%):</strong> Retention balance payable post physical structure mounting, inverter sync, Bi-directional Net Meter (BM) installation, and Joint Commissioning Report (JCR).
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Actions (Always Visible Sticky Footer) */}
            <div className="flex justify-end space-x-3 pt-3 border-t mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowMilestoneModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMilestoneModal(false);
                  setShowRecordModal(true);
                }}
                className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Record Payment with Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 9: Edit Payment Details */}
      {/* ------------------------------------------------------------- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-solar-500/10 text-solar-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Edit Payment Details</h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Receipt: {editPaymentForm.receiptNumber} • Client: {editPaymentForm.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPayment} className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Receipt Amount
                  </span>
                  <div className="text-lg font-extrabold text-foreground mt-0.5">
                    ₹{Number(editPaymentForm.amountRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground text-right max-w-[200px]">
                  Accounting lock: Base amount is protected for audit compliance.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Method</label>
                  <select
                    value={editPaymentForm.paymentMethod}
                    onChange={e => setEditPaymentForm({ ...editPaymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="NEFT_RTGS">Direct RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYMENT_GATEWAY">Payment Gateway</option>
                    <option value="DEMAND_DRAFT">Demand Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={editPaymentForm.paymentDate}
                    onChange={e => setEditPaymentForm({ ...editPaymentForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Transaction Ref / Cheque No / Cash Voucher
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ: 881920 (SBI) or UTR20261025..."
                  value={editPaymentForm.transactionReference}
                  onChange={e => setEditPaymentForm({ ...editPaymentForm, transactionReference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Public Notes (Receipt Visible)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Milestone 1: Booking Advance (20%)"
                  value={editPaymentForm.notes}
                  onChange={e => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Confidential Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Internal audit notes, bank account matching details..."
                  value={editPaymentForm.internalNotes}
                  onChange={e => setEditPaymentForm({ ...editPaymentForm, internalNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-solar-500/20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
