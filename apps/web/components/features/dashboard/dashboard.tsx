'use client';

import { useRouter } from 'next/navigation';
import { Activity, Dumbbell, Salad } from 'lucide-react';
import { BrandMark } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';

export function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

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
          Вийти
        </Button>
      </nav>

      <header className="pb-10 pt-14">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          Особистий кабінет
        </p>
        <h1 className="mt-3 max-w-lg font-heading text-5xl uppercase leading-none">
          Твоя система <span className="text-accent">прогресу</span>
        </h1>
        <p className="mt-5 text-sm text-muted">{user?.email}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          icon={<Dumbbell />}
          title="Тренування"
          text="Персональна програма з’явиться тут у наступному модулі."
        />
        <DashboardCard
          icon={<Salad />}
          title="Харчування"
          text="Калорії та макроси будуть розраховані окремо."
        />
        <DashboardCard
          icon={<Activity />}
          title="Прогрес"
          text="Виміри, фото й історія результатів — скоро."
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
