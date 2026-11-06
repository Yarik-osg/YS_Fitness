import { Suspense } from 'react';
import { FoodPage } from '@/components/features/food/food-page';

export default function NutritionRoute() {
  return (
    <Suspense fallback={null}>
      <FoodPage />
    </Suspense>
  );
}
