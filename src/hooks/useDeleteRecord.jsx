import { useState } from 'react';
import { useRegistry } from './useRegistry';
import { useToast } from './useToast';
import { deleteEntity, getDependents } from '../services/registry.service';
import { ENTITIES } from '../services/schema';
import DeleteDialog from '../components/dialogs/DeleteDialog';

/** Returns [requestDelete(entity, id, onDone?), dialogElement]. */
export function useDeleteRecord() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const request = (entity, id, onDone) => {
    const record = (data[entity] || []).find((r) => r.id === id);
    if (record) setTarget({ entity, id, record, onDone });
  };
  const confirm = () => {
    try {
      run(deleteEntity, target.entity, target.id);
      toast(`${ENTITIES[target.entity].label} ${target.id} deleted.`);
      target.onDone?.();
    } catch (e) {
      toast(e.message, 'error');
    }
    setTarget(null);
  };
  const dialog = target ? (
    <DeleteDialog target={target} dependents={getDependents(data, target.entity, target.id)} onConfirm={confirm} onCancel={() => setTarget(null)} />
  ) : null;
  return [request, dialog];
}
