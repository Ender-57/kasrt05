import React from 'react';

interface RTLogoProps {
  className?: string;
  size?: number;
}

export const RT_LOGO_IMG_SRC = '/logo-rt05.png';

export const RTLogo: React.FC<RTLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-white overflow-hidden shadow-xs border border-slate-200/80 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <img
        src={RT_LOGO_IMG_SRC}
        alt="Logo RT 05 RW 08 Dusun III Satriajaya"
        className="w-full h-full object-contain rounded-full"
        loading="eager"
      />
    </div>
  );
};
