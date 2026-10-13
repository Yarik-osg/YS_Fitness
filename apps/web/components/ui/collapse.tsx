'use client';

import { AnimatePresence, m, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const DURATION = 0.22;

// `custom` carries `instant`, because an exiting child can no longer receive
// new props once it has been removed.
const variants: Variants = {
  closed: (instant: boolean) => ({
    height: 0,
    opacity: 0,
    transition: { duration: instant ? 0 : DURATION, ease: 'easeOut' },
  }),
  open: (instant: boolean) => ({
    height: 'auto',
    opacity: 1,
    transition: { duration: instant ? 0 : DURATION, ease: 'easeOut' },
  }),
};

/**
 * Animated expand/collapse panel. The content is mounted only while `open`,
 * so closed panels stay out of the DOM and the accessibility tree. Reduced
 * motion is honoured by the app-wide `MotionConfig`.
 *
 * Pass `instant` for a change that must not animate, e.g. when the page is
 * about to scroll to a position that depends on the final layout.
 */
export function Collapse({
  open,
  id,
  instant = false,
  className,
  children,
}: {
  open: boolean;
  id?: string;
  instant?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false} custom={instant}>
      {open ? (
        <m.div
          key="panel"
          id={id}
          className={className}
          custom={instant}
          variants={variants}
          initial="closed"
          animate="open"
          exit="closed"
          style={{ overflow: 'hidden' }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
