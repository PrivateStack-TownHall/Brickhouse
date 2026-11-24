/**
 * Logo asset exports and dynamic resolver for Brickhouse.
 */
import brickhouseMark from './brickhouse-mark.png';
import brickhouseFull from './brickhouse-logo-full.png';

export const brandLogos = {
  mark: brickhouseMark,
  full: brickhouseFull,
};

// Vite eager glob imports for structured logo collections
export const applicationLogos = import.meta.glob('./applications/*.png', { eager: true, import: 'default' });
export const platformLogos = import.meta.glob('./platforms/*.png', { eager: true, import: 'default' });
export const technologyLogos = import.meta.glob('./technologies/*.png', { eager: true, import: 'default' });

/**
 * Helper to retrieve a logo URL by entity type and filename/slug.
 * Example: getLogoUrl('technologies', 'react') or getLogoUrl('applications', 'vs-portfolio')
 */
export function getLogoUrl(category, name) {
  const clean = String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const key = `./${category}/logo-${clean}.png`;
  if (category === 'applications') return applicationLogos[key] || null;
  if (category === 'platforms') return platformLogos[key] || null;
  if (category === 'technologies') return technologyLogos[key] || null;
  return null;
}
