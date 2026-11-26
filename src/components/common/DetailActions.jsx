import { Link } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';

/** Standard Edit + Delete action buttons used in PageHeader on entity detail pages. */
export default function DetailActions({ editTo, onEdit, onDelete, children }) {
  return (
    <>
      {children}
      {editTo && (
        <Link to={editTo} className="btn btn-secondary">
          <Pencil size={16} />Edit
        </Link>
      )}
      {onEdit && (
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          <Pencil size={16} />Edit
        </button>
      )}
      {onDelete && (
        <button type="button" className="btn btn-outline-danger" onClick={onDelete}>
          <Trash2 size={16} />Delete
        </button>
      )}
    </>
  );
}
