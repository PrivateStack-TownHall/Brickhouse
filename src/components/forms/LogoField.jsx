import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import Avatar from '../common/Avatar';
import { resolveLogo } from '../../assets/logos';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 128;

/** Read an uploaded image and downscale it so Data URLs stay compact inside localStorage. */
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (PNG, JPG, WebP, SVG, or GIF).'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('Image must be smaller than 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or unsupported image file.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || MAX_DIM) * scale));
        const h = Math.max(1, Math.round((img.height || MAX_DIM) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const webp = canvas.toDataURL('image/webp', 0.85);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoField({ label = 'Logo', value = '', onChange, name, seed, hint, help, error }) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');
  const isDataUrl = String(value || '').startsWith('data:image/');
  const hintLogo = hint ? resolveLogo(hint) : undefined;
  const shownError = error || localError;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setLocalError('');
      const dataUrl = await compressImageFile(file);
      onChange(dataUrl);
    } catch (err) {
      setLocalError(err.message || 'Failed to load image.');
    }
  };

  return (
    <div className="mb-3">
      {label && <label className="form-label">{label}</label>}
      <div className="bh-multiselect p-2 d-flex align-items-center gap-3 flex-wrap">
        <Avatar name={name || 'Logo'} seed={seed} src={value || hintLogo} size={48} />
        <div className="flex-grow-1 min-w-0 d-flex flex-column gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input
              type="url"
              className={`form-control form-control-sm flex-grow-1 ${shownError ? 'is-invalid' : ''}`}
              style={{ minWidth: 180 }}
              value={isDataUrl ? '' : (value || '')}
              placeholder={isDataUrl ? 'Uploaded image active (paste URL to replace)' : 'Paste image URL (https://…) or upload'}
              onChange={(e) => { setLocalError(''); onChange(e.target.value); }}
            />
            <input ref={inputRef} type="file" accept="image/*" className="d-none" onChange={handleFile} />
            <button type="button" className="btn btn-outline-secondary btn-sm text-nowrap" onClick={() => inputRef.current?.click()}>
              <Upload size={14} /> Upload
            </button>
            {value && (
              <button type="button" className="btn btn-outline-secondary btn-sm text-nowrap" onClick={() => { setLocalError(''); onChange(''); }} title="Reset to default avatar">
                <X size={14} /> Clear
              </button>
            )}
          </div>
          {isDataUrl && (
            <div className="text-subtle" style={{ fontSize: 11.5 }}>
              Uploaded image stored locally (~{Math.max(1, Math.round(value.length / 1024))} KB).
            </div>
          )}
        </div>
      </div>
      {shownError && <div className="invalid-feedback d-block">{shownError}</div>}
      {help && <div className="form-text">{help}</div>}
    </div>
  );
}
