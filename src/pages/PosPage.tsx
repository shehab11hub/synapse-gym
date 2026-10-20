import React, { useState } from 'react';
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

  // Search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

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
    barcode: '',
  });

  const handleOpenEdit = (product: POSProduct) => {
    setEditingProduct(product);
    setEditProductForm({
      name: product.name,
      category: product.category,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      stock: product.stock,
      barcode: product.barcode || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editProductForm.name) return;

    updateProduct(editingProduct.id, {
      name: editProductForm.name,
      category: editProductForm.category,
      buyPrice: Number(editProductForm.buyPrice),
      sellPrice: Number(editProductForm.sellPrice),
      stock: Number(editProductForm.stock),
      barcode: editProductForm.barcode,
    });

    setEditingProduct(null);
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
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
    if (!newProductForm.name) return;

    addProduct({
      name: newProductForm.name,
      category: newProductForm.category,
      buyPrice: Number(newProductForm.buyPrice),
      sellPrice: Number(newProductForm.sellPrice),
      stock: Number(newProductForm.stock),
      barcode: newProductForm.barcode || `BAR-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    setIsAddProductModalOpen(false);
    setNewProductForm({
      name: '',
      category: 'supplements',
      buyPrice: 100,
      sellPrice: 150,
      stock: 20,
      barcode: '',
    });
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchCat && matchSearch;
  });

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

      {/* Main Register & Cart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Products Grid (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Controls: Search, Category Filters, Add Product Button */}
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

              <button
                onClick={() => setIsAddProductModalOpen(true)}
                className="w-full sm:w-auto py-2.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منتج جديد (Add Product)</span>
              </button>
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
              const profitPerItem = p.sellPrice - p.buyPrice;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && handleAddToCart(p)}
                  className={`p-4 rounded-3xl border transition duration-200 flex flex-col justify-between cursor-pointer select-none ${
                    isOutOfStock
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-50 cursor-not-allowed'
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
                            p.stock <= 5 ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          متبقي: {p.stock}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(p);
                          }}
                          title="تعديل المنتج"
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
                          title="حذف المنتج"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                      className="p-2 rounded-xl bg-teal-500/15 text-teal-400 hover:bg-teal-500 hover:text-slate-950 font-bold transition"
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

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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

      {/* Edit Product Modal */}
      {editingProduct && (
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

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="supplements">مكملات وبروتين</option>
                    <option value="drinks">مشروبات ومياه</option>
                    <option value="snacks">سناكس وبار</option>
                    <option value="apparel">ملابس وأدوات</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الكمية في المخزن</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editProductForm.stock}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, stock: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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
