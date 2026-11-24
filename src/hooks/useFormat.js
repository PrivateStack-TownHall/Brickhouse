import { useMemo } from 'react';
import { useRegistry } from './useRegistry';
import { formatDate, formatTime, relativeTime } from '../helpers';

/** Date/time formatters that follow Settings → System Preferences. */
export function useFormat() {
  const { data } = useRegistry();
  const { dateFormat, timeFormat } = data.settings.preferences;
  return useMemo(() => ({
    date: (v) => formatDate(v, dateFormat),
    dateTime: (v) => (v ? `${formatDate(v, dateFormat)} ${formatTime(v, timeFormat)}` : '—'),
    time: (v) => formatTime(v, timeFormat),
    relative: (v) => relativeTime(v),
    /** "Today, 09:24" · "Yesterday, 17:06" · "3 days ago" · date */
    friendly: (v) => {
      if (!v) return '—';
      const d = new Date(v);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days = Math.floor((today - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
      if (days <= 0) return `Today, ${formatTime(d, timeFormat)}`;
      if (days === 1) return `Yesterday, ${formatTime(d, timeFormat)}`;
      if (days < 7) return `${days} days ago`;
      return formatDate(d, dateFormat);
    },
  }), [dateFormat, timeFormat]);
}
