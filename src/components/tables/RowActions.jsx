import { Link } from 'react-router';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ActionMenu from '../common/ActionMenu';

/** Row / card actions: quick View (eye) + "…" menu with View, Edit and Delete. */
export default function RowActions({ viewTo, editTo, onEdit, onDelete, label, extra = [], compact = false }) {
  const items = [
    viewTo && { label: 'View details', icon: Eye, to: viewTo },
    (editTo || onEdit) && { label: 'Edit', icon: Pencil, to: editTo, onClick: onEdit },
    ...extra,
    onDelete && { separator: true },
    onDelete && { label: 'Delete', icon: Trash2, onClick: onDelete, danger: true },
  ].filter(Boolean);
  return (
    <div className="bh-row-actions" onClick={(e) => e.stopPropagation()}>
      {viewTo && !compact && <Link to={viewTo} className="btn btn-ghost btn-icon" title="View" aria-label={`View ${label}`}><Eye size={17} /></Link>}
      <ActionMenu items={items} label={`Actions for ${label}`} />
    </div>
  );
}
