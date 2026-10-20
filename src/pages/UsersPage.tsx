import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  ShieldAlert,
  Eye,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const UsersPage: React.FC = () => {
  const { users, addUser, deleteUser, updateUserStatus, currentUser } = useAuth();

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    role: 'receptionist' as UserRole,
  });
  const [error, setError] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const success = addUser({
      username: form.username.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      active: true,
    });

    if (!success) {
      setError('اسم المستخدم هذا موجود بالفعل! يرجى اختيار اسم مستخدم آخر.');
      return;
    }

    setIsAddUserModalOpen(false);
    setForm({
      username: '',
      password: '',
      name: '',
      phone: '',
      role: 'receptionist',
    });
  };

  const pagesMatrix = [
    { name: '1. صفحة الاستقبال والتحضير', key: 'reception', admin: true, reception: true },
    { name: '2. صفحة الحصص والكلاسات', key: 'sessions', admin: true, reception: true },
    { name: '3. صفحة تأجير العلاج الطبيعي', key: 'physiotherapy', admin: true, reception: true },
    { name: '4. صفحة حسابات وتصفية المدربين', key: 'trainers', admin: true, reception: true },
    { name: '5. صفحة المصاريف وإدارة الدرج', key: 'expenses', admin: true, reception: true },
    { name: '6. صفحة التقارير والرسومات البيانية', key: 'analytics', admin: true, reception: true },
    { name: '7. صفحة المتجر ونقطة البيع (POS)', key: 'pos', admin: true, reception: true },
    { name: '8. صفحة إدارة المستخدمين والصلاحيات', key: 'users', admin: true, reception: false },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#172038] via-[#131b2e] to-[#0c1220] border border-teal-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">إدارة المستخدمين وصلاحيات الأدوار</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                حساب المدير Master
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              المدير يمتلك الصلاحية الكاملة لإضافة مدراء آخرين وتعيين موظفي الاستقبال بالصفحات المحددة
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="py-3 px-5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Permissions Matrix Explanation */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-white">مصفوفة الصلاحيات حسب نوع الدور</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              موظف الاستقبال مسموح له بالصفحات (1، 2، 3، 5) فقط، بينما حسابات المدربين والمستخدمين محجوبة للمدير حصراً
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-bold">الصفحة / القسم</th>
                <th className="py-3 px-4 font-bold text-center">
                  <span className="text-emerald-400 font-black">حساب المدير (Admin)</span>
                </th>
                <th className="py-3 px-4 font-bold text-center">
                  <span className="text-amber-400 font-black">موظف الاستقبال (Receptionist)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pagesMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20">
                  <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <Check className="w-3.5 h-3.5" />
                      مسموح بالكامل
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.reception ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" />
                        مسموح بالظهور
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        محجوب وممنوع
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-base font-black text-white mb-4">قائمة مستخدمي النظام</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-bold">الاسم</th>
                <th className="py-3 px-4 font-bold">اسم المستخدم (Username)</th>
                <th className="py-3 px-4 font-bold">الدور والصلاحية</th>
                <th className="py-3 px-4 font-bold">رقم الهاتف</th>
                <th className="py-3 px-4 font-bold">الحالة</th>
                <th className="py-3 px-4 font-bold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => {
                const isMasterAdmin = u.username === 'cahmed255u';

                return (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          u.role === 'admin'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-teal-300 dir-ltr text-right">
                      {u.username}
                      {isMasterAdmin && (
                        <span className="mr-2 text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 font-bold">
                          Master
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === 'admin' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                          مدير عام (Admin)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          موظف استقبال (Receptionist)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 dir-ltr text-right">
                      {u.phone || '---'}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        disabled={isMasterAdmin}
                        onClick={() => updateUserStatus(u.id, !u.active)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          u.active
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {u.active ? 'نشط' : 'معطل'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-left">
                      {!isMasterAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف حساب ${u.name}؟`)) {
                              deleteUser(u.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="حذف المستخدم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-400" />
              <span>إضافة مستخدم جديد للنظام</span>
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: ياسمين أحمد"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الدور والصلاحية</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="receptionist">موظف استقبال (صفحات 1، 2، 3، 5 فقط)</option>
                  <option value="admin">مدير نظام (كامل الصلاحيات 1 - 6)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم</label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="user1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-teal-500 dir-ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="010..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 dir-ltr"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs"
                >
                  إنشاء المستخدم
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
