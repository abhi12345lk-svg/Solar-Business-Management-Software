# INS Solar Business Management Software — Database Architecture & Data Design

**Document Reference:** `INS-ARC-DAT-001`  
**Version:** `1.0.0`  
**Status:** Approved Schema Blueprint  
**Primary Database Engine:** MongoDB Atlas (Replica Set, WiredTiger Storage Engine, Snappy Compression)  
**Object-Document Mapper (ODM):** Mongoose 8+ with Strict Schemas and TypeScript Typings  

---

## 1. Data Modeling Philosophy & Integrity Principles

The **INS Solar Business Management Software** data architecture balances the document model's flexibility with strict relational data integrity. It enforces the following core database design principles:

1.  **Reference Over Deep Nesting for Independent Entities:** Entities that possess their own lifecycle, querying patterns, or transactional boundaries (Customers, Quotations, Orders, Projects, Invoices, Inventory Items) are stored in distinct top-level collections and cross-referenced via `ObjectId` references.
2.  **Strategic Embedding for Discrete Snapshots:** Line items, checklist progress checkpoints, and historical discussion logs that never exist independently of their parent document are embedded as subdocument arrays.
3.  **Strict Immutability for Financial & Stock Transactions:** Ledger entries (Stock Movements, Payment Receipts, Invoices, Purchase Orders) are append-only. Corrections require explicit reversing entries or voiding records.
4.  **Zero Floating-Point Financials:** Monetary amounts are stored in base currency units as **Integer Paise** (1 INR = 100 Paise) or using MongoDB `Decimal128` to prevent IEEE 754 floating-point rounding errors.
5.  **Strong Concurrency & Anti-Negative Stock Guards:** Stock balances are updated using atomic conditional operations (`$inc` coupled with `$gte` availability queries) or multi-document ACID transactions.

---

## 2. Entity Relationship Architecture

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : "has active"
    USERS ||--o{ LEADS : "assigned to"
    CUSTOMERS ||--o{ SITES : "owns"
    CUSTOMERS ||--o{ LEADS : "originates"
    CUSTOMERS ||--o{ QUOTATIONS : "receives"
    CUSTOMERS ||--o{ ORDERS : "places"
    CUSTOMERS ||--o{ PROJECTS : "contracts"
    CUSTOMERS ||--o{ PAYMENTS : "remits"
    CUSTOMERS ||--o{ COMPLAINTS : "files"
    CUSTOMERS ||--o{ AMCS : "holds"

    LEADS ||--o{ FOLLOWUPS : "logs"
    LEADS ||--o{ SURVEYS : "triggers"
    LEADS ||--o{ QUOTATIONS : "yields"

    SURVEYS ||--o{ SYSTEM_DESIGNS : "informs"
    SYSTEM_DESIGNS ||--o{ QUOTATIONS : "sizes"

    QUOTATIONS ||--o| ORDERS : "converts to"
    ORDERS ||--|| PROJECTS : "instantiates"
    ORDERS ||--o{ PAYMENTS : "billed against"

    PRODUCTS ||--o{ INVENTORY_BALANCES : "stocked as"
    PRODUCTS ||--o{ STOCK_MOVEMENTS : "transacted in"
    PRODUCTS ||--o{ PURCHASE_ITEMS : "procured in"

    PROJECTS ||--o{ INSTALLATION_LOGS : "executes"
    PROJECTS ||--o{ CHECKLISTS : "inspected via"
    PROJECTS ||--o{ DOCUMENTS : "stores"
    PROJECTS ||--o{ EXPENSES : "incurs"
    PROJECTS ||--o{ NET_METERING : "tracks"

    VENDORS ||--o{ PURCHASES : "supplies"
    PURCHASES ||--o{ STOCK_MOVEMENTS : "receives (GRN)"

    AMCS ||--o{ SERVICE_VISITS : "schedules"
```

---

## 3. Core Database Collections & Field Specifications

### 3.1 Security, Users & System Config

#### `users`
Internal staff and administrators.
```typescript
interface IUser {
  _id: ObjectId;
  employeeCode: string;          // e.g. "EMP-0101" (unique, indexed)
  firstName: string;
  lastName: string;
  email: string;                 // unique, lowercase, indexed
  phone: string;                 // unique, E.164 format, indexed
  passwordHash: string;          // Argon2id string
  department: 'ADMIN' | 'SALES' | 'ENGINEERING' | 'OPERATIONS' | 'ACCOUNTS' | 'SERVICE' | 'INVENTORY';
  role: 'SUPERADMIN' | 'ADMIN' | 'DEPARTMENT_HEAD' | 'EXECUTIVE' | 'TECHNICIAN' | 'CUSTOMER';
  permissions: string[];         // Granular permission tokens (e.g. "quote:discount_approve")
  isActive: boolean;             // Default: true
  mfaEnabled: boolean;           // Default: false
  mfaSecretEncrypted?: string;   // AES-256-GCM encrypted TOTP secret
  mfaRecoveryCodesHashed?: string[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { email: 1 } (unique), { phone: 1 } (unique), { employeeCode: 1 } (unique), { department: 1, role: 1 }
```

#### `sessions`
Server-managed session state.
```typescript
interface ISession {
  _id: ObjectId;
  sessionId: string;             // Cryptographically random 256-bit token hash (unique, indexed)
  userId: ObjectId;              // Ref -> users._id (indexed)
  role: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;               // TTL index: automatically deleted upon expiration
  createdAt: Date;
}
// Indexes: { sessionId: 1 } (unique), { userId: 1 }, { expiresAt: 1 } (TTL expireAfterSeconds: 0)
```

#### `audit_logs`
Immutable system-wide compliance and security trail.
```typescript
interface IAuditLog {
  _id: ObjectId;
  actorUserId?: ObjectId;        // Ref -> users._id (null for public/system actions)
  action: string;                // e.g. "ORDER_CONFIRMED", "DISCOUNT_APPROVED", "STOCK_VOID"
  entityType: string;            // e.g. "Order", "Quotation", "StockMovement"
  entityId: ObjectId;            // Target document ID
  ipAddress: string;
  userAgent: string;
  correlationId: string;         // Request tracking UUID
  beforeSnapshot?: Record<string, any>;
  afterSnapshot?: Record<string, any>;
  timestamp: Date;
}
// Indexes: { entityType: 1, entityId: 1 }, { actorUserId: 1 }, { timestamp: -1 }, { correlationId: 1 }
```

---

### 3.2 CRM & Solar Engineering Domain

#### `customers`
Master customer directory.
```typescript
interface ICustomer {
  _id: ObjectId;
  customerCode: string;          // e.g. "CUST-2026-00042" (unique, indexed)
  type: 'INDIVIDUAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'INSTITUTIONAL';
  name: string;                  // Full legal individual or firm name
  primaryPhone: string;          // Indexed
  secondaryPhone?: string;
  email: string;                 // Indexed
  billingAddress: {
    street: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
  };
  gstin?: string;                // 15-character Indian GSTIN
  pan?: string;                  // 10-character PAN
  portalUserId?: ObjectId;       // Ref -> users._id (optional customer portal login)
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { customerCode: 1 } (unique), { primaryPhone: 1 }, { email: 1 }, { gstin: 1 }
```

#### `sites`
Installation rooftop locations associated with customers.
```typescript
interface ISite {
  _id: ObjectId;
  customerId: ObjectId;          // Ref -> customers._id (indexed)
  siteName: string;              // e.g. "Main Factory Rooftop", "Residence"
  address: {
    street: string;
    city: string;
    state: string;
    pinCode: string;
    geoCoordinates?: { lat: number; lng: number };
  };
  discomName: string;            // e.g. "BESCOM", "MSEDCL"
  consumerNumber: string;        // Utility connection ID
  sanctionedLoadKw: number;
  connectionPhase: 'SINGLE' | 'THREE';
  roofType: 'RCC_FLAT' | 'METAL_SHEET' | 'TILE' | 'ELEVATED' | 'GROUND';
  usableRoofAreaSqFt: number;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { customerId: 1 }, { consumerNumber: 1 }
```

#### `leads`
Pre-conversion prospect tracking.
```typescript
interface ILead {
  _id: ObjectId;
  leadCode: string;              // e.g. "LD-2026-00128" (unique, indexed)
  customerId?: ObjectId;         // Ref -> customers._id (if existing customer)
  prospectName: string;
  prospectPhone: string;         // Indexed (checked for duplicates)
  prospectEmail?: string;
  location: {
    street?: string;
    city: string;
    district?: string;
    state: string;
    pinCode?: string;
    geoCoordinates?: { latitude: number; longitude: number };
  };
  source: 'WEBSITE' | 'REFERRAL' | 'EXPO' | 'COLD_CALL' | 'SOCIAL_MEDIA' | 'CHANNEL_PARTNER' | 'OTHER';
  solarRequirement: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'PUMP' | 'STORAGE_RETROFIT' | 'OTHER';
  estimatedCapacityKw?: number;
  assignedToEmployeeId?: ObjectId; // Ref -> users._id (indexed)
  status: 'NEW' | 'CONTACTED' | 'SURVEY_SCHEDULED' | 'QUOTED' | 'NEGOTIATION' | 'CONVERTED' | 'LOST';
  lostReason?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  nextFollowUpDate?: Date;
  isActive: boolean;
  convertedCustomerId?: ObjectId;  // Ref -> customers._id (populated upon explicit conversion)
  convertedAt?: Date;
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { leadCode: 1 } (unique), { prospectPhone: 1 }, { assignedToEmployeeId: 1 }, { status: 1, createdAt: -1 }
```

#### `lead_activities`
Chronological interaction timeline and scheduled sales follow-ups.
```typescript
interface ILeadActivity {
  _id: ObjectId;
  leadId: ObjectId;              // Ref -> leads._id (indexed)
  customerId?: ObjectId;         // Ref -> customers._id
  activityType: 'CALL' | 'MEETING' | 'SITE_VISIT' | 'NOTE' | 'FOLLOW_UP' | 'WHATSAPP' | 'EMAIL';
  summary: string;
  remarks?: string;
  activityDate: Date;
  nextFollowUpDate?: Date;       // Indexed for due/overdue queries
  assignedEmployeeId?: ObjectId; // Ref -> users._id
  status: 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
  sentiment?: 'HOT' | 'WARM' | 'COLD';
  completedAt?: Date;
  createdBy?: ObjectId;          // Ref -> users._id
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { leadId: 1, createdAt: -1 }, { assignedEmployeeId: 1, nextFollowUpDate: 1, status: 1 }, { status: 1, nextFollowUpDate: 1 }
```

#### `site_surveys`
Physical rooftop feasibility, shadow analysis, electrical parameters, and photographic evidence.
```typescript
interface ISiteSurvey {
  _id: ObjectId;
  surveyNumber: string;          // e.g. "SRV-2026-00001" (unique, indexed)
  leadId: ObjectId;              // Ref -> leads._id (indexed)
  customerId?: ObjectId;         // Ref -> customers._id (indexed)
  siteAddress: IAddressSubdocument;
  roofType: 'RCC_FLAT' | 'METAL_SHEET' | 'TILE' | 'ELEVATED' | 'GROUND';
  usableRoofAreaSqFt: number;    // Non-negative
  grossRoofAreaSqFt?: number;
  monthlyUnitsKwh?: number;
  averageMonthlyBillPaise?: number; // Integer paise (Rs. 1 = 100 paise)
  sanctionedLoadKw: number;      // Strictly positive
  connectionPhase: 'SINGLE' | 'THREE';
  shadowAnalysisNotes?: string;
  orientationAzimuth?: string;
  proposedCapacityKw?: number;
  surveyorEmployeeId?: ObjectId; // Ref -> users._id
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  scheduledDate?: Date;
  completedDate?: Date;
  observations?: string;
  constraints?: string;
  recommendations?: string;
  photos: Array<{
    storageKey: string;          // Private object reference (no image binary stored in MongoDB)
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    category: 'ROOF' | 'DISTRIBUTION_BOARD' | 'METER' | 'EARTHING_PIT' | 'SHADOW_OBSTRUCTION' | 'OTHER';
    caption?: string;
    geoCoordinates?: { latitude: number; longitude: number };
    uploadedBy?: ObjectId;
    uploadedAt: Date;
  }>;
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { surveyNumber: 1 } (unique), { leadId: 1, createdAt: -1 }, { status: 1, createdAt: -1 }, { surveyorEmployeeId: 1, status: 1 }
```

#### `solar_designs`
Technical sizing records and PV plant configurations for On-Grid, Off-Grid, and Hybrid plants.
```typescript
interface ISolarDesign {
  _id: ObjectId;
  designNumber: string;          // e.g. "DES-2026-00001" (unique, indexed)
  customerId: ObjectId;          // Ref -> customers._id (indexed)
  leadId?: ObjectId;             // Ref -> leads._id (indexed)
  surveyId?: ObjectId;           // Ref -> site_surveys._id (indexed)
  designName: string;
  systemTopology: 'ON_GRID' | 'OFF_GRID' | 'HYBRID';
  proposedCapacityKwp: number;   // DC capacity in kWp

  module: {
    productId: ObjectId;         // Ref -> products._id
    name: string;
    sku: string;
    wattageWp: number;
    quantity: number;
    totalDcCapacityKwp: number;
  };
  inverter: {
    productId: ObjectId;         // Ref -> products._id
    name: string;
    sku: string;
    ratedCapacityKw: number;
    quantity: number;
    actualDcAcRatio: number;     // e.g. 1.20
  };
  battery?: {
    productId?: ObjectId;        // Ref -> products._id
    batteryType: string;
    unitVoltageV: number;
    unitCapacityAh: number;
    quantity: number;
    totalStorageKwh: number;
    autonomyDays: number;
  };
  structure: {
    roofType: 'RCC_FLAT' | 'METAL_SHEET' | 'TILE' | 'ELEVATED' | 'GROUND';
    structureType: string;
    tiltAngleDegrees: number;
    azimuthOrientation: string;
  };
  estimatedGeneration: {
    dailyGenerationKwh: number;
    monthlyGenerationKwh: number;
    annualGenerationKwh: number;
    specificYieldKwhPerKwp: number;
  };
  assumptions: {
    peakSunHoursPerDay: number;
    performanceRatioPercent: number;
    assumptionsSource: string;
  };
  warnings: string[];
  disclaimer: string;
  engineeringNotes?: string;
  createdBy: ObjectId;           // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { designNumber: 1 } (unique), { customerId: 1, createdAt: -1 }, { leadId: 1 }, { surveyId: 1 }, { systemTopology: 1 }
```

#### `quotations`
Commercial proposals with immutable revision snapshots (`QT-YYYY-NNNNN-R0`, `R1`, etc.), integer paise financials, and approval tracking.
```typescript
interface IQuotation {
  _id: ObjectId;
  quotationNumber: string;       // e.g. "QT-2026-00001"
  revisionNumber: number;        // 0 for R0, 1 for R1, etc.
  fullQuotationCode: string;     // e.g. "QT-2026-00001-R0" (unique, indexed)
  parentQuotationId?: ObjectId;  // Ref -> quotations._id
  isLatestRevision: boolean;
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'SENT'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'REVISED'
    | 'EXPIRED'
    | 'CANCELLED';

  customerId: ObjectId;          // Ref -> customers._id
  leadId?: ObjectId;             // Ref -> leads._id
  solarDesignId?: ObjectId;      // Ref -> solar_designs._id

  systemTopology: 'ON_GRID' | 'OFF_GRID' | 'HYBRID';
  systemCapacityKwp: number;

  // Itemized Bill of Materials (all monetary values in Integer Paise)
  lineItems: Array<{
    itemType: 'SOLAR_MODULE' | 'INVERTER' | 'BATTERY' | 'STRUCTURE' | 'BOS_ELECTRICAL' | 'INSTALLATION_LABOUR' | 'OTHER';
    productId?: ObjectId;        // Ref -> products._id
    skuSnapshot?: string;
    description: string;
    quantity: number;
    unit: string;
    unitRatePaise: number;       // Integer paise
    discountPaise: number;
    taxableAmountPaise: number;
    gstRateBasisPoints: number;  // e.g. 1200 for 12%, 1800 for 18%
    taxPaise: number;
    itemTotalPaise: number;
  }>;

  // Commercial Financial Summary (Integer Paise)
  grossSubtotalPaise: number;
  additionalDiscountPaise: number;
  totalDiscountPaise: number;
  discountPercent: number;
  requiresDiscountApproval: boolean;
  discountApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
  discountApprovedBy?: ObjectId; // Ref -> users._id (Anti-self-approval enforced)
  discountApprovedAt?: Date;
  discountRemarks?: string;
  discountRejectionReason?: string;

  taxableAmountPaise: number;
  totalTaxPaise: number;
  taxComponents: Array<{
    componentName: string;       // 'CGST', 'SGST', 'IGST'
    rateBasisPoints: number;
    taxAmountPaise: number;
  }>;
  netTotalPaise: number;

  taxProfile: {
    profileName: string;
    profileCode: string;
    effectiveDate: string;
    isInterState: boolean;
    accountingNotice: string;
  };

  paymentMilestones: Array<{
    name: string;
    percentage: number;
    description: string;
  }>;
  termsAndConditions: string[];
  validUntil: Date;

  // Customer Review & Acceptance
  isAccepted: boolean;
  acceptedAt?: Date;
  decisionIpAddress?: string;
  customerNotes?: string;
  rejectionReason?: string;

  createdBy: ObjectId;           // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { fullQuotationCode: 1 } (unique), { quotationNumber: 1, revisionNumber: -1 }, { customerId: 1, status: 1 }, { requiresDiscountApproval: 1, discountApprovalStatus: 1 }, { status: 1, validUntil: 1 }
```

---

### 3.3 Orders & Multi-Location Supply Chain

#### `orders`
Confirmed sales contracts locking prices and BOM.
```typescript
interface IOrder {
  _id: ObjectId;
  orderCode: string;             // e.g. "ORD-2026-00034" (unique, indexed)
  customerId: ObjectId;          // Ref -> customers._id
  quotationId: ObjectId;         // Ref -> quotations._id (accepted revision)
  projectId?: ObjectId;          // Ref -> projects._id (linked project)
  systemCapacityKw: number;
  systemTopology: 'ON_GRID' | 'OFF_GRID' | 'HYBRID';
  totalOrderValuePaise: number;  // Immutable contracted gross amount
  advanceReceivedPaise: number;
  totalCollectedPaise: number;
  outstandingBalancePaise: number;
  paymentStatus: 'ADVANCE_PENDING' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  installationStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  orderDate: Date;
  status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { orderCode: 1 } (unique), { customerId: 1 }, { quotationId: 1 }, { status: 1 }
```

#### `products`
Hardware component master catalog.
```typescript
interface IProduct {
  _id: ObjectId;
  itemCode: string;              // e.g. "MOD-550-MONO" (unique, indexed)
  name: string;
  category: 'SOLAR_PANEL' | 'INVERTER' | 'BATTERY' | 'STRUCTURE' | 'CABLE' | 'SWITCHGEAR' | 'EARTHING' | 'ACCESSORY';
  brand: string;
  model: string;
  uom: 'NOS' | 'SETS' | 'METERS' | 'KG' | 'PAIRS';
  hsnCode: string;
  defaultGstRate: number;        // e.g. 12
  standardPurchaseRatePaise: number;
  standardSellingRatePaise: number;
  specifications: Record<string, any>; // Polymorphic technical metadata
  minimumStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { itemCode: 1 } (unique), { category: 1 }, { brand: 1 }
```

#### `inventory_balances`
Multi-location real-time stock balances.
```typescript
interface IInventoryBalance {
  _id: ObjectId;
  productId: ObjectId;           // Ref -> products._id
  locationType: 'WAREHOUSE' | 'INSTALLATION_SITE' | 'EMPLOYEE_ISSUED';
  locationId: string;            // e.g. "MAIN_DEPOT", ProjectId, or EmployeeId
  physicalQuantity: number;      // Physically on hand
  reservedQuantity: number;      // Locked against confirmed orders
  // Available Quantity is calculated: physicalQuantity - reservedQuantity
  updatedAt: Date;
}
// Compound Unique Index: { productId: 1, locationType: 1, locationId: 1 } (guarantees one balance record per location)
```

#### `stock_movements`
Immutable append-only ledger for every material transaction.
```typescript
interface IStockMovement {
  _id: ObjectId;
  movementCode: string;          // e.g. "STK-2026-00512" (unique, indexed)
  productId: ObjectId;           // Ref -> products._id
  sourceLocationType?: 'WAREHOUSE' | 'INSTALLATION_SITE' | 'EMPLOYEE_ISSUED' | 'VENDOR';
  sourceLocationId?: string;
  destLocationType?: 'WAREHOUSE' | 'INSTALLATION_SITE' | 'EMPLOYEE_ISSUED' | 'CUSTOMER_ROOF';
  destLocationId?: string;
  quantity: number;
  movementType: 'GRN_RECEIPT' | 'SITE_DISPATCH' | 'EMPLOYEE_ISSUE' | 'RETURN_TO_DEPOT' | 'ADJUSTMENT_WRITE_OFF';
  referenceEntityType: 'PURCHASE_ORDER' | 'ORDER' | 'PROJECT' | 'SERVICE_TICKET' | 'MANUAL';
  referenceEntityId?: ObjectId;
  serializedIdentifiers?: string[]; // Array of module barcodes or inverter serials
  performedByUserId: ObjectId;   // Ref -> users._id
  remarks?: string;
  timestamp: Date;
}
// Indexes: { productId: 1, timestamp: -1 }, { movementCode: 1 } (unique), { referenceEntityId: 1 }
```

#### `vendors`
Supplier master catalog with commercial, tax, and banking details.
```typescript
interface IVendor {
  _id: ObjectId;
  vendorCode: string;             // e.g. "VEN-2026-00001" (unique, indexed)
  name: string;                   // Legal firm name (indexed)
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  gstin?: string;                 // 15-char Indian GSTIN (sparse unique index)
  pan?: string;                   // 10-char PAN
  suppliedCategoryIds: ObjectId[];// Ref -> product_categories._id
  suppliedProductIds: ObjectId[]; // Ref -> products._id
  paymentTermsDays: number;       // Default net days (e.g. 30)
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  leadTimeDays?: number;
  notes?: string;
  isActive: boolean;
  hasPurchaseHistory: boolean;    // Guard flag preventing deletion if purchase records exist
  createdBy: ObjectId;            // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { vendorCode: 1 } (unique), { name: 1 }, { gstin: 1 } (sparse unique), { isActive: 1 }
```

#### `purchase_orders`
Official procurement commitments with integer paise calculations and approval controls.
```typescript
interface IPurchaseOrder {
  _id: ObjectId;
  poNumber: string;               // e.g. "PO-2026-00001" (unique, indexed)
  vendorId: ObjectId;             // Ref -> vendors._id (indexed)
  destinationWarehouseId: ObjectId; // Ref -> warehouses._id (indexed)
  orderDate: Date;
  expectedDeliveryDate?: Date;
  lineItems: Array<{
    productId: ObjectId;          // Ref -> products._id
    sku: string;
    productName: string;
    description?: string;
    orderedQuantity: number;
    uom: string;
    unitPurchaseRatePaise: number;
    discountAmountPaise: number;
    taxRateBasisPoints: number;   // e.g. 1800 for 18%
    subtotalPaise: number;
    taxAmountPaise: number;
    totalAmountPaise: number;
    receivedQuantity: number;
    rejectedQuantity: number;
    outstandingQuantity: number;
  }>;
  subtotalPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';
  approvalMetadata?: {
    approvedBy: ObjectId;
    approvedAt: Date;
    decisionNotes?: string;
  };
  rejectionReason?: string;
  cancellationReason?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  createdBy: ObjectId;            // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { poNumber: 1 } (unique), { vendorId: 1, status: 1 }, { destinationWarehouseId: 1 }, { status: 1, orderDate: -1 }
```

#### `goods_receipts`
Official warehouse inbound intake notes recording accepted vs rejected quantities.
```typescript
interface IGoodsReceipt {
  _id: ObjectId;
  grnNumber: string;              // e.g. "GRN-2026-00001" (unique, indexed)
  purchaseOrderId: ObjectId;      // Ref -> purchase_orders._id (indexed)
  vendorId: ObjectId;             // Ref -> vendors._id
  warehouseId: ObjectId;          // Ref -> warehouses._id (destination)
  receiptDate: Date;
  deliveryChallanNumber?: string;
  vehicleNumber?: string;
  lineItems: Array<{
    productId: ObjectId;          // Ref -> products._id
    sku: string;
    productName: string;
    orderedQuantity: number;
    deliveredQuantity: number;
    acceptedQuantity: number;     // Physical stock increment
    rejectedQuantity: number;     // Never increments physical stock
    outstandingQuantityAfter: number;
    rejectionReason?: string;
    serialNumbers?: string[];
    stockMovementId?: ObjectId;   // Ref -> stock_movements._id
  }>;
  status: 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED';
  stockMovementIds: ObjectId[];   // Ref -> stock_movements._id
  receivedBy: ObjectId;           // Ref -> users._id
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { grnNumber: 1 } (unique), { purchaseOrderId: 1 }, { vendorId: 1 }, { warehouseId: 1 }
```

#### `vendor_invoices`
Accounts payable records with automated 3-way match reconciliation.
```typescript
interface IVendorInvoice {
  _id: ObjectId;
  vendorId: ObjectId;             // Ref -> vendors._id (indexed)
  purchaseOrderId?: ObjectId;     // Ref -> purchase_orders._id (indexed)
  vendorInvoiceNumber: string;    // Vendor invoice number
  invoiceDate: Date;
  dueDate?: Date;
  subtotalPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balancePayablePaise: number;
  reconciliationStatus: 'PENDING' | 'RECONCILED' | 'DISPUTED';
  discrepancyReason?: string;
  status: 'RECORDED' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  documentUrl?: string;
  notes?: string;
  createdBy: ObjectId;            // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { vendorId: 1, vendorInvoiceNumber: 1 } (compound unique), { purchaseOrderId: 1 }, { reconciliationStatus: 1 }, { status: 1 }
```

---

### 3.4 Project Operations & Field Execution

#### `projects`
Operational execution lifecycle for confirmed customer installations and milestone management.
```typescript
interface IProject {
  _id: ObjectId;
  projectCode: string;           // e.g. "PRJ-2026-00001" (unique, indexed)
  name: string;                  // Project Title
  customerId: ObjectId;          // Ref -> customers._id (indexed)
  orderId?: ObjectId;            // Ref -> orders._id (sparse unique 1:1 binding)
  siteAddress?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  systemCapacityKwp?: number;
  systemTopology?: 'ON_GRID' | 'OFF_GRID' | 'HYBRID';
  projectManagerId?: ObjectId;   // Ref -> users._id (indexed)
  teamMemberIds?: ObjectId[];    // Array of users._id
  
  currentStage: 
    | 'STAGE_1_ENGINEERING_DESIGN'
    | 'STAGE_2_NET_METERING_APPLY'
    | 'STAGE_3_MATERIAL_DISPATCH'
    | 'STAGE_4_CIVIL_STRUCTURE'
    | 'STAGE_5_MODULE_DC_CABLING'
    | 'STAGE_6_INVERTER_ACDB'
    | 'STAGE_7_EARTHING_LIGHTNING'
    | 'STAGE_8_TESTING_PRE_COMMISSION'
    | 'STAGE_9_DISCOM_METER_INSTALL'
    | 'STAGE_10_COMMISSION_HANDOVER';

  stageHistory: Array<{
    stage: string;
    transitionedAt: Date;
    transitionedBy: ObjectId;   // Ref -> users._id
    notes?: string;
  }>;

  milestones: Array<{
    _id: ObjectId;
    name: string;
    description?: string;
    displayOrder: number;
    plannedStartDate?: Date;
    targetDueDate?: Date;
    actualCompletionDate?: Date;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
    blockerReason?: string;
    completedBy?: ObjectId;     // Ref -> users._id
    completedAt?: Date;
  }>;

  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plannedStartDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  statusChangeReason?: string;
  notes?: string;
  createdBy: ObjectId;           // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { projectCode: 1 } (unique), { orderId: 1 } (sparse unique), { customerId: 1 }, { status: 1 }, { currentStage: 1 }, { projectManagerId: 1 }
```

#### `project_tasks`
Scoped operational tasks with milestone linkage, assignee, due date, and overdue indexing.
```typescript
interface IProjectTask {
  _id: ObjectId;
  taskCode: string;              // e.g. "TSK-2026-00001" (unique, indexed)
  projectId: ObjectId;           // Ref -> projects._id (indexed)
  milestoneId?: ObjectId;        // Ref -> projects.milestones._id (verified belonging to project)
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  dueDate?: Date;
  blockerReason?: string;
  assignedUserId?: ObjectId;     // Ref -> users._id (indexed)
  completedAt?: Date;
  completedBy?: ObjectId;        // Ref -> users._id
  createdBy: ObjectId;           // Ref -> users._id
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { taskCode: 1 } (unique), { projectId: 1, status: 1 }, { assignedUserId: 1, status: 1 }, { dueDate: 1 }, { milestoneId: 1 }
```

#### `material_dispatches` (Phase 6B)
Physical inventory issue slips from warehouse stock to project installation site.
```typescript
interface IMaterialDispatch {
  _id: ObjectId;
  dispatchNumber: string;         // e.g. "DSP-2026-00001" (unique, indexed)
  projectId: ObjectId;            // Ref -> projects._id (indexed)
  orderId?: ObjectId;             // Ref -> orders._id
  sourceWarehouseId: ObjectId;     // Ref -> warehouses._id (indexed)
  destinationSiteAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  lineItems: Array<{
    productId: ObjectId;          // Ref -> products._id
    requestedQuantity: number;
    issuedQuantity: number;
    serialNumbers?: string[];
    stockMovementId?: ObjectId;   // Ref -> stock_movements._id
  }>;
  status: 'DRAFT' | 'DISPATCHED' | 'CANCELLED';
  dispatchedBy: ObjectId;         // Ref -> users._id
  dispatchedAt: Date;
  cancelledBy?: ObjectId;         // Ref -> users._id
  cancelledAt?: Date;
  cancellationReason?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  idempotencyKey?: string;        // Client idempotency key (sparse unique)
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { dispatchNumber: 1 } (unique), { projectId: 1 }, { sourceWarehouseId: 1 }, { status: 1 }, { idempotencyKey: 1 } (sparse unique)
```

#### `installation_checklist_templates` (Phase 6B)
Standardized, versioned 5-category quality and safety inspection templates.
```typescript
interface IInstallationChecklistTemplate {
  _id: ObjectId;
  templateCode: string;          // e.g. "CKT-STANDARD-ROOFTOP"
  name: string;
  version: number;               // Sequential template version integer
  categories: Array<{
    category: 
      | 'SITE_READINESS_SAFETY'
      | 'STRUCTURE_MODULE_MOUNTING'
      | 'DC_WIRING_EARTHING'
      | 'INVERTER_AC_PROTECTION'
      | 'TESTING_COMMISSIONING_HANDOVER';
    title: string;
    items: Array<{
      itemCode: string;          // e.g. "CHK-01-01"
      description: string;
      isRequired: boolean;       // Mandatory vs Optional
      requiresEvidence: boolean; // Must attach photo before PASSED
    }>;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { templateCode: 1, version: 1 } (compound unique)
```

#### `project_installation_checklists` (Phase 6B)
Project-specific inspection instance snapshotted from template with photo evidence subdocuments.
```typescript
interface IProjectInstallationChecklist {
  _id: ObjectId;
  projectId: ObjectId;           // Ref -> projects._id (indexed)
  templateCode: string;
  templateVersion: number;
  categories: Array<{
    category: string;
    title: string;
    items: Array<{
      _id: ObjectId;
      itemCode: string;
      description: string;
      isRequired: boolean;
      requiresEvidence: boolean;
      status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'BLOCKED';
      notes?: string;
      failureReason?: string;    // Required if FAILED
      blockerReason?: string;    // Required if BLOCKED
      inspectedAt?: Date;
      inspectedBy?: ObjectId;    // Ref -> users._id
      evidence: Array<{
        _id: ObjectId;
        storageKey: string;      // Private object key (evidence/{proj}/{item}/{file})
        fileName: string;
        fileSizeBytes: number;
        mimeType: string;
        caption?: string;
        latitude?: number;       // Validated -90 to 90
        longitude?: number;      // Validated -180 to 180
        uploadedAt: Date;
        uploadedBy: ObjectId;    // Ref -> users._id
      }>;
    }>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { projectId: 1, templateVersion: 1 } (compound unique)
```

#### `net_metering_applications` (Phase 7A)
Official utility net-metering lifecycle, inspections, bi-directional meter installation, and document gates.
```typescript
interface INetMeteringApplication {
  _id: ObjectId;
  applicationNumber: string;      // e.g. "NMA-2026-00001" (unique, indexed)
  projectId: ObjectId;            // Ref -> projects._id (indexed)
  customerId: ObjectId;           // Ref -> customers._id (indexed)
  orderId?: ObjectId;             // Ref -> orders._id
  discomName: string;
  division?: string;
  subdivision?: string;
  consumerNumber?: string;
  sanctionedLoadKw?: number;
  solarCapacityKwp?: number;
  applicationReferenceNumber?: string;
  submissionDate?: Date;
  status: 
    | 'DRAFT'
    | 'DOCUMENTS_PENDING'
    | 'READY_TO_SUBMIT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'INSPECTION_SCHEDULED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED';
  rejectionReason?: string;
  approvedDate?: Date;
  assignedTo?: ObjectId;          // Ref -> users._id
  assignedTeam?: string;
  technicalFeasibility?: {
    isFeasible?: boolean;
    approvalDate?: Date;
    demandNoteAmountPaise?: number; // Integer paise
    demandNotePaidDate?: Date;
    demandNotePaymentRef?: string;
  };
  inspection?: {
    scheduledDate?: Date;
    inspectorName?: string;
    inspectorPhone?: string;
    outcome?: 'PENDING' | 'PASSED' | 'FAILED' | 'RESCHEDULE_REQUIRED';
    inspectionDate?: Date;
    remarks?: string;
  };
  meterInstallation?: {
    workOrderNumber?: string;
    meterSerialNumber?: string;
    installedAt?: Date;
    installedBy?: string;
    oldMeterFinalReading?: number;
    newMeterInitialReading?: number;
    testedAndCommissioned?: boolean;
    remarks?: string;
  };
  documentRequirements: Array<{
    documentType: string;         // e.g. ELECTRICITY_BILL, AADHAAR_CARD, SINGLE_LINE_DIAGRAM
    isMandatory: boolean;
    status: 'REQUIRED' | 'UPLOADED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'RESUBMISSION_REQUIRED';
    storageKey?: string;          // Private object storage key
    fileName?: string;
    uploadedAt?: Date;
    reviewedBy?: ObjectId;        // Ref -> users._id
    reviewedAt?: Date;
    reviewNotes?: string;
  }>;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy: ObjectId;          // Ref -> users._id
    reason?: string;
    notes?: string;
  }>;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { applicationNumber: 1 } (unique), { projectId: 1, discomName: 1 }, { customerId: 1 }, { status: 1 }, { assignedTo: 1 }
```

#### `subsidy_applications` (Phase 7A)
Government subsidy claims (PM Surya Ghar Muft Bijli Yojana, State Rooftop Subsidy), DBT tracking, and multi-installment disbursement ledger.
```typescript
interface ISubsidyApplication {
  _id: ObjectId;
  applicationNumber: string;      // e.g. "SUB-2026-00001" (unique, indexed)
  projectId: ObjectId;            // Ref -> projects._id (indexed)
  customerId: ObjectId;           // Ref -> customers._id (indexed)
  schemeName: string;             // e.g. "PM_SURYA_GHAR_MUFT_BIJLI_YOJANA"
  schemeVersion?: string;
  effectivePeriod?: {
    startDate?: Date;
    endDate?: Date;
  };
  eligibilityStatus: 'PENDING_VERIFICATION' | 'ELIGIBLE' | 'INELIGIBLE';
  eligibilityNotes?: string;
  verifiedBy?: ObjectId;          // Ref -> users._id
  verifiedAt?: Date;
  nationalPortalApplicationNumber?: string; // e.g. Portal registration ID (sparse unique)
  submissionDate?: Date;
  acknowledgmentNumber?: string;
  estimatedAmountPaise: number;   // Integer paise
  requestedAmountPaise: number;   // Integer paise
  approvedAmountPaise: number;    // Integer paise (must not exceed requestedAmountPaise)
  disbursedAmountPaise: number;   // Integer paise (must not exceed approvedAmountPaise)
  remainingAmountPaise: number;   // Integer paise
  status: 
    | 'ELIGIBLE'
    | 'DOCUMENTS_PENDING'
    | 'READY_TO_APPLY'
    | 'APPLIED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'SANCTIONED'
    | 'DISBURSED'
    | 'REJECTED'
    | 'CANCELLED';
  rejectionReason?: string;
  sanctionReference?: string;
  sanctionDate?: Date;
  disbursements: Array<{
    _id: ObjectId;
    installmentNumber: number;
    amountPaise: number;          // Integer paise
    disbursedAt: Date;
    disbursementMode: 'DIRECT_BENEFIT_TRANSFER' | 'BANK_TRANSFER' | 'CHEQUE' | 'ADJUSTMENT';
    utrNumber?: string;           // Bank transaction UTR
    disbursedToAccount?: {
      accountHolderName?: string;
      accountNumberMasked?: string;
      bankName?: string;
      ifscCode?: string;
    };
    recordedBy: ObjectId;         // Ref -> users._id
    notes?: string;
    idempotencyKey?: string;      // Concurrency duplicate guard (sparse unique)
  }>;
  documentRequirements: Array<{
    documentType: string;
    isMandatory: boolean;
    status: 'REQUIRED' | 'UPLOADED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'RESUBMISSION_REQUIRED';
    storageKey?: string;
    fileName?: string;
    uploadedAt?: Date;
    reviewedBy?: ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;
  }>;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy: ObjectId;
    reason?: string;
    notes?: string;
  }>;
  assignedTo?: ObjectId;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { applicationNumber: 1 } (unique), { nationalPortalApplicationNumber: 1 } (sparse unique), { projectId: 1 }, { customerId: 1 }, { status: 1 }, { 'disbursements.idempotencyKey': 1 } (sparse unique)
```

---

### 3.5 Financial Ledgers & Commercial Records

#### `payments`
Cash collection vouchers and receipts.
```typescript
interface IPayment {
  _id: ObjectId;
  receiptCode: string;          // e.g. "REC-2026-00089" (unique, indexed)
  customerId: ObjectId;          // Ref -> customers._id
  projectId?: ObjectId;          // Ref -> projects._id
  orderId?: ObjectId;            // Ref -> orders._id
  amountPaise: number;           // Integer paise
  paymentDate: Date;
  paymentMode: 'NEFT_RTGS' | 'UPI_IMPS' | 'CHEQUE' | 'ONLINE_GATEWAY' | 'CASH';
  transactionReference: string;  // Unique bank UTR, cheque number, or gateway ID (indexed)
  idempotencyKey: string;        // UUID from client preventing duplicate submission (unique, indexed)
  receivedByUserId: ObjectId;    // Ref -> users._id
  status: 'PENDING_CLEARANCE' | 'CLEARED' | 'BOUNCED' | 'REFUNDED';
  reversalReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { receiptCode: 1 } (unique), { idempotencyKey: 1 } (unique), { transactionReference: 1 }, { customerId: 1 }
```

#### `expenses`
Operational expenditures and project-level cost logging.
```typescript
interface IExpense {
  _id: ObjectId;
  expenseCode: string;          // e.g. "EXP-2026-00215" (unique, indexed)
  category: 'TRAVEL_FUEL' | 'FREIGHT' | 'CRANE' | 'CIVIL_MATERIAL' | 'LABOR_SUBCONTRACT' | 'LIAISON_INSPECTION' | 'CONSUMABLES' | 'GENERAL_OVERHEAD';
  projectId?: ObjectId;          // Ref -> projects._id (null for general overhead)
  amountPaise: number;           // Integer paise
  expenseDate: Date;
  paymentMode: 'COMPANY_CARD' | 'BANK_TRANSFER' | 'PETTY_CASH' | 'EMPLOYEE_REIMBURSE';
  claimedByUserId: ObjectId;     // Ref -> users._id
  vendorId?: ObjectId;           // Ref -> vendors._id
  receiptDocumentId?: ObjectId;  // Ref -> documents._id
  description: string;
  isApproved: boolean;
  approvedByUserId?: ObjectId;   // Ref -> users._id
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { expenseCode: 1 } (unique), { projectId: 1 }, { category: 1 }, { expenseDate: -1 }
```

---

## 4. Concurrency Control & Atomic Transactions

### 4.1 Safe Multi-Location Inventory Allocation
To satisfy the mandatory requirement that **negative stock is strictly blocked** under concurrent conditions, inventory decrement operations never perform read-then-write loops. Instead, they execute atomic conditional writes:

```javascript
// Example: Atomic Stock Decrement with Safe Guard
const result = await InventoryBalance.updateOne(
  {
    productId: targetProductId,
    locationType: 'WAREHOUSE',
    locationId: 'MAIN_DEPOT',
    physicalQuantity: { $gte: requiredQuantity } // Hard guard preventing negative balance
  },
  {
    $inc: { physicalQuantity: -requiredQuantity }
  }
);

if (result.matchedCount === 0) {
  throw new InsufficientStockError(`Insufficient warehouse stock for item ${targetProductId}`);
}
```

### 4.2 Two-Phase Stock Reservation & Issue Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Available: Stock Procured via GRN
    Available --> Reserved: Order Confirmed ($inc reservedQuantity)
    Reserved --> Available: Order Cancelled ($inc reservedQuantity: -qty)
    Reserved --> IssuedToSite: Material Dispatched to Roof ($inc reserved, physical at Depot; $inc at Site)
    IssuedToSite --> Commissioned: Project Handed Over (Stock consumed from site balance)
    Commissioned --> [*]
```

### 4.3 Multi-Document ACID Transactions
Critical multi-entity operations—such as confirming an order (updating order status, creating project record, reserving inventory balances, and logging audit entry)—execute inside a native **MongoDB ClientSession Transaction** with `readConcern: "majority"` and `writeConcern: "majority"`.

### 4.4 Future Inventory Integrity Contract (Phase 3B Baseline)
To ensure absolute accounting and physical traceability across subsequent inventory and supply chain phases, the system establishes the following architectural rules:
1.  **Movement History as Single Source of Truth:** Stock balances are never arbitrarily mutated. Every physical addition, deduction, or relocation must originate from an immutable `StockMovement` ledger entry.
2.  **Location-Scoped Balances:** Balances are strictly scoped by composite key `{ productId, locationType, locationId }`. A product has no monolithic global quantity.
3.  **Serial Number Tracking:** Tier-1 solar hardware (PV modules and solar inverters) requires individual barcode/serial tracking mapped through `SerialNumberTracking` documents to link factory warranties to installation roofs.
4.  **Two-Phase Reservation vs Issue:** Reserving stock for an approved quotation or confirmed order increases `reservedQuantity` without altering `physicalQuantity`. Physical dispatch reduces both depot `physicalQuantity` and `reservedQuantity`, simultaneously creating in-transit or site balance.
5.  **Traceable Transfers:** Inter-warehouse or depot-to-site stock transfers require explicit source and destination locations, tracked through a two-step dispatch and receipt confirmation lifecycle.
6.  **Custody History for Tools & Crews:** Field installation tools and unconsumed materials issued to technicians are maintained in `EMPLOYEE_CUSTODY` warehouse locations, enforcing accountability upon job completion.
7.  **Atomic Negative Stock Prevention:** Stock deductions must use atomic MongoDB conditional updates (`$gte: requiredQuantity`), rejecting requests that would drive physical or available balances below zero.
8.  **Idempotency Protection:** Material transaction requests must include client-supplied or correlation-derived `Idempotency-Key` headers to prevent double-issue or double-receipt upon network retries.
9.  **Immutability of Historical Transactions:** Committed stock movements cannot be updated or deleted. Reconciliation discrepancies require compensating adjustment movements (`ADJUSTMENT_WRITE_OFF` or `COUNT_VARIANCE`).
10. **Non-Destructive Master Lifecycle:** Soft deactivation (`isActive: false`) of products or warehouses preserves historical relational integrity across past quotations, purchase orders, and ledger movements.

#### Proposed Future Inventory Models (Phase 5 Batch)
*   `StockMovement`: Append-only transaction ledger (`movementCode`, `productId`, `sourceLocation`, `destLocation`, `quantity`, `movementType`, `referenceEntityId`, `performedByUserId`, `timestamp`).
*   `StockBalance`: Real-time aggregated location balance (`productId`, `locationType`, `locationId`, `physicalQuantity`, `reservedQuantity`, `updatedAt`).
*   `StockReservation`: Active order allocations (`orderId`, `productId`, `locationId`, `reservedQuantity`, `expiresAt`).
*   `SerialNumberTracking`: Serialized asset lifecycle (`serialNumber`, `productId`, `currentLocationId`, `status: IN_STOCK | ALLOCATED | DISPATCHED | INSTALLED | DEFECTIVE`, `warrantyExpiryDate`).
*   `LocationCustody`: Custodian signoff records for toolkits and materials (`custodianUserId`, `warehouseLocationId`, `issuedAt`, `returnedAt`, `signatureUrl`).

---

## 5. Audit Logging, Data Retention & Unresolved Decisions

### 5.1 Append-Only Audit Logging
All state modifications on critical business records (Quotations, Orders, Invoices, Payments, Inventory) emit structured audit records to `audit_logs` storing:
*   Before and after document deltas.
*   Actor user identity and IP address.
*   Trace correlation ID linking HTTP requests to database changes.

### 5.2 Data Retention & Archival
*   **Active Records:** Retained indefinitely in primary collections for the company's operational lifetime.
*   **Audit Logs:** Hot retention in Atlas for 2 years; automated weekly ETL offloads older logs to compressed S3 Glacier parquet files.
*   **Soft Deletes:** Master entities (Users, Customers, Products, Warehouses) use `isActive: false` flags. Hard deletion is forbidden to preserve historical relational integrity.

### 5.3 Documented Architectural Decisions & Tax Engine Alignment
1.  **Multi-Component Date-Effective Tax Engine (DEC-01):** As mandated in [open-decisions-and-risks.md](file:///d:/My%20project/Solar%20Business%20Management%20Software/docs/planning/open-decisions-and-risks.md), no statutory tax formula, split percentage (such as 70:30), or effective tax rate is hardcoded. Quotations compute estimates using date-effective tax profiles, while legally issued Tax Invoices permanently snapshot applied tax components (CGST, SGST, IGST, cess), HSN/SAC codes, and line-item amounts in base integer paise. Applicable GST treatment must be confirmed by the company's chartered accountant before production use.
2.  **Technician Tool Kit Tracking:** Field technician tools (multimeters, torque wrenches, crimping tools, ladder harnesses) are modeled in `products` with category `TOOL_ASSET` to leverage the established multi-location inventory tracking engine across employee custodianship.

---

## 6. Model Implementation Roadmap & Dependency Plan for All 30 Modules

### 6.1 Status Baseline: Models Implemented in Phase 2, Phase 3A & Phase 3B
*   **`User` (Phase 2):** Internal employee identity, role, department, Argon2id hash, encrypted TOTP MFA secret, session version.
*   **`CustomerIdentity` (Phase 2):** Customer portal passwordless authentication (magic link and OTP hashes).
*   **`PasswordResetToken` (Phase 2):** Single-use employee password reset tokens with MongoDB TTL deletion.
*   **`SecurityAuditLog` (Phase 2):** Append-only security audit events with Mongoose query-level mutation blocking and recursive secret redaction.
*   **`Customer` (Phase 3A):** Business customer record (`customerCode`, name, company, contact details, Indian billing & site addresses, GSTIN/PAN).
*   **`SequenceCounter` (Phase 3A):** Atomic sequence counter store supporting concurrent business number generation (`sequenceKey`, `currentValue`).
*   **`CompanySettings` (Phase 3A):** Organization profile, registered address, fiscal year start month, default numbering prefixes.
*   **`ProductCategory` (Phase 3B):** Hierarchical hardware category model with cycle detection and deactivation constraints.
*   **`Product` (Phase 3B):** Hardware component master catalog with integer paise pricing, normalized case-insensitive SKU uniqueness (`skuNormalized`), and decoupled inventory balance design.
*   **`Warehouse` (Phase 3B):** Multi-location storage model (Central Depot, Transit, Installation Site, Employee Custody) with unique location codes and non-destructive deactivation.

### 6.2 Dependency-Ordered Roadmap for Remaining Modules

| Batch / Phase | Target Module | Proposed Model Name | Main References & Relationships | Critical Indexes | Ownership & Concurrency Rules | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 3B** | Mod 9: Products | `Product`, `ProductCategory` | `categoryId -> ProductCategory` | `skuNormalized` (unique), `productCode` (unique) | Optimistic locking (`__v`); rates in paise; decoupled balances | **Verified & Passing (12/12 Tests)** |
| **Phase 3B** | Mod 10: Inventory Locations | `Warehouse` | None (standalone locations) | `code` (unique), `{ type, isActive }` | Central depot vs site transit vs custody; soft deactivation | **Verified & Passing** |
| **Phase 4** | Mod 2: Leads | `Lead`, `LeadActivity` | `assignedTo -> User`, `customer -> Customer` | `leadNumber` (unique), `phone`, `status` | Role-scoped sales visibility | Planned |
| **Phase 4** | Mod 5: Surveys | `SiteSurvey` | `leadId -> Lead`, `surveyorId -> User` | `surveyNumber` (unique), `leadId` | Surveyor ownership; GPS & shadow photo URLs | Planned |
| **Phase 4** | Mod 6: Solar Design | `SolarDesign` | `surveyId -> SiteSurvey`, `engineerId -> User` | `designCode` (unique), `surveyId` | Versioned CAD layout & monthly kWh estimate | Planned |
| **Phase 4** | Mod 7: Quotations | `Quotation`, `QuotationVersion` | `customerId -> Customer`, `designId -> SolarDesign` | `quotationNumber` (unique), `customerId` | Immutable accepted versions; anti-self discount approval | Planned |
| **Phase 5** | Mod 10: Inventory Balances | `StockBalance`, `StockMovement`, `StockReservation` | `productId -> Product`, `warehouseId -> Warehouse` | `{ productId, warehouseId }` (unique), `movementNumber` | Atomic `$inc` with `$gte` balance guard; append-only ledger | Product, Warehouse, Order |
| **Phase 5** | Mod 11: Purchases | `PurchaseOrder`, `PurchaseInvoice` | `vendorId -> Vendor`, `orderId -> Order` | `poNumber` (unique), `vendorId` | PO approval limit guard (>₹25k requires Admin) | Product, SequenceService |
| **Phase 5** | Mod 12: Vendors | `Vendor` | Standalone supplier directory | `vendorCode` (unique), `gstin` | Procurement department scope | Shared Primitives |
| **Phase 6** | Mod 13: Project Governance | `Project`, `ProjectStage` | `orderId -> Order`, `managerId -> User` | `projectCode` (unique), `orderId` | Linear stage gates; supervisor signoff | Order, SequenceService |
| **Phase 7A** | Mod 15/17: Net Metering | `NetMeteringApplication` | `projectId -> Project`, `customerId -> Customer` | `applicationNumber` (unique), `{ projectId, discomName }` | Utility lifecycle, feasibility, demand note in paise, inspections, meter install | **Verified & Passing (14 Tests)** |
| **Phase 7A** | Mod 16/17: Subsidy Tracking | `SubsidyApplication` | `projectId -> Project`, `customerId -> Customer` | `applicationNumber` (unique), `nationalPortalApplicationNumber` (sparse unique) | Integer paise balance, invariants (disbursed <= approved <= requested), idempotency-keyed disbursement ledger | **Verified & Passing (14 Tests)** |
| **Phase 6** | Mod 17: Documents & Storage | `Document` | `entityId`, `entityType`, `uploadedBy -> User` | `storageKey` (unique), `{ entityType, entityId }` | Private S3 key; short-lived signed URLs | User, Customer |
| **Phase 7** | Mod 18: Invoices & Payments | `Invoice`, `PaymentReceipt`, `CustomerLedgerEntry` | `orderId -> Order`, `customerId -> Customer` | `invoiceNumber` (unique), `receiptNumber` (unique) | Integer paise; append-only running ledger with reversals | Order, SequenceService |
| **Phase 7** | Mod 19: Expenses | `Expense` | `projectId -> Project`, `submittedBy -> User` | `expenseNumber` (unique), `projectId` | Anti-self approval; manager threshold check | Project, SequenceService |
| **Phase 7** | Mod 20: Project Costing | `ProjectCostEstimate`, `ActualCostEntry` | `projectId -> Project` | `projectId` (unique) | Estimated vs realized gross margin calculation | Project, Expense, PurchaseOrder |
| **Phase 7B** | Mod 21: Service Complaints | `ServiceComplaint` | `customerId -> Customer`, `projectId -> Project` | `complaintNumber` (unique), `{ customerId, status }` | Strict state machine (`OPEN` to `CLOSED`); internal vs customer notes; sequence `CMP-YYYY-NNNNN` | **Verified & Passing (14 API Tests + 6 Web Tests)** |
| **Phase 7B** | Mod 22: Warranty & Claims | `ProductSerialNumber` (ext), `WarrantyClaim` | `productId -> Product`, `serialNumberId -> ProductSerialNumber` | `claimNumber` (unique), `serialNumber` | Active warranty bounds; duplicate claim prevention; sequence `CLM-YYYY-NNNNN` | **Verified & Passing (14 API Tests + 6 Web Tests)** |
| **Phase 7B** | Mod 23: AMC Contracts | `AnnualMaintenanceContract` | `customerId -> Customer`, `projectId -> Project` | `amcNumber` (unique), `{ customerId, status }` | Integer paise pricing; atomic visit quota deduction `$expr: { $lt: ['$consumedVisits', '$includedVisits'] }`; sequence `AMC-YYYY-NNNNN` | **Verified & Passing (14 API Tests + 6 Web Tests)** |
| **Phase 7B** | Mod 24: Field Service Visits | `ServiceVisit` | `complaintId -> ServiceComplaint`, `amcId -> AnnualMaintenanceContract`, `assignedTechnicianId -> User` | `visitNumber` (unique), `{ assignedTechnicianId, scheduledDate }` | Checklist execution; parts used; feedback; sequence `VIS-YYYY-NNNNN` | **Verified & Passing (14 API Tests + 6 Web Tests)** |
| **Phase 8** | Mod 25: Teams & Crews | `Team` | `leaderId -> User`, `members -> [User]` | `name` (unique) | Department assignment | User |
| **Phase 8** | Mod 26: Tasks | `Task` | `assignedTo -> User`, `relatedEntityId` | `taskId` (unique), `assignedTo` | Milestone task dependencies & deadlines | User, Project |
| **Phase 9** | Mod 27: Notifications | `Notification`, `NotificationTemplate` | `recipientId -> User/Customer` | `recipientId`, `isRead` | In-app notification center & dispatch logs | User, CustomerIdentity |
| **Phase 9** | Mod 28: Reminders | `Reminder` | `assignedTo -> User`, `relatedEntityId` | `dueDate`, `isCompleted` | Automated background scheduler triggers | User, SequenceService |
| **Phase 10** | Mod 1: Analytics & KPIs | `MetricSnapshot`, `KpiCache` | Aggregated read model | `metricKey`, `snapshotDate` | Background aggregation; read-only KPI dashboards | All Modules |

---

## 7. Phase 7B Database Collection Specifications

### 7.1 `service_complaints`
```typescript
interface IServiceComplaint {
  _id: ObjectId;
  complaintNumber: string;               // Unique: CMP-YYYY-NNNNN
  customerId: ObjectId;                  // Ref: Customer
  projectId: ObjectId;                   // Ref: Project
  orderId?: ObjectId;                    // Ref: SalesOrder
  productId?: ObjectId;                  // Ref: Product
  serialNumber?: string;                 // Asset Serial
  title: string;
  description: string;
  category: ComplaintCategory;           // INVERTER_FAULT, GENERATION_DROP, PHYSICAL_DAMAGE, etc.
  priority: ProjectPriority;             // LOW, MEDIUM, HIGH, CRITICAL
  severity: ComplaintSeverity;           // MINOR, MAJOR, CRITICAL
  status: ComplaintStatus;               // OPEN -> TRIAGED -> ASSIGNED -> VISIT_SCHEDULED -> IN_PROGRESS -> RESOLVED -> CLOSED
  source: ComplaintSource;               // CUSTOMER_PORTAL, PHONE, WHATSAPP, EMAIL, INTERNAL_STAFF
  reportedDate: Date;
  preferredVisitTime?: string;
  contactPreference?: 'PHONE' | 'WHATSAPP' | 'EMAIL';
  assignedTechnicianId?: ObjectId;       // Ref: User
  assignedTeam?: string;
  isWarrantyCovered?: boolean;
  warrantyRecordId?: ObjectId;
  resolutionSummary?: string;
  resolvedBy?: ObjectId;                 // Ref: User
  resolvedAt?: Date;
  reopenReason?: string;
  reopenedAt?: Date;
  reopenedBy?: ObjectId;
  internalNotes?: IComplaintNote[];      // Confidential, stripped from customer portal
  customerUpdates?: ICustomerUpdate[];   // Customer-visible milestones
  attachments?: IComplaintAttachment[];  // Private evidence storage keys
  statusHistory: IComplaintStatusTransition[];
  createdAt: Date;
  updatedAt: Date;
}
// Indexes: { complaintNumber: 1 } (unique), { customerId: 1, status: 1 }, { projectId: 1 }
```

### 7.2 `warranty_claims`
```typescript
interface IWarrantyClaim {
  _id: ObjectId;
  claimNumber: string;                   // Unique: CLM-YYYY-NNNNN
  serialNumberId?: ObjectId;             // Ref: ProductSerialNumber
  serialNumber: string;                  // Asset serial
  productId?: ObjectId;                  // Ref: Product
  projectId?: ObjectId;                  // Ref: Project
  customerId?: ObjectId;                 // Ref: Customer
  complaintId?: ObjectId;                // Ref: ServiceComplaint
  manufacturerName: string;
  supplierWarrantyReference?: string;
  claimType: WarrantyClaimType;          // REPLACEMENT, REPAIR, CREDIT_NOTE
  issueDescription: string;
  status: WarrantyClaimStatus;           // SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PARTS_DISPATCHED, COMPLETED
  decisionNotes?: string;
  decisionDate?: Date;
  decisionBy?: ObjectId;
  replacementSerialNumber?: string;
  replacementDispatchedAt?: Date;
  claimCostPaise?: number;               // Integer Paise
  attachments?: string[];
  history: Array<{ status: string; changedAt: Date; changedBy?: ObjectId; notes?: string }>;
}
// Indexes: { claimNumber: 1 } (unique), { serialNumber: 1, status: 1 }, { complaintId: 1 }
```

### 7.3 `annual_maintenance_contracts`
```typescript
interface IAnnualMaintenanceContract {
  _id: ObjectId;
  amcNumber: string;                     // Unique: AMC-YYYY-NNNNN
  customerId: ObjectId;                  // Ref: Customer
  projectId: ObjectId;                  // Ref: Project
  planType: AmcPlanType;                 // BASIC_PREVENTIVE, COMPREHENSIVE, COMPREHENSIVE_WITH_SPARES
  capacityKwp: number;
  startDate: Date;
  endDate: Date;
  contractAmountPaise: number;           // Integer Paise (e.g. ₹25,000 = 2500000)
  billingCadence: AmcBillingCadence;     // ANNUAL_UPFRONT, SEMI_ANNUAL, QUARTERLY
  paymentStatus: AmcPaymentStatus;       // UNPAID, PARTIALLY_PAID, PAID
  visitCadence: AmcVisitCadence;         // QUARTERLY, TRI_ANNUAL, SEMI_ANNUAL, ANNUAL
  includedVisits: number;
  consumedVisits: number;                // Atomically incremented via $expr guard
  chargeableVisits: number;              // Incremented when included visits are exhausted
  coveredEquipment: IAmcCoveredEquipment[];
  scopeOfWork?: string;
  exclusions?: string;
  slaCommitments?: string;
  status: AmcStatus;                     // DRAFT, PENDING_APPROVAL, ACTIVE, ON_HOLD, EXPIRED, CANCELLED, RENEWED
  approvedBy?: ObjectId;
  approvedAt?: Date;
  cancellationReason?: string;
  previousAmcId?: ObjectId;
  successorAmcId?: ObjectId;
  statusHistory: IAmcStatusTransition[];
}
// Indexes: { amcNumber: 1 } (unique), { customerId: 1, status: 1 }, { projectId: 1 }
```

### 7.4 `service_visits`
```typescript
interface IServiceVisit {
  _id: ObjectId;
  visitNumber: string;                   // Unique: VIS-YYYY-NNNNN
  complaintId?: ObjectId;                // Ref: ServiceComplaint
  amcId?: ObjectId;                      // Ref: AnnualMaintenanceContract
  projectId: ObjectId;                  // Ref: Project
  customerId: ObjectId;                  // Ref: Customer
  assignedTechnicianId?: ObjectId;       // Ref: User
  visitType: ServiceVisitType;           // BREAK_FIX_COMPLAINT, AMC_ROUTINE, WARRANTY_INSPECTION, COMMISSIONING_CHECK
  scheduledDate: Date;
  scheduledTimeSlot?: string;            // e.g. "10:00 AM - 01:00 PM"
  status: ServiceVisitStatus;            // SCHEDULED, DISPATCHED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULED
  purpose: string;
  checklist: Array<{ item: string; completed: boolean; remarks?: string }>;
  observations?: string;
  workPerformed?: string;
  partsUsed?: Array<{ productId?: ObjectId; serialNumber?: string; quantity: number; notes?: string }>;
  customerFeedback?: { rating?: number; comments?: string; signedBy?: string };
  isChargeable: boolean;
  isFollowUpRequired: boolean;
  followUpVisitId?: ObjectId;
  evidenceKeys?: string[];
  statusHistory: Array<{ fromStatus: string; toStatus: string; changedAt: Date; changedBy?: ObjectId; reason?: string }>;
}
// Indexes: { visitNumber: 1 } (unique), { assignedTechnicianId: 1, scheduledDate: 1 }, { complaintId: 1 }, { amcId: 1 }
```

---

## 8. Customer Payments & Operational Receivables Ledger (Phase 8A)

### 8.1 `customer_payments`
```typescript
interface ICustomerPayment {
  _id: ObjectId;
  receiptNumber: string;                 // Unique: REC-YYYY-NNNNN (SequenceService)
  customerId: ObjectId;                  // Ref: Customer
  amountPaise: number;                   // Integer Paise (Positive, e.g. ₹50,000 = 5000000)
  paymentDate: Date;                     // Realization / intake date
  paymentMethod: PaymentMethod;          // BANK_TRANSFER, UPI, CHEQUE, NEFT_RTGS, IMPS, CASH, PAYMENT_GATEWAY, DEMAND_DRAFT
  transactionReference?: string;         // Unique per customer: Bank UTR, Cheque #, Gateway Txn ID
  status: CustomerPaymentStatus;         // RECORDED, VERIFIED, REVERSED, REFUNDED
  allocatedAmountPaise: number;          // Total actively allocated towards Sales Orders
  unallocatedAmountPaise: number;        // Available credit for order allocation or refund
  evidenceKey?: string;                  // Supporting bank deposit slip / screenshot storage key
  notes?: string;                        // Public customer-visible notes
  internalNotes?: string;                // Confidential accounts notes (strictly redacted on portal)
  idempotencyKey?: string;               // Safe replay token
  recordedBy: ObjectId;                  // Ref: User
  verifiedBy?: ObjectId;                 // Ref: User
  verifiedAt?: Date;
  verificationNotes?: string;
  reversedBy?: ObjectId;                 // Ref: User
  reversedAt?: Date;
  reversalReason?: string;
  refundReference?: string;
  refundedAt?: Date;
  refundedBy?: ObjectId;                 // Ref: User
  refundReason?: string;
  refundAmountPaise?: number;
  statusHistory: Array<{
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: ObjectId;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes:
// - { receiptNumber: 1 } (unique)
// - { customerId: 1, transactionReference: 1 } (sparse, unique where transactionReference is set)
// - { idempotencyKey: 1 } (sparse, unique)
// - { customerId: 1, status: 1 }
// - { paymentDate: -1 }
```

### 8.2 `payment_allocations`
```typescript
interface IPaymentAllocation {
  _id: ObjectId;
  allocationNumber: string;              // Unique: ALC-YYYY-NNNNN (SequenceService)
  paymentId: ObjectId;                   // Ref: CustomerPayment
  salesOrderId: ObjectId;                // Ref: SalesOrder
  customerId: ObjectId;                  // Ref: Customer (Enforces non-cross-customer invariant)
  allocatedAmountPaise: number;          // Positive integer paise allocated to order
  allocationDate: Date;
  status: PaymentAllocationStatus;       // ACTIVE, REVERSED
  allocatedBy: ObjectId;                 // Ref: User
  notes?: string;
  reversalReason?: string;
  reversedBy?: ObjectId;                 // Ref: User
  reversedAt?: Date;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes:
// - { allocationNumber: 1 } (unique)
// - { paymentId: 1, status: 1 }
// - { salesOrderId: 1, status: 1 }
// - { customerId: 1 }
// - { idempotencyKey: 1 } (sparse, unique)
```

---

## 9. Expense Management & Project Costing (Phase 8B)

### 9.1 `expenses`
Operational expenses, receipts, manager approval workflows, and disbursement tracking.
```typescript
interface IExpense {
  _id: ObjectId;
  expenseNumber: string;                 // Unique: EXP-YYYY-NNNNN (SequenceService)
  category: ExpenseCategory;             // MATERIALS, SITE_SURVEY, CIVIL_WORK, INSTALLATION_LABOR, LOGISTICS_TRANSPORT, PERMITS_APPROVALS, TOOLS_CONSUMABLES, COMMISSIONING, AMC_SERVICE, TRAVEL_STAY, OFFICE_UTILITIES, MARKETING_SALES, MISCELLANEOUS
  expenseDate: Date;                     // Date expense was incurred
  amountPaise: number;                   // Base amount in integer paise (Positive, e.g. ₹5,000 = 500000)
  taxAmountPaise: number;                // Tax amount in integer paise (>= 0)
  totalAmountPaise: number;              // Total amount in integer paise (amountPaise + taxAmountPaise)
  currency: string;                      // Default "INR"
  description: string;                   // Purpose / detailed narrative
  vendorId?: ObjectId;                   // Optional Ref: Vendor
  payeeName?: string;                    // Free-text payee / recipient name
  projectId?: ObjectId;                  // Optional Ref: Project (Indexed for project costing)
  salesOrderId?: ObjectId;               // Optional Ref: SalesOrder
  paymentMethod: ExpensePaymentMethod;   // CASH, BANK_TRANSFER, UPI, COMPANY_CARD, PETTY_CASH, REIMBURSEMENT
  paymentStatus: ExpensePaymentStatus;   // UNPAID, PAID, PARTIAL
  paidAmountPaise: number;               // Cumulative disbursed amount in integer paise
  paymentDate?: Date;                    // Disbursement date
  paymentReference?: string;             // UTR, Cheque #, transaction ref
  disbursedBy?: ObjectId;                // Ref: User
  status: ExpenseStatus;                 // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED
  requiresApproval: boolean;             // True if amountPaise > companySettings.expenseApprovalThresholdPaise
  submittedBy: ObjectId;                 // Ref: User (Anti-self-approval enforced against approver)
  submittedAt: Date;
  approvedBy?: ObjectId;                 // Ref: User
  approvedAt?: Date;
  approvalNotes?: string;
  rejectedBy?: ObjectId;                 // Ref: User
  rejectedAt?: Date;
  rejectionReason?: string;
  cancelledBy?: ObjectId;                // Ref: User
  cancelledAt?: Date;
  cancellationReason?: string;
  receiptUrl?: string;                   // Evidence storage key or URL
  tags?: string[];
  idempotencyKey?: string;               // Replay prevention token
  statusHistory: Array<{
    fromStatus: string;
    toStatus: string;
    changedAt: Date;
    changedBy: ObjectId;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes:
// - { expenseNumber: 1 } (unique)
// - { idempotencyKey: 1 } (sparse, unique)
// - { projectId: 1, status: 1 }
// - { status: 1, expenseDate: -1 }
// - { category: 1 }
// - { submittedBy: 1 }
```

### 9.2 `project_budgets`
Versioned project cost baselines and category budget limits.
```typescript
interface IProjectBudget {
  _id: ObjectId;
  projectId: ObjectId;                  // Ref: Project (Indexed)
  version: number;                       // Sequential positive integer (1, 2, 3...)
  status: ProjectBudgetStatus;           // DRAFT, APPROVED, SUPERSEDED, REJECTED
  materialsBudgetPaise: number;          // Planned hardware/materials cost in integer paise
  laborBudgetPaise: number;              // Planned installation and field labor cost
  equipmentBudgetPaise: number;          // Planned machinery, crane, and tool rental cost
  permitsBudgetPaise: number;            // Planned DISCOM and statutory approval fees
  logisticsBudgetPaise: number;          // Planned freight and transport cost
  contingencyBudgetPaise: number;        // Planned contingency reserve
  otherBudgetPaise: number;              // Planned miscellaneous cost
  totalBudgetPaise: number;              // Sum of all category planned budgets (integer paise)
  currency: string;                      // Default "INR"
  notes?: string;                        // Revision explanation
  createdBy: ObjectId;                   // Ref: User
  approvedBy?: ObjectId;                 // Ref: User
  approvedAt?: Date;
  approvalNotes?: string;
  effectiveDate: Date;
  supersededByBudgetVersion?: number;    // Links to successor approved version
  createdAt: Date;
  updatedAt: Date;
}
// Indexes:
// - { projectId: 1, version: 1 } (unique)
// - { projectId: 1, status: 1 }
```


