import { ExternalLink } from 'lucide-react';
import { cx } from '../../helpers';

/** External hyperlink with trailing icon; renders null when `href` is absent. */
export default function ExtLink({ href, children, className = '', iconSize = 12, title, onClick }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx('d-inline-flex align-items-center gap-1', className)}
      title={title}
      onClick={onClick}
    >
      {children ?? href}
      <ExternalLink size={iconSize} />
    </a>
  );
}
