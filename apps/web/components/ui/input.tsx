import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-13 w-full rounded-none border border-line bg-panel px-4 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
