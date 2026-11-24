// Activity Log: append-only record of changes made inside BRICKHOUSE.
// (Not to be confused with Git activity, which tracks software development.)

export const ACTIVITY_CATEGORIES = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  lifecycle: 'Lifecycle Change',
  relationship: 'Relationship Change',
  system: 'System Activity',
};

/** Append an activity inside a transaction (see registry.service `transaction`). */
export function logActivity(tx, { category, action, resourceType, resourceId = null, description = '', applicationId = null }) {
  const id = tx.nextId('ACT');
  tx.insert('activities', {
    id,
    timestamp: new Date().toISOString(),
    actor: tx.data.settings?.general?.ownerName || 'Registry Owner',
    category,
    action,
    resourceType,
    resourceId,
    applicationId,
    description,
  });
  return id;
}
