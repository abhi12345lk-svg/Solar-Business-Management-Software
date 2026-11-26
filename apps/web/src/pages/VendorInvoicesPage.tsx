/**
 * INS Solar ERP — Vendor Invoices & Accounts Payable Screen
 *
 * Dedicated Supplier Outflow Workflow (Khareedari & Supplier Payout):
 * - Step 2 of the Solar Financial Cycle (Panels, Inverters, Structures, BOS purchase)
 * - Record supplier equipment tax invoices with optional link to Customer's Solar Project
 * - Disburse bank payments / RTGS to suppliers with UTR tracking
 * - Real-time accounts payable dues and supplier balance tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  X,
  CreditCard,
  Calculator,
  Clock
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface VendorInvoiceItem {
  _id: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotalPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balancePayablePaise: number;
  status: string;
  reconciliationNotes?: string;
  documentUrl?: string;
  notes?: string;
  vendorId?: {
    _id: string;
    name: string;
    vendorCode?: string;
    gstin?: string;
    phone?: string;
  };
  purchaseOrderId?: {
    _id: string;
    poNumber: string;
    totalAmountPaise: number;
  };
}

const SOLAR_CATEGORIES = [
  'Solar PV Modules / Panels (Waaree, Adani, etc.)',
  'Solar Inverters & PCU (Growatt, Deye, Havells, etc.)',
  'Mounting Structures & Hardware (GI / Aluminum)',
  'AC/DC Cables & Earthing BOS',
  'ACDB / DCDB & Junction Protection Boxes',
  'Solar Batteries & Energy Storage (BESS)'
];

// Indian GSTIN validation regex: 2 State Digits + 10 PAN alphanumeric + 1 Entity + "Z" + 1 Check Digit
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const isGstinFormatValid = (gstin: string): boolean => {
  if (!gstin || !gstin.trim()) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
};

const GST_PRESETS = [
  { label: '0%', rate: 0, title: '0% (Exempt / Nil Rated)' },
  { label: '5%', rate: 5, title: '5% (Concessional Solar Rate)' },
  { label: '12% (Solar)', rate: 12, title: '12% for Solar Panels & Inverters' },
  { label: '18% (EPC)', rate: 18, title: '18% for Services, BOS & Cables' }
];

export function VendorInvoicesPage() {
  // Safe auth hook (works in both app and isolated test environments)
  let auth: any = { isAdmin: true, hasPermission: () => true };
  try {
    auth = useAuth();
  } catch {
    // Fallback when rendered outside AuthProvider
  }
  const { isAdmin = true, hasPermission = () => true } = auth;
  const canCreateInvoice = isAdmin || hasPermission('vendor_invoice:create') || hasPermission('vendor:create');
  const canManageInvoice = isAdmin || hasPermission('vendor_invoice:update');

  const [invoices, setInvoices] = useState<VendorInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');

  // Master Dropdown Lists
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<any[]>([]);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteTargetInvoice, setDeleteTargetInvoice] = useState<VendorInvoiceItem | null>(null);

  // In-modal errors (clean alerts, replacing window.alert)
  const [formError, setFormError] = useState<string | null>(null);
  const [payFormError, setPayFormError] = useState<string | null>(null);

  // Active GST Preset Rate: 0, 5, 12, 18, or null for manual/custom
  const [activeGstRate, setActiveGstRate] = useState<number | null>(12);

  // Active Selections
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<VendorInvoiceItem | null>(null);
  const [selectedDetailInvoice, setSelectedDetailInvoice] = useState<VendorInvoiceItem | null>(null);

  // Global action status
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Inline Vendor Selection Mode inside Add Bill Modal
  const [vendorMode, setVendorMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [newVendorData, setNewVendorData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    gstin: '',
    isUnregistered: false
  });

  // Invoice Form State
  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getDefaultDueISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseOrderId: '',
    linkedCustomerId: '',
    vendorInvoiceNumber: '',
    invoiceDate: getTodayISO(),
    dueDate: getDefaultDueISO(),
    category: SOLAR_CATEGORIES[0],
    subtotalInr: '',
    taxAmountInr: '',
    totalAmountInr: '',
    notes: ''
  });

  // Pay Bill Form State
  const [payFormData, setPayFormData] = useState({
    amountInr: '',
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    paymentDate: getTodayISO(),
    notes: ''
  });

  const resetInvoiceForm = () => {
    setFormError(null);
    setActiveGstRate(12);
    const defaultVendorId = vendorsList[0]?._id || vendorsList[0]?.id || '';
    setFormData({
      vendorId: defaultVendorId,
      purchaseOrderId: '',
      linkedCustomerId: '',
      vendorInvoiceNumber: '',
      invoiceDate: getTodayISO(),
      dueDate: getDefaultDueISO(),
      category: SOLAR_CATEGORIES[0],
      subtotalInr: '',
      taxAmountInr: '',
      totalAmountInr: '',
      notes: ''
    });
    setNewVendorData({
      name: '',
      contactPerson: '',
      phone: '',
      gstin: '',
      isUnregistered: false
    });
    setVendorMode(vendorsList.length > 0 ? 'EXISTING' : 'NEW');
  };

  // 1. Fetch Invoices from Backend
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=100`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;
      if (vendorFilter && vendorFilter !== 'ALL') query += `&vendorId=${vendorFilter}`;

      const res = await apiClient<any>(`/vendor-invoices${query}`);
      const rawList = res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);
      const list = (Array.isArray(rawList) ? rawList : []).map((inv: any) => ({
        ...inv,
        _id: inv._id || inv.id,
        id: inv.id || inv._id,
        vendorId: inv.vendorId
          ? {
              ...inv.vendorId,
              _id: inv.vendorId._id || inv.vendorId.id,
              id: inv.vendorId.id || inv.vendorId._id
            }
          : undefined
      }));
      setInvoices(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, vendorFilter]);

  // 2. Load Master Dropdowns (Vendors, Customers, and Projects)
  const loadDropdowns = async () => {
    try {
      const [vRes, cRes, pRes, poRes] = await Promise.all([
        apiClient<any>('/vendors?limit=100&isActive=true'),
        apiClient<any>('/customers?limit=100&status=ACTIVE'),
        apiClient<any>('/projects?limit=100').catch(() => null),
        apiClient<any>('/purchase-orders?limit=100').catch(() => null)
      ]);
      const rawVList =
        vRes?.items || vRes?.data?.items || vRes?.data || (Array.isArray(vRes) ? vRes : []);
      const vList = (Array.isArray(rawVList) ? rawVList : []).map((v: any) => ({
        ...v,
        _id: v._id || v.id,
        id: v.id || v._id
      }));

      const rawCList =
        cRes?.items || cRes?.data?.items || cRes?.data || (Array.isArray(cRes) ? cRes : []);
      const cList = (Array.isArray(rawCList) ? rawCList : []).map((c: any) => ({
        ...c,
        _id: c._id || c.id,
        id: c.id || c._id
      }));

      const rawPList =
        pRes?.projects ||
        pRes?.data?.projects ||
        pRes?.items ||
        pRes?.data?.items ||
        (Array.isArray(pRes?.data) ? pRes.data : Array.isArray(pRes) ? pRes : []);
      const pList = (Array.isArray(rawPList) ? rawPList : []).map((p: any) => ({
        ...p,
        _id: p._id || p.id,
        id: p.id || p._id
      }));

      const rawPoList =
        poRes?.items || poRes?.data?.items || poRes?.data || (Array.isArray(poRes) ? poRes : []);
      const poList = (Array.isArray(rawPoList) ? rawPoList : []).map((po: any) => ({
        ...po,
        _id: po._id || po.id,
        id: po.id || po._id
      }));

      setVendorsList(vList);
      setCustomersList(cList);
      setProjectsList(pList);
      setPurchaseOrdersList(poList);
      if (vList.length === 0) {
        setVendorMode('NEW');
      } else {
        setFormData(prev => ({
          ...prev,
          vendorId: prev.vendorId || vList[0]._id || vList[0].id || ''
        }));
      }
    } catch (err) {
      console.error('Failed to load dropdowns', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    loadDropdowns();
  }, []);

  // 3. Dynamic GST Rate & Real-Time Calculation Handlers
  const applyGSTRate = (ratePercent: number) => {
    setActiveGstRate(ratePercent);
    const sub = parseFloat(formData.subtotalInr) || 0;
    if (sub <= 0) {
      setFormData(prev => ({
        ...prev,
        taxAmountInr: ratePercent === 0 ? '0' : prev.taxAmountInr,
        totalAmountInr: ratePercent === 0 && sub > 0 ? sub.toString() : prev.totalAmountInr
      }));
      return;
    }
    const tax = Math.round(sub * (ratePercent / 100) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      taxAmountInr: tax.toString(),
      totalAmountInr: total.toString()
    }));
  };

  const handleSubtotalChange = (val: string) => {
    const sub = parseFloat(val) || 0;
    if (activeGstRate !== null && activeGstRate >= 0) {
      const tax = Math.round(sub * (activeGstRate / 100) * 100) / 100;
      const total = Math.round((sub + tax) * 100) / 100;
      setFormData(prev => ({
        ...prev,
        subtotalInr: val,
        taxAmountInr: sub > 0 ? tax.toString() : '',
        totalAmountInr: sub > 0 ? total.toString() : ''
      }));
    } else {
      const tax = parseFloat(formData.taxAmountInr) || 0;
      const total = Math.round((sub + tax) * 100) / 100;
      setFormData(prev => ({
        ...prev,
        subtotalInr: val,
        totalAmountInr: sub > 0 ? total.toString() : ''
      }));
    }
  };

  const handleTaxChange = (val: string) => {
    setActiveGstRate(null); // Switch to manual custom tax mode
    const sub = parseFloat(formData.subtotalInr) || 0;
    const tax = parseFloat(val) || 0;
    const total = Math.round((sub + tax) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      taxAmountInr: val,
      totalAmountInr: total > 0 ? total.toString() : (sub > 0 ? sub.toString() : '')
    }));
  };

  const handleTotalChange = (val: string) => {
    setActiveGstRate(null);
    const total = parseFloat(val) || 0;
    const sub = parseFloat(formData.subtotalInr) || 0;
    const tax = Math.max(0, Math.round((total - sub) * 100) / 100);
    setFormData(prev => ({
      ...prev,
      totalAmountInr: val,
      taxAmountInr: sub > 0 && total >= sub ? tax.toString() : prev.taxAmountInr
    }));
  };

  // 4. Create Vendor Invoice Submit (with Auto-Supplier Creation if NEW)
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setSubmitting(true);
      setError(null);

      let targetVendorId = formData.vendorId;

      // If user is adding a new supplier inline:
      if (vendorMode === 'NEW') {
        const cleanName = newVendorData.name.trim();
        if (!cleanName) {
          setFormError('Please enter the Supplier / Company name.');
          setSubmitting(false);
          return;
        }

        let cleanGstin: string | undefined = undefined;
        if (!newVendorData.isUnregistered && newVendorData.gstin.trim()) {
          cleanGstin = newVendorData.gstin.trim().toUpperCase();
          if (!GSTIN_REGEX.test(cleanGstin)) {
            setFormError(
              `Invalid GSTIN "${cleanGstin}". Indian GSTIN format must be exactly 15 alphanumeric characters (e.g. 22AAAAA0000A1Z5: 2 digits State + 10 alphanumeric PAN + 1 Entity + "Z" + 1 Check Digit). If this supplier does not have a GST registration, check "Unregistered Vendor".`
            );
            setSubmitting(false);
            return;
          }
        }

        const vendorRes = await apiClient<any>('/vendors', {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            contactPerson: newVendorData.contactPerson.trim() || undefined,
            phone: newVendorData.phone.trim() || undefined,
            gstin: cleanGstin
          })
        });

        const rawCreated = vendorRes?.data || vendorRes;
        const newVendorId = rawCreated?._id || rawCreated?.id;
        if (!newVendorId) {
          setFormError('Failed to retrieve newly created supplier ID. Please select from Existing suppliers.');
          setSubmitting(false);
          return;
        }
        const createdVendor = {
          ...rawCreated,
          _id: newVendorId,
          id: newVendorId
        };
        targetVendorId = newVendorId;
        setVendorsList(prev => [createdVendor, ...prev]);
        setFormData(prev => ({ ...prev, vendorId: newVendorId }));
      }

      // If existing vendor selected, resolve ID safely:
      if (!targetVendorId) {
        setFormError('Please select or specify a Supplier / Vendor.');
        setSubmitting(false);
        return;
      }

      // Safeguard: If targetVendorId is a vendor name or label instead of a 24-char ObjectId, find the real ID from vendorsList
      if (!/^[0-9a-fA-F]{24}$/.test(targetVendorId)) {
        const found = vendorsList.find(
          v =>
            (v._id || v.id) === targetVendorId ||
            v.name?.trim().toLowerCase() === targetVendorId.trim().toLowerCase() ||
            targetVendorId.includes(v.name)
        );
        if (found && (found._id || found.id)) {
          targetVendorId = found._id || found.id;
        } else {
          setFormError('Selected supplier is invalid. Please select an existing supplier from the list or create a new one.');
          setSubmitting(false);
          return;
        }
      }

      const subtotal = parseFloat(formData.subtotalInr) || 0;
      const tax = parseFloat(formData.taxAmountInr) || 0;
      const total = parseFloat(formData.totalAmountInr) || subtotal + tax;

      if (total <= 0) {
        setFormError('Invoice total amount must be greater than ₹0.');
        setSubmitting(false);
        return;
      }

      // Link project/customer info if selected
      let projectPrefix = '';
      if (formData.linkedCustomerId) {
        if (formData.linkedCustomerId.startsWith('PRJ:')) {
          const parts = formData.linkedCustomerId.split(':');
          projectPrefix = `[Project: ${parts[2] || parts[1]}] `;
        } else {
          const matchedCustomer = customersList.find(
            c => (c._id || c.id) === formData.linkedCustomerId
          );
          if (matchedCustomer) {
            projectPrefix = `[Customer: ${matchedCustomer.name}] `;
          }
        }
      }
      const particularsNote = `${projectPrefix}[${formData.category}] ${formData.notes || ''}`.trim();

      const payload = {
        vendorId: targetVendorId,
        purchaseOrderId: formData.purchaseOrderId || undefined,
        vendorInvoiceNumber: formData.vendorInvoiceNumber.trim(),
        invoiceDate: new Date(formData.invoiceDate || Date.now()).toISOString(),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        subtotalPaise: Math.round(subtotal * 100),
        taxAmountPaise: Math.round(tax * 100),
        totalAmountPaise: Math.round(total * 100),
        notes: particularsNote || undefined
      };

      await apiClient('/vendor-invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsAddModalOpen(false);
      resetInvoiceForm();
      await fetchInvoices();
      setActionSuccess(`Supplier Bill #${payload.vendorInvoiceNumber} recorded successfully!`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save supplier bill. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Pay Bill Modal Open & Submit (Disbursement to Vendor)
  const handleOpenPayModal = (inv: VendorInvoiceItem) => {
    if (inv.status === 'DISPUTED' || inv.status === 'CANCELLED') {
      setPayFormError(`Disbursement is blocked while bill ${inv.vendorInvoiceNumber} is ${inv.status}.`);
      return;
    }
    setSelectedPayInvoice(inv);
    setPayFormError(null);
    const balanceInr = (inv.balancePayablePaise / 100).toFixed(2);
    setPayFormData({
      amountInr: balanceInr,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: `RTGS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      paymentDate: getTodayISO(),
      notes: `Bank payout for supplier bill ${inv.vendorInvoiceNumber}`
    });
    setIsPayModalOpen(true);
  };

  const handleRecordBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayFormError(null);
    if (!selectedPayInvoice) return;
    try {
      setSubmitting(true);
      const amountPaise = Math.round(Number(payFormData.amountInr) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        setPayFormError('Please enter a valid disbursement amount greater than ₹0.');
        setSubmitting(false);
        return;
      }
      if (amountPaise > selectedPayInvoice.balancePayablePaise) {
        setPayFormError(`Disbursement amount cannot exceed remaining balance of ₹${(selectedPayInvoice.balancePayablePaise / 100).toFixed(2)}.`);
        setSubmitting(false);
        return;
      }

      const invId = selectedPayInvoice._id || (selectedPayInvoice as any).id;
      await apiClient(`/vendor-invoices/${invId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaise,
          paymentMethod: payFormData.paymentMethod,
          paymentReference: payFormData.paymentReference.trim() || undefined,
          notes: payFormData.notes.trim() || undefined
        })
      });

      setActionSuccess(`Disbursement of ₹${payFormData.amountInr} paid to supplier against Bill #${selectedPayInvoice.vendorInvoiceNumber}!`);
      setIsPayModalOpen(false);
      setSelectedPayInvoice(null);
      await fetchInvoices();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setPayFormError(err.message || 'Failed to disburse payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Delete Invoice Confirmation
  const confirmDeleteInvoice = async () => {
    if (!deleteTargetInvoice) return;
    try {
      setSubmitting(true);
      const invId = deleteTargetInvoice._id || (deleteTargetInvoice as any).id;
      await apiClient(`/vendor-invoices/${invId}`, { method: 'DELETE' });
      setActionSuccess(`Supplier Bill #${deleteTargetInvoice.vendorInvoiceNumber} deleted successfully.`);
      setDeleteTargetInvoice(null);
      await fetchInvoices();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // Financial aggregates
  const totalBilledPaise = invoices.reduce((sum, inv) => sum + (inv.totalAmountPaise || 0), 0);
  const totalPaidPaise = invoices.reduce((sum, inv) => sum + (inv.paidAmountPaise || 0), 0);
  const totalBalanceDuePaise = invoices.reduce(
    (sum, inv) => sum + (inv.balancePayablePaise || 0),
    0
  );

  const formatINR = (paise?: number) => {
    if (paise === undefined || isNaN(paise)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(paise / 100);
  };

  // Clean Payment Status Badge
  const getPaymentStatusBadge = (inv: VendorInvoiceItem) => {
    if (inv.status === 'DISPUTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
          <AlertCircle className="w-3 h-3 text-orange-600" />
          <span>Disputed</span>
        </span>
      );
    }
    if (inv.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
          <AlertCircle className="w-3 h-3 text-slate-600" />
          <span>Cancelled</span>
        </span>
      );
    }
    const isPaid = (inv.balancePayablePaise || 0) === 0;
    const isPartial = (inv.paidAmountPaise || 0) > 0 && (inv.balancePayablePaise || 0) > 0;

    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Paid</span>
        </span>
      );
    }
    if (isPartial) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Partially Paid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
        <AlertCircle className="w-3 h-3 text-rose-600" />
        <span>Unpaid</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* =========================================================================
          PAGE HEADER: Title, Purpose, & Action Button
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Vendor Invoices &amp; Bills</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Panels &amp; Inverters
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record major solar hardware purchases (Panels, Inverters, Structures, Cables) and supplier payables.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            onClick={() => {
              loadDropdowns();
              fetchInvoices();
            }}
            className="p-2 border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {canCreateInvoice && (
            <button
              onClick={() => {
                loadDropdowns();
                resetInvoiceForm();
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Equipment Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          FINANCIAL KPI SUMMARY (3 Simple, Logical Accounts Cards)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Total Invoiced Value */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Total Invoiced (Material Bills)</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground mt-2 font-mono">
            {formatINR(totalBilledPaise)}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium mt-0.5 block">
            {invoices.length} supplier {invoices.length === 1 ? 'bill' : 'bills'} recorded
          </span>
        </div>

        {/* Card 2: Paid to Vendors */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Disbursed to Suppliers</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {formatINR(totalPaidPaise)}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
            Bank transfers / payouts released
          </span>
        </div>

        {/* Card 3: Outstanding Payables (Balance Due) */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Outstanding Supplier Dues</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {formatINR(totalBalanceDuePaise)}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5 block">
            Pending supplier payments to clear
          </span>
        </div>
      </div>

      {/* =========================================================================
          FILTER & SEARCH STRIP
         ========================================================================= */}
      <div className="p-3 bg-card border rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by bill #, supplier name, particulars..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-background border rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Status Filter Tabs & Supplier Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl bg-secondary p-0.5 border text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Bills
            </button>
            <button
              onClick={() => setStatusFilter('UNPAID')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'UNPAID'
                  ? 'bg-card text-rose-600 shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unpaid / Due
            </button>
            <button
              onClick={() => setStatusFilter('PAID')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'PAID'
                  ? 'bg-card text-emerald-600 shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Paid
            </button>
          </div>

          {/* Supplier Dropdown Filter */}
          {vendorsList.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <select
                value={vendorFilter}
                onChange={e => setVendorFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-background border rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none max-w-[180px] truncate"
              >
                <option value="ALL">All Suppliers</option>
                {vendorsList.map(v => {
                  const vId = v._id || v.id;
                  return (
                    <option key={vId} value={vId}>
                      {v.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {(statusFilter !== 'ALL' || vendorFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setVendorFilter('ALL');
                setSearch('');
              }}
              className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground font-semibold rounded-lg hover:bg-muted cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          NOTIFICATIONS
         ========================================================================= */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* =========================================================================
          VENDOR BILLS LEDGER TABLE
         ========================================================================= */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground border-b text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Bill / Invoice #</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4">Equipment &amp; Particulars</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading supplier bills...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-foreground text-sm">No supplier bills recorded</div>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter !== 'ALL' || vendorFilter !== 'ALL'
                          ? 'No bills match your current filter. Try resetting.'
                          : 'Record purchase bills for Solar Panels, Inverters, Structures or site supplies.'}
                      </p>
                      {canCreateInvoice && !search && statusFilter === 'ALL' && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              resetInvoiceForm();
                              setIsAddModalOpen(true);
                            }}
                            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Vendor Bill</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => {
                  const hasDue = (inv.balancePayablePaise || 0) > 0;

                  return (
                    <tr key={inv._id} className="hover:bg-muted/20 transition-colors">
                      {/* Bill / Invoice # */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-500">
                        {inv.vendorInvoiceNumber}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {inv.vendorId?.name || 'Supplier'}
                        </div>
                        {inv.vendorId?.gstin && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            GST: {inv.vendorId.gstin}
                          </div>
                        )}
                      </td>

                      {/* Bill Date */}
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="font-medium text-foreground">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        {inv.dueDate && (
                          <div className="text-[10px] text-muted-foreground">
                            Due: {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </td>

                      {/* Particulars */}
                      <td className="py-3 px-4 text-muted-foreground max-w-[220px] truncate" title={inv.notes || 'Equipment Purchase'}>
                        {inv.notes || 'Equipment Purchase'}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatINR(inv.totalAmountPaise)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatINR(inv.paidAmountPaise)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3 px-4 text-right font-mono font-black">
                        <div className={hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {formatINR(inv.balancePayablePaise)}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 text-center">
                        {getPaymentStatusBadge(inv)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Disburse to Supplier (if outstanding due and not disputed/cancelled) */}
                          {canManageInvoice &&
                            hasDue &&
                            inv.status !== 'DISPUTED' &&
                            inv.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(inv)}
                              className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Pay / Disburse to supplier"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay Bill</span>
                            </button>
                          )}

                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailInvoice(inv);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2 py-1 text-[11px] rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold border transition cursor-pointer"
                            title="View details"
                          >
                            Details
                          </button>

                          {/* Delete (only if no payments made) */}
                          {canManageInvoice && (inv.paidAmountPaise || 0) === 0 && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetInvoice(inv)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Delete bill"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: ADD SUPPLIER PURCHASE BILL (OUTFLOW)
         ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 !mt-0 !m-0">
          <div className="w-full max-w-lg bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto !mt-0 !m-0">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-500" />
                  <span>Record Equipment Purchase Bill</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                    Material Outflow (-)
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Record equipment tax invoices (Panels, Inverters, Structures, Cables) from manufacturers or distributors.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-Modal Error Banner */}
            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium leading-relaxed">{formError}</div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              {/* Supplier Selection Mode: Choose Existing vs + New Supplier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Equipment Supplier / Manufacturer *
                  </label>
                  <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 border text-[11px]">
                    <button
                      type="button"
                      onClick={() => setVendorMode('EXISTING')}
                      disabled={vendorsList.length === 0}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        vendorMode === 'EXISTING'
                          ? 'bg-card text-foreground font-bold shadow-2xs'
                          : 'text-muted-foreground'
                      } ${vendorsList.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      Existing ({vendorsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorMode('NEW')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        vendorMode === 'NEW'
                          ? 'bg-amber-600 text-white font-bold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      + New Supplier
                    </button>
                  </div>
                </div>

                {vendorMode === 'EXISTING' ? (
                  <select
                    required
                    value={formData.vendorId}
                    onChange={e => {
                      setFormData({ ...formData, vendorId: e.target.value });
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- Choose Supplier (e.g. Waaree, Growatt, Havells) --</option>
                    {vendorsList.map(v => {
                      const vId = v._id || v.id;
                      return (
                        <option key={vId} value={vId}>
                          {v.name} {v.gstin ? `(GST: ${v.gstin})` : '(No GST)'}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-3.5 rounded-xl border bg-secondary/30 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Supplier / Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Waaree Energies Ltd, Tata Power Solar, Local Fabricator"
                        value={newVendorData.name}
                        onChange={e => {
                          setNewVendorData({ ...newVendorData, name: e.target.value });
                          if (formError) setFormError(null);
                        }}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    {/* Unregistered Vendor (No GST) Checkbox */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/60">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newVendorData.isUnregistered}
                          onChange={e => {
                            const checked = e.target.checked;
                            setNewVendorData(prev => ({
                              ...prev,
                              isUnregistered: checked,
                              gstin: checked ? '' : prev.gstin
                            }));
                            if (formError) setFormError(null);
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-foreground">
                          Unregistered Vendor (No GSTIN / Local Small Supplier)
                        </span>
                      </label>
                      {newVendorData.isUnregistered && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          Non-GST Supplier
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* GSTIN field with live validation & helper */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-foreground">
                            GSTIN {newVendorData.isUnregistered ? '(Disabled)' : '(15-Char Tax ID)'}
                          </label>
                          {!newVendorData.isUnregistered && newVendorData.gstin.trim().length > 0 && (
                            <span
                              className={`text-[10px] font-mono font-semibold ${
                                isGstinFormatValid(newVendorData.gstin)
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isGstinFormatValid(newVendorData.gstin)
                                ? '✓ Valid Format'
                                : `${newVendorData.gstin.trim().length}/15`}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          disabled={newVendorData.isUnregistered}
                          maxLength={15}
                          placeholder={
                            newVendorData.isUnregistered
                              ? 'Unregistered (No GST required)'
                              : 'e.g. 22AAAAA0000A1Z5'
                          }
                          value={newVendorData.gstin}
                          onChange={e => {
                            const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
                            setNewVendorData({ ...newVendorData, gstin: val });
                            if (formError) setFormError(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                            newVendorData.isUnregistered
                              ? 'bg-muted/50 text-muted-foreground cursor-not-allowed border-dashed'
                              : newVendorData.gstin && !isGstinFormatValid(newVendorData.gstin)
                              ? 'border-amber-500 bg-amber-50/20 text-amber-900 dark:text-amber-200'
                              : 'bg-background text-foreground'
                          }`}
                        />
                        {!newVendorData.isUnregistered && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">
                            Format: 2 State + 10 PAN + 1 + Z + 1 (e.g. 22AAAAA0000A1Z5)
                          </span>
                        )}
                      </div>

                      {/* Phone / Contact */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Phone / Mobile (Optional)
                        </label>
                        <input
                          type="tel"
                          maxLength={15}
                          placeholder="e.g. 9876543210"
                          value={newVendorData.phone}
                          onChange={e => setNewVendorData({ ...newVendorData, phone: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Vendor dispatch / accounts contact
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Contact Person Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar (Sales Head)"
                        value={newVendorData.contactPerson}
                        onChange={e =>
                          setNewVendorData({ ...newVendorData, contactPerson: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Purchase Order Link for Automated 3-Way Match */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Associated Purchase Order (3-Way Match)
                </label>
                <select
                  value={formData.purchaseOrderId}
                  onChange={e => {
                    const poId = e.target.value;
                    const poObj = purchaseOrdersList.find(p => (p._id || p.id) === poId);
                    const poVendorId = poObj?.vendorId?._id || poObj?.vendorId?.id || poObj?.vendorId || '';
                    const poProjectId = poObj?.projectId?._id || poObj?.projectId?.id || poObj?.projectId || '';
                    const poProjectName = poObj?.projectId?.name || poObj?.projectId?.projectCode || '';
                    setFormData(prev => ({
                      ...prev,
                      purchaseOrderId: poId,
                      vendorId: poVendorId || prev.vendorId,
                      linkedCustomerId: poProjectId ? `PRJ:${poProjectId}:${poProjectName || poProjectId}` : prev.linkedCustomerId
                    }));
                    if (poVendorId) setVendorMode('EXISTING');
                    if (formError) setFormError(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">-- Direct Expense Bill (No Purchase Order / 3-Way Match) --</option>
                  {purchaseOrdersList.map(po => {
                    const poId = po._id || po.id;
                    const vName = po.vendorId?.name || '';
                    const tot = po.grandTotalPaise || po.totalAmountPaise || 0;
                    return (
                      <option key={poId} value={poId}>
                        {po.poNumber} {vName ? `• ${vName}` : ''} • ₹{(tot / 100).toLocaleString('en-IN')} ({po.status})
                      </option>
                    );
                  })}
                </select>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Select a PO to enforce automated 3-way matching against physical GRN accepted quantities.
                </span>
              </div>

              {/* Optional Link to Customer's Solar Project */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Associated Customer / Project (Optional)
                </label>
                <select
                  value={formData.linkedCustomerId}
                  onChange={e => setFormData({ ...formData, linkedCustomerId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">-- General Stock / Warehouse Inventory (No specific site) --</option>
                  {projectsList.length > 0 && (
                    <optgroup label="Active Solar EPC Projects">
                      {projectsList.map(p => {
                        const pId = p._id || p.id;
                        return (
                          <option key={pId} value={`PRJ:${pId}:${p.name || p.projectCode}`}>
                            Project: {p.projectCode ? `${p.projectCode} - ` : ''}
                            {p.name} {p.systemCapacityKw ? `(${p.systemCapacityKw} kW)` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {customersList.length > 0 && (
                    <optgroup label="Rooftop Customers">
                      {customersList.map(c => {
                        const cId = c._id || c.id;
                        return (
                          <option key={cId} value={cId}>
                            Customer: {c.name} {c.primaryPhone ? `(${c.primaryPhone})` : ''}{' '}
                            {c.city ? `• ${c.city}` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Select customer or project if material was purchased specifically for a rooftop site order.
                </span>
              </div>

              {/* Bill Number & Invoice Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Supplier Bill / Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-9021"
                    value={formData.vendorInvoiceNumber}
                    onChange={e => {
                      setFormData({ ...formData, vendorInvoiceNumber: e.target.value });
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoiceDate}
                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Equipment / Service Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    {SOLAR_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Amount Breakdown with Quick GST Buttons & Real-Time Math */}
              <div className="p-3.5 rounded-xl border bg-secondary/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-500" />
                    <span>Purchase Cost &amp; GST Breakdown (₹)</span>
                  </span>
                  {/* Dynamic GST Preset Buttons */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground mr-0.5">GST:</span>
                    {GST_PRESETS.map(p => {
                      const isActive = activeGstRate === p.rate;
                      return (
                        <button
                          key={p.rate}
                          type="button"
                          onClick={() => applyGSTRate(p.rate)}
                          className={`px-2 py-0.5 rounded cursor-pointer transition ${
                            isActive
                              ? 'bg-amber-600 text-white font-bold shadow-2xs'
                              : 'bg-card border text-muted-foreground hover:text-foreground hover:bg-muted font-medium'
                          }`}
                          title={p.title}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Base Cost (Taxable ₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 150000"
                      value={formData.subtotalInr}
                      onChange={e => {
                        handleSubtotalChange(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-muted-foreground">
                        GST Tax (₹)
                      </label>
                      {activeGstRate !== null && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                          @{activeGstRate}%
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 18000"
                      value={formData.taxAmountInr}
                      onChange={e => {
                        handleTaxChange(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Total Bill Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 168000"
                      value={formData.totalAmountInr}
                      onChange={e => {
                        handleTotalChange(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs font-mono font-black text-amber-600 dark:text-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks / Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Item Particulars / Shipment Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. 550Wp bifacial solar panels batch shipment (10 nos)"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border hover:bg-muted font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : '+ Record Equipment Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DISBURSE VENDOR PAYMENT (OUTFLOW)
         ========================================================================= */}
      {isPayModalOpen && selectedPayInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 !mt-0 !m-0">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto !mt-0 !m-0">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Disburse Supplier Payment</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                    Bank Outflow (-)
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Bill: {selectedPayInvoice.vendorInvoiceNumber} • {selectedPayInvoice.vendorId?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-Modal Error Banner */}
            {payFormError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium leading-relaxed">{payFormError}</div>
                <button
                  type="button"
                  onClick={() => setPayFormError(null)}
                  className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Bill Financial Summary */}
            <div className="p-3.5 rounded-xl bg-secondary/30 border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bill Value:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatINR(selectedPayInvoice.totalAmountPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(selectedPayInvoice.paidAmountPaise)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-foreground font-bold">Remaining Balance Due:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  {formatINR(selectedPayInvoice.balancePayablePaise)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordBillPayment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Amount to Disburse (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedPayInvoice.balancePayablePaise / 100}
                    required
                    value={payFormData.amountInr}
                    onChange={e => {
                      setPayFormData({ ...payFormData, amountInr: e.target.value });
                      if (payFormError) setPayFormError(null);
                    }}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Disbursement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payFormData.paymentDate}
                    onChange={e => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payFormData.paymentMethod}
                  onChange={e => setPayFormData({ ...payFormData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (RTGS / NEFT / IMPS)</option>
                  <option value="UPI">Company UPI Payout</option>
                  <option value="CHEQUE">Company Cheque Clearance</option>
                  <option value="CASH">Cash Voucher (Minor Site Purchases)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bank UTR / Transaction / Cheque Ref # *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-HDFC-9912048 or UPI-88371902"
                  value={payFormData.paymentReference}
                  onChange={e => {
                    setPayFormData({ ...payFormData, paymentReference: e.target.value });
                    if (payFormError) setPayFormError(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Accounts Remarks / Purpose
                </label>
                <input
                  type="text"
                  value={payFormData.notes}
                  onChange={e => setPayFormData({ ...payFormData, notes: e.target.value })}
                  placeholder="e.g. Advance transfer for panel dispatch to site."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border hover:bg-muted font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Disbursing...' : 'Confirm Bank Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: VIEW SUPPLIER BILL DETAILS
         ========================================================================= */}
      {isDetailModalOpen && selectedDetailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 !mt-0 !m-0">
          <div className="w-full max-w-lg bg-card rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto !mt-0 !m-0">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground font-mono">
                    Bill #{selectedDetailInvoice.vendorInvoiceNumber}
                  </h3>
                  {getPaymentStatusBadge(selectedDetailInvoice)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supplier: {selectedDetailInvoice.vendorId?.name || 'Vendor'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl border bg-secondary/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Billed</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatINR(selectedDetailInvoice.totalAmountPaise)}
                </span>
              </div>
              <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Disbursed</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatINR(selectedDetailInvoice.paidAmountPaise)}
                </span>
              </div>
              <div className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/20">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-semibold block">Balance Due</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {formatINR(selectedDetailInvoice.balancePayablePaise)}
                </span>
              </div>
            </div>

            {/* Bill Details */}
            <div className="p-3.5 rounded-xl border bg-secondary/10 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Supplier Name:</span>
                  <span className="font-semibold text-foreground">
                    {selectedDetailInvoice.vendorId?.name || 'Supplier'}
                  </span>
                  {selectedDetailInvoice.vendorId?.gstin ? (
                    <span className="block text-[11px] font-mono text-muted-foreground">
                      GSTIN: {selectedDetailInvoice.vendorId.gstin}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-muted-foreground">
                      Unregistered (No GST)
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bill Date:</span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedDetailInvoice.invoiceDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {selectedDetailInvoice.dueDate && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Due Date:</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedDetailInvoice.dueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block text-[11px]">Taxable / GST:</span>
                  <span className="font-medium font-mono text-foreground">
                    {formatINR(selectedDetailInvoice.subtotalPaise)} + {formatINR(selectedDetailInvoice.taxAmountPaise)} GST
                  </span>
                </div>
              </div>

              {selectedDetailInvoice.notes && (
                <div className="border-t pt-2 mt-2">
                  <span className="text-muted-foreground block text-[11px]">Particulars / Project:</span>
                  <p className="font-medium text-foreground text-xs mt-0.5">
                    {selectedDetailInvoice.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Payment History / Audit trail notes */}
            {selectedDetailInvoice.reconciliationNotes && (
              <div className="p-3 rounded-xl border bg-card text-xs space-y-1">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] block">
                  Disbursement History &amp; Bank Log:
                </span>
                <p className="text-foreground text-[11px]">
                  {selectedDetailInvoice.reconciliationNotes}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t">
              {selectedDetailInvoice.status === 'DISPUTED' ||
              selectedDetailInvoice.status === 'CANCELLED' ? (
                <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Payment Blocked ({selectedDetailInvoice.status})
                </span>
              ) : selectedDetailInvoice.balancePayablePaise > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenPayModal(selectedDetailInvoice);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Disburse Balance {formatINR(selectedDetailInvoice.balancePayablePaise)}</span>
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled &amp; Paid
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DELETE INVOICE CONFIRMATION
         ========================================================================= */}
      {deleteTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 !mt-0 !m-0">
          <div className="w-full max-w-sm bg-card rounded-2xl border shadow-2xl p-5 space-y-4 !mt-0 !m-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Delete Supplier Bill?</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Bill #{deleteTargetInvoice.vendorInvoiceNumber}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this bill from{' '}
              <strong className="text-foreground">
                {deleteTargetInvoice.vendorId?.name || 'Supplier'}
              </strong>{' '}
              for <strong className="text-foreground">{formatINR(deleteTargetInvoice.totalAmountPaise)}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeleteTargetInvoice(null)}
                className="px-3.5 py-1.5 text-xs rounded-xl border hover:bg-muted font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmDeleteInvoice}
                className="px-4 py-1.5 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Yes, Delete Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
