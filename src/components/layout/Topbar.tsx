import React, { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Menu,
} from 'lucide-react';
import { useGymData } from '../../context/GymDataContext';
import { useAuth } from '../../context/AuthContext';
import { formatEGP } from '../../utils/formatters';

interface TopbarProps {
  activeTab: string;
  onOpenMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ activeTab, onOpenMobileMenu }) => {
  const { getTodayStats } = useGymData();
  const { currentUser } = useAuth();
  const stats = getTodayStats();

  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'reception':
        return { title: 'الاستقبال وتسجيل الحضور', subtitle: 'مسح الكيو آر كود والتحقق من اشتراكات اللاعبين' };
      case 'sessions':
        return { title: 'جدول الحصص والتمارين', subtitle: 'إدارة الكلاسات، المدربين، واللاعبين المسجلين' };
      case 'physiotherapy':
        return { title: 'قسم العلاج الطبيعي والتأهيل', subtitle: 'حجز غرف العيادات، حساب الساعات وأتعاب الأطباء' };
      case 'trainers':
        return { title: 'حسابات ومستحقات المدربين', subtitle: 'إثبات حضور الحصص وتصفية اليوميات والرواتب' };
      case 'expenses':
        return { title: 'إدارة المصاريف والدرج النقدي', subtitle: 'تسجيل الفواتير والصيانة وصافي النقدية بالدرج بالجنيه' };
      case 'master_report':
        return { title: 'التقرير الشامل والأرشيف الشهري', subtitle: 'شيت الإكسيل، تفصيل الكباتن، وحسابات الدرج' };
      case 'analytics':
        return { title: 'التقارير الإحصائية والرسومات البيانية', subtitle: 'تحليل الأرباح ومقارنة أداء الأسبوع والشهر والسنة' };
      case 'pos':
        return { title: 'نقطة البيع ومبيعات المتجر', subtitle: 'المكملات الغذائية، المشروبات والأرباح اليومية' };
      case 'users':
        return { title: 'إدارة المستخدمين والصلاحيات', subtitle: 'التحكم في حسابات المدراء وموظفي الاستقبال' };
      default:
        return { title: 'لوحة التحكم', subtitle: 'منظومة Synapse Gym لإدارة الأندية' };
    }
  };

  const { title, subtitle } = getPageTitle(activeTab);

  return (
    <header className="h-20 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Subtitle + Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-teal-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="فتح القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h1 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
            {title}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>
        </div>
      </div>

      {/* Middle Stat Badges */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Check-ins today */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="p-1 rounded-md bg-teal-500/10 text-teal-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400">حضور اليوم</div>
            <div className="font-bold text-teal-300">{stats.checkInsCount} لاعب</div>
          </div>
        </div>

        {/* POS Sales today */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400">مبيعات اليوم (POS)</div>
            <div className="font-bold text-emerald-300">{formatEGP(stats.posSalesToday)}</div>
          </div>
        </div>

        {/* Coach Paid Today - only if admin */}
        {currentUser?.role === 'admin' && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="p-1 rounded-md bg-rose-500/10 text-rose-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">منصرف للمدربين اليوم</div>
              <div className="font-bold text-rose-300">{formatEGP(stats.coachesPaidToday)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Clock & Status */}
      <div className="flex items-center gap-2">
        {/* Live Clock */}
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 animate-pulse" />
          <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider dir-ltr text-teal-200">
            {timeString || '--:--:--'}
          </span>
        </div>
      </div>
    </header>
  );
};
