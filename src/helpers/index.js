// Small, dependency-free presentation helpers.

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

export const DATE_FORMATS = ['DD MMM YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];
export const TIME_FORMATS = ['24h', '12h'];

export function formatDate(value, format = 'DD MMM YYYY') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const DD = p2(d.getDate());
  const MM = p2(d.getMonth() + 1);
  const YYYY = d.getFullYear();
  switch (format) {
    case 'YYYY-MM-DD': return `${YYYY}-${MM}-${DD}`;
    case 'DD/MM/YYYY': return `${DD}/${MM}/${YYYY}`;
    case 'MM/DD/YYYY': return `${MM}/${DD}/${YYYY}`;
    default: return `${DD} ${MONTHS[d.getMonth()]} ${YYYY}`;
  }
}

export function formatTime(value, format = '24h') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  if (format === '12h') {
    const h = d.getHours() % 12 || 12;
    return `${h}:${p2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function relativeTime(value, nowDate = new Date()) {
  if (!value) return '—';
  const diff = (nowDate - new Date(value)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))} mo ago`;
  return `${Math.floor(diff / (86400 * 365))} y ago`;
}

export const shortMonth = (d) => MONTHS[new Date(d).getMonth()];

export function titleCase(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n || 0);

export function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Local YYYY-MM-DD key for a date/ISO string (empty string if missing or invalid). */
export function localDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Trigger a browser download from a Blob or URL string without leaving orphan DOM nodes. */
export function triggerDownload(source, filename, { revokeAfterMs = 1000 } = {}) {
  const isBlob = typeof Blob !== 'undefined' && source instanceof Blob;
  const href = isBlob ? URL.createObjectURL(source) : source;
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (isBlob && revokeAfterMs >= 0) {
    setTimeout(() => URL.revokeObjectURL(href), revokeAfterMs);
  }
}
