import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface VendorItem {
  _id: string;
  vendorCode: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  paymentTermsDays: number;
  isActive: boolean;
  hasPurchaseHistory: boolean;
  createdAt: string;
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const handleCreateVendor = async (e: React.FormEvent) => {
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

      await apiClient('/vendors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
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
      await fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to create vendor');
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
            <Building2 className="w-7 h-7 text-primary" />
            Vendor Directory
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage hardware suppliers, Tier-1 module & inverter OEMs, and payment credit terms.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Suppliers
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalCount}</p>
          </div>
          <Building2 className="w-8 h-8 text-primary/40" />
        </div>
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Suppliers
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
        </div>
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Inactive
            </p>
            <p className="text-2xl font-bold text-muted-foreground mt-1">
              {totalCount - activeCount}
            </p>
          </div>
          <XCircle className="w-8 h-8 text-muted-foreground/30" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, code, GSTIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Filter Status:
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Vendors</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Vendors Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Vendor Code</th>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">GSTIN / Tax</th>
                <th className="py-3 px-4">Credit Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading suppliers...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No vendors found matching criteria.
                  </td>
                </tr>
              ) : (
                vendors.map(vendor => (
                  <tr key={vendor._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {vendor.vendorCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{vendor.name}</div>
                      {vendor.contactPerson && (
                        <div className="text-xs text-muted-foreground">{vendor.contactPerson}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {vendor.phone && (
                        <div className="flex items-center gap-1 text-foreground">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      {vendor.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{vendor.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-foreground">
                      {vendor.gstin || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      {vendor.paymentTermsDays} Days Net
                    </td>
                    <td className="py-3 px-4">
                      {vendor.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {vendor.isActive && (
                        <button
                          onClick={() => handleDeactivate(vendor._id)}
                          className="text-xs text-destructive hover:underline font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground">Register New Vendor</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Vendor / Supplier Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adani Solar Tech Ltd"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.contactPerson}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +919876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    placeholder="sales@supplier.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
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
                    value={formData.paymentTermsDays}
                    onChange={e =>
                      setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    GSTIN (15-char)
                  </label>
                  <input
                    type="text"
                    placeholder="24AAACA1234A1Z5"
                    value={formData.gstin}
                    onChange={e =>
                      setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    PAN (10-char)
                  </label>
                  <input
                    type="text"
                    placeholder="AAACA1234A"
                    value={formData.pan}
                    onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-foreground">Registered Address</p>
                <input
                  type="text"
                  placeholder="Address Line 1"
                  value={formData.addressLine1}
                  onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={formData.postalCode}
                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional commercial notes..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
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
                  {submitting ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
