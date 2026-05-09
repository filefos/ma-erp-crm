/**
 * Permission helpers shared across the ERP frontend.
 */

/** Roles that are authorised to sign and stamp company documents. */
export const SIGNING_ROLES = new Set([
  "super_admin",
  "company_admin",
  "department_admin",
  "manager",
]);

/**
 * Returns true when the given permission level entitles a user to upload a
 * signature and see the signature / stamp preview panel on documents.
 */
export function canSignDocuments(
  permissionLevel: string | null | undefined,
): boolean {
  return SIGNING_ROLES.has(permissionLevel ?? "");
}
