import { UserRole, USER_ROLES, ROLE_HIERARCHY, hasRole, canManageRole } from '../role';

describe('Role Value Object', () => {
  describe('USER_ROLES', () => {
    it('should contain all expected roles', () => {
      expect(USER_ROLES).toEqual(['owner', 'admin', 'manager', 'cashier', 'waiter']);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should have correct hierarchy levels', () => {
      expect(ROLE_HIERARCHY.owner).toBe(100);
      expect(ROLE_HIERARCHY.admin).toBe(80);
      expect(ROLE_HIERARCHY.manager).toBe(60);
      expect(ROLE_HIERARCHY.cashier).toBe(40);
      expect(ROLE_HIERARCHY.waiter).toBe(20);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has exact role', () => {
      expect(hasRole(['owner'], 'owner')).toBe(true);
      expect(hasRole(['admin'], 'admin')).toBe(true);
    });

    it('should return true if user has higher role', () => {
      expect(hasRole(['owner'], 'admin')).toBe(true);
      expect(hasRole(['owner'], 'manager')).toBe(true);
      expect(hasRole(['owner'], 'cashier')).toBe(true);
      expect(hasRole(['owner'], 'waiter')).toBe(true);
      expect(hasRole(['admin'], 'manager')).toBe(true);
      expect(hasRole(['admin'], 'cashier')).toBe(true);
      expect(hasRole(['admin'], 'waiter')).toBe(true);
      expect(hasRole(['manager'], 'cashier')).toBe(true);
      expect(hasRole(['manager'], 'waiter')).toBe(true);
      expect(hasRole(['cashier'], 'waiter')).toBe(true);
    });

    it('should return false if user has lower role', () => {
      expect(hasRole(['waiter'], 'cashier')).toBe(false);
      expect(hasRole(['waiter'], 'manager')).toBe(false);
      expect(hasRole(['waiter'], 'admin')).toBe(false);
      expect(hasRole(['waiter'], 'owner')).toBe(false);
      expect(hasRole(['cashier'], 'manager')).toBe(false);
      expect(hasRole(['cashier'], 'admin')).toBe(false);
      expect(hasRole(['cashier'], 'owner')).toBe(false);
      expect(hasRole(['manager'], 'admin')).toBe(false);
      expect(hasRole(['manager'], 'owner')).toBe(false);
      expect(hasRole(['admin'], 'owner')).toBe(false);
    });

    it('should work with multiple user roles', () => {
      expect(hasRole(['cashier', 'manager'], 'admin')).toBe(false);
      expect(hasRole(['cashier', 'manager'], 'manager')).toBe(true);
      expect(hasRole(['admin', 'waiter'], 'owner')).toBe(false);
      expect(hasRole(['admin', 'waiter'], 'admin')).toBe(true);
    });

    it('should return false for empty roles', () => {
      expect(hasRole([], 'owner')).toBe(false);
    });
  });

  describe('canManageRole', () => {
    it('should return true if user role is higher than target', () => {
      expect(canManageRole(['owner'], 'admin')).toBe(true);
      expect(canManageRole(['admin'], 'manager')).toBe(true);
      expect(canManageRole(['manager'], 'cashier')).toBe(true);
      expect(canManageRole(['cashier'], 'waiter')).toBe(true);
    });

    it('should return false if user role is equal or lower', () => {
      expect(canManageRole(['owner'], 'owner')).toBe(false);
      expect(canManageRole(['admin'], 'admin')).toBe(false);
      expect(canManageRole(['admin'], 'owner')).toBe(false);
      expect(canManageRole(['manager'], 'admin')).toBe(false);
      expect(canManageRole(['waiter'], 'cashier')).toBe(false);
    });

    it('should use highest user role when multiple', () => {
      expect(canManageRole(['cashier', 'manager'], 'admin')).toBe(false);
      expect(canManageRole(['cashier', 'manager'], 'manager')).toBe(false);
      expect(canManageRole(['cashier', 'manager'], 'cashier')).toBe(true);
    });
  });
});