import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Package,
  Search,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  AlertCircle,
  AlertTriangle,
  Bell,
  BarChart2,
  ArrowDown,
  ArrowUp,
  Boxes,
  RefreshCw,
} from 'lucide-react';
import { useGymData } from '../context/GymDataContext';
import { useAuth } from '../context/AuthContext';
import { POSProduct, POSTransactionItem } from '../types';
import { formatEGP } from '../utils/formatters';
import { sounds } from '../utils/sound';

export const PosPage: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    processSale,
    getTodayStats,
    transactions,
  } = useGymData();
  const { currentUser } = useAuth();
  const stats = getTodayStats();
  const isManager = currentUser?.role === 'admin';

  // Search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showInventoryPanel, setShowInventoryPanel] = useState(false);

  // Cart state
  const [cart, setCart] = useState<{ product: POSProduct; quantity: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'instapay'>('cash');

  // Add Product Modal
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: 'supplements' as POSProduct['category'],
    buyPrice: 100,
    sellPrice: 150,
    stock: 20,
    lowStockThreshold: 5,
    barcode: '',
  });

  // Edit Product Modal state
  const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    category: 'supplements' as POSProduct['category'],
    buyPrice: 100,
    sellPrice: 150,
    stock: 20,
    lowStockThreshold: 5,
    barcode: '',
  });

  // View mode: POS Register vs Bar Inventory Database
  const [activeView, setActiveView] = useState<'register' | 'inventory'>('register');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  const handleOpenEdit = (product: POSProduct) => {
    if (!isManager) {
      alert('عفواً، تعديل أسعار أو بيانات منتجات البار مقصور على حساب المدير فقط.');
      return;
    }
    setEditingProduct(product);
    setEditProductForm({
      name: product.name,
      category: product.category,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      barcode: product.barcode || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      alert('عفواً، تعديل أسعار أو بيانات منتجات البار مقصور على حساب المدير فقط.');
      return;
    }
    if (!editingProduct || !editProductForm.name) return;

    updateProduct(editingProduct.id, {
      name: editProductForm.name,
      category: editProductForm.category,
      buyPrice: Number(editProductForm.buyPrice),
      sellPrice: Number(editProductForm.sellPrice),
      stock: Number(editProductForm.stock),
      lowStockThreshold: Number(editProductForm.lowStockThreshold),
      barcode: editProductForm.barcode,
    });

    setEditingProduct(null);
  };

  const handleQuickRestock = (productId: string, quantityToAdd: number) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;
    updateProduct(productId, {
      stock: Math.max(0, p.stock + quantityToAdd),
    });
    sounds.playBeep();
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    if (!isManager) {
      alert('عفواً، حذف منتجات البار مقصور على حساب المدير فقط.');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف المنتج "${productName}"؟`)) {
      deleteProduct(productId);
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    }
  };

  // Recent Receipt Modal
  const [receiptData, setReceiptData] = useState<{
    id: string;
    items: POSTransactionItem[];
    total: number;
    profit: number;
    method: string;
    time: string;
  } | null>(null);

  // Cart calculations
  const cartTotalAmount = cart.reduce((acc, item) => acc + item.product.sellPrice * item.quantity, 0);
  const cartTotalCost = cart.reduce((acc, item) => acc + item.product.buyPrice * item.quantity, 0);
  const cartProfit = cartTotalAmount - cartTotalCost;

  const handleAddToCart = (product: POSProduct) => {
    if (product.stock <= 0) {
      alert('المنتج نفد من المخزون!');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('وصلت للحد الأقصى للكمية المتاحة في المخزن');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    sounds.playBeep();
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const items: POSTransactionItem[] = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.sellPrice,
      unitCost: item.product.buyPrice,
      totalPrice: item.product.sellPrice * item.quantity,
    }));

    const tx = processSale({
      items,
      totalAmount: cartTotalAmount,
      totalCost: cartTotalCost,
      profit: cartProfit,
      paymentMethod,
      cashierName: currentUser?.name || 'الكاشير',
    });

    sounds.playCashRegister();

    setReceiptData({
      id: tx.id,
      items: tx.items,
      total: tx.totalAmount,
      profit: tx.profit,
      method: paymentMethod,
      time: new Date().toLocaleTimeString('ar-EG'),
    });

    setCart([]);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      alert('عفواً، إضافة وتعديل منتجات البار مقصور على حساب المدير فقط.');
      return;
    }
    if (!newProductForm.name) return;

    addProduct({
      name: newProductForm.name,
      category: newProductForm.category,
      buyPrice: Number(newProductForm.buyPrice),
      sellPrice: Number(newProductForm.sellPrice),
      stock: Number(newProductForm.stock),
      lowStockThreshold: Number(newProductForm.lowStockThreshold),
      barcode: newProductForm.barcode || `BAR-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    setIsAddProductModalOpen(false);
    setNewProductForm({
      name: '',
      category: 'supplements',
      buyPrice: 100,
      sellPrice: 150,
      stock: 20,
      lowStockThreshold: 5,
      barcode: '',
    });
  };

  // Low stock & out of stock computation
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)),
    [products]
  );
  const outOfStockProducts = useMemo(
    () => products.filter((p) => p.stock === 0),
    [products]
  );

  // Inventory stats
  const inventoryStats = useMemo(() => {
    const totalItemsCount = products.reduce((acc, p) => acc + p.stock, 0);
    const totalCostValue = products.reduce((acc, p) => acc + p.buyPrice * p.stock, 0);
    const totalRetailValue = products.reduce((acc, p) => acc + p.sellPrice * p.stock, 0);
    const potentialProfit = totalRetailValue - totalCostValue;
    return { totalItemsCount, totalCostValue, totalRetailValue, potentialProfit };
  }, [products]);

  // Filter products for POS register
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // Filter products for Inventory Database view
  const inventoryFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      let matchStatus = true;
      if (stockStatusFilter === 'low') {
        matchStatus = p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5);
      } else if (stockStatusFilter === 'out') {
        matchStatus = p.stock === 0;
      }
      return matchCat && matchSearch && matchStatus;
    });
  }, [products, activeCategory, searchQuery, stockStatusFilter]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Real-time Sales & Profit Stat Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's Total Sales */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0c2621] to-[#071714] border border-teal-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-teal-300">
              إجمالي مبيعات اليوم (بيعت بكام أول بأول)
            </span>
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-teal-300">
            {formatEGP(stats.posSalesToday)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            محدث لحظياً مع كل عملية بيع جديدة
          </p>
        </div>

        {/* Today's Net Profit */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#122e1b] to-[#0a1c10] border border-emerald-500/40 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-300">
              أرباح اليوم الصافية (الأرباح أول بأول)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">
            {formatEGP(stats.posProfitToday)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            هامش الربح الصافي بعد خصم تكلفة الشراء
          </p>
        </div>

        {/* Total Products in Stock */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#161d2f] to-[#0d121e] border border-slate-700/60 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300">الأصناف المتوفرة بالمتجر</span>
            <div className="p-2 rounded-xl bg-slate-800 text-teal-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {products.length} صنف
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            مكملات غذائية، مشروبات طاقة، ملابس
          </p>
        </div>
      </div>

      {/* Low Stock & Out of Stock Alert Banner */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-[#1e1710] to-[#120e0a] p-5 shadow-2xl relative overflow-hidden space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-300">
                  تنبيه المخزون الذكي (Low Stock Alert)
                </h4>
                <p className="text-[11px] text-slate-400">
                  يوجد أصناف قاربت على النفاذ أو نفدت بالكامل من بار الجيم، يرجى طلب شحنة توريد جديدة:
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveView('inventory');
                setStockStatusFilter(outOfStockProducts.length > 0 ? 'out' : 'low');
              }}
              className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Boxes className="w-4 h-4" />
              <span>إدارة المخزون والتوريد ({lowStockProducts.length + outOfStockProducts.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-500/20">
            {outOfStockProducts.map((p) => (
              <span
                key={p.id}
                onClick={isManager ? () => handleOpenEdit(p) : undefined}
                className={`px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 ${
                  isManager ? 'cursor-pointer hover:bg-rose-500/30' : ''
                } transition`}
                title={isManager ? 'اضغط للتعديل والتوريد' : undefined}
              >
                <span>🚫 نفد تماماً:</span>
                <span className="font-black text-white">{p.name}</span>
                <span className="text-[10px] bg-rose-950 px-1.5 py-0.5 rounded">0 قطع</span>
              </span>
            ))}
            {lowStockProducts.map((p) => (
              <span
                key={p.id}
                onClick={isManager ? () => handleOpenEdit(p) : undefined}
                className={`px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 ${
                  isManager ? 'cursor-pointer hover:bg-amber-500/30' : ''
                } transition`}
                title={isManager ? 'اضغط للتعديل والتوريد' : undefined}
              >
                <span>⚠️ قارب على النفاذ:</span>
                <span className="font-black text-white">{p.name}</span>
                <span className="text-[10px] bg-amber-950 px-1.5 py-0.5 rounded text-amber-200">
                  متبقي {p.stock} (الحد: {p.lowStockThreshold ?? 5})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* View Switcher Tabs: POS Register vs Bar Inventory Database */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-[#0f172a] border border-slate-800 rounded-3xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveView('register')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
              activeView === 'register'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>نقطة البيع والكاشير (POS Register)</span>
          </button>

          <button
            onClick={() => setActiveView('inventory')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer relative ${
              activeView === 'inventory'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>قاعدة بيانات وإدارة مخزون البار (Inventory)</span>
            {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>
        </div>

        {isManager && (
          <button
            onClick={() => setIsAddProductModalOpen(true)}
            className="w-full sm:w-auto py-2.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد (Add Product)</span>
          </button>
        )}
      </div>

      {/* CONDITIONAL VIEW: POS Register vs Bar Inventory Database */}
      {activeView === 'register' ? (
        /* Main Register & Cart Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Products Grid (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Controls: Search, Category Filters */}
            <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو الباركود..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'جميع الأصناف' },
                  { id: 'supplements', label: 'مكملات وبروتين' },
                  { id: 'drinks', label: 'مشروبات ومياه' },
                  { id: 'snacks', label: 'سناكس وبار' },
                  { id: 'apparel', label: 'ملابس وأدوات' },
                  { id: 'other', label: 'أخرى' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
                      activeCategory === cat.id
                        ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = !isOutOfStock && p.stock <= (p.lowStockThreshold ?? 5);
                const profitPerItem = p.sellPrice - p.buyPrice;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    className={`p-4 rounded-3xl border transition duration-200 flex flex-col justify-between cursor-pointer select-none ${
                      isOutOfStock
                        ? 'bg-slate-900/40 border-slate-800/80 opacity-50 cursor-not-allowed'
                        : isLowStock
                        ? 'bg-[#0f172a]/90 hover:bg-[#131f38] border-amber-500/50 hover:border-amber-400 shadow-lg'
                        : 'bg-[#0f172a]/90 hover:bg-[#131f38] border-slate-800 hover:border-teal-500/40 shadow-lg'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-800 px-2 py-0.5 rounded font-mono">
                            {p.barcode || 'NO-BARCODE'}
                          </span>
                          <span
                            className={`font-bold ${
                              isOutOfStock
                                ? 'text-rose-400'
                                : isLowStock
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isOutOfStock ? '🚫 نفد' : `متبقي: ${p.stock}`}
                          </span>
                        </div>

                        {isManager && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(p);
                              }}
                              title="تعديل المنتج (المدير)"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(p.id, p.name);
                              }}
                              title="حذف المنتج (المدير)"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-white line-clamp-2 mb-2">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-teal-300">
                          {formatEGP(p.sellPrice)}
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          ربح: +{formatEGP(profitPerItem)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className="p-2 rounded-xl bg-teal-500/15 text-teal-400 hover:bg-teal-500 hover:text-slate-950 font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POS Cart Register (4 Cols) */}
          <div className="lg:col-span-4">
            <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl sticky top-24">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-teal-400" />
                  <span>فاتورة البيع الحالية</span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold">
                  {cart.length} أصناف
                </span>
              </div>

              {/* Cart Items */}
              <div className="my-4 space-y-3 max-h-64 overflow-y-auto pr-1">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex-1 ml-2">
                        <div className="font-bold text-white line-clamp-1">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-teal-400 font-mono mt-0.5">
                          {formatEGP(item.product.sellPrice)} × {item.quantity} ={' '}
                          {formatEGP(item.product.sellPrice * item.quantity)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold text-white px-1.5 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 mr-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    السلة فارغة. اضغط على أي منتج لإضافته للفاتورة.
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  طريقة الدفع:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition flex flex-col items-center gap-1 ${
                      paymentMethod === 'cash'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>كاش (نقدي)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition flex flex-col items-center gap-1 ${
                      paymentMethod === 'card'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>فيزا / بطاقة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('instapay')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition flex flex-col items-center gap-1 ${
                      paymentMethod === 'instapay'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>انستاباي</span>
                  </button>
                </div>
              </div>

              {/* Total breakdown */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي الأصناف:</span>
                  <span className="font-bold text-white">{cart.length}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>الربح التقديري للفاتورة:</span>
                  <span className="font-bold">+{formatEGP(cartProfit)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>المبلغ المطلوب للدفع:</span>
                  <span className="text-teal-300 text-lg font-mono">
                    {formatEGP(cartTotalAmount)}
                  </span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>إتمام البيع وحفظ الربح الآن</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* BAR INVENTORY DATABASE VIEW (جدول وقاعدة بيانات إدارة مخزون البار) */
        <div className="space-y-6">
          {/* Inventory Stats Mini KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">إجمالي القطع بالمخزن</span>
              <div className="text-2xl font-black text-white flex items-center gap-1.5">
                <span>{inventoryStats.totalItemsCount}</span>
                <span className="text-xs text-slate-400 font-normal">قطعة ({products.length} صنف)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">رأس المال المخزون (التكلفة)</span>
              <div className="text-2xl font-black text-teal-400">
                {formatEGP(inventoryStats.totalCostValue)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">القيمة البيعية المتوقعة</span>
              <div className="text-2xl font-black text-emerald-400">
                {formatEGP(inventoryStats.totalRetailValue)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">الأرباح المتوقعة عند البيع</span>
              <div className="text-2xl font-black text-amber-400">
                +{formatEGP(inventoryStats.potentialProfit)}
              </div>
            </div>
          </div>

          {/* Inventory Controls & Filters */}
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في المخزون بالاسم أو الباركود..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setStockStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                    stockStatusFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  جميع الأصناف ({products.length})
                </button>
                <button
                  onClick={() => setStockStatusFilter('low')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                    stockStatusFilter === 'low'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-amber-900/40'
                  }`}
                >
                  <span>⚠️ قارب على النفاذ</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-950/60 text-[10px]">
                    {lowStockProducts.length}
                  </span>
                </button>
                <button
                  onClick={() => setStockStatusFilter('out')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                    stockStatusFilter === 'out'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-rose-900/40'
                  }`}
                >
                  <span>🚫 نفد تماماً</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-950/60 text-[10px]">
                    {outOfStockProducts.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'جميع الأقسام' },
                { id: 'supplements', label: 'مكملات وبروتين' },
                { id: 'drinks', label: 'مشروبات ومياه' },
                { id: 'snacks', label: 'سناكس وبار' },
                { id: 'apparel', label: 'ملابس وأدوات' },
                { id: 'other', label: 'أخرى' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl font-bold transition shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-teal-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full Inventory Data Table */}
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 text-xs font-bold border-b border-slate-800">
                    <th className="p-4">الباركود</th>
                    <th className="p-4">اسم الصنف</th>
                    <th className="p-4">القسم</th>
                    <th className="p-4">سعر التكلفة</th>
                    <th className="p-4">سعر البيع</th>
                    <th className="p-4">الربح للقطعة</th>
                    <th className="p-4">الكمية بالمخزن</th>
                    <th className="p-4">حد التنبيه</th>
                    <th className="p-4">حالة التوفر</th>
                    <th className="p-4 text-center">توريد سريع (+ قطع)</th>
                    {isManager && <th className="p-4 text-center">إجراءات التعديل</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {inventoryFilteredProducts.length > 0 ? (
                    inventoryFilteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const threshold = p.lowStockThreshold ?? 5;
                      const isLowStock = !isOutOfStock && p.stock <= threshold;
                      const profit = p.sellPrice - p.buyPrice;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-800/40 transition duration-150"
                        >
                          <td className="p-4 font-mono text-slate-400 text-[11px]">
                            {p.barcode || '—'}
                          </td>
                          <td className="p-4 font-bold text-white">
                            {p.name}
                          </td>
                          <td className="p-4 text-slate-400">
                            {p.category === 'supplements'
                              ? 'مكملات غذائية'
                              : p.category === 'drinks'
                              ? 'مشروبات ومياه'
                              : p.category === 'snacks'
                              ? 'سناكس وبار'
                              : p.category === 'apparel'
                              ? 'ملابس وأدوات'
                              : 'أخرى'}
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {formatEGP(p.buyPrice)}
                          </td>
                          <td className="p-4 font-mono font-bold text-teal-300">
                            {formatEGP(p.sellPrice)}
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-400">
                            +{formatEGP(profit)}
                          </td>
                          <td className="p-4 font-mono font-black text-base">
                            <span
                              className={
                                isOutOfStock
                                  ? 'text-rose-400'
                                  : isLowStock
                                  ? 'text-amber-400'
                                  : 'text-white'
                              }
                            >
                              {p.stock}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-400">
                            {threshold}
                          </td>
                          <td className="p-4">
                            {isOutOfStock ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
                                🚫 نفد تماماً
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse">
                                ⚠️ قارب على النفاذ
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                                ✅ متوفر
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            {isManager ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleQuickRestock(p.id, 1)}
                                  title="إضافة قطعة واحدة للمخزن"
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-teal-500/20 text-slate-300 hover:text-teal-400 font-mono text-[11px] font-bold transition border border-slate-700 cursor-pointer"
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => handleQuickRestock(p.id, 5)}
                                  title="إضافة 5 قطع للمخزن"
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-teal-500/20 text-slate-300 hover:text-teal-400 font-mono text-[11px] font-bold transition border border-slate-700 cursor-pointer"
                                >
                                  +5
                                </button>
                                <button
                                  onClick={() => handleQuickRestock(p.id, 10)}
                                  title="إضافة 10 قطع للمخزن (كرتونة صغيرة)"
                                  className="px-2 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500 hover:text-slate-950 text-teal-300 font-mono text-[11px] font-bold transition border border-teal-500/30 cursor-pointer"
                                >
                                  +10
                                </button>
                              </div>
                            ) : (
                              <div className="text-center text-slate-600 font-mono text-xs">—</div>
                            )}
                          </td>
                          {isManager && (
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  title="تعديل بيانات الصنف (المدير)"
                                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 transition cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  title="حذف الصنف (المدير)"
                                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={isManager ? 11 : 10} className="p-8 text-center text-slate-500">
                        لا توجد أصناف مطابقة لبحثك في جدول المخزون.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-400" />
              <span>إضافة صنف أو منتج جديد</span>
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  placeholder="مثال: واي بروتين، كرياتين، مياه"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">القسم</label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) =>
                      setNewProductForm({
                        ...newProductForm,
                        category: e.target.value as POSProduct['category'],
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="supplements">مكملات غذائية</option>
                    <option value="drinks">مشروبات ومياه</option>
                    <option value="snacks">سناكس وبروتين بار</option>
                    <option value="apparel">ملابس رياضية</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الكمية بالمخزن</label>
                  <input
                    type="number"
                    value={newProductForm.stock}
                    onChange={(e) => setNewProductForm({ ...newProductForm, stock: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">حد التنبيه (Low)</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductForm.lowStockThreshold}
                    onChange={(e) => setNewProductForm({ ...newProductForm, lowStockThreshold: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-amber-600/50 rounded-xl px-2 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    value={newProductForm.buyPrice}
                    onChange={(e) => setNewProductForm({ ...newProductForm, buyPrice: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر البيع للجمهور</label>
                  <input
                    type="number"
                    value={newProductForm.sellPrice}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sellPrice: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الباركود (اختياري)</label>
                <input
                  type="text"
                  value={newProductForm.barcode}
                  onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs"
                >
                  حفظ الصنف
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal (Manager-Only) */}
      {isManager && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">تعديل بيانات المنتج</h3>
                <p className="text-xs text-slate-400">قم بتحديث الاسم أو الأسعار أو الكمية في المخزن</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={editProductForm.name}
                  onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">القسم</label>
                  <select
                    value={editProductForm.category}
                    onChange={(e) =>
                      setEditProductForm({
                        ...editProductForm,
                        category: e.target.value as POSProduct['category'],
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="supplements">مكملات وبروتين</option>
                    <option value="drinks">مشروبات ومياه</option>
                    <option value="snacks">سناكس وبار</option>
                    <option value="apparel">ملابس وأدوات</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الكمية بالمخزن</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editProductForm.stock}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, stock: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">حد التنبيه (Threshold)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editProductForm.lowStockThreshold}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-amber-600/50 rounded-xl px-2 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editProductForm.buyPrice}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, buyPrice: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سعر البيع للجمهور</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editProductForm.sellPrice}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, sellPrice: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الباركود</label>
                <input
                  type="text"
                  value={editProductForm.barcode}
                  onChange={(e) =>
                    setEditProductForm({ ...editProductForm, barcode: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">إيصال بيع Synapse POS</h3>
            <p className="text-xs text-slate-400 mt-0.5">تم تسجيل البيع وإضافة الربح بنجاح</p>

            <div className="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-right space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>رقم الفاتورة:</span>
                <span className="font-mono text-slate-200">{receiptData.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-teal-400">{receiptData.method}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>الوقت:</span>
                <span className="text-slate-200">{receiptData.time}</span>
              </div>

              <div className="border-t border-slate-800 pt-2 space-y-1">
                {receiptData.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="text-slate-300">
                      {it.productName} (×{it.quantity})
                    </span>
                    <span className="font-mono text-white">{formatEGP(it.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-sm">
                <span className="text-white">الإجمالي:</span>
                <span className="text-teal-300">{formatEGP(receiptData.total)}</span>
              </div>
            </div>

            <button
              onClick={() => setReceiptData(null)}
              className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
