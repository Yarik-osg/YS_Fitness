'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputProps & { revealLabel: string; hideLabel: string }
>(function PasswordInput({ revealLabel, hideLabel, className, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
      />
      <button
        type="button"
        aria-label={visible ? hideLabel : revealLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-white/40 transition hover:text-white/70"
      >
        {visible ? (
          <EyeOff size={18} strokeWidth={1.8} />
        ) : (
          <Eye size={18} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
});
