import type {CatalogItem} from '@/types/api';

export function catalogObservation(c: CatalogItem) {
  const category = c.max_category ?? c.maxCategory;
  return {
    id: c.id,
    name: c.name,
    basin: typeof c.basin === 'string' && c.basin.trim() ? c.basin : 'Not available',
    category: typeof category === 'string' && category.trim() ? category : 'Not available',
    knots: typeof c.knots === 'number' && Number.isFinite(c.knots) && c.knots >= 0 ? c.knots : null,
  };
}
