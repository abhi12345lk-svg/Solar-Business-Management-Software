import { describe, it, expect } from 'vitest';
import {
  UserRole,
  Department,
  PanelType,
  getDefaultPanelForRole,
  isRoleAllowedInPanel,
  ROLE_DEFAULT_PERMISSIONS
} from '@ins-solar/shared';

describe('Three-Panel Enterprise Architecture Verification', () => {
  describe('Panel-Role Mapping and Access Boundaries', () => {
    it('maps Superadmin and Admin to Admin Panel with company-wide access to all 3 panels', () => {
      expect(getDefaultPanelForRole(UserRole.SUPERADMIN)).toBe(PanelType.ADMIN);
      expect(getDefaultPanelForRole(UserRole.ADMIN)).toBe(PanelType.ADMIN);

      // Superadmin & Admin can access all three internal panels
      expect(isRoleAllowedInPanel(UserRole.SUPERADMIN, PanelType.ADMIN)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.SUPERADMIN, PanelType.SALES)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.SUPERADMIN, PanelType.ACCOUNTS)).toBe(true);

      expect(isRoleAllowedInPanel(UserRole.ADMIN, PanelType.ADMIN)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.ADMIN, PanelType.SALES)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.ADMIN, PanelType.ACCOUNTS)).toBe(true);
    });

    it('maps Sales Executive and Surveyor strictly to Sales Panel', () => {
      expect(getDefaultPanelForRole(UserRole.SALES_EXECUTIVE)).toBe(PanelType.SALES);
      expect(getDefaultPanelForRole(UserRole.SURVEYOR)).toBe(PanelType.SALES);
      expect(getDefaultPanelForRole(UserRole.EXECUTIVE)).toBe(PanelType.SALES);
      expect(getDefaultPanelForRole(UserRole.DEPARTMENT_HEAD, Department.SALES)).toBe(
        PanelType.SALES
      );

      // Permitted in Sales
      expect(isRoleAllowedInPanel(UserRole.SALES_EXECUTIVE, PanelType.SALES)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.SURVEYOR, PanelType.SALES)).toBe(true);

      // Strictly isolated from Accounts and Admin governance
      expect(isRoleAllowedInPanel(UserRole.SALES_EXECUTIVE, PanelType.ACCOUNTS)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.SALES_EXECUTIVE, PanelType.ADMIN)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.SURVEYOR, PanelType.ACCOUNTS)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.SURVEYOR, PanelType.ADMIN)).toBe(false);
    });

    it('maps Accounts Officer strictly to Accounts Panel', () => {
      expect(getDefaultPanelForRole(UserRole.ACCOUNTS_OFFICER)).toBe(PanelType.ACCOUNTS);
      expect(getDefaultPanelForRole(UserRole.DEPARTMENT_HEAD, Department.ACCOUNTS)).toBe(
        PanelType.ACCOUNTS
      );

      // Permitted in Accounts
      expect(isRoleAllowedInPanel(UserRole.ACCOUNTS_OFFICER, PanelType.ACCOUNTS)).toBe(true);

      // Strictly isolated from Sales and Admin internal panels
      expect(isRoleAllowedInPanel(UserRole.ACCOUNTS_OFFICER, PanelType.SALES)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.ACCOUNTS_OFFICER, PanelType.ADMIN)).toBe(false);
    });

    it('maps Field Operations & Service Crew to Admin operational submodules', () => {
      expect(getDefaultPanelForRole(UserRole.INSTALLATION_CREW)).toBe(PanelType.ADMIN);
      expect(getDefaultPanelForRole(UserRole.SERVICE_TECHNICIAN)).toBe(PanelType.ADMIN);
      expect(getDefaultPanelForRole(UserRole.TECHNICIAN)).toBe(PanelType.ADMIN);

      expect(isRoleAllowedInPanel(UserRole.INSTALLATION_CREW, PanelType.ADMIN)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.INSTALLATION_CREW, PanelType.SALES)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.INSTALLATION_CREW, PanelType.ACCOUNTS)).toBe(false);

      expect(isRoleAllowedInPanel(UserRole.SERVICE_TECHNICIAN, PanelType.ADMIN)).toBe(true);
      expect(isRoleAllowedInPanel(UserRole.SERVICE_TECHNICIAN, PanelType.SALES)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.SERVICE_TECHNICIAN, PanelType.ACCOUNTS)).toBe(false);
    });

    it('denies external Customers access to all 3 internal company panels', () => {
      expect(isRoleAllowedInPanel(UserRole.CUSTOMER, PanelType.ADMIN)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.CUSTOMER, PanelType.SALES)).toBe(false);
      expect(isRoleAllowedInPanel(UserRole.CUSTOMER, PanelType.ACCOUNTS)).toBe(false);
    });
  });

  describe('Permission Boundary and Financial Invariants', () => {
    it('ensures Sales Executive cannot approve expenses or purchase orders', () => {
      const salesPermissions = ROLE_DEFAULT_PERMISSIONS[UserRole.SALES_EXECUTIVE];

      expect(salesPermissions).not.toContain('expense:approve');
      expect(salesPermissions).not.toContain('po:approve');
      expect(salesPermissions).not.toContain('account:payment_record');
      expect(salesPermissions).not.toContain('inv:adjust');
      expect(salesPermissions).not.toContain('user:roles_assign');
    });

    it('ensures Accounts Officer cannot modify technical solar designs or change project stages', () => {
      const accountsPermissions = ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTS_OFFICER];

      expect(accountsPermissions).not.toContain('design:create');
      expect(accountsPermissions).not.toContain('design:update');
      expect(accountsPermissions).not.toContain('project:stage_advance');
      expect(accountsPermissions).not.toContain('survey:create');
      expect(accountsPermissions).not.toContain('user:roles_assign');
    });

    it('ensures Accounts Officer has complete receivables and expense permissions', () => {
      const accountsPermissions = ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTS_OFFICER];

      expect(accountsPermissions).toContain('payment:create');
      expect(accountsPermissions).toContain('payment:allocate');
      expect(accountsPermissions).toContain('payment:reverse');
      expect(accountsPermissions).toContain('expense:create');
      expect(accountsPermissions).toContain('expense:approve');
      expect(accountsPermissions).toContain('po:approve');
      expect(accountsPermissions).toContain('vendor_invoice:create');
      expect(accountsPermissions).toContain('project:cost_read');
    });

    it('ensures Superadmin maintains unrestricted company-wide authority', () => {
      const superAdminPermissions = ROLE_DEFAULT_PERMISSIONS[UserRole.SUPERADMIN];

      expect(superAdminPermissions).toContain('user:roles_assign');
      expect(superAdminPermissions).toContain('lead:create');
      expect(superAdminPermissions).toContain('quote:create');
      expect(superAdminPermissions).toContain('payment:create');
      expect(superAdminPermissions).toContain('inv:adjust');
      expect(superAdminPermissions).toContain('project:stage_advance');
    });
  });
});
