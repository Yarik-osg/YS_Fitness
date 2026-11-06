'use client';

import type { FoodMeal, FoodProductResponse } from '@repo/shared-types';
import {
  createFoodProductSchema,
  FOOD_MAX_GRAMS,
  FOOD_MEALS,
  FOOD_MIN_GRAMS,
} from '@repo/validation';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { FoodImage } from '@/components/features/food/food-image';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import { gramsAccepted, previewMacros } from '@/lib/food/macros';
import { decodeFoodText } from '@/lib/food/text';
import {
  useCreateFoodLog,
  useCreateFoodProduct,
  useFavoriteFoods,
  useFoodSearch,
  useRecentFoods,
  useToggleFavorite,
} from '@/lib/hooks/use-food';

type Tab = 'search' | 'favorites' | 'recent';

export function AddFoodSheet({
  open,
  meal,
  loggedOn,
  onClose,
}: {
  open: boolean;
  meal: FoodMeal;
  loggedOn: string;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent>
        {open ? (
          <AddFoodForm
            key={`${meal}-${loggedOn}`}
            meal={meal}
            loggedOn={loggedOn}
            onClose={onClose}
          />
        ) : (
          <SheetTitle className="sr-only">Add</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddFoodForm({
  meal,
  loggedOn,
  onClose,
}: {
  meal: FoodMeal;
  loggedOn: string;
  onClose: () => void;
}) {
  const t = useTranslations('food');
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<{
    product: FoodProductResponse;
    grams: string;
    meal: FoodMeal;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(
    product: FoodProductResponse,
    grams = '100',
    nextMeal: FoodMeal = meal,
  ) {
    setPicked({ product, grams, meal: nextMeal });
  }

  return (
    <>
      <SheetTitle>{t(`meals.${picked?.meal ?? meal}`)}</SheetTitle>
      <SheetDescription>
        {picked ? t('quantityHint') : t('addHint')}
      </SheetDescription>
      {picked ? (
        <QuantityStep
          product={picked.product}
          grams={picked.grams}
          meal={picked.meal}
          loggedOn={loggedOn}
          onGrams={(grams) => setPicked({ ...picked, grams })}
          onMeal={(next) => setPicked({ ...picked, meal: next })}
          onBack={() => setPicked(null)}
          onDone={onClose}
        />
      ) : (
        <>
          <div className="mb-4 flex border border-line">
            {(['search', 'favorites', 'recent'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={tab === item}
                onClick={() => setTab(item)}
                className={`flex-1 px-2 py-2 font-label text-[10px] font-bold tracking-[0.08em] uppercase ${
                  tab === item ? 'bg-teal text-background' : 'text-muted'
                }`}
              >
                {t(`tabs.${item}`)}
              </button>
            ))}
          </div>
          {tab === 'search' ? (
            <SearchTab
              query={query}
              debounced={debounced}
              creating={creating}
              onQuery={setQuery}
              onCreating={setCreating}
              onPick={(product) => pick(product)}
              onCreated={(product) => {
                setCreating(false);
                pick(product);
              }}
            />
          ) : null}
          {tab === 'favorites' ? (
            <FavoritesTab onPick={(product) => pick(product)} />
          ) : null}
          {tab === 'recent' ? (
            <RecentTab
              onPick={(product, grams, nextMeal) =>
                pick(product, grams, nextMeal)
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}

function SearchTab({
  query,
  debounced,
  creating,
  onQuery,
  onCreating,
  onPick,
  onCreated,
}: {
  query: string;
  debounced: string;
  creating: boolean;
  onQuery: (value: string) => void;
  onCreating: (value: boolean) => void;
  onPick: (product: FoodProductResponse) => void;
  onCreated: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const search = useFoodSearch(debounced);
  const slow =
    search.error instanceof ApiClientError && search.error.status === 429;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="border border-line bg-background px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {slow ? (
        <p role="alert" className="text-sm text-amber">
          {t('slowDown')}
        </p>
      ) : null}
      {search.data?.fromCacheOnly ? (
        <p className="text-sm text-muted">{t('cacheOnly')}</p>
      ) : null}
      <ProductList products={search.data?.products ?? []} onPick={onPick} />
      <button
        type="button"
        onClick={() => onCreating(!creating)}
        className="text-left text-sm text-teal"
      >
        {t('createOwn')}
      </button>
      {creating ? <CreateProductForm onCreated={onCreated} /> : null}
    </div>
  );
}

function FavoritesTab({
  onPick,
}: {
  onPick: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const favorites = useFavoriteFoods(true);
  if (favorites.isPending)
    return <p className="text-sm text-muted">{t('loading')}</p>;
  if (!favorites.data?.products.length) {
    return <p className="text-sm text-muted">{t('favoritesEmpty')}</p>;
  }
  return <ProductList products={favorites.data.products} onPick={onPick} />;
}

function RecentTab({
  onPick,
}: {
  onPick: (product: FoodProductResponse, grams: string, meal: FoodMeal) => void;
}) {
  const t = useTranslations('food');
  const recent = useRecentFoods(true);
  if (recent.isPending)
    return <p className="text-sm text-muted">{t('loading')}</p>;
  if (!recent.data?.items.length) {
    return <p className="text-sm text-muted">{t('recentEmpty')}</p>;
  }
  return (
    <ProductList
      products={recent.data.items.map((item) => item.product)}
      onPick={(product) => {
        const item = recent.data?.items.find(
          (row) => row.product.id === product.id,
        );
        if (!item) return;
        onPick(item.product, String(item.lastGrams), item.lastMeal);
      }}
      footer={(product) => {
        const item = recent.data?.items.find(
          (row) => row.product.id === product.id,
        );
        if (!item) return null;
        return (
          <button
            type="button"
            onClick={() =>
              onPick(item.product, String(item.lastGrams), item.lastMeal)
            }
            className="w-full border-t border-line px-3 py-2 text-left text-sm text-teal"
          >
            {t('addAgain')}
          </button>
        );
      }}
    />
  );
}

function ProductList({
  products,
  onPick,
  footer,
}: {
  products: FoodProductResponse[];
  onPick: (product: FoodProductResponse) => void;
  footer?: (product: FoodProductResponse) => ReactNode;
}) {
  const t = useTranslations('food');
  const toggle = useToggleFavorite();
  if (!products.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {products.map((product) => (
        <li key={product.id} className="border border-line">
          <div className="flex items-center gap-2 p-2">
            <button
              type="button"
              onClick={() => onPick(product)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <FoodImage
                src={product.imageUrl}
                alt={decodeFoodText(product.name)}
              />
              <span className="min-w-0">
                <span className="block text-sm text-ink">
                  {decodeFoodText(product.name)}
                </span>
                {product.brand ? (
                  <span className="block text-xs text-muted">
                    {decodeFoodText(product.brand)}
                  </span>
                ) : null}
                <span className="block text-xs text-muted tabular-nums">
                  {t('per100', { kcal: product.kcalPer100g })}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={product.isFavorite}
              aria-label={
                product.isFavorite
                  ? t('unfavorite', { name: decodeFoodText(product.name) })
                  : t('favorite', { name: decodeFoodText(product.name) })
              }
              onClick={() =>
                toggle.mutate({ product, next: !product.isFavorite })
              }
              className="grid size-10 place-items-center text-teal"
            >
              <Heart
                size={18}
                strokeWidth={1.6}
                fill={product.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          </div>
          {footer?.(product)}
        </li>
      ))}
    </ul>
  );
}

function CreateProductForm({
  onCreated,
}: {
  onCreated: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const create = useCreateFoodProduct();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const parsed = createFoodProductSchema.safeParse({
      name,
      kcalPer100g: Number(kcal),
      proteinPer100g: Number(protein),
      fatPer100g: Number(fat),
      carbsPer100g: Number(carbs),
    });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    create.mutate(parsed.data, {
      onSuccess: (product) => onCreated({ ...product, isFavorite: false }),
    });
  }

  return (
    <div className="flex flex-col gap-2 border border-line p-3">
      <input
        aria-label={t('productName')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink"
      />
      <input
        aria-label={t('kcalPer100')}
        value={kcal}
        inputMode="decimal"
        onChange={(event) => setKcal(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink"
      />
      <input
        aria-label={t('proteinPer100')}
        value={protein}
        inputMode="decimal"
        onChange={(event) => setProtein(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink"
      />
      <input
        aria-label={t('fatPer100')}
        value={fat}
        inputMode="decimal"
        onChange={(event) => setFat(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink"
      />
      <input
        aria-label={t('carbsPer100')}
        value={carbs}
        inputMode="decimal"
        onChange={(event) => setCarbs(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink"
      />
      {invalid ? (
        <p role="alert" className="text-sm text-amber">
          {t('invalidProduct')}
        </p>
      ) : null}
      <Button disabled={create.isPending} onClick={submit}>
        {t('create')}
      </Button>
    </div>
  );
}

function QuantityStep({
  product,
  grams,
  meal,
  loggedOn,
  onGrams,
  onMeal,
  onBack,
  onDone,
}: {
  product: FoodProductResponse;
  grams: string;
  meal: FoodMeal;
  loggedOn: string;
  onGrams: (value: string) => void;
  onMeal: (meal: FoodMeal) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('food');
  const tAuth = useTranslations('auth');
  const create = useCreateFoodLog();
  const parsed = Number(grams);
  const valid = gramsAccepted(parsed);
  const preview = valid ? previewMacros(product, parsed) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">{decodeFoodText(product.name)}</p>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t('grams')}
        <input
          aria-label={t('grams')}
          inputMode="decimal"
          min={FOOD_MIN_GRAMS}
          max={FOOD_MAX_GRAMS}
          value={grams}
          onChange={(event) => onGrams(event.target.value)}
          className="border border-line bg-background px-3 py-2 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t('meal')}
        <select
          aria-label={t('meal')}
          value={meal}
          onChange={(event) => onMeal(event.target.value as FoodMeal)}
          className="border border-line bg-background px-3 py-2 text-ink"
        >
          {FOOD_MEALS.map((item) => (
            <option key={item} value={item}>
              {t(`meals.${item}`)}
            </option>
          ))}
        </select>
      </label>
      {preview ? (
        <p className="text-sm text-muted tabular-nums">
          {t('preview', {
            kcal: preview.kcal,
            protein: preview.protein,
            fat: preview.fat,
            carbs: preview.carbs,
          })}
        </p>
      ) : (
        <p role="alert" className="text-sm text-amber">
          {t('invalidAmount')}
        </p>
      )}
      <Button
        disabled={!valid || create.isPending}
        onClick={() => {
          if (!valid) return;
          create.mutate(
            { productId: product.id, grams: parsed, meal, loggedOn },
            { onSuccess: onDone },
          );
        }}
      >
        {t('add')}
      </Button>
      {create.isError ? (
        <p role="alert" className="text-sm text-amber">
          {getUserFacingError(create.error, tAuth)}
        </p>
      ) : null}
      <button type="button" onClick={onBack} className="text-sm text-muted">
        {t('back')}
      </button>
    </div>
  );
}
