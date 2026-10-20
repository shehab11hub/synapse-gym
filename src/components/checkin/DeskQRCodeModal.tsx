import React, { useEffect, useState } from 'react';
import { X, Printer, Download, Sparkles, QrCode } from 'lucide-react';
import { generateQRDataUrl } from '../../utils/qrGenerator';

interface DeskQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  gymName?: string;
}

export const DeskQRCodeModal: React.FC<DeskQRCodeModalProps> = ({
  isOpen,
  onClose,
  gymName = 'SYNAPSE GYM - الفرع الرئيسي',
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Dynamic Desk QR code using current origin with SPA /checkin route
      const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
      const deskCheckinUrl = `${baseUrl}/checkin?desk=true&gym=${encodeURIComponent(gymName)}`;
      generateQRDataUrl(deskCheckinUrl).then(setQrUrl);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2 text-teal-400">
          <QrCode className="w-6 h-6" />
          <span className="text-xs uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
            كيو آر كود مكتب الاستقبال
          </span>
        </div>

        <h3 className="text-xl font-black text-white">{gymName}</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          يتم وضع هذا الرمز على كاونتر الاستقبال ليقوم الأعضاء بمسحه عبر هواتفهم لتسجيل الحضور فوراً
        </p>

        {/* Printable Desk Stand Preview */}
        <div className="my-6 p-6 rounded-2xl bg-white text-slate-900 border-4 border-teal-500/40 shadow-inner flex flex-col items-center justify-center">
          <div className="text-sm font-black tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
            SYNAPSE SMART CHECK-IN
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
            {qrUrl ? (
              <img src={qrUrl} alt="Desk QR Code" className="w-56 h-56 mx-auto object-contain" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                جاري توليد الكود...
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs font-bold text-slate-800">امسح الكود لتسجيل حضورك</p>
            <p className="text-[10px] text-slate-500 font-medium">Scan to check-in to your workout</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة استاند المكتب</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
