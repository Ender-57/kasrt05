import React, { useState, useEffect } from 'react';
import { formatThousands, parseThousands } from '../utils/formatters';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | '' | undefined | null;
  onChange: (value: number, formatted: string) => void;
  allowEmpty?: boolean;
  prefix?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  allowEmpty = true,
  prefix,
  placeholder = '0',
  className = '',
  disabled = false,
  ...restProps
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === '' || value === undefined || value === null) return '';
    return formatThousands(value);
  });

  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplayValue('');
    } else {
      const formatted = formatThousands(value);
      if (formatted !== displayValue && parseThousands(displayValue) !== Number(value)) {
        setDisplayValue(formatted);
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawText = e.target.value;
    const cleanDigits = rawText.replace(/[^0-9]/g, '');

    if (!cleanDigits) {
      setDisplayValue('');
      onChange(0, '');
      return;
    }

    const num = parseInt(cleanDigits, 10);
    const formatted = formatThousands(num);
    setDisplayValue(formatted);
    onChange(num, formatted);
  };

  if (prefix) {
    return (
      <div className="relative flex items-center w-full">
        <span className="absolute left-3 text-slate-400 font-mono text-xs select-none pointer-events-none">
          {prefix}
        </span>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`${className} ${prefix ? 'pl-9' : ''}`}
          {...restProps}
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...restProps}
    />
  );
};
