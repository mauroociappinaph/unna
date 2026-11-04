export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export const USER_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'cashier', 'waiter'];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  cashier: 40,
  waiter: 20,
};

export function hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
  const userMaxLevel = Math.max(...userRoles.map(r => ROLE_HIERARCHY[r]));
  return userMaxLevel >= ROLE_HIERARCHY[requiredRole];
}

export function canManageRole(userRoles: UserRole[], targetRole: UserRole): boolean {
  const userMaxLevel = Math.max(...userRoles.map(r => ROLE_HIERARCHY[r]));
  return userMaxLevel > ROLE_HIERARCHY[targetRole];
}