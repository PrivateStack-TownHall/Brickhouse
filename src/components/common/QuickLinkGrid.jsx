import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function QuickLinkGrid({ items }) {
  return (
    <div className="bh-quick">
      {items.map(({ to, label, icon: Icon, count }) => (
        <motion.div key={to} whileHover={{ x: 4 }} transition={{ duration: 0.15 }} style={{ display: 'flex' }}>
          <Link to={to} style={{ width: '100%' }}>
            {Icon && <Icon size={21} color="var(--bh-orange)" />}
            <span className="text-truncate">{label}</span>
            {count !== undefined && <span className="bh-chip ms-auto">{count}</span>}
            <ChevronRight size={17} className={count !== undefined ? 'text-muted' : 'chev'} />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
