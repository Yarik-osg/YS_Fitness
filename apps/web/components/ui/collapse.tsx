'use client';

import { AnimatePresence, m, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const DURATION = 0.22;

const variants: Variants = {
  closed: { height: 0, opacity: 0 },
  open: { height: 'auto', opacity: 1 },
};

/**
 * Animated expand/collapse panel. The content is mounted only while `open`,
 * so closed panels stay out of the DOM and the accessibility tree. Reduced
 * motion is honoured by the app-wide `MotionConfig`.
 *
 * Pass `instant` for a change that must not animate, e.g. when the page is
 * about to scroll to a position that depends on the final layout. It is
 * synchronous: closing removes the content in the same commit and opening
 * renders it at full height at once. (An exit animation, even a zero-length
 * one, would keep the old panel in the layout for a frame, and an enter
 * animation starts at height 0, so a scroll measured right after the change
 * would land in the wrong place.)
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
  if (instant) {
    return open ? (
      <div id={id} className={className}>
        {children}
      </div>
    ) : null;
  }

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <m.div
          key="panel"
          id={id}
          className={className}
          variants={variants}
          initial="closed"
          animate="open"
          exit="closed"
          transition={{ duration: DURATION, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
