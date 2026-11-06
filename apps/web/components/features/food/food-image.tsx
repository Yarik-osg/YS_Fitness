'use client';

/* eslint-disable @next/next/no-img-element -- Open Food Facts hosts are not in the image allow-list. */

import { UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';

export function FoodImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center border border-line bg-background text-muted"
      >
        <UtensilsCrossed size={16} strokeWidth={1.6} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={48}
      height={48}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 object-cover"
    />
  );
}
