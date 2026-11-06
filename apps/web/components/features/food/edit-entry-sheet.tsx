'use client';

import type { FoodLogEntryResponse, FoodMeal } from '@repo/shared-types';
import { FOOD_MAX_GRAMS, FOOD_MEALS, FOOD_MIN_GRAMS } from '@repo/validation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import {
  exceedsEntryCap,
  gramsAccepted,
  oneDecimal,
  roundHalfUp,
  scaleAmount,
} from '@/lib/food/macros';
import { decodeFoodText } from '@/lib/food/text';
import { useUpdateFoodLog } from '@/lib/hooks/use-food';

export function EditEntrySheet({
  entry,
  onClose,
}: {
  entry: FoodLogEntryResponse | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        {entry ? (
          <EditEntryForm key={entry.id} entry={entry} onClose={onClose} />
        ) : (
          <SheetTitle className="sr-only">Edit</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditEntryForm({
  entry,
  onClose,
}: {
  entry: FoodLogEntryResponse;
  onClose: () => void;
}) {
  const t = useTranslations('food');
  const tAuth = useTranslations('auth');
  const update = useUpdateFoodLog();
  const [name, setName] = useState(entry.productName);
  const [factor, setFactor] = useState('1');
  const [grams, setGrams] = useState(String(entry.grams));
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [protein, setProtein] = useState(String(entry.protein));
  const [fat, setFat] = useState(String(entry.fat));
  const [carbs, setCarbs] = useState(String(entry.carbs));
  const [meal, setMeal] = useState<FoodMeal>(entry.meal);
  const [saveAsMyProduct, setSaveAsMyProduct] = useState(false);
  const [clientError, setClientError] = useState<'amount' | 'cap' | null>(null);
  const [basis, setBasis] = useState({
    grams: entry.grams,
    kcal: entry.kcal,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
  });

  function applyFactor(next: string) {
    setFactor(next);
    const multiplier = Number(next);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;
    const nextGrams = roundHalfUp(entry.grams * multiplier, 1);
    setGrams(String(nextGrams));
    setKcal(String(scaleAmount(entry.kcal, entry.grams, nextGrams)));
    setProtein(String(scaleAmount(entry.protein, entry.grams, nextGrams)));
    setFat(String(scaleAmount(entry.fat, entry.grams, nextGrams)));
    setCarbs(String(scaleAmount(entry.carbs, entry.grams, nextGrams)));
    setBasis({
      grams: nextGrams,
      kcal: scaleAmount(entry.kcal, entry.grams, nextGrams),
      protein: scaleAmount(entry.protein, entry.grams, nextGrams),
      fat: scaleAmount(entry.fat, entry.grams, nextGrams),
      carbs: scaleAmount(entry.carbs, entry.grams, nextGrams),
    });
  }

  function changeGrams(next: string) {
    setGrams(next);
    const parsed = Number(next);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setKcal(String(scaleAmount(basis.kcal, basis.grams, parsed)));
    setProtein(String(scaleAmount(basis.protein, basis.grams, parsed)));
    setFat(String(scaleAmount(basis.fat, basis.grams, parsed)));
    setCarbs(String(scaleAmount(basis.carbs, basis.grams, parsed)));
  }

  function editMacro(key: 'kcal' | 'protein' | 'fat' | 'carbs', next: string) {
    const parsedGrams = Number(grams);
    const nextValues = {
      kcal: key === 'kcal' ? Number(next) : Number(kcal),
      protein: key === 'protein' ? Number(next) : Number(protein),
      fat: key === 'fat' ? Number(next) : Number(fat),
      carbs: key === 'carbs' ? Number(next) : Number(carbs),
    };
    if (key === 'kcal') setKcal(next);
    if (key === 'protein') setProtein(next);
    if (key === 'fat') setFat(next);
    if (key === 'carbs') setCarbs(next);
    if (Number.isFinite(parsedGrams) && parsedGrams > 0) {
      setBasis({ grams: parsedGrams, ...nextValues });
    }
  }

  const parsed = {
    grams: Number(grams),
    kcal: Number(kcal),
    protein: Number(protein),
    fat: Number(fat),
    carbs: Number(carbs),
  };
  const changed =
    parsed.grams !== entry.grams ||
    parsed.kcal !== entry.kcal ||
    parsed.protein !== entry.protein ||
    parsed.fat !== entry.fat ||
    parsed.carbs !== entry.carbs ||
    meal !== entry.meal ||
    name.trim() !== entry.productName ||
    saveAsMyProduct;
  const serverTooLarge =
    update.error instanceof ApiClientError &&
    update.error.code === 'FOOD_VALUES_OUT_OF_RANGE';

  function save() {
    setClientError(null);
    const macros = [parsed.kcal, parsed.protein, parsed.fat, parsed.carbs];
    if (
      !gramsAccepted(parsed.grams) ||
      macros.some((value) => !oneDecimal(value) || value < 0)
    ) {
      setClientError('amount');
      return;
    }
    if (
      exceedsEntryCap(parsed.grams, {
        kcal: parsed.kcal,
        protein: parsed.protein,
        fat: parsed.fat,
        carbs: parsed.carbs,
      })
    ) {
      setClientError('cap');
      return;
    }
    const body: {
      grams?: number;
      kcal?: number;
      protein?: number;
      fat?: number;
      carbs?: number;
      meal?: FoodMeal;
      productName?: string;
      saveAsMyProduct?: boolean;
    } = {};
    if (parsed.grams !== entry.grams) body.grams = parsed.grams;
    if (parsed.kcal !== entry.kcal) body.kcal = parsed.kcal;
    if (parsed.protein !== entry.protein) body.protein = parsed.protein;
    if (parsed.fat !== entry.fat) body.fat = parsed.fat;
    if (parsed.carbs !== entry.carbs) body.carbs = parsed.carbs;
    if (meal !== entry.meal) body.meal = meal;
    if (name.trim() !== entry.productName) body.productName = name.trim();
    if (saveAsMyProduct) body.saveAsMyProduct = true;
    update.mutate({ id: entry.id, body }, { onSuccess: onClose });
  }

  return (
    <>
      <SheetTitle>{decodeFoodText(entry.productName)}</SheetTitle>
      <SheetDescription>{t('editHint')}</SheetDescription>
      <div className="flex flex-col gap-3">
        <Field
          id="edit-name"
          label={t('productName')}
          value={name}
          onChange={setName}
        />
        <Field
          id="edit-factor"
          label={t('multiplier')}
          value={factor}
          onChange={applyFactor}
        />
        <Field
          id="edit-grams"
          label={t('grams')}
          value={grams}
          min={FOOD_MIN_GRAMS}
          max={FOOD_MAX_GRAMS}
          onChange={changeGrams}
        />
        <Field
          id="edit-kcal"
          label={t('kcal')}
          value={kcal}
          onChange={(value) => editMacro('kcal', value)}
        />
        <Field
          id="edit-protein"
          label={t('protein')}
          value={protein}
          onChange={(value) => editMacro('protein', value)}
        />
        <Field
          id="edit-fat"
          label={t('fat')}
          value={fat}
          onChange={(value) => editMacro('fat', value)}
        />
        <Field
          id="edit-carbs"
          label={t('carbs')}
          value={carbs}
          onChange={(value) => editMacro('carbs', value)}
        />
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t('meal')}
          <select
            aria-label={t('meal')}
            value={meal}
            onChange={(event) => setMeal(event.target.value as FoodMeal)}
            className="border border-line bg-background px-3 py-2 text-ink"
          >
            {FOOD_MEALS.map((item) => (
              <option key={item} value={item}>
                {t(`meals.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={saveAsMyProduct}
            onChange={(event) => setSaveAsMyProduct(event.target.checked)}
          />
          {t('saveAsMine')}
        </label>
        {clientError === 'amount' ? (
          <p role="alert" className="text-sm text-amber">
            {t('invalidAmount')}
          </p>
        ) : null}
        {clientError === 'cap' || serverTooLarge ? (
          <p role="alert" className="text-sm text-amber">
            {t('tooLarge')}
          </p>
        ) : null}
        {update.isError && !serverTooLarge ? (
          <p role="alert" className="text-sm text-amber">
            {getUserFacingError(update.error, tAuth)}
          </p>
        ) : null}
        <Button disabled={!changed || update.isPending} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-muted">
      {label}
      <input
        id={id}
        inputMode="decimal"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-line bg-background px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
