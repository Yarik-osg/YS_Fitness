'use client';

import * as React from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

const OpenerContext = React.createContext<React.RefObject<HTMLElement | null>>({
  current: null,
});

/**
 * Bottom sheet built on vaul (Radix Dialog underneath): focus trap, focus
 * return, Escape, hiding the page from screen readers and scroll lock come for free, and it portals to
 * the body so nothing (e.g. the fixed bottom nav) can cover it.
 *
 * Pass `dismissible={false}` to block Escape, outside tap and swipe-down, for
 * example while a save is in flight.
 */
export function Sheet({
  open,
  ...props
}: React.ComponentProps<typeof Drawer.Root>) {
  // Radix only returns focus to a <Trigger>. Our sheets are opened from state,
  // so remember what had focus just before opening and restore it on close.
  const opener = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
  }, [open]);

  // vaul turns Radix's focus-on-open off by default; keep it on so keyboard
  // and screen-reader users land inside the sheet instead of behind it.
  return (
    <OpenerContext.Provider value={opener}>
      <Drawer.Root autoFocus open={open} {...props} />
    </OpenerContext.Provider>
  );
}

export function SheetContent({
  className,
  children,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof Drawer.Content>) {
  const opener = React.useContext(OpenerContext);
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/70" />
      <Drawer.Content
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && opener.current?.isConnected) {
            opener.current.focus();
          }
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px] border-t border-white/10 bg-panel px-5 pt-4 pb-9 outline-none',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20"
        />
        {children}
      </Drawer.Content>
    </Drawer.Portal>
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Title>) {
  return (
    <Drawer.Title
      className={cn(
        'mb-3 text-center font-label text-sm font-bold tracking-[0.06em] text-white uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Description>) {
  return (
    <Drawer.Description
      className={cn(
        'mb-7 text-center text-[13px] leading-relaxed text-white/50',
        className,
      )}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2.5', className)} {...props} />;
}
