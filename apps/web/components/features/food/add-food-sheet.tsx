'use client';

import type { FoodMeal, FoodProductResponse } from '@repo/shared-types';
import {
  createFoodProductSchema,
  FOOD_MAX_GRAMS,
  FOOD_MEALS,
  FOOD_MIN_GRAMS,
  normalizeBarcode,
} from '@repo/validation';
import { Heart, ScanBarcode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BarcodeLookupPanel,
  BarcodeScanner,
} from '@/components/features/food/barcode-scanner';
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
import { gramsAccepted, previewMacros, roundHalfUp } from '@/lib/food/macros';
import { rankFoodProducts, sortByMacro, type MacroSort } from '@/lib/food/rank';
import { decodeFoodText } from '@/lib/food/text';
import {
  useCreateFoodLog,
  useCreateFoodProduct,
  useCustomFoods,
  useFavoriteFoods,
  useFoodBarcodeLookup,
  useFoodSearch,
  useRecentFoods,
  useToggleFavorite,
} from '@/lib/hooks/use-food';

type Tab = 'search' | 'custom' | 'favorites' | 'recent';

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
  const [scanning, setScanning] = useState(false);
  return (
    <Sheet
      open={open}
      dismissible={!scanning}
      repositionInputs={!scanning}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent full={scanning}>
        {open ? (
          <AddFoodForm
            key={`${meal}-${loggedOn}`}
            meal={meal}
            loggedOn={loggedOn}
            onClose={onClose}
            scanning={scanning}
            onScanningChange={setScanning}
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
  scanning,
  onScanningChange,
}: {
  meal: FoodMeal;
  loggedOn: string;
  onClose: () => void;
  scanning: boolean;
  onScanningChange: (scanning: boolean) => void;
}) {
  const t = useTranslations('food');
  const [tab, setTab] = useState<Tab>('search');
  const [lockedBarcode, setLockedBarcode] = useState<string | null>(null);
  const [addedFromScan, setAddedFromScan] = useState(false);
  const [fromScan, setFromScan] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<{
    product: FoodProductResponse;
    grams: string;
    meal: FoodMeal;
    factor: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(
    product: FoodProductResponse,
    grams = '100',
    nextMeal: FoodMeal = meal,
    scanned = false,
  ) {
    setFromScan(scanned);
    onScanningChange(false);
    setPicked({ product, grams, meal: nextMeal, factor: '1' });
  }

  const closeScanner = useCallback(
    () => onScanningChange(false),
    [onScanningChange],
  );

  return (
    <>
      <SheetTitle className={scanning ? 'sr-only' : undefined}>
        {t('addProduct')}
      </SheetTitle>
      <div
        inert={scanning ? true : undefined}
        aria-hidden={scanning || undefined}
      >
        <SheetDescription>
          {t(`addContext.${picked?.meal ?? meal}`)}
        </SheetDescription>
        {picked ? (
          <QuantityStep
            product={picked.product}
            grams={picked.grams}
            factor={picked.factor}
            meal={picked.meal}
            loggedOn={loggedOn}
            onGrams={(grams) => setPicked({ ...picked, grams })}
            onFactor={(factor) => setPicked({ ...picked, factor })}
            onMeal={(next) => setPicked({ ...picked, meal: next })}
            onBack={() => setPicked(null)}
            onDone={() => {
              if (!fromScan) {
                onClose();
                return;
              }
              setPicked(null);
              setAddedFromScan(true);
            }}
          />
        ) : addedFromScan ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">{t('scanAdded')}</p>
            <Button
              variant="outline"
              className="w-full whitespace-nowrap"
              onClick={() => {
                setAddedFromScan(false);
                onScanningChange(true);
              }}
            >
              {t('scanAnother')}
            </Button>
            <Button onClick={onClose}>{t('scanDone')}</Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex border border-line">
              {(['search', 'custom', 'favorites', 'recent'] as const).map(
                (item) => (
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
                ),
              )}
            </div>
            {tab === 'search' ? (
              <SearchTab
                query={query}
                debounced={debounced}
                creating={creating}
                onQuery={setQuery}
                onCreating={setCreating}
                onPick={(product) => pick(product)}
                onBarcode={(product) => pick(product, '100', meal, true)}
                lockedBarcode={lockedBarcode}
                onScan={() => onScanningChange(true)}
                onCreated={(product) => {
                  setCreating(false);
                  setLockedBarcode(null);
                  pick(product, '100', meal, fromScan);
                }}
              />
            ) : null}
            {tab === 'custom' ? (
              <CustomTab onPick={(product) => pick(product)} />
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
      </div>
      {scanning ? (
        <BarcodeScanner
          onClose={closeScanner}
          onProduct={(product) => pick(product, '100', meal, true)}
          onCreate={(barcode) => {
            onScanningChange(false);
            setFromScan(true);
            setTab('search');
            setLockedBarcode(barcode);
            setCreating(true);
            setQuery('');
          }}
          onSearchByName={() => {
            onScanningChange(false);
            setTab('search');
            setQuery('');
            setCreating(false);
          }}
        />
      ) : null}
    </>
  );
}

function SearchTab({
  query,
  debounced,
  creating,
  lockedBarcode,
  onQuery,
  onCreating,
  onScan,
  onPick,
  onBarcode,
  onCreated,
}: {
  query: string;
  debounced: string;
  creating: boolean;
  lockedBarcode: string | null;
  onQuery: (value: string) => void;
  onCreating: (value: boolean) => void;
  onScan: () => void;
  onPick: (product: FoodProductResponse) => void;
  onBarcode: (product: FoodProductResponse) => void;
  onCreated: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const code = normalizeBarcode(debounced);
  const search = useFoodSearch(debounced);
  const barcodeLookup = useFoodBarcodeLookup(code);
  const typed = debounced.trim().length >= 2 && !code;
  const slow =
    search.error instanceof ApiClientError && search.error.status === 429;
  const products = useMemo(
    () =>
      code ? [] : rankFoodProducts(search.data?.products ?? [], debounced),
    [code, search.data, debounced],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="min-w-0 flex-1 border border-line bg-background px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          aria-label={t('scanOpen')}
          onClick={onScan}
          className="grid size-11 shrink-0 place-items-center border border-line text-teal"
        >
          <ScanBarcode size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
      {!typed ? <p className="text-sm text-muted">{t('searchHint')}</p> : null}
      {typed && search.isPending ? (
        <p className="text-sm text-muted">{t('loading')}</p>
      ) : null}
      {typed && slow ? (
        <p role="alert" className="text-sm text-amber">
          {t('slowDown')}
        </p>
      ) : null}
      {typed && search.isError && !slow ? (
        <div>
          <p role="alert" className="text-sm text-amber">
            {t('searchError')}
          </p>
          <button
            type="button"
            onClick={() => void search.refetch()}
            className="mt-2 text-sm text-teal"
          >
            {t('retry')}
          </button>
        </div>
      ) : null}
      {code && !creating ? (
        <BarcodeLookupPanel
          lookup={barcodeLookup}
          code={code}
          onProduct={onBarcode}
          onCreate={() => onCreating(true)}
          onSearchByName={() => onQuery('')}
        />
      ) : null}
      {!code && search.data?.fromCacheOnly ? (
        <p className="text-sm text-muted">{t('cacheOnly')}</p>
      ) : null}
      {typed && search.isSuccess && products.length === 0 ? (
        <p className="text-sm text-muted">{t('searchEmpty')}</p>
      ) : null}
      <ProductList products={products} onPick={onPick} />
      <button
        type="button"
        onClick={() => onCreating(!creating)}
        className="text-left text-sm text-teal"
      >
        {t('createOwn')}
      </button>
      {creating ? (
        <CreateProductForm
          barcode={code ?? lockedBarcode ?? ''}
          barcodeLocked={Boolean(code ?? lockedBarcode)}
          onCreated={onCreated}
        />
      ) : null}
    </div>
  );
}

function MacroSortRow({
  value,
  onChange,
}: {
  value: MacroSort | null;
  onChange: (sort: MacroSort | null) => void;
}) {
  const t = useTranslations('food');
  const options = [
    ['protein', t('sortProtein')],
    ['fat', t('sortFat')],
    ['carbs', t('sortCarbs')],
  ] as const;
  return (
    <div className="flex gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(value === key ? null : key)}
          className={`min-h-11 flex-1 border border-line text-xs ${
            value === key ? 'bg-teal text-background' : 'text-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CustomTab({
  onPick,
}: {
  onPick: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const custom = useCustomFoods(true);
  if (custom.isPending)
    return <p className="text-sm text-muted">{t('loading')}</p>;
  if (custom.isError) {
    return (
      <div>
        <p role="alert" className="text-sm text-amber">
          {t('listError')}
        </p>
        <button
          type="button"
          onClick={() => void custom.refetch()}
          className="mt-2 text-sm text-teal"
        >
          {t('retry')}
        </button>
      </div>
    );
  }
  if (!custom.data?.products.length) {
    return <p className="text-sm text-muted">{t('customEmpty')}</p>;
  }
  return <ProductList products={custom.data.products} onPick={onPick} />;
}

function FavoritesTab({
  onPick,
}: {
  onPick: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const favorites = useFavoriteFoods(true);
  const [sort, setSort] = useState<MacroSort | null>(null);
  if (favorites.isPending)
    return <p className="text-sm text-muted">{t('loading')}</p>;
  if (favorites.isError) {
    return (
      <div>
        <p role="alert" className="text-sm text-amber">
          {t('listError')}
        </p>
        <button
          type="button"
          onClick={() => void favorites.refetch()}
          className="mt-2 text-sm text-teal"
        >
          {t('retry')}
        </button>
      </div>
    );
  }
  if (!favorites.data?.products.length) {
    return <p className="text-sm text-muted">{t('favoritesEmpty')}</p>;
  }
  const products = sort
    ? sortByMacro(favorites.data.products, sort, true)
    : favorites.data.products;
  return (
    <div className="flex flex-col gap-3">
      <MacroSortRow value={sort} onChange={setSort} />
      <ProductList products={products} onPick={onPick} />
    </div>
  );
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
  if (recent.isError) {
    return (
      <div>
        <p role="alert" className="text-sm text-amber">
          {t('listError')}
        </p>
        <button
          type="button"
          onClick={() => void recent.refetch()}
          className="mt-2 text-sm text-teal"
        >
          {t('retry')}
        </button>
      </div>
    );
  }
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
          <div className="flex items-center gap-3 p-2">
            <button
              type="button"
              onClick={() => onPick(product)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <FoodImage src={product.imageUrl} alt="" size="card" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm text-ink">
                  {decodeFoodText(product.name)}
                </span>
                <span className="block truncate text-xs text-muted">
                  {product.brand ? decodeFoodText(product.brand) : '\u00a0'}
                </span>
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
              onClick={(event) => {
                event.stopPropagation();
                toggle.mutate({ product, next: !product.isFavorite });
              }}
              className="grid size-11 shrink-0 place-items-center self-center text-teal"
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
  barcode = '',
  barcodeLocked = false,
  onCreated,
}: {
  barcode?: string;
  barcodeLocked?: boolean;
  onCreated: (product: FoodProductResponse) => void;
}) {
  const t = useTranslations('food');
  const create = useCreateFoodProduct();
  const [name, setName] = useState('');
  const [code, setCode] = useState(barcode);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [invalid, setInvalid] = useState(false);
  const duplicate =
    create.error instanceof ApiClientError &&
    create.error.code === 'BARCODE_ALREADY_USED';

  function submit() {
    const parsed = createFoodProductSchema.safeParse({
      name,
      barcode: code.trim() ? code : null,
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
        placeholder={t('productName')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink placeholder:text-muted"
      />
      <input
        aria-label={t('barcode')}
        placeholder={t('barcode')}
        inputMode="numeric"
        value={code}
        readOnly={barcodeLocked}
        onChange={(event) => setCode(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-base text-ink placeholder:text-muted read-only:text-muted"
      />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['kcal', 'kcalPer100', kcal, setKcal],
            ['protein', 'proteinPer100', protein, setProtein],
            ['fat', 'fatPer100', fat, setFat],
            ['carbs', 'carbsPer100', carbs, setCarbs],
          ] as const
        ).map(([short, full, value, setValue]) => (
          <label
            key={full}
            className="flex min-w-0 flex-col gap-1 text-sm text-muted"
          >
            {t(short)}
            <input
              aria-label={t(full)}
              value={value}
              inputMode="decimal"
              onChange={(event) => setValue(event.target.value)}
              className="min-w-0 border border-line bg-background px-3 py-2 text-base text-ink placeholder:text-muted"
            />
          </label>
        ))}
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-amber">
          {t('invalidProduct')}
        </p>
      ) : null}
      {create.isError ? (
        <p role="alert" className="text-sm text-amber">
          {duplicate ? t('barcodeUsed') : t('couldNotCreate')}
        </p>
      ) : null}
      <Button disabled={create.isPending} onClick={submit}>
        {create.isPending ? t('loading') : t('create')}
      </Button>
    </div>
  );
}

function QuantityStep({
  product,
  grams,
  factor,
  meal,
  loggedOn,
  onGrams,
  onFactor,
  onMeal,
  onBack,
  onDone,
}: {
  product: FoodProductResponse;
  grams: string;
  factor: string;
  meal: FoodMeal;
  loggedOn: string;
  onGrams: (value: string) => void;
  onFactor: (value: string) => void;
  onMeal: (meal: FoodMeal) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('food');
  const tAuth = useTranslations('auth');
  const create = useCreateFoodLog();
  const parsed = Number(grams);
  const multiplier = Number(factor);
  const scaled =
    gramsAccepted(parsed) && Number.isFinite(multiplier) && multiplier > 0
      ? roundHalfUp(parsed * multiplier, 1)
      : Number.NaN;
  const valid = gramsAccepted(scaled);
  const preview = valid ? previewMacros(product, scaled) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">{decodeFoodText(product.name)}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-muted">
          {t('grams')}
          <input
            aria-label={t('grams')}
            inputMode="decimal"
            min={FOOD_MIN_GRAMS}
            max={FOOD_MAX_GRAMS}
            value={grams}
            onChange={(event) => onGrams(event.target.value)}
            className="border border-line bg-background px-3 py-2 text-base text-ink"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-muted">
          {t('multiplier')}
          <input
            aria-label={t('multiplier')}
            inputMode="decimal"
            value={factor}
            onChange={(event) => onFactor(event.target.value)}
            className="border border-line bg-background px-3 py-2 text-base text-ink"
          />
        </label>
      </div>
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
            { productId: product.id, grams: scaled, meal, loggedOn },
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
