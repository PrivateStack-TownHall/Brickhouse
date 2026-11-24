import { BarChart3 } from 'lucide-react';

export default function ChartEmpty({ message = 'No data for this period.', height = 200 }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-subtle" style={{ height }}>
      <BarChart3 size={28} />
      <div className="mt-2 small">{message}</div>
    </div>
  );
}
