'use client';

import {
  Apple,
  BarChart3,
  Dumbbell,
  Home,
  LayoutGrid,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const NAV_ITEMS = [
  { id: 'home', href: '/dashboard', icon: Home },
  { id: 'training', href: '/training', icon: Dumbbell },
  { id: 'nutrition', href: null, icon: Apple },
  { id: 'progress', href: null, icon: BarChart3 },
  { id: 'profile', href: '/profile', icon: User },
  { id: 'library', href: null, icon: LayoutGrid },
] as const;

export function ClientNav({
  active,
}: {
  active: 'home' | 'training' | 'profile';
}) {
  const t = useTranslations('dashboard');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] border-t border-white/10 bg-[#0b0b0b] pb-[env(safe-area-inset-bottom,0px)]">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === active;
        const className =
          'relative flex flex-1 flex-col items-center gap-1 px-0.5 pt-2.5 pb-3';
        const content = (
          <NavTabContent
            active={isActive}
            available={item.href != null}
            icon={item.icon}
            label={t(`home.nav.${item.id}`)}
          />
        );

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            disabled={!isActive}
            aria-current={isActive ? 'page' : undefined}
            className={`${className} disabled:cursor-not-allowed`}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}

function NavTabContent({
  active,
  available,
  icon: Icon,
  label,
}: {
  active: boolean;
  available: boolean;
  icon: typeof Home;
  label: string;
}) {
  const tone = active
    ? 'text-[#35f5e8]'
    : available
      ? 'text-white/70'
      : 'text-white/30';

  return (
    <>
      {active ? (
        <span className="absolute top-0 left-1/2 h-px w-[22px] -translate-x-1/2 bg-[#35f5e8]" />
      ) : null}
      <Icon size={20} strokeWidth={1.6} className={tone} />
      <span
        className={`text-[7px] whitespace-nowrap ${
          active ? 'font-semibold' : 'font-medium'
        } ${tone}`}
      >
        {label}
      </span>
    </>
  );
}
