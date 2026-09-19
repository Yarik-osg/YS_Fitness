import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  className?: string;
  label?: string;
}

export function Progress({
  value,
  className,
  label = 'Progress',
}: ProgressProps) {
  const normalized = Math.max(0, Math.min(value, 100));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
      className={cn('h-1 w-full overflow-hidden bg-line', className)}
    >
      <div
        className="h-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}
