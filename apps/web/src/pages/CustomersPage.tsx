import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building2,
  Sun,
  FileSpreadsheet,
  FolderKanban,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShoppingCart
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { CustomerDto, CustomerType, CustomerStatus } from '@ins-solar/shared';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Customer Detail Modal / Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);

  // New Customer Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.INDIVIDUAL);
  const [city, setCity] = useState('');
  const [state, setState] = useState('Chhattisgarh');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [notes, setNotes] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const data = await apiClient<CustomerDto[]>(`/customers?${params.toString()}`);
      setCustomers(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        primaryPhone: primaryPhone.trim(),
        email: email.trim() || undefined,
        customerType,
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        billingAddress: {
          type: 'BILLING',
          addressLine1: street.trim() || name.trim(),
          city: city.trim() || 'Raipur',
          state: state.trim() || 'Chhattisgarh',
          postalCode: postalCode.trim() || '492001',
          country: 'India'
        },
        installationAddress: {
          type: 'SITE_INSTALLATION',
          addressLine1: street.trim() || name.trim(),
          city: city.trim() || 'Raipur',
          state: state.trim() || 'Chhattisgarh',
          postalCode: postalCode.trim() || '492001',
          country: 'India'
        },
        notes: notes.trim() || undefined
      };

      await apiClient<CustomerDto>('/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      // Reset form
      setName('');
      setCompanyName('');
      setPrimaryPhone('');
      setEmail('');
      setCity('');
      setPostalCode('');
      setStreet('');
      setGstin('');
      setPan('');
      setNotes('');
      fetchCustomers();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create customer record.');
    } finally {
      setCreating(false);
    }
  };

  // Filtered by type in client
  const filteredCustomers = customers.filter(c => {
    if (typeFilter !== 'ALL') {
      if (typeFilter === CustomerType.COMMERCIAL) {
        if (c.type !== CustomerType.COMMERCIAL && c.type !== CustomerType.INDUSTRIAL) return false;
      } else if (c.type !== typeFilter) {
        return false;
      }
    }
    return true;
  });

  // Calculate Metrics
  const totalCount = customers.length;
  const residentialCount = customers.filter(c => c.type === CustomerType.INDIVIDUAL).length;
  const commercialCount = customers.filter(
    c => c.type === CustomerType.COMMERCIAL || c.type === CustomerType.INDUSTRIAL
  ).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Customer Directory</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {totalCount} Active Clients
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registered solar clients, rooftop site installation profiles, and ongoing projects.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-solar-600 hover:bg-solar-700 text-white shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Sleek Filter & Search Strip */}
      <div className="p-2.5 bg-card border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs">
        {/* Quick Filter Tabs */}
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 border border-border text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === 'ALL'
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Clients ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter(CustomerType.INDIVIDUAL)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === CustomerType.INDIVIDUAL
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Residential ({residentialCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter(CustomerType.COMMERCIAL)}
            className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              typeFilter === CustomerType.COMMERCIAL || typeFilter === CustomerType.INDUSTRIAL
                ? 'bg-background text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Commercial & Industrial ({commercialCount})
          </button>
        </div>

        {/* Live Search & Status */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, code, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-background border rounded-lg text-muted-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value={CustomerStatus.ACTIVE}>Active</option>
            <option value={CustomerStatus.INACTIVE}>Inactive</option>
          </select>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Customers Data Table */}
      <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
            <p>Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <UserCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-bold text-foreground">No Customers Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {search || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No customer records match your filter criteria. Try clearing filters.'
                : 'Convert prospective leads from the CRM pipeline or directly register new customers.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                to="/leads"
                className="px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition"
              >
                View Leads to Convert →
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition"
              >
                + Register Customer
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Customer Name & Type</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Installation Site</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map(customer => {
                  const initial = (customer.name || 'C').charAt(0).toUpperCase();
                  const isCommercial =
                    customer.type === CustomerType.COMMERCIAL ||
                    customer.type === CustomerType.INDUSTRIAL;

                  const cityStr =
                    customer.installationAddress?.city || customer.billingAddress?.city || 'Raipur';
                  const stateStr =
                    customer.installationAddress?.state || customer.billingAddress?.state || 'Chhattisgarh';
                  const pinStr =
                    customer.installationAddress?.postalCode || customer.billingAddress?.postalCode || '';

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-muted/30 transition group"
                    >
                      {/* Customer Code */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="hover:underline text-solar-600 text-left font-mono font-bold cursor-pointer"
                        >
                          {customer.customerCode}
                        </button>
                        <div className="text-[10px] text-muted-foreground font-sans">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Name & Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(customer)}
                              className="font-bold text-foreground hover:text-solar-600 text-left flex items-center space-x-1.5 transition cursor-pointer"
                            >
                              <span>{customer.name}</span>
                              {isCommercial && (
                                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              )}
                            </button>
                            {customer.companyName && (
                              <div className="text-[11px] text-muted-foreground font-medium">
                                {customer.companyName}
                              </div>
                            )}
                            <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border">
                              {customer.type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1 text-foreground">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <a
                              href={`tel:${customer.primaryPhone}`}
                              className="hover:underline font-mono"
                            >
                              {customer.primaryPhone}
                            </a>
                          </div>
                          {customer.email && (
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <a
                                href={`mailto:${customer.email}`}
                                className="hover:underline truncate max-w-[180px]"
                              >
                                {customer.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Site Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1 text-foreground">
                          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>
                            {cityStr}, {stateStr} {pinStr ? `(${pinStr})` : ''}
                          </span>
                        </div>
                        {customer.installationAddress?.addressLine1 && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                            {customer.installationAddress.addressLine1}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{customer.status || 'ACTIVE'}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-solar-600 hover:bg-solar-700 text-white transition shadow-xs cursor-pointer"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-base">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedCustomer.name}
                    </h3>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold bg-secondary text-secondary-foreground">
                      {selectedCustomer.customerCode}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCustomer.type} Account • Customer since{' '}
                    {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Direct Workflow Launch Hub */}
            <div className="p-3.5 bg-gradient-to-r from-solar-500/10 via-solar-500/5 to-emerald-500/10 border rounded-xl space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Direct Workflow Launch:</span>
                <span className="text-[11px] text-muted-foreground font-normal">Pre-filled with customer details</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  to={`/solar-designs?customerId=${selectedCustomer.id}&customerName=${encodeURIComponent(selectedCustomer.name)}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <Sun className="w-3.5 h-3.5" />
                    <span>1. Solar CAD</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">PV sizing simulation</span>
                </Link>

                <Link
                  to={`/quotations?customerId=${selectedCustomer.id}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>2. Quotation</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Draft proposal & BOM</span>
                </Link>

                <Link
                  to={`/orders?customerId=${selectedCustomer.id}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>3. Sales Order</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Billing & payments</span>
                </Link>

                <Link
                  to={`/projects?customerId=${selectedCustomer.id}&customerName=${encodeURIComponent(selectedCustomer.name)}`}
                  className="p-2.5 bg-card hover:bg-muted/50 border rounded-lg transition shadow-xs flex flex-col items-start space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5 text-solar-600 font-semibold text-xs">
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>4. 10-Stage EPC</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Installation tracker</span>
                </Link>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Contact Information */}
              <div className="p-4 bg-muted/30 border rounded-xl space-y-2">
                <h4 className="font-bold text-foreground flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-solar-500" />
                  <span>Contact Information</span>
                </h4>
                <div className="space-y-1.5 text-muted-foreground pt-1">
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <a
                      href={`tel:${selectedCustomer.primaryPhone}`}
                      className="font-bold text-foreground font-mono hover:underline"
                    >
                      {selectedCustomer.primaryPhone}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium text-foreground">
                      {selectedCustomer.email || 'None Provided'}
                    </span>
                  </div>
                  {selectedCustomer.companyName && (
                    <div className="flex justify-between">
                      <span>Company Name:</span>
                      <span className="font-medium text-foreground">
                        {selectedCustomer.companyName}
                      </span>
                    </div>
                  )}
                  {selectedCustomer.gstin && (
                    <div className="flex justify-between">
                      <span>GSTIN:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedCustomer.gstin}
                      </span>
                    </div>
                  )}
                  {selectedCustomer.pan && (
                    <div className="flex justify-between">
                      <span>PAN:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedCustomer.pan}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Site Installation Address */}
              <div className="p-4 bg-muted/30 border rounded-xl space-y-2">
                <h4 className="font-bold text-foreground flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-solar-500" />
                  <span>Installation Site Address</span>
                </h4>
                <div className="space-y-1 text-muted-foreground pt-1">
                  <p className="font-semibold text-foreground">
                    {selectedCustomer.installationAddress?.addressLine1 || selectedCustomer.name}
                  </p>
                  {selectedCustomer.installationAddress?.addressLine2 && (
                    <p>{selectedCustomer.installationAddress.addressLine2}</p>
                  )}
                  <p>
                    {selectedCustomer.installationAddress?.city || 'Raipur'},{' '}
                    {selectedCustomer.installationAddress?.state || 'Chhattisgarh'}{' '}
                    {selectedCustomer.installationAddress?.postalCode || '492001'}
                  </p>
                  <p>{selectedCustomer.installationAddress?.country || 'India'}</p>
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {selectedCustomer.notes && (
              <div className="p-3.5 bg-muted/20 border rounded-xl text-xs space-y-1">
                <span className="font-semibold text-muted-foreground">Internal Notes & History:</span>
                <p className="text-foreground">{selectedCustomer.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Register New Solar Client</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create direct customer record without requiring prior lead inquiry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Customer / Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Phone Number (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={primaryPhone}
                    onChange={e => setPrimaryPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Customer Account Type
                  </label>
                  <select
                    value={customerType}
                    onChange={e => setCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    <option value={CustomerType.INDIVIDUAL}>Residential / Homeowner</option>
                    <option value={CustomerType.COMMERCIAL}>Commercial Entity</option>
                    <option value={CustomerType.INDUSTRIAL}>Industrial Plant</option>
                    <option value={CustomerType.INSTITUTIONAL}>Institutional / NGO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              {(customerType === CustomerType.COMMERCIAL || customerType === CustomerType.INDUSTRIAL) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Company / Enterprise
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patel Solar Enterprises"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="08AAAAA0000A1Z5"
                      value={gstin}
                      onChange={e => setGstin(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      PAN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={pan}
                      onChange={e => setPan(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Installation Site Address */}
              <div className="space-y-2 pt-1 border-t">
                <span className="text-xs font-bold text-foreground">
                  Site Installation Address
                </span>
                <input
                  type="text"
                  placeholder="Street / Building Address / Landmark"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="City (e.g. Raipur)"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="State"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                  <input
                    type="text"
                    placeholder="PIN Code"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Client Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Electricity bill details, sanction load, roof dimensions..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Save Customer Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
