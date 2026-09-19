import Link from 'next/link';
import { BrandMark } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-12 pt-7">
      <nav className="flex items-center justify-between border-b border-line pb-5">
        <BrandMark />
        <Link
          href="/login"
          className="font-label text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-accent"
        >
          Увійти
        </Link>
      </nav>

      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Персональний фітнес
        </p>
        <h1 className="mt-5 max-w-4xl font-heading text-[clamp(3.7rem,11vw,8rem)] uppercase leading-[0.86] tracking-tight">
          Сильніше тіло.
          <br />
          <span className="text-accent">Розумний план.</span>
        </h1>
        <p className="mt-8 max-w-lg text-sm leading-7 text-muted">
          Відповідай на кілька питань — і отримай основу персональної програми
          навколо свого ритму, досвіду та цілей.
        </p>
        <Link className="mt-10 w-full max-w-sm" href="/register">
          <Button size="lg" className="w-full">
            Почати →
          </Button>
        </Link>
      </section>
    </main>
  );
}
