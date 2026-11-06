'use client';

/* eslint-disable @next/next/no-img-element -- Open Food Facts hosts are not in the image allow-list. */

import { UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';

export function FoodImage({
  src,
  alt,
  size = 'row',
}: {
  src: string | null;
  alt: string;
  size?: 'row' | 'card';
}) {
  const [failed, setFailed] = useState(false);
  const box = size === 'card' ? 'size-16' : 'size-12';
  const pixels = size === 'card' ? 64 : 48;

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`grid ${box} shrink-0 place-items-center border border-line bg-background text-muted`}
      >
        <UtensilsCrossed size={16} strokeWidth={1.6} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={pixels}
      height={pixels}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${box} shrink-0 object-cover`}
    />
  );
}
