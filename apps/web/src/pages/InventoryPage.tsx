/**
 * INS Solar Business Management Software — Inventory & Material Ledger Screen
 *
 * Location-scoped stock balances (on-hand, reserved, available), append-oriented movement ledger,
 * product serial tracking, and authorized material movement primitives (receipt, issue, transfer, return).
 */

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  QrCode,
  CheckCircle2,
  History,
  Package,
  Building2,
  Plus,
  Tag,
  Search,
  Loader2
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface StockBalanceItem {
  _id: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
    brand?: string;
  };
  warehouseId: {
    _id: string;
    name: string;
    code: string;
    type?: string;
  };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  updatedAt: string;
}

interface StockMovementItem {
  _id: string;
  movementNumber: string;
  movementType: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
  };
  quantity: number;
  sourceWarehouseId?: {
    name: string;
    code: string;
  };
  destinationWarehouseId?: {
    name: string;
    code: string;
  };
  performedBy?: {
    firstName: string;
    lastName: string;
  };
  reason?: string;
  reference?: string;
  createdAt: string;
}

interface SerialItem {
  _id: string;
  serialNumber: string;
  productId: {
    name: string;
    sku: string;
  };
  warehouseId: {
    name: string;
    code: string;
  };
  status: string;
  createdAt: string;
}

interface CatalogProductItem {
  _id: string;
  name: string;
  sku: string;
  brand?: string;
  modelNumber?: string;
  description?: string;
  categoryId?: {
    _id: string;
    name: string;
    code: string;
  };
  uom: string;
  sellingPricePaise: number;
  purchaseRatePaise?: number;
  isSerialized: boolean;
  isActive: boolean;
  specifications?: Record<string, any>;
}

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'balances' | 'products' | 'movements' | 'serials' | 'warehouses'
  >('balances');

  // Balances
  const [balances, setBalances] = useState<StockBalanceItem[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Products (Catalogue Master)
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('INS Solar Tech');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductUom, setNewProductUom] = useState('PCS');
  const [newProductSellPrice, setNewProductSellPrice] = useState('15000');
  const [newProductBuyRate, setNewProductBuyRate] = useState('12000');
  const [newProductSerialized, setNewProductSerialized] = useState(false);

  // Movements
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Serials
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);

  // Common metadata for forms
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Modals
  const [modalType, setModalType] = useState<
    'receipt' | 'issue' | 'transfer' | 'return' | 'opening' | 'serials' | null
  >(null);
  const [formWarehouseA, setFormWarehouseA] = useState('');
  const [formWarehouseB, setFormWarehouseB] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formReason, setFormReason] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formSerialsText, setFormSerialsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchWarehousesAndProducts = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        apiClient('/warehouses?isActive=true'),
        apiClient('/catalog/products?isActive=true&limit=100')
      ]);
      setWarehouses(whRes.items || []);
      setProducts(prodRes.items || []);
      if (whRes.items?.length > 0) {
        setFormWarehouseA(whRes.items[0]._id);
        if (whRes.items.length > 1) {
          setFormWarehouseB(whRes.items[1]._id);
        }
      }
      if (prodRes.items?.length > 0) {
        setFormProduct(prodRes.items[0]._id);
      }
    } catch {
      // fallback
    }
  };

  const fetchBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await apiClient('/inventory/balances?limit=100');
      setBalances(res.items || []);
    } catch {
      // error handled in view
    } finally {
      setLoadingBalances(false);
    }
  };

  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const res = await apiClient('/inventory/movements?limit=100');
      setMovements(res.items || []);
    } catch {
      // error
    } finally {
      setLoadingMovements(false);
    }
  };

  const fetchSerials = async () => {
    setLoadingSerials(true);
    try {
      const res = await apiClient('/inventory/serials?limit=100');
      setSerials(res.items || []);
    } catch {
      // error
    } finally {
      setLoadingSerials(false);
    }
  };

  const fetchCatalogProducts = async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient('/catalog/products?limit=100'),
        apiClient('/catalog/categories?isActive=true')
      ]);
      setCatalogProducts(prodRes.items || []);
      setCategories(catRes || []);
      if (catRes?.length > 0 && !newProductCategory) {
        setNewProductCategory(catRes[0]._id);
      }
    } catch {
      // handled
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchWarehousesAndProducts();
    fetchBalances();
  }, []);

  useEffect(() => {
    if (activeTab === 'balances') fetchBalances();
    if (activeTab === 'products') fetchCatalogProducts();
    if (activeTab === 'movements') fetchMovements();
    if (activeTab === 'serials') fetchSerials();
  }, [activeTab]);

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductSku.trim() || !newProductCategory) {
      alert('Please fill product name, SKU, and category.');
      return;
    }
    setSavingProduct(true);
    try {
      await apiClient('/catalog/products', {
        method: 'POST',
        body: JSON.stringify({
          name: newProductName.trim(),
          sku: newProductSku.trim(),
          brand: newProductBrand.trim() || 'INS Solar',
          categoryId: newProductCategory,
          uom: newProductUom,
          sellingPricePaise: Math.round(Number(newProductSellPrice) * 100),
          purchaseRatePaise: Math.round(Number(newProductBuyRate) * 100),
          isSerialized: newProductSerialized
        })
      });
      setShowAddProductModal(false);
      setNewProductName('');
      setNewProductSku('');
      setSuccessBanner('New product item successfully added to master catalogue.');
      fetchCatalogProducts();
    } catch (err: any) {
      alert(err?.message || 'Failed to create product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const resetForm = () => {
    setModalType(null);
    setFormQuantity(1);
    setFormReason('');
    setFormReference('');
    setFormSerialsText('');
    setFormError(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setSuccessBanner(null);

    try {
      if (modalType === 'receipt') {
        await apiClient('/inventory/receipt', {
          method: 'POST',
          body: JSON.stringify({
            warehouseId: formWarehouseA,
            productId: formProduct,
            quantity: Number(formQuantity),
            reference: formReference.trim() || undefined,
            reason: formReason.trim() || undefined
          })
        });
        setSuccessBanner('Stock receipt recorded and on-hand balance incremented.');
      } else if (modalType === 'issue') {
        await apiClient('/inventory/issue', {
          method: 'POST',
          body: JSON.stringify({
            warehouseId: formWarehouseA,
            productId: formProduct,
            quantity: Number(formQuantity),
            reason: formReason.trim() || undefined
          })
        });
        setSuccessBanner('Physical stock issue recorded and on-hand balance decremented.');
      } else if (modalType === 'transfer') {
        await apiClient('/inventory/transfer', {
          method: 'POST',
          body: JSON.stringify({
            sourceWarehouseId: formWarehouseA,
            destinationWarehouseId: formWarehouseB,
            productId: formProduct,
            quantity: Number(formQuantity),
            reason: formReason.trim() || undefined
          })
        });
        setSuccessBanner('Inter-warehouse material transfer executed successfully.');
      } else if (modalType === 'return') {
        await apiClient('/inventory/return', {
          method: 'POST',
          body: JSON.stringify({
            sourceWarehouseId: formWarehouseA,
            destinationWarehouseId: formWarehouseB,
            productId: formProduct,
            quantity: Number(formQuantity),
            reason: formReason.trim()
          })
        });
        setSuccessBanner('Stock return recorded successfully.');
      } else if (modalType === 'opening') {
        await apiClient('/inventory/opening-balance', {
          method: 'POST',
          body: JSON.stringify({
            warehouseId: formWarehouseA,
            productId: formProduct,
            quantity: Number(formQuantity),
            reason: formReason.trim()
          })
        });
        setSuccessBanner('Authorized opening balance recorded with audit ledger trail.');
      } else if (modalType === 'serials') {
        const serialArray = formSerialsText
          .split(/[\n,]+/)
          .map(s => s.trim())
          .filter(Boolean);

        if (serialArray.length === 0) {
          throw new Error('Please enter at least one serial number.');
        }

        await apiClient('/inventory/serials', {
          method: 'POST',
          body: JSON.stringify({
            warehouseId: formWarehouseA,
            productId: formProduct,
            serialNumbers: serialArray
          })
        });
        setSuccessBanner(`Successfully registered ${serialArray.length} serialized assets.`);
      }

      resetForm();
      if (activeTab === 'balances') fetchBalances();
      if (activeTab === 'movements') fetchMovements();
      if (activeTab === 'serials') fetchSerials();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="w-6 h-6 text-solar-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Inventory Ledger & Stock Balances
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-location stock projections, append-only material ledger, and hardware
            serialization.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setModalType('receipt');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
            Receive Stock
          </button>
          <button
            onClick={() => {
              setModalType('issue');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5 mr-1" />
            Issue Material
          </button>
          <button
            onClick={() => {
              setModalType('transfer');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
            Transfer
          </button>
          <button
            onClick={() => {
              setModalType('return');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Return
          </button>
          <button
            onClick={() => {
              setModalType('serials');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 mr-1" />
            Register Serials
          </button>
          <button
            onClick={() => {
              setModalType('opening');
              setFormError(null);
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted border hover:bg-muted/80 text-foreground text-xs font-medium transition-colors"
          >
            Opening Stock
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-xs hover:text-emerald-300">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b flex items-center space-x-2 sm:space-x-6 text-xs sm:text-sm font-medium overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
        <button
          onClick={() => setActiveTab('balances')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 sm:space-x-2 border-b-2 -mb-px ${
            activeTab === 'balances'
              ? 'border-solar-500 text-solar-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Balances</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 sm:space-x-2 border-b-2 -mb-px ${
            activeTab === 'products'
              ? 'border-solar-500 text-solar-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product & Item Catalogue</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 sm:space-x-2 border-b-2 -mb-px ${
            activeTab === 'movements'
              ? 'border-solar-500 text-solar-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('serials')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 sm:space-x-2 border-b-2 -mb-px ${
            activeTab === 'serials'
              ? 'border-solar-500 text-solar-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Serialized Assets</span>
        </button>

        <button
          onClick={() => setActiveTab('warehouses')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 sm:space-x-2 border-b-2 -mb-px ${
            activeTab === 'warehouses'
              ? 'border-solar-500 text-solar-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Warehouses & Locations</span>
        </button>
      </div>

      {/* Tab 1: Stock Balances */}
      {activeTab === 'balances' && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Product Name & SKU</th>
                  <th className="px-6 py-3">Warehouse Location</th>
                  <th className="px-6 py-3 text-center">On-Hand Qty</th>
                  <th className="px-6 py-3 text-center">Reserved Qty</th>
                  <th className="px-6 py-3 text-center">Available Qty</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingBalances ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="inline-flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-solar-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading stock balances...</span>
                      </div>
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No stock balances found. Record an authorized receipt or opening balance to
                      initialize stock.
                    </td>
                  </tr>
                ) : (
                  balances.map(b => (
                    <tr key={b._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {b.productId?.name || 'Hardware Asset'}
                        <span className="block text-xs font-mono text-muted-foreground">
                          {b.productId?.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {b.warehouseId?.name || 'Central Hub'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Code: {b.warehouseId?.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-foreground">
                        {b.onHandQuantity}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-400">
                        {b.reservedQuantity}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-400">
                        {b.availableQuantity}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {b.availableQuantity > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            In Stock
                          </span>
                        ) : b.reservedQuantity > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Fully Reserved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Product & Item Catalogue Master */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products by SKU, name, brand..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
              />
            </div>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add New Product / Item</span>
            </button>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Item Name & SKU</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Brand / Mfr</th>
                    <th className="px-6 py-3 text-center">Unit (UOM)</th>
                    <th className="px-6 py-3 text-right">Purchase Rate</th>
                    <th className="px-6 py-3 text-right">Selling Price</th>
                    <th className="px-6 py-3 text-center">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        <div className="inline-flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-solar-500" />
                          <span>Loading product catalogue...</span>
                        </div>
                      </td>
                    </tr>
                  ) : catalogProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        No product items found. Click "+ Add New Product / Item" to define your
                        hardware catalogue.
                      </td>
                    </tr>
                  ) : (
                    catalogProducts
                      .filter(p =>
                        productSearch
                          ? p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
                          : true
                      )
                      .map(p => (
                        <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground">
                            {p.name}
                            <span className="block text-xs font-mono text-muted-foreground">
                              {p.sku}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
                              <Tag className="w-3 h-3 mr-1" />
                              {p.categoryId?.name || 'General Hardware'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-foreground text-xs">{p.brand || '—'}</td>
                          <td className="px-6 py-4 text-center text-xs font-mono">
                            {p.uom || 'PCS'}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground">
                            ₹
                            {(p.purchaseRatePaise ? p.purchaseRatePaise / 100 : 0).toLocaleString(
                              'en-IN'
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-sm font-bold text-foreground">
                            ₹{(p.sellingPricePaise / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {p.isSerialized ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Barcode / Serial
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Bulk Batch</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Movement Ledger */}
      {activeTab === 'movements' && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Movement #</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-center">Quantity</th>
                  <th className="px-6 py-3">Source / Destination</th>
                  <th className="px-6 py-3">Reason / Ref</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingMovements ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      Loading material ledger...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No stock movement records found in ledger.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-solar-500">
                        {m.movementNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border">
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {m.productId?.name}
                        <span className="block text-xs font-mono text-muted-foreground">
                          {m.productId?.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-foreground">
                        {m.quantity}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {m.sourceWarehouseId && <div>From: {m.sourceWarehouseId.code}</div>}
                        {m.destinationWarehouseId && <div>To: {m.destinationWarehouseId.code}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-foreground">
                        {m.reason || m.reference || 'Operational stock transaction'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Serial Numbers */}
      {activeTab === 'serials' && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Serial Number</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Current Location</th>
                  <th className="px-6 py-3">Lifecycle Status</th>
                  <th className="px-6 py-3 text-right">Registered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingSerials ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      Loading serial number database...
                    </td>
                  </tr>
                ) : serials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No serialized assets registered yet. Click &quot;Register Serials&quot; to
                      track solar panels or inverters.
                    </td>
                  </tr>
                ) : (
                  serials.map(s => (
                    <tr key={s._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        {s.serialNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">{s.productId?.name}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {s.warehouseId?.name} ({s.warehouseId?.code})
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Warehouses & Depots */}
      {activeTab === 'warehouses' && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase font-medium text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Warehouse Name</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Depot Type</th>
                  <th className="px-6 py-3">Location / Address</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {warehouses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No warehouses found. Default central depot is active.
                    </td>
                  </tr>
                ) : (
                  warehouses.map(w => (
                    <tr key={w._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-solar-500" />
                        <span>{w.name}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-foreground">
                        {w.code}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted border">
                          {w.type || 'CENTRAL_DEPOT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {w.address?.city || 'Jaipur'}, {w.address?.state || 'Rajasthan'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Operational
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-solar-500" />
                <h2 className="text-lg font-bold text-foreground">Add New Product / Item</h2>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550Wp Mono PERC Solar Module"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    SKU / Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MOD-550-MONO"
                    value={newProductSku}
                    onChange={e => setNewProductSku(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Brand / Mfr
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INS Solar"
                    value={newProductBrand}
                    onChange={e => setNewProductBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Category *
                  </label>
                  <select
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    {categories.length === 0 ? (
                      <option value="">No categories defined</option>
                    ) : (
                      categories.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Unit of Measure
                  </label>
                  <select
                    value={newProductUom}
                    onChange={e => setNewProductUom(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="NOS">NOS (Numbers)</option>
                    <option value="SET">SET (Sets)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="KG">KG (Kilograms)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Purchase Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductBuyRate}
                    onChange={e => setNewProductBuyRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductSellPrice}
                    onChange={e => setNewProductSellPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chkSerialized"
                  checked={newProductSerialized}
                  onChange={e => setNewProductSerialized(e.target.checked)}
                  className="rounded text-solar-600 focus:ring-solar-500"
                />
                <label htmlFor="chkSerialized" className="text-xs text-foreground cursor-pointer">
                  Requires Individual Barcode / Serial Number Tracking
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {savingProduct ? 'Saving Item...' : 'Save to Catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-2">
              <Boxes className="w-5 h-5 text-solar-500" />
              <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">
                {modalType === 'receipt' && 'Record Stock Receipt (GRN)'}
                {modalType === 'issue' && 'Record Physical Stock Issue'}
                {modalType === 'transfer' && 'Inter-Warehouse Stock Transfer'}
                {modalType === 'return' && 'Record Stock Return'}
                {modalType === 'opening' && 'Authorized Opening Balance'}
                {modalType === 'serials' && 'Register Serialized Assets'}
              </h2>
            </div>

            {formError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4">
              {/* Product selection */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Product *
                </label>
                <select
                  value={formProduct}
                  onChange={e => setFormProduct(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  {products.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse A */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {modalType === 'transfer' || modalType === 'return'
                    ? 'Source Warehouse *'
                    : 'Target Warehouse *'}
                </label>
                <select
                  value={formWarehouseA}
                  onChange={e => setFormWarehouseA(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  {warehouses.map(wh => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse B for Transfer/Return */}
              {(modalType === 'transfer' || modalType === 'return') && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Destination Warehouse *
                  </label>
                  <select
                    value={formWarehouseB}
                    onChange={e => setFormWarehouseB(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    {warehouses.map(wh => (
                      <option key={wh._id} value={wh._id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity (for all except serials) */}
              {modalType !== 'serials' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formQuantity}
                    onChange={e => setFormQuantity(parseInt(e.target.value, 10) || 1)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              )}

              {/* Serials Textarea for serials modal */}
              {modalType === 'serials' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Serial Numbers (one per line or comma-separated) *
                  </label>
                  <textarea
                    rows={4}
                    value={formSerialsText}
                    onChange={e => setFormSerialsText(e.target.value)}
                    placeholder="SN-MOD-001&#10;SN-MOD-002&#10;SN-MOD-003"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              )}

              {/* Reference */}
              {modalType === 'receipt' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    External Reference (e.g. Supplier Invoice / Delivery Note)
                  </label>
                  <input
                    type="text"
                    value={formReference}
                    onChange={e => setFormReference(e.target.value)}
                    placeholder="DEL-2026-987"
                    className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reason / Operational Note {modalType === 'opening' ? '(Required)' : ''}
                </label>
                <input
                  type="text"
                  value={formReason}
                  onChange={e => setFormReason(e.target.value)}
                  required={modalType === 'opening' || modalType === 'return'}
                  placeholder={
                    modalType === 'opening'
                      ? 'Stock audit justification for opening balance'
                      : 'Operational movement note'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-solar-600 hover:bg-solar-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Confirm Operation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
