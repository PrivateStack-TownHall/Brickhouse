import { useState } from 'react';
import { useRegistry } from './useRegistry';
import { useToast } from './useToast';
import { createEntity, updateEntity, ValidationError } from '../services/registry.service';

/** Form state and create/update persistence helper for modal entity editors. */
export function useEntityFormModal({ entity, record, initialValues, onClose, onCreated, createMessage, updateMessage }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setValues((s) => ({ ...s, [key]: val }));
    setErrors((e) => (e[key] === undefined ? e : { ...e, [key]: undefined }));
  };

  const save = (payload) => {
    try {
      if (record) {
        run(updateEntity, entity, record.id, payload);
        toast(updateMessage(record.id));
        onClose();
      } else {
        const id = run(createEntity, entity, payload);
        toast(createMessage(id));
        onClose();
        onCreated?.(id);
      }
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors);
      else toast(e.message, 'error');
    }
  };

  return { data, values, set, errors, setErrors, save };
}
