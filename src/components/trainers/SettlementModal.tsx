import React, { useState } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, X, DollarSign } from 'lucide-react';
import { Coach } from '../../types';
import { formatEGP } from '../../utils/formatters';

interface SettlementModalProps {
  coach: Coach | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSettlement: (coachId: string, adminUser: string) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  coach,
  isOpen,
  onClose,
  onConfirmSettlement,
}) => {
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !coach) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Verify Admin credentials as specified in prompt: cahmed255u / cahmed255p
    if (
      adminUsername.trim().toLowerCase() === 'cahmed255u' &&
      adminPassword === 'cahmed255p'
    ) {
      onConfirmSettlement(coach.id, adminUsername);
      onClose();
      setAdminUsername('');
      setAdminPassword('');
    } else {
      setError('بيانات اعتماد المدير غير صحيحة! يرجى إدخال cahmed255u وكلمة المرور الخاصة به.');
    }
  };

  const autoFillAdmin = () => {
    setAdminUsername('cahmed255u');
    setAdminPassword('cahmed255p');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-black text-white">تصفية حساب المدرب (إذن صرف المدير)</h3>
        <p className="text-xs text-slate-400 mt-1">
          لتصفية مستحقات المدرب وتصفير رصيده، يلزم تأكيد هوية المدير العام
        </p>

        {/* Coach Balance Summary */}
        <div className="my-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">اسم المدرب:</span>
            <span className="font-bold text-white">{coach.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">المبلغ المستحق للتصفية (ليه كام):</span>
            <span className="font-black text-emerald-400 text-sm">{formatEGP(coach.currentBalance)}</span>
          </div>
        </div>

        {/* Quick Autofill Pill */}
        <button
          type="button"
          onClick={autoFillAdmin}
          className="w-full mb-4 py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-[11px] text-teal-400 font-bold border border-slate-700/60 transition text-center"
        >
          ملء بيانات المدير تلقائياً (cahmed255u)
        </button>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">اسم مستخدم المدير</label>
            <div className="relative">
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="cahmed255u"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-9 text-xs text-white dir-ltr focus:outline-none focus:border-rose-500"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">كلمة مرور المدير</label>
            <div className="relative">
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-9 text-xs text-white dir-ltr focus:outline-none focus:border-rose-500"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-rose-500/20 transition cursor-pointer"
            >
              تأكيد الصرف وتصفير الحساب
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
