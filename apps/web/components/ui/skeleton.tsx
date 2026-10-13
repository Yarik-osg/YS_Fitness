import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Placeholder block for a page that is still loading. The pulse is skipped
 * when the user prefers reduced motion. The bar itself is hidden from
 * assistive tech; the page wrapper carries `aria-busy`.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-white/10 motion-safe:animate-pulse', className)}
      {...props}
    />
  );
}
