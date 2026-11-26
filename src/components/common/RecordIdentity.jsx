import { Link } from 'react-router';
import Avatar from './Avatar';
import { cx } from '../../helpers';

/** Table cell pairing an Avatar/logo with a linked record name and optional subtitle. */
export default function RecordIdentity({
  name,
  seed,
  src,
  to,
  subtitle,
  subtitleMono = false,
  size = 32,
  round = false,
  onLinkClick,
}) {
  return (
    <div className="d-flex align-items-center gap-2">
      <Avatar name={name} seed={seed} src={src} size={size} round={round} />
      <div className="min-w-0">
        {to ? (
          <Link to={to} className="cell-strong" onClick={onLinkClick}>
            {name}
          </Link>
        ) : (
          <span className="cell-strong">{name}</span>
        )}
        {subtitle && (
          <div className={cx('text-subtle', subtitleMono && 'mono')} style={{ fontSize: subtitleMono ? 11.5 : 12 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
