/**
 * INS Solar ERP — Customer Payments & Milestone Collections Ledger
 *
 * Streamlined Solar EPC accounts workflow:
 * - Clean standard 3-Stage Milestone billing (Booking Advance 20%, Pre-Dispatch 70%, Commissioning 10%)
 * - Rapid payment recording with automatic order allocation
 * - Bank realization verification, editable references, and reversal audit
 * - Clean printable payment receipts and customer account statements
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote,
  Plus,
  Search,
  RefreshCw,
  Printer,
  Edit3,
  Undo2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Lock,
  Check,
  FileText
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface CustomerPaymentRecord {
  _id: string;
  receiptNumber: string;
  customerId?: {
    _id: string;
    customerCode?: string;
    name: string;
    primaryPhone?: string;
    email?: string;
  };
  amountPaise: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  status: 'RECORDED' | 'VERIFIED' | 'REVERSED' | 'REFUNDED';
  allocatedAmountPaise: number;
  unallocatedAmountPaise: number;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
}

interface CustomerItem {
  _id: string;
  name: string;
  customerCode?: string;
  primaryPhone?: string;
  city?: string;
}

interface OrderItem {
  _id: string;
  orderNumber: string;
  netTotalPaise?: number;
  totalAmountPaise?: number;
  allocatedAmountPaise?: number;
  systemCapacityKwp?: number;
  status?: string;
}

export const PaymentsPage: React.FC = () => {
  const { isAdmin, hasPermission } = useAuth();
  const canRecordPayment = isAdmin || hasPermission('payment:create');
  const canVerifyPayment = isAdmin || hasPermission('payment:verify');
  const canReversePayment = isAdmin || hasPermission('payment:reverse');
  const canEditPayment = isAdmin || hasPermission('payment:create');

  const [searchParams] = useSearchParams();
  const paramOrderId = searchParams.get('orderId');
  const paramCustomerId = searchParams.get('customerId');
  const paramMilestone = searchParams.get('milestone');

  // Ledger state
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Master dropdown data
  const [customersList, setCustomersList] = useState<CustomerItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<OrderItem[]>([]);
  const [, setLoadingOrders] = useState(false);

  // Unified Record Payment Modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMilestoneStage, setSelectedMilestoneStage] = useState<'M1' | 'M2' | 'M3' | 'CUSTOM'>('CUSTOM');

  // Local ISO string for datetime-local input (YYYY-MM-DDTHH:MM)
  const getNowLocalISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const [recordForm, setRecordForm] = useState({
    customerId: '',
    salesOrderId: '',
    amountRupees: '',
    paymentDate: getNowLocalISO(),
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    notes: ''
  });

  // Selected Order Contract Info & Milestone Progress
  const [activeOrderContractRupees, setActiveOrderContractRupees] = useState<number>(0);
  const [customerTotalPaidRupees, setCustomerTotalPaidRupees] = useState<number>(0);
  const [customContractRupees, setCustomContractRupees] = useState<number>(100000);
  const [customerReceipts, setCustomerReceipts] = useState<any[]>([]);

  // Computed Solar EPC Contract & Balance values
  const effectiveContractRupees = activeOrderContractRupees > 0 ? activeOrderContractRupees : (customContractRupees || 100000);
  const remainingBalanceRupees = Math.max(0, effectiveContractRupees - customerTotalPaidRupees);
  const percentPaid = effectiveContractRupees > 0 ? Math.min(100, Math.round((customerTotalPaidRupees / effectiveContractRupees) * 100)) : 0;

  // 3-Stage Milestone Targets & Progression
  const m1Target = Math.round(effectiveContractRupees * 0.2); // 20% Booking Advance
  const m2Target = Math.round(effectiveContractRupees * 0.7); // 70% Pre-Dispatch
  const m3Target = Math.round(effectiveContractRupees * 0.1); // 10% Handover & Commissioning

  // Calculate stage breakdown specifically from verified receipts
  const stageTotals = useMemo(() => {
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let untagged = 0;

    for (const p of customerReceipts) {
      const amtRupees = Math.round((p.amountPaise || 0) / 100);
      const n = (p.notes || '').toLowerCase();
      if (n.includes('stage 2') || n.includes('pre-dispatch') || n.includes('milestone 2')) {
        s2 += amtRupees;
      } else if (n.includes('stage 3') || n.includes('commissioning') || n.includes('milestone 3')) {
        s3 += amtRupees;
      } else if (n.includes('stage 1') || n.includes('advance') || n.includes('booking') || n.includes('milestone 1') || n.includes('token')) {
        s1 += amtRupees;
      } else {
        untagged += amtRupees;
      }
    }

    // Allocate any untagged payment sequentially across stages
    if (untagged > 0) {
      const s1Need = Math.max(0, m1Target - s1);
      const addS1 = Math.min(s1Need, untagged);
      s1 += addS1;
      untagged -= addS1;

      const s2Need = Math.max(0, m2Target - s2);
      const addS2 = Math.min(s2Need, untagged);
      s2 += addS2;
      untagged -= addS2;

      const s3Need = Math.max(0, m3Target - s3);
      const addS3 = Math.min(s3Need, untagged);
      s3 += addS3;
    }

    return { s1, s2, s3 };
  }, [customerReceipts, m1Target, m2Target, m3Target]);

  // Milestone completion & dues
  const m1Paid = stageTotals.s1;
  const m1Due = Math.max(0, m1Target - m1Paid);
  const m1Completed = m1Due === 0 && m1Target > 0;

  const m2Paid = stageTotals.s2;
  const m2Due = Math.max(0, m2Target - m2Paid);
  const m2Completed = m2Due === 0 && m2Target > 0;

  const m3Paid = stageTotals.s3;
  const m3Due = Math.max(0, m3Target - m3Paid);
  const m3Completed = m3Due === 0 && m3Target > 0;

  // Fully settled if all 3 stages completed OR total remaining balance <= 0
  const isContractFullySettled = (m1Completed && m2Completed && m3Completed) || (effectiveContractRupees > 0 && remainingBalanceRupees <= 0);

  // Live Projected Balance when entering payment amount
  const enteredAmount = parseFloat(recordForm.amountRupees) || 0;
  const projectedPaid = customerTotalPaidRupees + enteredAmount;
  const projectedRemaining = Math.max(0, effectiveContractRupees - projectedPaid);
  const projectedPercent = effectiveContractRupees > 0 ? Math.min(100, Math.round((projectedPaid / effectiveContractRupees) * 100)) : 0;

  // Edit Payment Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    receiptNumber: '',
    amountRupees: '',
    customerName: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    paymentDate: '',
    notes: ''
  });

  // Reverse Payment Modal
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedReversePayment, setSelectedReversePayment] = useState<CustomerPaymentRecord | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // Printable Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Customer Statement Modal
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Format Currency
  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  // Format Date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format Date & Time for professional audit
  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) +
        ', ' +
        d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      );
    } catch {
      return String(dateStr);
    }
  };

  // Convert Number to Words (INR)
  const numberToWordsINR = (amount: number): string => {
    const num = Math.floor(amount);
    if (num <= 0) return 'Zero Rupees Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n < 20) return a[n] || '';
      if (n < 100) return (b[Math.floor(n / 10)] || '') + (n % 10 !== 0 ? ' ' + (a[n % 10] || '') : '');
      if (n < 1000) return (a[Math.floor(n / 100)] || '') + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    return inWords(num).trim() + ' Rupees Only';
  };

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
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await apiClient<any>(`/payments?${params.toString()}`);
      const data = res?.data || res;
      setPayments(data?.items || []);
      setTotal(data?.total || (data?.items ? data.items.length : 0));
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments ledger.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, searchTerm]);

  // Load customer master list
  const loadCustomers = async () => {
    try {
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
    }
  };

  // Load customer data & receivables
  const loadCustomerData = async (customerId: string) => {
    if (!customerId) {
      setCustomerOrders([]);
      setActiveOrderContractRupees(0);
      setCustomerTotalPaidRupees(0);
      setCustomerReceipts([]);
      return;
    }
    try {
      setLoadingOrders(true);
      const [ordersRes, recvRes] = await Promise.all([
        apiClient<any>(`/orders?customerId=${customerId}&limit=50`).catch(() => null),
        apiClient<any>(`/payments/receivables/customers/${customerId}`).catch(() => null)
      ]);

      const items = ordersRes?.items || ordersRes?.data?.items || (Array.isArray(ordersRes) ? ordersRes : ordersRes?.data || []);
      const activeOrders = items.filter((o: any) => o.status !== 'CANCELLED');
      setCustomerOrders(activeOrders);

      const allPayments = recvRes?.data?.payments || recvRes?.payments || [];
      const verifiedPayments = allPayments.filter((p: any) => p.status === 'VERIFIED' || p.status === 'RECORDED');
      setCustomerReceipts(verifiedPayments);

      const totalPaidPaise = verifiedPayments.length > 0
        ? verifiedPayments.reduce((sum: number, p: any) => sum + (p.amountPaise || 0), 0)
        : (recvRes?.data?.totalPaidPaise ?? recvRes?.totalPaidPaise ?? 0);
      setCustomerTotalPaidRupees(Math.round(totalPaidPaise / 100));

      if (activeOrders.length > 0) {
        const first = activeOrders[0];
        setRecordForm(prev => ({ ...prev, salesOrderId: first._id }));
        const total = Math.round((first.netTotalPaise || first.totalAmountPaise || 0) / 100);
        setActiveOrderContractRupees(total);
      } else {
        setActiveOrderContractRupees(0);
      }
    } catch (err) {
      console.warn('Failed to load customer data:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle customer change in Record Modal
  const handleCustomerChange = async (customerId: string) => {
    setRecordForm(prev => ({
      ...prev,
      customerId,
      salesOrderId: '',
      amountRupees: '',
      notes: ''
    }));
    setSelectedMilestoneStage('CUSTOM');
    if (customerId) {
      await loadCustomerData(customerId);
    } else {
      setCustomerOrders([]);
      setActiveOrderContractRupees(0);
      setCustomerTotalPaidRupees(0);
      setCustomerReceipts([]);
    }
  };

  // Handle order selection change in Record Modal
  const handleOrderChange = (orderId: string) => {
    setRecordForm(prev => ({ ...prev, salesOrderId: orderId }));
    const found = customerOrders.find(o => o._id === orderId);
    if (found) {
      const total = Math.round((found.netTotalPaise || found.totalAmountPaise || 0) / 100);
      setActiveOrderContractRupees(total);
      setSelectedMilestoneStage('CUSTOM');
    } else {
      setActiveOrderContractRupees(0);
    }
  };

  // 1-Click Milestone Stage Selection with Smart Locking & Balance Tracking
  const applyMilestoneStage = (stage: 'M1' | 'M2' | 'M3' | 'CUSTOM') => {
    setSelectedMilestoneStage(stage);

    if (stage === 'M1') {
      if (m1Completed) {
        alert(`Stage 1 (20% Booking Advance - ${formatINR(m1Target * 100)}) has already been fully paid and locked! Please proceed to Stage 2.`);
        return;
      }
      const stageAmt = m1Due > 0 ? m1Due : m1Target;
      setRecordForm(prev => ({
        ...prev,
        amountRupees: stageAmt.toString(),
        notes: m1Paid > 0
          ? `Stage 1 Booking Advance: Balance payment of ${formatINR(stageAmt * 100)} (completing 20% milestone)`
          : `Stage 1: Booking Advance (20%) - Order confirmation token`
      }));
    } else if (stage === 'M2') {
      if (!m1Completed) {
        alert(`Stage 1 (20% Booking Advance) must be completed before proceeding to Stage 2 (Material Pre-Dispatch)!`);
        return;
      }
      if (m2Completed) {
        alert(`Stage 2 (70% Material Pre-Dispatch - ${formatINR(m2Target * 100)}) has already been fully paid and locked! Please proceed to Stage 3.`);
        return;
      }
      const stageAmt = m2Due > 0 ? m2Due : m2Target;
      setRecordForm(prev => ({
        ...prev,
        amountRupees: stageAmt.toString(),
        notes: m2Paid > 0
          ? `Stage 2 Pre-Dispatch: Balance payment of ${formatINR(stageAmt * 100)} (completing 70% milestone)`
          : `Stage 2: Material Pre-Dispatch (70%) - Prior to warehouse dispatch`
      }));
    } else if (stage === 'M3') {
      if (!m2Completed) {
        alert(`Stage 2 (70% Material Pre-Dispatch) must be completed before proceeding to Stage 3 (Commissioning & Handover)!`);
        return;
      }
      if (m3Completed) {
        alert(`Stage 3 (10% Commissioning - ${formatINR(m3Target * 100)}) has already been fully paid! All project milestones are 100% completed.`);
        return;
      }
      const stageAmt = m3Due > 0 ? m3Due : m3Target;
      setRecordForm(prev => ({
        ...prev,
        amountRupees: stageAmt.toString(),
        notes: m3Paid > 0
          ? `Stage 3 Commissioning: Balance payment of ${formatINR(stageAmt * 100)} (completing 10% handover milestone)`
          : `Stage 3: Installation & Commissioning (10%) - Post net-meter test & final handover`
      }));
    }
  };

  // Open Record Modal pre-filled
  const openRecordModal = (prefillCustomerId?: string, prefillOrderId?: string, stage?: 'M1' | 'M2' | 'M3') => {
    const cId = prefillCustomerId || (customersList[0]?._id || '');
    setRecordForm({
      customerId: cId,
      salesOrderId: prefillOrderId || '',
      amountRupees: '',
      paymentDate: getNowLocalISO(),
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: '',
      notes: ''
    });
    setShowRecordModal(true);
    if (cId) {
      loadCustomerData(cId).then(() => {
        if (stage) applyMilestoneStage(stage);
      });
    }
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.customerId) {
      alert('Please select a customer.');
      return;
    }

    if (isContractFullySettled || remainingBalanceRupees <= 0) {
      alert('This project contract is already 100% fully settled! No further payments can be accepted.');
      return;
    }

    const amountNum = parseFloat(recordForm.amountRupees);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid received amount (INR).');
      return;
    }

    if (amountNum > remainingBalanceRupees) {
      alert(`Received amount (${formatINR(amountNum * 100)}) exceeds remaining contract balance of ${formatINR(remainingBalanceRupees * 100)}. You cannot overpay.`);
      return;
    }

    if (selectedMilestoneStage === 'M1' && amountNum > m1Due) {
      alert(`Stage 1 Booking Advance only requires ${formatINR(m1Due * 100)} to complete. You cannot overpay this stage.`);
      return;
    }

    if (selectedMilestoneStage === 'M2' && amountNum > m2Due) {
      alert(`Stage 2 Pre-Dispatch only requires ${formatINR(m2Due * 100)} to complete. You cannot overpay this stage.`);
      return;
    }

    if (selectedMilestoneStage === 'M3' && amountNum > m3Due) {
      alert(`Stage 3 Commissioning only requires ${formatINR(m3Due * 100)} to complete. You cannot overpay this stage.`);
      return;
    }

    try {
      setSubmitting(true);
      const amountPaise = Math.round(amountNum * 100);

      const res: any = await apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: recordForm.customerId,
          amountPaise,
          paymentDate: recordForm.paymentDate ? new Date(recordForm.paymentDate) : new Date(),
          paymentMethod: recordForm.paymentMethod,
          transactionReference: recordForm.transactionReference.trim() || undefined,
          notes: recordForm.notes.trim() || undefined,
          autoVerify: true
        })
      });

      const payment = res?.data || res;

      // Automatically allocate to linked sales order
      if (payment?._id && recordForm.salesOrderId) {
        try {
          await apiClient(`/payments/${payment._id}/allocate`, {
            method: 'POST',
            body: JSON.stringify({
              salesOrderId: recordForm.salesOrderId,
              allocatedAmountPaise: amountPaise,
              notes: recordForm.notes || 'Solar milestone payment allocation'
            })
          });
        } catch (allocErr) {
          console.warn('Auto-allocation skipped:', allocErr);
        }
      }

      setShowRecordModal(false);
      fetchPayments();

      // Open printable receipt for immediate print/confirmation
      if (payment?._id) {
        openReceiptModal(payment._id);
      }
    } catch (err: any) {
      alert(`Error saving payment: ${err.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Verify pending payment directly
  const handleVerifyDirect = async (paymentId: string) => {
    if (!window.confirm('Verify and mark this payment as realized in bank?')) return;
    try {
      await apiClient(`/payments/${paymentId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verificationNotes: 'Bank realization confirmed by accounts officer' })
      });
      fetchPayments();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (p: CustomerPaymentRecord) => {
    setEditForm({
      id: p._id,
      receiptNumber: p.receiptNumber,
      amountRupees: (p.amountPaise / 100).toFixed(2),
      customerName: p.customerId?.name || 'Customer',
      paymentMethod: p.paymentMethod || 'BANK_TRANSFER',
      transactionReference: p.transactionReference || '',
      paymentDate: p.paymentDate ? (new Date(p.paymentDate).toISOString().split('T')[0] ?? '') : '',
      notes: p.notes || ''
    });
    setShowEditModal(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    try {
      setSubmitting(true);
      await apiClient(`/payments/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paymentMethod: editForm.paymentMethod,
          transactionReference: editForm.transactionReference.trim() || undefined,
          paymentDate: editForm.paymentDate ? new Date(editForm.paymentDate) : undefined,
          notes: editForm.notes.trim() || undefined
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

  // Open Reverse Modal
  const handleOpenReverse = (p: CustomerPaymentRecord) => {
    setSelectedReversePayment(p);
    setReverseReason('');
    setShowReverseModal(true);
  };

  // Submit Reverse
  const handleConfirmReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReversePayment || !reverseReason.trim()) {
      alert('Please provide a mandatory reason for reversing this payment.');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient(`/payments/${selectedReversePayment._id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reversalReason: reverseReason.trim() })
      });
      setShowReverseModal(false);
      setSelectedReversePayment(null);
      fetchPayments();
    } catch (err: any) {
      alert(`Error reversing payment: ${err.message || 'Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Receipt Modal
  const openReceiptModal = async (paymentId: string) => {
    try {
      const res = await apiClient<any>(`/payments/${paymentId}/receipt`);
      setReceiptData(res?.data || res);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(`Failed to load receipt: ${err.message}`);
    }
  };

  // Open Customer Statement Modal
  const openCustomerStatement = async (customerId?: string) => {
    if (!customerId) return;
    try {
      setStatementLoading(true);
      setShowStatementModal(true);
      const res = await apiClient<any>(`/payments/receivables/customers/${customerId}`);
      setStatementData(res?.data || res);
    } catch (err: any) {
      alert(`Failed to load customer statement: ${err.message}`);
      setShowStatementModal(false);
    } finally {
      setStatementLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadCustomers();
    fetchPayments();
  }, [fetchPayments]);

  // Handle URL navigation params (orderId, customerId from other pages)
  useEffect(() => {
    if (paramCustomerId) {
      openRecordModal(
        paramCustomerId,
        paramOrderId || undefined,
        paramMilestone === '1' ? 'M1' : paramMilestone === '2' ? 'M2' : paramMilestone === '3' ? 'M3' : undefined
      );
    }
  }, [paramCustomerId, paramOrderId, paramMilestone]);

  // Financial KPIs
  const verifiedPayments = payments.filter(p => p.status === 'VERIFIED');
  const totalRealizedPaise = verifiedPayments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  const pendingPayments = payments.filter(p => p.status === 'RECORDED');
  const totalPendingPaise = pendingPayments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  const totalAllocatedPaise = verifiedPayments.reduce((sum, p) => sum + (p.allocatedAmountPaise || 0), 0);

  return (
    <div className="space-y-5">
      {/* =========================================================================
          PAGE HEADER: Title, Subtitle, & Primary Action Button
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Customer Payment Collections</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary border text-muted-foreground">
                  Accounts
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record customer advance payments, milestone billing receipts, and bank realizations.
              </p>
            </div>
          </div>
        </div>

        {canRecordPayment ? (
          <div className="flex items-center space-x-2.5 self-end sm:self-auto shrink-0">
            <button
              onClick={() => openRecordModal()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record Payment</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 border text-[11px] text-muted-foreground self-end sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Read-Only Ledger (Accounts Protected)</span>
          </div>
        )}
      </div>

      {/* =========================================================================
          FINANCIAL KPI SUMMARY (4 CLEAN CARDS)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Realized Collections</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {formatINR(totalRealizedPaise)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            {verifiedPayments.length} verified receipts realized
          </span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Pending Clearance</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {formatINR(totalPendingPaise)}
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-0.5 block">
            {pendingPayments.length} receipts awaiting bank check
          </span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Applied to Solar Orders</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {formatINR(totalAllocatedPaise)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Milestone payments allocated
          </span>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Total Payment Records</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">{total}</div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Customer receipts on ledger
          </span>
        </div>
      </div>

      {/* =========================================================================
          FILTER & SEARCH BAR (SIMPLE & LOGICAL)
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card border rounded-2xl p-3 shadow-xs items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search receipt #, customer, UTR / ref..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="VERIFIED">Verified / Realized</option>
            <option value="RECORDED">Pending Verification</option>
            <option value="REVERSED">Reversed / Void</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <select
            value={methodFilter}
            onChange={e => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All Payment Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
            <option value="PAYMENT_GATEWAY">Online Gateway</option>
          </select>

          <button
            onClick={() => fetchPayments()}
            className="p-2 border rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            title="Refresh payment register"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          PAYMENTS REGISTER TABLE
         ========================================================================= */}
      <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2 text-amber-500" />
            <span>Loading payment records...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-12 text-xs text-rose-600">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>{error}</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground">
            <Banknote className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">No payment records found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Record Payment&quot; above to log customer advances or milestone receipts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Customer &amp; Project</th>
                  <th className="py-3 px-4">Date &amp; Mode</th>
                  <th className="py-3 px-4">Transaction / Ref</th>
                  <th className="py-3 px-4">Milestone Stage</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map(payment => {
                  const isVerified = payment.status === 'VERIFIED';
                  const isRecorded = payment.status === 'RECORDED';
                  const isReversed = payment.status === 'REVERSED';

                  // Extract milestone tag if present
                  let milestoneLabel = 'General Receipt';
                  const n = (payment.notes || '').toLowerCase();
                  if (n.includes('stage 2') || n.includes('pre-dispatch') || n.includes('milestone 2')) {
                    milestoneLabel = 'Stage 2: Pre-Dispatch (70%)';
                  } else if (n.includes('stage 3') || n.includes('commissioning') || n.includes('milestone 3')) {
                    milestoneLabel = 'Stage 3: Commissioning (10%)';
                  } else if (n.includes('stage 1') || n.includes('advance') || n.includes('booking') || n.includes('milestone 1') || n.includes('token')) {
                    milestoneLabel = 'Stage 1: Advance (20%)';
                  }

                  return (
                    <tr key={payment._id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-500">
                        {payment.receiptNumber}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {payment.customerId?.name || 'Client'}
                        </div>
                        {payment.customerId?.primaryPhone && (
                          <div className="text-[11px] text-muted-foreground">
                            {payment.customerId.primaryPhone}
                          </div>
                        )}
                        {payment.customerId?._id && (
                          <button
                            onClick={() => openCustomerStatement(payment.customerId?._id)}
                            className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                          >
                            <span>View Ledger &amp; Balance</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{formatDate(payment.paymentDate)}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {payment.paymentDate
                            ? new Date(payment.paymentDate).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })
                            : ''}
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mt-0.5 inline-block">
                          {payment.paymentMethod?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {payment.transactionReference || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary text-foreground border">
                          {milestoneLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatINR(payment.amountPaise)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : isRecorded
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {isVerified ? 'Verified' : isRecorded ? 'Pending' : payment.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Print Receipt */}
                          <button
                            onClick={() => openReceiptModal(payment._id)}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit (Accounts / Admin Only) */}
                          {canEditPayment && !isReversed && (
                            <button
                              onClick={() => handleOpenEdit(payment)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-amber-600 cursor-pointer"
                              title="Edit Reference & Date"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Verify (if pending - Accounts / Admin Only) */}
                          {canVerifyPayment && isRecorded && (
                            <button
                              onClick={() => handleVerifyDirect(payment._id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                              title="Confirm bank realization"
                            >
                              Verify
                            </button>
                          )}

                          {/* Reverse (Accounts / Admin Only) */}
                          {canReversePayment && !isReversed && (
                            <button
                              onClick={() => handleOpenReverse(payment)}
                              className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-lg cursor-pointer"
                              title="Mark as Reversed / Bounced"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between p-3 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total} payments
            </span>
            <div className="flex items-center space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 border rounded-lg hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 border rounded-lg hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: UNIFIED RECORD PAYMENT MODAL (WITH 1-CLICK 3-STAGE MILESTONES)
         ========================================================================= */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  Record Customer Payment
                </h2>
                <p className="text-xs text-muted-foreground">
                  Record advance or milestone collections against rooftop solar projects.
                </p>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4 text-xs">
              {/* Customer Selector */}
              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Customer / Rooftop Client <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={recordForm.customerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customersList.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.primaryPhone ? `(${c.primaryPhone})` : ''} {c.city ? `• ${c.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Linked Solar Sales Order */}
              {customerOrders.length > 0 && (
                <div>
                  <label className="block font-semibold mb-1 text-foreground">
                    Linked Solar Order / Project Contract
                  </label>
                  <select
                    value={recordForm.salesOrderId}
                    onChange={e => handleOrderChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {customerOrders.map(o => (
                      <option key={o._id} value={o._id}>
                        {o.orderNumber} &bull; {o.systemCapacityKwp || 3} kWp (Total: {formatINR(o.netTotalPaise || o.totalAmountPaise)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* If no sales order in system, allow specifying Project Contract Target */}
              {recordForm.customerId && customerOrders.length === 0 && (
                <div className="p-3 bg-secondary/30 border border-dashed rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground text-xs">
                      Total Solar Project Contract (INR ₹)
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Project Contract Target
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={customContractRupees}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setCustomContractRupees(v);
                      setSelectedMilestoneStage('CUSTOM');
                    }}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-1.5 border rounded-lg bg-background font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Project total for tracking 3-stage milestone billing (20% Advance, 70% Pre-Dispatch, 10% Handover).
                  </p>
                </div>
              )}

              {/* If Contract is 100% Fully Settled */}
              {recordForm.customerId && isContractFullySettled ? (
                <div className="p-5 sm:p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-800 dark:text-emerald-300">
                      Contract 100% Fully Settled!
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 max-w-md mx-auto">
                      All 3 solar project milestones (20% Advance, 70% Pre-Dispatch, 10% Handover) have been completely realized and verified.
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-xs text-left">
                    <div className="bg-background/80 p-2.5 rounded-xl border border-emerald-500/20">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Contract</div>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">{formatINR(effectiveContractRupees * 100)}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-emerald-500/20">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Realized</div>
                      <div className="font-mono font-bold text-emerald-600 text-sm mt-0.5">{formatINR(customerTotalPaidRupees * 100)}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-emerald-500/20">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Balance Due</div>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm mt-0.5">₹0.00 (0% due)</div>
                    </div>
                  </div>

                  {/* Milestone Status Badges */}
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-background/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5 shadow-xs">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Stage 1: {formatINR(m1Target * 100)} ✓</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5 shadow-xs">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Stage 2: {formatINR(m2Target * 100)} ✓</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5 shadow-xs">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Stage 3: {formatINR(m3Target * 100)} ✓</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    🔒 Payment intake is locked because this client account has zero outstanding dues.
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecordModal(false);
                        openCustomerStatement(recordForm.customerId);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Customer Statement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecordModal(false)}
                      className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : recordForm.customerId ? (
                <>
                  {/* 1-Click Milestone Selector & Progress / Balance Tracker */}
                  <div className="p-3.5 bg-secondary/40 border rounded-xl space-y-3">
                    {/* Balance & Progress Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                      <div>
                        <div className="text-[11px] font-bold uppercase text-foreground flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                          <span>Solar EPC 3-Stage Milestone Billing</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Contract: <strong className="text-foreground font-mono">{formatINR(effectiveContractRupees * 100)}</strong> &bull; Paid So Far: <strong className="text-emerald-600 font-mono">{formatINR(customerTotalPaidRupees * 100)}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Remaining Balance:</span>
                        <div className="text-xs font-mono font-bold text-rose-600">
                          {formatINR(remainingBalanceRupees * 100)} ({Math.max(0, 100 - percentPaid)}% due)
                        </div>
                      </div>
                    </div>

                    {/* 3 Milestone Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Stage 1 Button */}
                      <button
                        type="button"
                        disabled={m1Completed}
                        onClick={() => applyMilestoneStage('M1')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          m1Completed
                            ? 'bg-muted/40 border-muted text-muted-foreground opacity-80 cursor-not-allowed'
                            : selectedMilestoneStage === 'M1'
                              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 cursor-pointer'
                              : 'bg-card hover:bg-muted/50 border-border cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                            {m1Completed && <Lock className="w-2.5 h-2.5 text-emerald-600" />}
                            Stage 1 (20%)
                          </span>
                          {m1Completed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Paid
                            </span>
                          ) : m1Paid > 0 ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 font-bold">
                              Due {formatINR(m1Due * 100)}
                            </span>
                          ) : null}
                        </div>
                        <div className="font-semibold text-foreground truncate mt-0.5">Booking Advance</div>
                        <div className="text-[11px] font-mono font-bold text-foreground mt-1">
                          {m1Completed ? (
                            <span className="text-emerald-600">✓ {formatINR(m1Target * 100)}</span>
                          ) : m1Paid > 0 ? (
                            <span className="text-amber-600">Pay Due: {formatINR(m1Due * 100)}</span>
                          ) : (
                            formatINR(m1Target * 100)
                          )}
                        </div>
                        {m1Paid > 0 && !m1Completed && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            ({formatINR(m1Paid * 100)} already received)
                          </div>
                        )}
                      </button>

                      {/* Stage 2 Button */}
                      <button
                        type="button"
                        disabled={m2Completed || !m1Completed}
                        onClick={() => applyMilestoneStage('M2')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          m2Completed
                            ? 'bg-muted/40 border-muted text-muted-foreground opacity-80 cursor-not-allowed'
                            : !m1Completed
                              ? 'bg-muted/20 border-border/50 text-muted-foreground opacity-50 cursor-not-allowed'
                              : selectedMilestoneStage === 'M2'
                                ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30 cursor-pointer'
                                : 'bg-blue-500/5 border-blue-400/50 hover:bg-blue-500/10 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                            {(m2Completed || !m1Completed) && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
                            Stage 2 (70%)
                          </span>
                          {m2Completed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Paid
                            </span>
                          ) : !m1Completed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                              Locked
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 font-bold">
                              👉 Next Step
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-foreground truncate mt-0.5">Pre-Dispatch</div>
                        <div className="text-[11px] font-mono font-bold text-foreground mt-1">
                          {m2Completed ? (
                            <span className="text-emerald-600">✓ {formatINR(m2Target * 100)}</span>
                          ) : (
                            formatINR(m2Due > 0 ? m2Due * 100 : m2Target * 100)
                          )}
                        </div>
                        {m2Paid > 0 && !m2Completed && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            ({formatINR(m2Paid * 100)} paid)
                          </div>
                        )}
                      </button>

                      {/* Stage 3 Button */}
                      <button
                        type="button"
                        disabled={m3Completed || !m2Completed}
                        onClick={() => applyMilestoneStage('M3')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          m3Completed
                            ? 'bg-muted/40 border-muted text-muted-foreground opacity-80 cursor-not-allowed'
                            : !m2Completed
                              ? 'bg-muted/20 border-border/50 text-muted-foreground opacity-50 cursor-not-allowed'
                              : selectedMilestoneStage === 'M3'
                                ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30 cursor-pointer'
                                : 'bg-purple-500/5 border-purple-400/50 hover:bg-purple-500/10 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
                            {(m3Completed || !m2Completed) && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
                            Stage 3 (10%)
                          </span>
                          {m3Completed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Paid
                            </span>
                          ) : !m2Completed ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                              Locked
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-700 font-bold">
                              👉 Final Step
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-foreground truncate mt-0.5">Commissioning</div>
                        <div className="text-[11px] font-mono font-bold text-foreground mt-1">
                          {m3Completed ? (
                            <span className="text-emerald-600">✓ {formatINR(m3Target * 100)}</span>
                          ) : (
                            formatINR(m3Due > 0 ? m3Due * 100 : m3Target * 100)
                          )}
                        </div>
                        {m3Paid > 0 && !m3Completed && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            ({formatINR(m3Paid * 100)} paid)
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Amount & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-foreground">
                        Received Amount (INR ₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={remainingBalanceRupees}
                        required
                        placeholder="e.g. 30000"
                        value={recordForm.amountRupees}
                        onChange={e => {
                          setRecordForm(prev => ({ ...prev, amountRupees: e.target.value }));
                          setSelectedMilestoneStage('CUSTOM');
                        }}
                        className="w-full px-3 py-2 border rounded-xl bg-background font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      {enteredAmount > 0 && recordForm.customerId && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 mt-1.5 space-y-0.5">
                          <div>
                            After receipt: <strong className="text-emerald-700 dark:text-emerald-300 font-mono">Total Paid: {formatINR(projectedPaid * 100)} ({projectedPercent}%)</strong>
                          </div>
                          <div className="text-rose-700 dark:text-rose-300">
                            Remaining to 100%: <strong className="font-mono">{formatINR(projectedRemaining * 100)}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-foreground">
                        Payment Date &amp; Time <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={recordForm.paymentDate}
                        onChange={e => setRecordForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-xl bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Mode & Reference */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-foreground">Payment Mode</label>
                      <select
                        value={recordForm.paymentMethod}
                        onChange={e => setRecordForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                        <option value="UPI">UPI</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CASH">Cash Voucher</option>
                        <option value="PAYMENT_GATEWAY">Online Gateway</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-foreground">
                        Transaction / UTR / Cheque Ref #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR-HDFC-9912048 or CHQ-881920"
                        value={recordForm.transactionReference}
                        onChange={e => setRecordForm(prev => ({ ...prev, transactionReference: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-xl bg-background font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block font-semibold mb-1 text-foreground">
                      Receipt Remarks / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Milestone 1 advance intake on signing contract"
                      value={recordForm.notes}
                      onChange={e => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowRecordModal(false)}
                      className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Saving...' : 'Save & Issue Receipt'}
                    </button>
                  </div>
                </>
              ) : null}
            </form>
          </div>
        </div>
      )}



      {/* =========================================================================
          MODAL 3: PRINTABLE OPERATIONAL PAYMENT RECEIPT (ON-SCREEN PREVIEW + A4 PRINT)
         ========================================================================= */}
      {showReceiptModal && receiptData && (
        <>
          {/* Dedicated A4 Print Document (Visible only when printing) */}
          <div id="printable-a4-receipt" className="hidden print:block text-slate-900 bg-white font-sans text-xs">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-a4-receipt, #printable-a4-receipt * {
                  visibility: visible !important;
                }
                #printable-a4-receipt {
                  display: block !important;
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  min-height: 100% !important;
                  margin: 0 !important;
                  padding: 12mm 15mm !important;
                  background: white !important;
                  color: #0f172a !important;
                  box-sizing: border-box !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
              }
            `}</style>

            {/* Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    RAREBOX SOLAR
                  </h1>
                  <p className="text-[11px] font-bold text-amber-700 tracking-wide uppercase mt-0.5">
                    A Division of RAREBOX LLP &bull; Solar EPC &amp; Clean Energy Solutions
                  </p>
                  <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                    <div>GSTIN: <strong className="text-slate-900 font-mono">22AAAFR1234A1Z5</strong> &bull; PAN: <strong className="text-slate-900 font-mono">AAAFR1234A</strong></div>
                    <div>Regd. Office: Rarebox Tower, Great Eastern Road, Raipur, Chhattisgarh - 492001</div>
                    <div>Phone: +91 771 4055555 &bull; Email: accounts@rareboxsolar.com &bull; Web: www.rareboxsolar.com</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
                    MONEY RECEIPT
                  </span>
                  <div className="font-mono font-bold text-base text-amber-700 mt-2">
                    {receiptData.receiptNumber}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Date &amp; Time: <strong className="text-slate-900">{formatDateTime(receiptData.paymentDate)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Client & Payment Info Box */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-4">
              <div className="grid grid-cols-2 divide-x divide-slate-300">
                {/* Left Column: Customer Info */}
                <div className="p-3 space-y-1.5 bg-slate-50/50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    RECEIVED FROM CLIENT / BILL TO:
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {receiptData.customer?.name || receiptData.customerId?.name || 'Customer'}
                  </div>
                  <div className="text-xs text-slate-700 font-mono">
                    Phone: {receiptData.customer?.primaryPhone || receiptData.customerId?.primaryPhone || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-600">
                    Address: {receiptData.customer?.installationAddress?.city || receiptData.customer?.billingAddress?.city || 'Raipur, Chhattisgarh'}
                  </div>
                  {receiptData.customer?.customerCode && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Customer ID: {receiptData.customer.customerCode}
                    </div>
                  )}
                </div>

                {/* Right Column: Instrument & Realization Info */}
                <div className="p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    PAYMENT INSTRUMENT &amp; SETTLEMENT:
                  </div>
                  <div className="text-xs text-slate-900">
                    Mode: <strong className="uppercase font-mono">{receiptData.paymentMethod?.replace(/_/g, ' ')}</strong>
                  </div>
                  <div className="text-xs text-slate-900 font-mono">
                    UTR / Cheque Ref: <strong>{receiptData.transactionReference || 'Direct Bank Settlement'}</strong>
                  </div>
                  <div className="text-xs text-slate-700">
                    Settlement Status: <strong className="text-emerald-700">REALIZED &amp; VERIFIED IN BANK</strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    Milestone Purpose: <span className="font-semibold">{receiptData.notes || 'Rooftop Solar Project Advance'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table: Financial Particulars */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Sr.</th>
                    <th className="py-2.5 px-3">Description of Solar EPC Service / Milestone</th>
                    <th className="py-2.5 px-3 w-40 text-center">Stage Tag</th>
                    <th className="py-2.5 px-3 w-36 text-right">Realized Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-3 px-3 text-center font-mono">01</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">Rooftop Solar PV Installation Milestone Receipt</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Received towards solar power plant procurement, installation, and commissioning.
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {receiptData.notes?.includes('Stage') ? receiptData.notes.split('-')[0].trim() : 'Advance Token'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(receiptData.amountPaise)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right uppercase text-slate-700 text-[11px]">
                      Total Realized Amount:
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-base">
                      {formatINR(receiptData.amountPaise)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Amount In Words */}
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg mb-4 text-xs">
              <span className="font-bold text-slate-700 uppercase text-[10px]">Amount in Words: </span>
              <span className="font-serif italic font-bold text-slate-900">
                {numberToWordsINR(receiptData.amountPaise / 100)}
              </span>
            </div>

            {/* Legal Terms & Acknowledgement Notice */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-[10px] text-slate-600 space-y-1 mb-6">
              <div className="font-bold text-amber-900 uppercase">Acknowledgement &amp; Terms:</div>
              <div>1. This document acknowledges realization of customer funds against rooftop solar milestones in Rarebox Solar bank account.</div>
              <div>2. Final statutory GST Tax Invoice will be issued upon commissioning of the solar system and net-meter synchronization.</div>
              <div>3. Payments made via Cheque are subject to bank realization. Computer generated voucher — valid with authorized stamp.</div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 pt-6 mt-6 border-t border-slate-300 text-xs">
              <div>
                <div className="h-12"></div>
                <div className="border-t border-slate-400 w-48 pt-1 text-slate-600 font-semibold text-[11px]">
                  Customer / Depositor Signature
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="h-12 flex items-end justify-end">
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold mb-1">
                    ✓ VERIFIED BY ACCOUNTS
                  </span>
                </div>
                <div className="border-t border-slate-400 w-56 pt-1 text-slate-900 font-bold text-[11px]">
                  For RAREBOX SOLAR (RAREBOX LLP)
                  <div className="text-[10px] font-normal text-slate-500">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>

          {/* On-Screen Modal Dialog (Hidden during print) */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 print:hidden !mt-0 !m-0">
            <div className="bg-card border rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[95vh] overflow-y-auto space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="text-base font-black text-foreground">
                    Rarebox Solar <span className="text-xs font-normal text-muted-foreground">(RAREBOX LLP)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    GSTIN: 22AAAFR1234A1Z5 &bull; Raipur, Chhattisgarh
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg text-xs">
                    {receiptData.receiptNumber}
                  </span>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {formatDateTime(receiptData.paymentDate)}
                  </div>
                </div>
              </div>

              {/* Client Info & Mode */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-bold">Received From Client:</span>
                  <div className="font-bold text-foreground text-sm mt-0.5">
                    {receiptData.customer?.name || receiptData.customerId?.name || 'Customer'}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {receiptData.customer?.primaryPhone || receiptData.customerId?.primaryPhone || ''}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-bold">Payment Instrument:</span>
                  <div className="font-bold text-foreground mt-0.5">
                    {receiptData.paymentMethod?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    Ref: {receiptData.transactionReference || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Total Box */}
              <div className="p-4 rounded-xl bg-secondary/40 border flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">Total Realized Amount:</span>
                  <div className="text-2xl font-black text-foreground font-mono mt-0.5">
                    {formatINR(receiptData.amountPaise)}
                  </div>
                  <div className="text-[11px] font-serif italic text-muted-foreground mt-1">
                    {numberToWordsINR(receiptData.amountPaise / 100)}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    receiptData.status === 'VERIFIED'
                      ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                  }`}
                >
                  {receiptData.status}
                </span>
              </div>

              {receiptData.notes && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border">
                  <span className="font-semibold text-foreground">Remarks: </span>
                  {receiptData.notes}
                </div>
              )}

              {/* Legal Disclaimer */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-800 dark:text-amber-300">
                Notice of Fund Realization: This document confirms receipt of customer funds against rooftop solar milestones. Statutory Tax Invoice will be handed over at project commissioning.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 Receipt (Save as PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          MODAL 4: CUSTOMER RECEIVABLES LEDGER / STATEMENT
         ========================================================================= */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Customer Statement of Account</h2>
                <p className="text-xs text-muted-foreground">
                  Client: {statementData?.customer?.name || 'Customer'}
                </p>
              </div>
              <button
                onClick={() => setShowStatementModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statementLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-amber-500" />
                <span>Loading customer statement...</span>
              </div>
            ) : statementData ? (() => {
              const totalContractPaise = (statementData.totalOrderValuePaise && statementData.totalOrderValuePaise > 0)
                ? statementData.totalOrderValuePaise
                : (statementData.totalInvoicedPaise && statementData.totalInvoicedPaise > 0)
                  ? statementData.totalInvoicedPaise
                  : (effectiveContractRupees * 100);
              const totalPaidPaise = statementData.totalPaidPaise ?? statementData.totalRealizedPaise ?? 0;
              const totalPendingPaise = Math.max(0, totalContractPaise - totalPaidPaise);
              const percentPaid = totalContractPaise > 0 ? Math.min(100, Math.round((totalPaidPaise / totalContractPaise) * 100)) : 0;
              const ordersList = statementData.orders ?? statementData.contractedOrders ?? [];
              const paymentsList = statementData.payments || [];

              return (
                <div className="space-y-4">
                  {/* KPI Summary */}
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-secondary/40 border text-xs">
                    <div>
                      <span className="text-muted-foreground">Total Invoiced / Contract</span>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                        {formatINR(totalContractPaise)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Realized Collections</span>
                      <div className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
                        {formatINR(totalPaidPaise)} ({percentPaid}%)
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Outstanding Due</span>
                      <div className="font-mono font-bold text-rose-600 text-sm mt-0.5">
                        {totalPendingPaise > 0 ? formatINR(totalPendingPaise) : '₹0.00 (Settled)'}
                      </div>
                    </div>
                  </div>

                  {/* Payment Receipts History */}
                  {paymentsList.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>Realized Payment Receipts</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {paymentsList.length} receipt{paymentsList.length !== 1 ? 's' : ''} on record
                        </span>
                      </h3>
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-muted-foreground font-semibold">
                            <tr className="border-b">
                              <th className="py-2 px-3">Receipt #</th>
                              <th className="py-2 px-3">Date &amp; Time</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3">Reference / UTR</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                              <th className="py-2 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {paymentsList.map((p: any) => (
                              <tr key={p._id} className="hover:bg-muted/20">
                                <td className="py-2 px-3 font-bold text-amber-600">{p.receiptNumber}</td>
                                <td className="py-2 px-3 font-sans">{formatDateTime(p.paymentDate)}</td>
                                <td className="py-2 px-3 uppercase text-[10px] font-semibold text-foreground font-sans">
                                  {p.paymentMethod?.replace(/_/g, ' ')}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground">{p.transactionReference || '—'}</td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatINR(p.amountPaise)}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Contracted Solar Orders */}
                  {ordersList.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
                        Contracted Solar Orders
                      </h3>
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-muted-foreground font-semibold">
                            <tr className="border-b">
                              <th className="py-2 px-3">Order #</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3 text-right">Order Total</th>
                              <th className="py-2 px-3 text-right">Allocated</th>
                              <th className="py-2 px-3 text-right">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {ordersList.map((o: any) => (
                              <tr key={o.orderId || o._id || o.orderNumber}>
                                <td className="py-2 px-3 text-amber-600">{o.orderNumber}</td>
                                <td className="py-2 px-3 font-sans">{formatDate(o.orderDate)}</td>
                                <td className="py-2 px-3 text-right">{formatINR(o.orderTotalPaise || o.netTotalPaise)}</td>
                                <td className="py-2 px-3 text-right text-emerald-600">
                                  {formatINR(o.allocatedPaise || o.allocatedAmountPaise)}
                                </td>
                                <td className="py-2 px-3 text-right text-rose-600">
                                  {formatINR(o.outstandingPaise || o.outstandingBalancePaise)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No statement records found.
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowStatementModal(false)}
                className="px-4 py-1.5 border rounded-xl hover:bg-muted font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: EDIT PAYMENT REFERENCE & DATE
         ========================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                Edit Payment Details ({editForm.receiptNumber})
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-foreground">Payment Mode</label>
                <select
                  value={editForm.paymentMethod}
                  onChange={e => setEditForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="PAYMENT_GATEWAY">Online Gateway</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Transaction / UTR / Cheque Ref #
                </label>
                <input
                  type="text"
                  value={editForm.transactionReference}
                  onChange={e => setEditForm(prev => ({ ...prev, transactionReference: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-xl bg-background font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">Payment Date</label>
                <input
                  type="date"
                  value={editForm.paymentDate}
                  onChange={e => setEditForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">Notes / Remarks</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: REVERSE / VOID PAYMENT MODAL
         ========================================================================= */}
      {showReverseModal && selectedReversePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 !mt-0 !m-0">
          <div className="bg-card border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Undo2 className="w-4 h-4" />
                Reverse Payment ({selectedReversePayment.receiptNumber})
              </h2>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReverse} className="space-y-3.5 mt-4 text-xs">
              <p className="text-muted-foreground">
                Reversing this payment of{' '}
                <strong className="text-foreground">{formatINR(selectedReversePayment.amountPaise)}</strong>{' '}
                will mark the receipt as void and restore outstanding balances on the customer&apos;s solar order.
              </p>

              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Mandatory Reversal / Bounce Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Cheque returned unpaid / UTR realization failed by bank..."
                  value={reverseReason}
                  onChange={e => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {submitting ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
