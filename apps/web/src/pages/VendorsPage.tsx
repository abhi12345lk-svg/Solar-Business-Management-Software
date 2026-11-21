import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Edit2,
  MapPin,
  FileCheck
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface VendorItem {
  _id?: string;
  id?: string;
  vendorCode: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  paymentTermsDays: number;
  isActive: boolean;
  hasPurchaseHistory?: boolean;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  notes?: string;
  createdAt: string;
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    pan: '',
    paymentTermsDays: 30,
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    notes: ''
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=50&search=${encodeURIComponent(search)}`;
      if (statusFilter === 'ACTIVE') query += '&isActive=true';
      if (statusFilter === 'INACTIVE') query += '&isActive=false';

      const res = await apiClient<any>(`/vendors${query}`);
      const list = res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);
      setVendors(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [search, statusFilter]);

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      gstin: '',
      pan: '',
      paymentTermsDays: 30,
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      notes: ''
    });
    setEditingVendor(null);
  };

  const openRegisterModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: VendorItem) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      gstin: vendor.gstin || '',
      pan: vendor.pan || '',
      paymentTermsDays: vendor.paymentTermsDays || 30,
      addressLine1: vendor.address?.addressLine1 || '',
      city: vendor.address?.city || '',
      state: vendor.address?.state || '',
      postalCode: vendor.address?.postalCode || '',
      notes: vendor.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        gstin: formData.gstin ? formData.gstin.toUpperCase() : undefined,
        pan: formData.pan ? formData.pan.toUpperCase() : undefined,
        paymentTermsDays: Number(formData.paymentTermsDays),
        address: formData.addressLine1
          ? {
              addressLine1: formData.addressLine1,
              city: formData.city,
              state: formData.state,
              postalCode: formData.postalCode,
              country: 'India'
            }
          : undefined,
        notes: formData.notes || undefined
      };

      if (editingVendor) {
        const vendorId = editingVendor._id || editingVendor.id;
        await apiClient(`/vendors/${vendorId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiClient('/vendors', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setIsModalOpen(false);
      resetForm();
      await fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (vendorId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this vendor?')) return;
    try {
      await apiClient(`/vendors/${vendorId}/deactivate`, { method: 'POST' });
      await fetchVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate vendor');
    }
  };

  const totalCount = vendors.length;
  const activeCount = vendors.filter(v => v.isActive).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-7 h-7 text-solar-600" />
            Vendor Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage Tier-1 solar module OEMs, string inverter suppliers, and hardware credit terms.
          </p>
        </div>
        <button
          onClick={openRegisterModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-solar-600 text-white font-semibold text-sm hover:bg-solar-500 shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Vendor</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Suppliers
            </p>
            <p className="text-2xl font-black text-foreground mt-1">{totalCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-solar-500/10 text-solar-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Suppliers
            </p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Inactive
            </p>
            <p className="text-2xl font-black text-muted-foreground mt-1">
              {totalCount - activeCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-secondary text-muted-foreground">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by vendor name, code, GSTIN..."
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
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-solar-500 cursor-pointer"
          >
            <option value="ALL">All Vendors ({totalCount})</option>
            <option value="ACTIVE">Active Suppliers ({activeCount})</option>
            <option value="INACTIVE">Inactive ({totalCount - activeCount})</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Vendors Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Vendor Code</th>
                <th className="py-3 px-4 font-semibold">Vendor / Supplier</th>
                <th className="py-3 px-4 font-semibold">Contact Details</th>
                <th className="py-3 px-4 font-semibold">GSTIN / Tax</th>
                <th className="py-3 px-4 font-semibold">Credit Terms</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground text-xs">
                    Loading suppliers...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs space-y-2">
                    <p className="font-semibold text-sm text-foreground">No suppliers found</p>
                    <p>Register your solar hardware manufacturers (Waaree, Solis, Polycab) to start raising POs.</p>
                  </td>
                </tr>
              ) : (
                vendors.map(vendor => {
                  const vendorId = vendor._id || vendor.id || '';
                  return (
                    <tr key={vendorId} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-foreground">
                        {vendor.vendorCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{vendor.name}</div>
                        {vendor.contactPerson && (
                          <div className="text-xs text-muted-foreground">{vendor.contactPerson}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {vendor.phone && (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{vendor.phone}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <Mail className="w-3.5 h-3.5" />
                            <span>{vendor.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-foreground">
                        {vendor.gstin || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground">
                        {vendor.paymentTermsDays} Days Net
                      </td>
                      <td className="py-3 px-4">
                        {vendor.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/purchase-orders?vendorId=${vendorId}&action=new`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-300 transition-colors"
                            title="Raise Purchase Order for this supplier"
                          >
                            <FileText className="w-3 h-3" />
                            <span>+ Raise PO</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(vendor)}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Edit vendor profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {vendor.isActive && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(vendorId)}
                              className="text-xs text-destructive hover:underline font-medium cursor-pointer"
                            >
                              Deactivate
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

      {/* Spacious 2-Column Vendor Register / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-solar-600" />
                  {editingVendor ? 'Edit Supplier Profile' : 'Register New Supplier / Vendor'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingVendor
                    ? `Updating details for ${editingVendor.name} (${editingVendor.vendorCode})`
                    : 'Add Tier-1 solar equipment manufacturer, inverter OEM, or electrical hardware distributor.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitVendor} className="space-y-4 text-sm">
              {/* Section 1: Commercial Identity */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 text-solar-600">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>1. Business & Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Vendor / Supplier Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Waaree Energies Limited / Solis Power"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="Key Account Manager name"
                      value={formData.contactPerson}
                      onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+919876543210"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      placeholder="orders@supplier.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Payment Terms (Days Net)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      placeholder="30"
                      value={formData.paymentTermsDays}
                      onChange={e =>
                        setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Taxation & Invoicing */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 text-solar-600">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>2. Tax & Registration (GSTIN & PAN)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      GSTIN (15-character uppercase)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="24AAACA1234A1Z5"
                      value={formData.gstin}
                      onChange={e =>
                        setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      PAN (10-character uppercase)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="AAACA1234A"
                      value={formData.pan}
                      onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Registered Address */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 text-solar-600">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>3. Factory / Registered Address</span>
                </div>
                <input
                  type="text"
                  placeholder="Street / Building Address Line 1"
                  value={formData.addressLine1}
                  onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City (e.g. Mumbai)"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="State (e.g. Maharashtra)"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={formData.postalCode}
                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Commercial Notes / Payment Terms Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Authorized distributor for Waaree 550W bifacial modules. Standard delivery lead time 5-7 business days."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
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
                  {submitting ? 'Saving...' : editingVendor ? 'Update Supplier Profile' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
