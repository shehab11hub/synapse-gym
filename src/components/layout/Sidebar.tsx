import React from 'react';
import {
  QrCode,
  Calendar,
  Activity,
  Calculator,
  ShoppingCart,
  ShieldCheck,
  LogOut,
  Building2,
  Sparkles,
  WalletCards,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, logout, canAccessPage } = useAuth();

  const menuItems = [
    {
      id: 'reception',
      label: 'الاستقبال والتحضير',
      sublabel: 'كيو آر وسجل الدخول',
      icon: QrCode,
      pageKey: 'reception',
      badge: 'الرئيسية',
    },
    {
      id: 'sessions',
      label: 'الحصص والكلاسات',
      sublabel: 'جدول التمارين واللاعبين',
      icon: Calendar,
      pageKey: 'sessions',
    },
    {
      id: 'physiotherapy',
      label: 'العلاج الطبيعي',
      sublabel: 'تأجير الغرف واستشارات الأطباء',
      icon: Activity,
      pageKey: 'physiotherapy',
    },
    {
      id: 'trainers',
      label: 'حسابات المدربين',
      sublabel: 'اليوميات، الحصص، وتصفية الحساب',
      icon: Calculator,
      pageKey: 'trainers',
      // Now visible to Receptionist as requested!
    },
    {
      id: 'expenses',
      label: 'المصاريف وإدارة الدرج',
      sublabel: 'الكهرباء، الصيانة، وصافي الخزينة',
      icon: WalletCards,
      pageKey: 'expenses',
      badge: 'الدرج',
    },
    {
      id: 'master_report',
      label: 'التقرير الشامل',
      sublabel: 'شيت الإكسيل، الاشتراكات، وبداية الشهر',
      icon: FileSpreadsheet,
      pageKey: 'master_report',
      badge: 'Excel',
    },
    {
      id: 'analytics',
      label: 'التقارير والرسومات البيانية',
      sublabel: 'مقارنة الأسبوع، الشهر، والسنة',
      icon: BarChart3,
      pageKey: 'analytics',
    },
    {
      id: 'pos',
      label: 'نقطة البيع (POS)',
      sublabel: 'المنتجات، المبيعات والأرباح',
      icon: ShoppingCart,
      pageKey: 'pos',
    },
    {
      id: 'users',
      label: 'المستخدمين والصلاحيات',
      sublabel: 'إدارة المدراء وموظفي الاستقبال',
      icon: ShieldCheck,
      pageKey: 'users',
      adminOnly: true,
    },
  ];

  // Filter items based on user role permissions
  const visibleItems = menuItems.filter((item) => {
    if (item.adminOnly && currentUser?.role !== 'admin') return false;
    return canAccessPage(item.pageKey);
  });

  return (
    <aside className="w-72 bg-[#0c1220] border-l border-slate-800/80 flex flex-col h-screen sticky top-0 select-none z-30 shadow-2xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-black text-xl tracking-wider">
            S
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold text-white tracking-wide">SYNAPSE</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                SaaS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">نظام إدارة الأندية الرياضية</p>
          </div>
        </div>

        {/* Tenant Gym Selector */}
        <div className="mt-4 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-semibold text-slate-200">الفرع الرئيسي | فرع القاهرة</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          قائمة التحكم السريع
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-right transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-l from-teal-500/15 via-teal-500/10 to-transparent border-r-4 border-teal-400 text-teal-300 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'bg-slate-850 text-slate-400 group-hover:text-teal-400 group-hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-sm ${isActive ? 'text-white font-bold' : 'font-medium'}`}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{item.sublabel}</div>
                </div>
              </div>

              {item.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Role / User Profile Card & Logout */}
      <div className="p-4 border-t border-slate-800/70 bg-[#090d16]/70">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold text-sm">
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 line-clamp-1">
                {currentUser?.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                    currentUser?.role === 'admin'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {currentUser?.role === 'admin' ? 'مدير النظام' : 'موظف استقبال'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="تسجيل الخروج"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] text-slate-600 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-teal-500" />
          <span>منصة سينابس SaaS الذكية v2.4</span>
        </div>
      </div>
    </aside>
  );
};
