import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import Avatar from '../common/Avatar';
import IdChip from '../common/IdChip';
import RowActions from '../tables/RowActions';

export default function EntityCard({ title, id, to, avatar, avatarSrc, status, subtitle, description, meta = [], tags = [], actions }) {
  const navigate = useNavigate();
  return (
    <motion.article
      className="bh-ecard"
      onClick={() => to && navigate(to)}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && to && navigate(to)}
      tabIndex={0}
      aria-label={title}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="d-flex align-items-start justify-content-between gap-2">
        <Avatar name={avatar || title} seed={id} src={avatarSrc} size={44} />
        {actions && <RowActions label={title} {...actions} />}
      </div>
      <div className="min-w-0">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="bh-ecard-title text-truncate-2">{title}</div>
          {status && <div className="flex-shrink-0">{status}</div>}
        </div>
        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
          {id && <IdChip id={id} />}
          {subtitle && <span className="text-muted small text-truncate">{subtitle}</span>}
        </div>
      </div>
      <div className="bh-ecard-desc text-truncate-2">{description || <span className="text-subtle">No description.</span>}</div>
      {tags.length > 0 && <div className="d-flex flex-wrap gap-1">{tags.slice(0, 4).map((t) => <span key={t} className="bh-chip">{t}</span>)}{tags.length > 4 && <span className="bh-chip">+{tags.length - 4}</span>}</div>}
      {meta.length > 0 && (
        <div className="bh-ecard-foot">
          {meta.filter((m) => m && m.text).map((m, i) => <span key={i}>{m.icon && <m.icon size={13} />}<span className="text-truncate">{m.text}</span></span>)}
        </div>
      )}
    </motion.article>
  );
}
