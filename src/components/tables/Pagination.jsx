import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="bh-pagination" aria-label="Pagination">
      <button type="button" className="bh-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
      {nums.map((n, i) => (n === '…' ? <span key={`e${i}`} className="px-1 align-self-center">…</span> : (
        <button key={n} type="button" className={`bh-page-btn ${n === page ? 'active' : ''}`} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>
      )))}
      <button type="button" className="bh-page-btn" disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
    </nav>
  );
}
