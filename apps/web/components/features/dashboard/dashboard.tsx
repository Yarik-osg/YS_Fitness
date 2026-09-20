'use client';

import { Activity, Dumbbell, Salad } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { useLogout } from '@/lib/hooks/use-auth';
import { useMySubscription } from '@/lib/hooks/use-subscriptions';
import { useAuthStore } from '@/lib/stores/auth-store';

export function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const subscription = useMySubscription();
  const t = useTranslations('dashboard');
  const locale = useLocale();

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pb-12 pt-7">
      <nav className="flex items-center justify-between border-b border-line pb-5">
        <BrandMark />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void signOut()}
          disabled={logout.isPending}
        >
          {t('logout')}
        </Button>
      </nav>

      <header className="pb-10 pt-14">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 max-w-lg font-heading text-5xl uppercase leading-none">
          {t('title')} <span className="text-accent">{t('titleAccent')}</span>
        </h1>
        <p className="mt-5 text-sm text-muted">{user?.email}</p>
        {subscription.data ? (
          <p className="mt-3 text-sm text-muted">
            {t('subscription.active', {
              plan: subscription.data.plan.name,
              periodEnd: formatPeriodEnd(
                subscription.data.currentPeriodEnd,
                locale,
              ),
            })}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">{t('subscription.none')}</p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          icon={<Dumbbell />}
          title={t('workouts.title')}
          text={t('workouts.text')}
        />
        <DashboardCard
          icon={<Salad />}
          title={t('nutrition.title')}
          text={t('nutrition.text')}
        />
        <DashboardCard
          icon={<Activity />}
          title={t('progress.title')}
          text={t('progress.text')}
        />
      </section>
    </main>
  );
}

function DashboardCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="border border-line bg-panel p-5">
      <div className="mb-8 text-accent">{icon}</div>
      <h2 className="font-heading text-xl uppercase">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-muted">{text}</p>
    </article>
  );
}

function formatPeriodEnd(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}
