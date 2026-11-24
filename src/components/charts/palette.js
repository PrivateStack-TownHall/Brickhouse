// Categorical series colors: validated reference palette (fixed order, never cycled).
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
export const seriesColor = (i) => {
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-bs-theme') === 'dark';
  return (dark ? SERIES_DARK : SERIES_LIGHT)[i] || 'var(--bh-gray-500)';
};
// Single-series magnitude uses the brand accent.
export const BRAND_SERIES = 'var(--bh-orange)';
// Sequential ramp (one hue, light → dark) for the commit heatmap.
export const HEAT_RAMP = ['var(--bh-surface-muted)', '#f6d3bc', '#eeaa80', '#e1874f', '#b9612d', '#7f3f19'];
// Lifecycle uses the reserved status semantics (always shown with a text label).
export const LIFECYCLE_COLORS = {
  planning: '#8a9ba8', development: '#2f6fb2', testing: '#d98c3d', active: '#2e7d5b', maintenance: '#c9733e', archived: '#445566',
};
// Lifecycle stacked bar (mockup): orange = Active; text color chosen for contrast.
export const LIFECYCLE_BAR = {
  planning: ['#5f7f9c', '#fff'], development: ['#4aa8e0', '#fff'], testing: ['#f2c14e', '#5a4200'],
  active: ['#e8803f', '#fff'], maintenance: ['#c4a08a', '#fff'], archived: ['#dfe4ea', '#445566'],
};
