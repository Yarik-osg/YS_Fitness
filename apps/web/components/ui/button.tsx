import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-none px-6 font-label text-sm font-bold uppercase tracking-[0.12em] transition enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-[#090b0d] shadow-[0_0_30px_rgb(91_244_214_/_15%)] hover:brightness-110',
        outline:
          'border border-line bg-transparent text-ink hover:border-accent hover:text-accent',
        ghost: 'text-muted hover:text-ink',
      },
      size: {
        default: 'h-13',
        sm: 'min-h-10 px-4 text-xs',
        lg: 'min-h-15 px-8 text-base',
        icon: 'size-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
