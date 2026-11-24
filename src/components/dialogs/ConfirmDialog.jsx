import { useState } from 'react';
import Modal from './Modal';

/** Confirmation dialog. `requireText` forces the user to type a word (e.g. RESET). */
export default function ConfirmDialog({ open, title, message, children, confirmLabel = 'Confirm', tone = 'primary', requireText, onConfirm, onCancel, confirmDisabled }) {
  const [typed, setTyped] = useState('');
  const close = () => { setTyped(''); onCancel(); };
  const blocked = confirmDisabled || (requireText && typed !== requireText);
  return (
    <Modal open={open} title={title} onClose={close}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <button type="button" className={`btn btn-${tone}`} disabled={blocked} onClick={() => { setTyped(''); onConfirm(); }}>{confirmLabel}</button>
        </>
      )}>
      {message && <p className="mb-2">{message}</p>}
      {children}
      {requireText && (
        <div className="mt-3">
          <label className="form-label" htmlFor="confirm-text">Type <strong className="mono">{requireText}</strong> to confirm</label>
          <input id="confirm-text" className="form-control" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
    </Modal>
  );
}
