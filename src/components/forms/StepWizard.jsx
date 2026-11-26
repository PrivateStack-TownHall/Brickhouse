import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X, FileText, Cpu, Link2, ClipboardCheck, Layers } from 'lucide-react';
import { cx } from '../../helpers';
import ConfirmDialog from '../dialogs/ConfirmDialog';
import SectionCard from '../common/SectionCard';
import { ValidationError } from '../../services/registry.service';

const STEP_ICONS = {
  basic: FileText,
  identity: FileText,
  technical: Cpu,
  relations: Link2,
  review: ClipboardCheck,
};

/**
 * Consistent multi-step form.
 * steps: [{ key, title, description, icon?, fields?: [names], validate?: () => errors, render: () => node }]
 * The last step is the review step. onSubmit may throw ValidationError.
 */
export default function StepWizard({ steps, errors, setErrors, dirty, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [index, setIndex] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const step = steps[index];
  const last = index === steps.length - 1;
  const StepIcon = step.icon || STEP_ICONS[step.key] || Layers;

  const validateUpTo = (i) => {
    for (let s = 0; s <= i; s += 1) {
      const errs = steps[s].validate ? steps[s].validate() : {};
      if (Object.keys(errs).length) return { step: s, errs };
    }
    return null;
  };

  const next = () => {
    const errs = step.validate ? step.validate() : {};
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setIndex(index + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goTo = (i) => {
    if (i <= index) { setErrors({}); setIndex(i); return; }
    const bad = validateUpTo(i - 1);
    if (bad) { setErrors(bad.errs); setIndex(bad.step); return; }
    setErrors({});
    setIndex(i);
  };

  const submit = () => {
    const bad = validateUpTo(steps.length - 1);
    if (bad) { setErrors(bad.errs); setIndex(bad.step); return; }
    setSaving(true);
    setFormError('');
    try {
      onSubmit();
    } catch (e) {
      if (e instanceof ValidationError) {
        setErrors(e.errors);
        const target = steps.findIndex((s) => (s.fields || []).some((f) => e.errors[f]));
        if (target >= 0) setIndex(target);
        setFormError(Object.values(e.errors)[0] || e.message);
      } else setFormError(String(e.message || e));
      setSaving(false);
    }
  };

  return (
    <div>
      <ol className="bh-steps list-unstyled">
        {steps.map((s, i) => (
          <li key={s.key} className={cx('bh-step', i === index && 'active', i < index && 'done')} style={{ cursor: 'pointer' }} onClick={() => goTo(i)}>
            <span className="bh-step-num">{i < index ? <Check size={15} /> : String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <div className="bh-step-title">{s.title}</div>
              <div className="bh-step-sub text-truncate">{s.description}</div>
            </div>
          </li>
        ))}
      </ol>
      <SectionCard
        variant="colored"
        fullHeight={false}
        icon={StepIcon}
        title={step.title}
        subtitle={step.description}
        actions={(
          <span className="bh-card-count small fw-semibold">
            Step {String(index + 1).padStart(2, '0')} of {String(steps.length).padStart(2, '0')}
          </span>
        )}
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => (dirty ? setConfirmCancel(true) : onCancel())}><X size={16} />Cancel</button>
            <div className="d-flex gap-2">
              {index > 0 && <button type="button" className="btn btn-secondary" onClick={() => { setErrors({}); setIndex(index - 1); }}><ArrowLeft size={16} />Back</button>}
              {!last && <button type="button" className="btn btn-primary" onClick={next}>Next<ArrowRight size={16} /></button>}
              {last && <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}><Check size={16} />{submitLabel}</button>}
            </div>
          </>
        )}
      >
        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
        {Object.keys(errors).length > 0 && !formError && <div className="alert alert-warning py-2 small mb-3">Please complete the required fields highlighted below.</div>}
        {step.render()}
      </SectionCard>
      <ConfirmDialog open={confirmCancel} title="Discard changes?" message="You have entered data in this form. Leaving now will discard it."
        confirmLabel="Discard" tone="danger" onConfirm={onCancel} onCancel={() => setConfirmCancel(false)} />
    </div>
  );
}
