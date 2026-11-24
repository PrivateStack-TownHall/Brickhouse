import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="bh-card mt-4">
      <EmptyState icon={SearchX} title="Record or page not found" message="It may have been deleted, or the link is incorrect."
        action={<Link to="/" className="btn btn-secondary">Back to Overview</Link>} />
    </div>
  );
}
