import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import { useRegistry } from '../../hooks/useRegistry';

function useTheme(mode) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => root.setAttribute('data-bs-theme', mode === 'system' ? (mq?.matches ? 'dark' : 'light') : mode);
    apply();
    if (mode === 'system' && mq) { mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply); }
    return undefined;
  }, [mode]);
}

export default function AppShell() {
  const { data, health } = useRegistry();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useTheme(data.settings.preferences.themeMode);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { document.title = 'Brickhouse'; }, []);
  return (
    <div className="bh-shell">
      <AppSidebar open={open} onNavigate={() => setOpen(false)} organization={data.settings.general.organization} />
      <div className={`bh-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="bh-main">
        <AppHeader onMenu={() => setOpen(true)} />
        <main className="bh-content">
          {(!health.persistence || health.status === 'error') && (
            <div className="bh-sample-banner mb-3" style={{ background: 'var(--bh-danger-soft)', borderColor: 'rgba(225,85,84,.35)' }} role="alert">
              <AlertTriangle size={18} color="var(--bh-danger)" className="flex-shrink-0" />
              <div><strong>Changes are not being saved.</strong> {health.message}</div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
