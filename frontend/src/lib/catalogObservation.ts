import type {CatalogItem} from '@/types/api';

export function formatCatalogStormName(name: string): string {
  if (
    name.startsWith('Cyclone ') ||
    name.startsWith('Deep Depression') ||
    name.startsWith('Depression') ||
    name.startsWith('Super Cyclone') ||
    name.includes('Cyclone')
  ) {
    return name;
  }
  return `Cyclone ${name}`;
}

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
