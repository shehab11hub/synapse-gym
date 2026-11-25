import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSaasBadge?: boolean;
  centered?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showSaasBadge = true,
  centered = false,
  className = '',
}) => {
  return (
    <div
      className={`flex ${
        centered ? 'flex-col items-center text-center' : 'items-center'
      } gap-3 ${className}`}
    >
      <img
        src="/egyfit-logo.png"
        alt="EGYFIT Logo"
        className={`${SIZE_MAP[size]} object-contain bg-transparent select-none drop-shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0`}
      />

      {showText && (
        <div className={centered ? 'text-center' : 'text-right'}>
          <div className={`flex items-center ${centered ? 'justify-center' : ''} gap-1.5`}>
            <span
              className={`font-black tracking-wider text-white ${
                size === 'xl' || size === 'lg' ? 'text-2xl' : 'text-lg'
              }`}
            >
              EGYFIT
            </span>
            {showSaasBadge && (
              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SAAS
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
            Powered by Synapse
          </p>
        </div>
      )}
    </div>
  );
};
