import { UserRole, Department } from './enums.js';

/**
 * Granular permissions supported in the INS Solar system.
 */
export const ALL_PERMISSIONS = [
  // User & Identity
  'user:create',
  'user:read',
  'user:update',
  'user:deactivate',
  'user:roles_assign',
  'user:mfa_manage',

  // Leads & CRM
  'lead:create',
  'lead:read',
  'lead:update',
  'lead:delete',
  'lead:assign',
  'lead:convert',

  // Customer Management
  'customer:create',
  'customer:read',
  'customer:update',

  // Site Surveys
  'survey:create',
  'survey:read',
  'survey:update',
  'survey:upload_photos',

  // Quotations & Design
  'design:create',
  'design:read',
  'design:update',
  'quote:create',
  'quote:read',
  'quote:update',
  'quote:discount_approve',
  'quote:delete',

  // Orders
  'order:create',
  'order:read',
  'order:confirm',
  'order:cancel',

  // Projects & Field Ops
  'project:create',
  'project:read',
  'project:update',
  'project:stage_advance',
  'project:milestone_manage',
  'project:task_manage',
  'dispatch:create',
  'dispatch:read',
  'dispatch:cancel',
  'checklist:template_manage',
  'checklist:read',
  'checklist:update',
  'evidence:upload',
  'evidence:read',

  // Net Metering & Subsidy
  'net_metering:create',
  'net_metering:read',
  'net_metering:update',
  'subsidy:create',
  'subsidy:read',
  'subsidy:update',
  'subsidy:disburse',

  // Product Catalog
  'catalog:read',
  'catalog:create',
  'catalog:update',
  'catalog:deactivate',

  // Inventory & Warehouse
  'inv:read',
  'inv:receive',
  'inv:issue',
  'inv:reserve',
  'inv:return',
  'inv:adjust',
  'inv:transfer',
  'warehouse:read',
  'warehouse:manage',

  // Accounts & Finance
  'account:invoice_create',
  'account:invoice_read',
  'account:payment_record',
  'account:expense_approve',
  'account:po_approve',
  'payment:create',
  'payment:read',
  'payment:verify',
  'payment:allocate',
  'payment:reverse',
  'payment:receipt_read',

  // Procurement & Vendor Management
  'vendor:create',
  'vendor:read',
  'vendor:update',
  'vendor:deactivate',
  'po:create',
  'po:read',
  'po:update',
  'po:approve',
  'po:cancel',
  'grn:create',
  'grn:read',
  'vendor_invoice:create',
  'vendor_invoice:read',
  'vendor_invoice:update',

  // Service, Warranty & AMC
  'service:ticket_create',
  'service:ticket_read',
  'service:ticket_resolve',
  'service:amc_manage',
  'service:visit_schedule',
  'service:visit_execute',
  'warranty:read',
  'warranty:claim_create',
  'warranty:claim_decide',

  // Security & Audit
  'audit:read',

  // Settings & Masters
  'settings:read',
  'settings:manage'
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/**
 * Baseline default permissions assigned to each role.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.SUPERADMIN]: ALL_PERMISSIONS,
  [UserRole.ADMIN]: ALL_PERMISSIONS.filter(p => p !== 'user:roles_assign'),
  [UserRole.DEPARTMENT_HEAD]: [
    'user:read',
    'lead:create',
    'lead:read',
    'lead:update',
    'lead:assign',
    'lead:convert',
    'customer:create',
    'customer:read',
    'customer:update',
    'survey:create',
    'survey:read',
    'survey:update',
    'survey:upload_photos',
    'design:create',
    'design:read',
    'design:update',
    'quote:create',
    'quote:read',
    'quote:update',
    'quote:discount_approve',
    'order:create',
    'order:read',
    'order:confirm',
    'order:cancel',
    'project:create',
    'project:read',
    'project:update',
    'project:stage_advance',
    'project:milestone_manage',
    'project:task_manage',
    'dispatch:create',
    'dispatch:read',
    'dispatch:cancel',
    'checklist:template_manage',
    'checklist:read',
    'checklist:update',
    'evidence:upload',
    'evidence:read',
    'catalog:read',
    'catalog:create',
    'catalog:update',
    'catalog:deactivate',
    'inv:read',
    'inv:receive',
    'inv:issue',
    'inv:reserve',
    'inv:return',
    'inv:adjust',
    'inv:transfer',
    'warehouse:read',
    'warehouse:manage',
    'account:invoice_read',
    'account:payment_record',
    'payment:create',
    'payment:read',
    'payment:verify',
    'payment:allocate',
    'payment:reverse',
    'payment:receipt_read',
    'service:ticket_create',
    'service:ticket_read',
    'service:ticket_resolve',
    'service:amc_manage',
    'service:visit_schedule',
    'service:visit_execute',
    'warranty:read',
    'warranty:claim_create',
    'warranty:claim_decide',
    'settings:read',
    'vendor:create',
    'vendor:read',
    'vendor:update',
    'vendor:deactivate',
    'po:create',
    'po:read',
    'po:update',
    'po:approve',
    'po:cancel',
    'grn:create',
    'grn:read',
    'vendor_invoice:create',
    'vendor_invoice:read',
    'vendor_invoice:update',
    'net_metering:create',
    'net_metering:read',
    'net_metering:update',
    'subsidy:create',
    'subsidy:read',
    'subsidy:update',
    'subsidy:disburse'
  ],
  [UserRole.SALES_EXECUTIVE]: [
    'lead:create',
    'lead:read',
    'lead:update',
    'lead:convert',
    'customer:create',
    'customer:read',
    'customer:update',
    'survey:read',
    'design:create',
    'design:read',
    'design:update',
    'quote:create',
    'quote:read',
    'quote:update',
    'order:create',
    'order:read',
    'order:cancel',
    'catalog:read',
    'warehouse:read',
    'net_metering:read',
    'subsidy:read'
  ],
  [UserRole.EXECUTIVE]: [
    'lead:create',
    'lead:read',
    'lead:update',
    'lead:convert',
    'customer:create',
    'customer:read',
    'customer:update',
    'quote:create',
    'quote:read',
    'quote:update'
  ],
  [UserRole.SURVEYOR]: [
    'survey:create',
    'survey:read',
    'survey:update',
    'survey:upload_photos',
    'customer:read',
    'lead:read'
  ],
  [UserRole.INSTALLATION_CREW]: [
    'project:read',
    'project:update',
    'project:stage_advance',
    'project:milestone_manage',
    'project:task_manage',
    'dispatch:read',
    'checklist:read',
    'checklist:update',
    'evidence:upload',
    'evidence:read',
    'customer:read',
    'inv:read',
    'net_metering:read',
    'net_metering:update'
  ],
  [UserRole.ACCOUNTS_OFFICER]: [
    'account:invoice_create',
    'account:invoice_read',
    'account:payment_record',
    'account:expense_approve',
    'account:po_approve',
    'payment:create',
    'payment:read',
    'payment:verify',
    'payment:allocate',
    'payment:reverse',
    'payment:receipt_read',
    'po:read',
    'po:approve',
    'vendor:read',
    'grn:read',
    'vendor_invoice:create',
    'vendor_invoice:read',
    'vendor_invoice:update',
    'order:read',
    'customer:read',
    'quote:read',
    'inv:read',
    'subsidy:read',
    'subsidy:update',
    'subsidy:disburse'
  ],
  [UserRole.SERVICE_TECHNICIAN]: [
    'service:ticket_create',
    'service:ticket_read',
    'service:ticket_resolve',
    'service:amc_manage',
    'service:visit_schedule',
    'service:visit_execute',
    'warranty:read',
    'warranty:claim_create',
    'customer:read'
  ],
  [UserRole.TECHNICIAN]: [
    'service:ticket_create',
    'service:ticket_read',
    'service:ticket_resolve',
    'service:visit_execute',
    'warranty:read',
    'customer:read'
  ],
  [UserRole.CUSTOMER]: []
};

/**
 * Roles that mandate Multi-Factor Authentication.
 */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_OFFICER
];

export interface AuthUserDto {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: Department;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  mfaEnabled: boolean;
  requiresMfa?: boolean;
}

export interface CustomerUserDto {
  id: string;
  customerId: string;
  customerCode?: string;
  name: string;
  email?: string;
  phone?: string;
  type?: string;
}

export interface SessionUserPayload {
  userId: string;
  employeeCode: string;
  email: string;
  role: UserRole;
  department: Department;
  mfaVerified: boolean;
  sessionVersion: number;
}

export interface SessionCustomerPayload {
  customerIdentityId: string;
  customerId: string;
  phone?: string;
  email?: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
}
