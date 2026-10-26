# INS Solar Business Management Software — Feature Traceability Matrix

**Document Reference:** `INS-REQ-TRM-001`  
**Version:** `1.1.0` (Updated following Independent Phase 0 Review)  
**Status:** Baseline Established — 100% Granular Feature Mapping  
**Convention:** Every single requirement is uniquely identified (`REQ-...`), mapped to its technical dependencies, planned phase, empirical acceptance criteria, required verification test, and lifecycle status (`Not Started`, `Planned`, `Implemented`, `Verified`).

> [!NOTE]
> In accordance with Phase 0 audit standards, all unimplemented features are initially marked **`Planned`**. No feature is marked `Implemented` or `Verified` until code is written, integrated, and empirically tested.

## 1. Summary of Requirements by Phase

| Implementation Phase | Focus Area | Requirements Count | Status Summary |
| :--- | :--- | :---: | :--- |
| **Phase 1** | Foundation, Toolchain, Standard Middleware, Logging, Testing Setup | 5 | Verified (5/5) |
| **Phase 2** | Auth, Sessions, RBAC, MFA, CSRF & Audit Logger | 15 | Verified (15/15) |
| **Phase 3** | Core Database Models, Numbering Engine & Shared Domain Services | 1 | Planned |
| **Phase 4** | CRM Pipeline (Leads, Customers, Surveys, Solar Design, Quotations, PDFs) | 70 | Planned |
| **Phase 5** | Supply Chain & Orders (Orders, Products, Multi-Location Inventory, Procurement, Vendors) | 67 | Planned |
| **Phase 6** | Execution & Field Ops (Projects, Installations, Checklists, Net Metering, Subsidy, Documents) | 58 | Partially Verified (20/58 - Phase 6A & 6B Complete) |
| **Phase 7** | Financial Management (Payments, Expenses, Costing, Profitability, Analytics) | 54 | Planned |
| **Phase 8** | After-Sales & Teams (Employees, Teams, Tasks, Service Tickets, AMC, Visits) | 49 | Planned |
| **Phase 9** | Customer Portal, Notifications, Reminders & System Settings | 27 | Planned |
| **Phase 10** | Full Integration, E2E Testing, Security Hardening, Backup Drills & Production Go-Live | 8 | Planned |
| **Total Requirements** | **100% Granular Feature Coverage** | **354** | **30 Verified, 324 Planned** |

---

## 2. Complete Traceability Register by Module

### Module 1: Dashboard

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD01-01` | Dashboard | Total Leads Metric | Phase 2, Phase 4 | Phase 4 | Displays aggregate count of all leads ever captured; updates on lead creation. | Aggregation query unit test; API integration test. | Planned |
| `REQ-MOD01-02` | Dashboard | New Leads Metric | Phase 4 | Phase 4 | Displays count of leads in New status awaiting qualification or sales assignment. | Integration test verifying count decrements when lead transitions out of New. | Planned |
| `REQ-MOD01-03` | Dashboard | Follow-ups Due & Overdue | Phase 4 | Phase 4 | Summarizes follow-ups due today + overdue count with alert badge indicator. | Date boundary unit test (due <= today and status scheduled). | Planned |
| `REQ-MOD01-04` | Dashboard | Quotations Summary | Phase 4 | Phase 4 | Displays active quotation counts grouped by status (Draft, Sent, Accepted, Expired). | Aggregation pipeline integration test verifying status bucket counts. | Planned |
| `REQ-MOD01-05` | Dashboard | Confirmed Orders Metric | Phase 5 | Phase 5 | Displays count and aggregate monetary value of orders booked in selected period. | Monetary sum calculation unit test. | Planned |
| `REQ-MOD01-06` | Dashboard | Installation Pending Metric | Phase 6 | Phase 6 | Real-time tally of active projects where physical installation is pending or in-progress. | Project stage filter query test. | Planned |
| `REQ-MOD01-07` | Dashboard | Completed Projects Metric | Phase 6 | Phase 6 | Total count of commissioned and handed-over projects with testing sign-off. | Query test verifying Completed status count. | Planned |
| `REQ-MOD01-08` | Dashboard | Payments Inflow Metric | Phase 7 | Phase 7 | Real-time aggregate collections within selected period categorized by payment mode. | Financial aggregation test with integer paise precision. | Planned |
| `REQ-MOD01-09` | Dashboard | Outstanding Receivables Metric | Phase 7 | Phase 7 | Sum of unpaid balances across active projects with 0-15, 16-30, 31-60, >60 day aging. | Receivables aging calculation unit test. | Planned |
| `REQ-MOD01-10` | Dashboard | Monthly Sales Trend Graph | Phase 5, Phase 7 | Phase 7 | Chronological 12-month visualization of booked sales vs cash collection realization. | Monthly time-bucket aggregation API test. | Planned |
| `REQ-MOD01-11` | Dashboard | Interactive Dashboard Filters | Phase 4, Phase 7 | Phase 7 | Global filtering by Date Range, Branch/Location, Solar Topology, and Sales Rep. | E2E component test verifying query sync across widgets. | Planned |

### Module 2: Lead Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD02-01` | Lead Management | Lead ID Generation | Phase 3 | Phase 4 | Sequential format LEAD-YYYY-XXXXX, immutable, unique, zero collision under concurrency. | Concurrency unit test asserting atomic sequence generation. | Verified |
| `REQ-MOD02-02` | Lead Management | Lead Date Capture | Phase 3 | Phase 4 | Timestamp of lead creation recorded automatically with creator identity and origin. | Schema default and audit field test. | Verified |
| `REQ-MOD02-03` | Lead Management | Customer Name Capture | Phase 3 | Phase 4 | Captures primary contact person or legal company name; trimmed and sanitized. | Zod string validation and sanitization test. | Verified |
| `REQ-MOD02-04` | Lead Management | Mobile Number & Duplicate Check | Phase 3 | Phase 4 | E.164 phone validation; flags existing active/closed leads on phone match. | Zod regex test; duplicate detection service query test. | Verified |
| `REQ-MOD02-05` | Lead Management | Location Details | Phase 3 | Phase 4 | Captures installation street, city, district, state, and postal PIN code. | Geographical address schema validation test. | Verified |
| `REQ-MOD02-06` | Lead Management | Lead Source Attribution | Phase 3 | Phase 4 | Captures source (Website, Referral, Expo, Cold Call, Social Media, Channel Partner). | Enum validation test against configured source master. | Verified |
| `REQ-MOD02-07` | Lead Management | Solar Requirement Classification | Phase 3 | Phase 4 | Classifies requirement: Residential, C&I, Agricultural Pump, Storage Retrofit. | Requirement category schema test. | Verified |
| `REQ-MOD02-08` | Lead Management | Estimated Capacity Capture | Phase 3 | Phase 4 | Captures prospect desired capacity in kWp as positive decimal/float. | Positive numeric boundary test. | Verified |
| `REQ-MOD02-09` | Lead Management | Assigned Employee Tracking | Phase 2, Phase 8 | Phase 4 | Assigns lead to sales executive; logs assignment timestamp and notification. | Assignment update test with audit history log. | Verified |
| `REQ-MOD02-10` | Lead Management | Lead Status State Machine | Phase 3 | Phase 4 | States: New -> Contacted -> Survey Scheduled -> Quoted -> Negotiation -> Converted / Lost. Lost requires reason. | Finite state machine transition validator test. | Verified |

### Module 3: Customer Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD03-01` | Customer Management | Customer ID Generation | Phase 3 | Phase 4 | Sequential format CUST-YYYY-XXXXX, immutable, unique across database. | Sequence counter uniqueness test. | Verified |
| `REQ-MOD03-02` | Customer Management | Customer Legal Name | Phase 3 | Phase 4 | Captures full individual name or registered corporate/industrial entity name. | String length and character sanitization test. | Verified |
| `REQ-MOD03-03` | Customer Management | Customer Mobile Numbers | Phase 3 | Phase 4 | Captures primary mobile (indexed, validated) and optional secondary site contact. | E.164 format validation test. | Verified |
| `REQ-MOD03-04` | Customer Management | Customer Email Address | Phase 3 | Phase 4 | Captures validated email address for digital document and quote delivery. | Email regex and RFC 5322 compliance test. | Verified |
| `REQ-MOD03-05` | Customer Management | Permanent Billing Address | Phase 3 | Phase 4 | Captures complete postal address with street, city, state, and 6-digit PIN code. | Address subdocument schema test. | Verified |
| `REQ-MOD03-06` | Customer Management | GSTIN & PAN Identification | Phase 3 | Phase 4 | Validates 15-char Indian GSTIN checksum and 10-char PAN structure. | GSTIN checksum algorithm test and PAN regex test. | Verified |
| `REQ-MOD03-07` | Customer Management | Installation Site Profiles | Phase 3 | Phase 4 | Links physical sites with GPS coordinates, DISCOM division, and consumer number. | Customer-to-Site 1:N relationship integration test. | Planned |
| `REQ-MOD03-08` | Customer Management | Customer Project History | Phase 6 | Phase 6 | Consolidated view of all past, present, and pipeline projects for customer. | Relational projection query test. | Planned |
| `REQ-MOD03-09` | Customer Management | Customer Payment History | Phase 7 | Phase 7 | Complete ledger view of invoices raised, payments received, and running balance. | Financial statement generation test. | Planned |
| `REQ-MOD03-10` | Customer Management | Customer Portal Account Link | Phase 2 | Phase 9 | Links customer master record to portal authentication identity with strict isolation. | Portal user binding and access token verification test. | Planned |

### Module 4: Follow-up Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD04-01` | Follow-up Management | Lead / Customer Relational Link | Phase 4 | Phase 4 | Follow-up record strictly binds to either an active Lead ID or Customer ID. | Polymorphic reference validation test. | Verified |
| `REQ-MOD04-02` | Follow-up Management | Follow-up Interaction Date | Phase 4 | Phase 4 | Records timestamp of when interaction occurred. | Date validation test. | Verified |
| `REQ-MOD04-03` | Follow-up Management | Discussion Narrative Log | Phase 4 | Phase 4 | Captures detailed notes of customer objections, requirements, and budget discussions. | Text field length and markdown sanitization test. | Verified |
| `REQ-MOD04-04` | Follow-up Management | Next Follow-up Scheduling | Phase 4, Phase 9 | Phase 4 | Schedules subsequent date/time; provisions calendar task and reminder. | Reminder provisioning service test. | Verified |
| `REQ-MOD04-05` | Follow-up Management | Assigned Employee Ownership | Phase 4 | Phase 4 | Binds follow-up to accountable sales representative. | User reference integrity test. | Verified |
| `REQ-MOD04-06` | Follow-up Management | Follow-up Status Transition | Phase 4 | Phase 4 | Tracks status: Scheduled, Completed, Rescheduled, or Cancelled. | Status enum transition test. | Verified |
| `REQ-MOD04-07` | Follow-up Management | Qualitative Remarks & Sentiment | Phase 4 | Phase 4 | Records outcome remarks and sentiment tags (Hot, Warm, Cold). | Sentiment tag validation test. | Verified |

### Module 5: Site Survey

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD05-01` | Site Survey | Survey ID Generation | Phase 3 | Phase 4 | Sequential format SRV-YYYY-XXXXX, uniquely allocated. | Sequence generator test. | Verified |
| `REQ-MOD05-02` | Site Survey | Customer & Lead Association | Phase 4 | Phase 4 | Binds survey to target customer and originating lead. | Foreign key integrity test. | Verified |
| `REQ-MOD05-03` | Site Survey | Site Address & Geo-Location | Phase 4 | Phase 4 | Records physical site address with GPS latitude/longitude. | Coordinate range validator test. | Verified |
| `REQ-MOD05-04` | Site Survey | Roof Substrate Classification | Phase 4 | Phase 4 | Classifies roof: RCC Flat, Metal Trapezoidal/Standing Seam, Tile, Ground Mount. | Roof type enum validation test. | Verified |
| `REQ-MOD05-05` | Site Survey | Usable Roof Area Measurement | Phase 4 | Phase 4 | Captures gross and usable shadow-free rooftop surface area (sqm / sqft). | Positive numeric area validation test. | Verified |
| `REQ-MOD05-06` | Site Survey | Electricity Bill Audit | Phase 4 | Phase 4 | Captures monthly consumed units (kWh), tariff category, and historical bill costs. | Numeric unit and tariff validation test. | Verified |
| `REQ-MOD05-07` | Site Survey | Sanctioned Load Verification | Phase 4 | Phase 4 | Records utility sanctioned load (kW/kVA) and phase supply (Single/Three Phase). | Sanctioned load parameter test. | Verified |
| `REQ-MOD05-08` | Site Survey | Shadow Analysis Documentation | Phase 4 | Phase 4 | Documents azimuth, tilt, parapet walls, water tanks, trees, and seasonal shade. | Shadow matrix data schema test. | Verified |
| `REQ-MOD05-09` | Site Survey | Proposed System Capacity | Phase 4 | Phase 4 | Calculates maximum feasible plant capacity (kWp) based on area and load limits. | Sizing boundary calculation test. | Verified |
| `REQ-MOD05-10` | Site Survey | Site Photo Repository | Phase 1, Phase 6 | Phase 6 | Uploads timestamped site photos (roof, DB, meter, earthing pits) to private S3. | Multipart S3 upload integration test. | Planned |
| `REQ-MOD05-11` | Site Survey | Assigned Surveyor Tracking | Phase 4 | Phase 4 | Tracks identity of technical surveyor or engineer conducting site audit. | Employee reference validation test. | Verified |
| `REQ-MOD05-12` | Site Survey | Surveyor Technical Remarks | Phase 4 | Phase 4 | Records structural integrity, waterproofing condition, and cable routing feasibility. | Text remarks schema test. | Verified |

### Module 6: Solar System Design

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD06-01` | Solar System Design | System Capacity Sizing | Phase 3 | Phase 4 | Defines total rated DC capacity in kWp with decimal precision. | Capacity calculation unit test. | Verified |
| `REQ-MOD06-02` | Solar System Design | Solar Panel Quantity | Phase 5 | Phase 4 | Computes panel count: Panel Count = (System Capacity * 1000) / Panel Wattage. | Integer panel count calculation test. | Verified |
| `REQ-MOD06-03` | Solar System Design | Solar Panel Wattage Selection | Phase 5 | Phase 4 | Selects module wattage rating from catalog (e.g. 540Wp, 550Wp, 580Wp TopCon). | Product master lookup test. | Verified |
| `REQ-MOD06-04` | Solar System Design | Inverter Sizing & MPPT Matching | Phase 5 | Phase 4 | Selects inverter capacity (kW), phase (1P/3P), and validates DC:AC ratio (1.1-1.35). | Inverter loading ratio calculation test. | Verified |
| `REQ-MOD06-05` | Solar System Design | Mounting Structure Specification | Phase 5 | Phase 4 | Specifies structure: HDG Aluminum Rail, Elevated Truss, Ballasted, or Sheet Clamps. | Structure specification schema test. | Verified |
| `REQ-MOD06-06` | Solar System Design | Battery Storage Sizing | Phase 5 | Phase 4 | Mandatory for Off-Grid/Hybrid: sizes kWh/Ah capacity, chemistry, and autonomy days. | Storage sizing algorithmic test. | Verified |
| `REQ-MOD06-07` | Solar System Design | DC & AC Cable Sizing | Phase 5 | Phase 4 | Sizes solar DC cable gauge (4/6 sqmm) and AC armored cable based on run length. | Cable voltage-drop sizing test. | Verified |
| `REQ-MOD06-08` | Solar System Design | Balance of System Accessories | Phase 5 | Phase 4 | Compiles ACDB, DCDB, MC4 connectors, earthing rods, lightning arrester into BOM. | BOM item compilation test. | Verified |
| `REQ-MOD06-09` | Solar System Design | Estimated Generation Yield | Phase 3 | Phase 4 | Calculates annual kWh output using regional GHI and specific yield factors. | Solar yield generation model test. | Verified |
| `REQ-MOD06-10` | Solar System Design | Tri-Topology Support | Phase 3 | Phase 4 | First-class calculation and BOM rules for On-Grid, Off-Grid, and Hybrid plants. | Topology-specific validation test suite. | Verified |

### Module 7: Quotation Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD07-01` | Quotation Management | Quotation Number & Revisioning | Phase 3 | Phase 4 | Format QT-YYYY-XXXXX-R0; revisions increment R1, R2 while preserving history. | Revision sequence generation test. | Verified |
| `REQ-MOD07-02` | Quotation Management | Customer & Site Link | Phase 4 | Phase 4 | Associates quotation with customer profile and verified site survey. | Reference integrity test. | Verified |
| `REQ-MOD07-03` | Quotation Management | Contracted System Capacity | Phase 6 | Phase 4 | Binds quotation to engineered plant capacity in kWp. | Capacity parity validation test. | Verified |
| `REQ-MOD07-04` | Quotation Management | Itemized BOM Line Items | Phase 5 | Phase 4 | Captures modules, inverters, structures, electrical BOS, and labor line items. | Line item array schema validation test. | Verified |
| `REQ-MOD07-05` | Quotation Management | Line Item Quantity | Phase 5 | Phase 4 | Enforces positive integer/decimal quantities based on unit of measurement. | Quantity positive boundary test. | Verified |
| `REQ-MOD07-06` | Quotation Management | Unit Selling Rate | Phase 5 | Phase 4 | Captures unit rate in integer paise; calculates line subtotal before taxes. | Integer paise multiplication test. | Verified |
| `REQ-MOD07-07` | Quotation Management | Discount & Approval Threshold | Phase 2 | Phase 4 | Applies discount; discounts exceeding configured threshold require Admin sign-off. | Approval threshold workflow test. | Verified |
| `REQ-MOD07-08` | Quotation Management | Configurable GST Engine | Phase 3 | Phase 4 | Calculates CGST+SGST, IGST, or Non-GST based on date-effective tax profiles. | Centralized tax calculator test suite. | Verified |
| `REQ-MOD07-09` | Quotation Management | Gross Proposal Total | Phase 3 | Phase 4 | Computes Gross Total = Taxable Subtotal + Tax Lines - Approved Discounts in Paise. | Total summation accuracy test. | Verified |
| `REQ-MOD07-10` | Quotation Management | Quotation Validity Period | Phase 3 | Phase 4 | Sets validity expiration date (default 15/30 days); flags expired proposals. | Quotation expiry cron test. | Verified |
| `REQ-MOD07-11` | Quotation Management | Commercial Terms & Conditions | Phase 3 | Phase 4 | Embeds structured legal, warranty, payment milestone, and DISCOM timeline terms. | Terms clause inclusion test. | Verified |
| `REQ-MOD07-12` | Quotation Management | Quotation Lifecycle Status | Phase 3 | Phase 4 | Lifecycle: Draft -> Pending Approval -> Approved -> Sent -> Accepted -> Revised -> Declined -> Expired. | Status state machine transition test. | Verified |

### Module 8: Quotation Sharing

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD08-01` | Quotation Sharing | Server-Side PDF Generation | Phase 1, Phase 7 | Phase 4 | Compiles clean branded proposal PDF with company header, BOM, financials, and terms. | Headless PDF compiler integration test. | Verified |
| `REQ-MOD08-02` | Quotation Sharing | Print-Optimized Layout | Phase 1 | Phase 4 | Provides clean CSS print media stylesheet for branch office hardcopy printing. | Print media CSS smoke test. | Verified |
| `REQ-MOD08-03` | Quotation Sharing | Secure Instant Download | Phase 1, Phase 2 | Phase 4 | Allows authenticated sales staff and customers to download generated PDF proposals. | Authenticated download endpoint test. | Verified |
| `REQ-MOD08-04` | Quotation Sharing | Email Proposal Dispatch | Phase 9 | Phase 4 | Dispatches quotation PDF directly to customer email via configured transactional mailer. | SMTP mailer delivery integration test. | Planned |
| `REQ-MOD08-05` | Quotation Sharing | WhatsApp Template Sharing | Phase 9 | Phase 9 | Dispatches pre-approved WhatsApp notification with secure tokenized document URL. | WhatsApp API service wrapper test. | Planned |
| `REQ-MOD08-06` | Quotation Sharing | Quotation Version History | Phase 7 | Phase 4 | Preserves complete chronological audit log of all quotation revisions and prices. | Revision audit trail immutability test. | Verified |
| `REQ-MOD08-07` | Quotation Sharing | Digital Customer Acceptance | Phase 2 | Phase 4 | Generates secure cryptographic token enabling customer to digitally accept/decline quote. | Cryptographic token acceptance test. | Verified |

### Module 9: Order Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD09-01` | Order Management | Order ID Generation | Phase 3 | Phase 5 | Sequential format ORD-YYYY-XXXXX, uniquely allocated on confirmation. | Order ID sequence uniqueness test. | Verified |
| `REQ-MOD09-02` | Order Management | Customer Master Link | Phase 3 | Phase 5 | Binds sales order to customer master profile. | Customer reference integrity test. | Verified |
| `REQ-MOD09-03` | Order Management | Accepted Quotation Terms Lock | Phase 7 | Phase 5 | Creates immutable snapshot of accepted quotation BOM, pricing, and terms on order. | Immutability test asserting order terms cannot mutate if item rates change. | Verified |
| `REQ-MOD09-04` | Order Management | Order Date Capture | Phase 3 | Phase 5 | Records contract execution date or advance confirmation date. | Order date validation test. | Verified |
| `REQ-MOD09-05` | Order Management | Contracted System Capacity | Phase 6 | Phase 5 | Records contracted solar plant capacity in kWp. | Capacity schema test. | Verified |
| `REQ-MOD09-06` | Order Management | Contracted Order Value | Phase 7 | Phase 5 | Records total agreed order value in integer paise. | Order value monetary precision test. | Verified |
| `REQ-MOD09-07` | Order Management | Advance Payment Tracking | Phase 7 | Phase 5 | Tracks advance payment received toward order booking. | Advance payment ledger balance test. | Planned |
| `REQ-MOD09-08` | Order Management | Outstanding Balance Ledger | Phase 7 | Phase 5 | Dynamically computes Balance = Total Order Value - Cleared Payments in Paise. | Balance calculation assertion test. | Planned |
| `REQ-MOD09-09` | Order Management | Payment Status Classification | Phase 7 | Phase 5 | Classifies status: Advance Pending, Partially Paid, Fully Paid. | Payment status update test. | Planned |
| `REQ-MOD09-10` | Order Management | Installation Status Sync | Phase 6 | Phase 5 | Tracks high-level installation state: Not Started, In Progress, Completed, On Hold. | Installation status sync test. | Planned |
| `REQ-MOD09-11` | Order Management | Automatic Project Creation | Phase 6 | Phase 5 | Atomically instantiates linked Project record upon order confirmation event. | Atomic transaction test verifying Project creation. | Planned |
| `REQ-MOD09-12` | Order Management | Inventory Stock Reservation | Phase 11 | Phase 5 | Places virtual reservation on required BOM inventory items upon order confirmation. | Stock reservation atomic increment test. | Verified |

### Module 10: Product / Item Master

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD10-01` | Product / Item Master | Solar Panels Catalog | Phase 3 | Phase 3B | Manages solar modules (Mono, Bifacial, TopCon, Poly) with wattage and dimensions. | Panel catalog CRUD test. | Verified |
| `REQ-MOD10-02` | Product / Item Master | Inverters Catalog | Phase 3 | Phase 3B | Manages string, hybrid, and micro-inverters with kW rating, phase, and MPPT count. | Inverter catalog CRUD test. | Verified |
| `REQ-MOD10-03` | Product / Item Master | Batteries Catalog | Phase 3 | Phase 3B | Manages battery storage units (LiFePO4, Lead-Acid) with voltage, Ah, and kWh capacity. | Battery catalog CRUD test. | Verified |
| `REQ-MOD10-04` | Product / Item Master | Mounting Structures Catalog | Phase 3 | Phase 3B | Manages mounting structures, rails, clamps, fasteners, and strut channels. | Structure catalog CRUD test. | Verified |
| `REQ-MOD10-05` | Product / Item Master | Cables & Wiring Catalog | Phase 3 | Phase 3B | Manages DC solar cables (4/6 sqmm) and AC armored cables per meter. | Cable catalog CRUD test. | Verified |
| `REQ-MOD10-06` | Product / Item Master | ACDB / DCDB Switchgear Catalog | Phase 3 | Phase 3B | Manages distribution boxes with MCB, SPD, fuse, and isolator specifications. | Switchgear catalog CRUD test. | Verified |
| `REQ-MOD10-07` | Product / Item Master | MC4 Connectors Catalog | Phase 3 | Phase 3B | Manages MC4 male/female connectors and Y-branch branch connectors. | Connector catalog CRUD test. | Verified |
| `REQ-MOD10-08` | Product / Item Master | Earthing & Lightning Protection | Phase 3 | Phase 3B | Manages chemical earthing electrodes, compound bags, GI strips, and arresters. | Earthing catalog CRUD test. | Verified |
| `REQ-MOD10-09` | Product / Item Master | Balance of System Accessories | Phase 3 | Phase 3B | Manages conduits, cable ties, glands, lugs, caution boards, and consumable hardware. | Accessories catalog CRUD test. | Verified |
| `REQ-MOD10-10` | Product / Item Master | Unit of Measurement Enforcement | Phase 3 | Phase 3B | Enforces standard UOM enums (Nos, Sets, Meters, Kg, Pairs) per item. | UOM enum validation test. | Verified |
| `REQ-MOD10-11` | Product / Item Master | Standard Purchase Rate | Phase 3 | Phase 3B | Maintains acquisition cost in integer paise for inventory valuation and costing. | Purchase rate precision test. | Verified |
| `REQ-MOD10-12` | Product / Item Master | Standard Selling Rate | Phase 3 | Phase 3B | Maintains baseline selling price in integer paise for quotation auto-population. | Selling rate precision test. | Verified |
| `REQ-MOD10-13` | Product / Item Master | HSN / SAC Code & Tax Mapping | Phase 3 | Phase 3B | Maps statutory Indian tax codes (HSN/SAC) and default GST rates per item. | HSN format validation test. | Verified |

### Module 11: Inventory Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD11-01` | Inventory Management | Item Master Association | Phase 10 | Phase 5 | Every inventory record strictly binds to an active Product Master ID. | Product foreign key integrity test. | Verified |
| `REQ-MOD11-02` | Inventory Management | Opening Stock Baseline | Phase 3 | Phase 5 | Captures audited opening stock balance at system launch or annual audit. | Opening stock audit ledger test. | Verified |
| `REQ-MOD11-03` | Inventory Management | Stock In via Procurement | Phase 12 | Phase 5 | Increments physical stock atomically upon verified Goods Receipt Note (GRN). | GRN stock increment unit test. | Verified |
| `REQ-MOD11-04` | Inventory Management | Stock Out via Material Dispatch | Phase 9, Phase 14 | Phase 5 | Decrements physical stock atomically upon verified material issue to project site. | Material dispatch decrement test. | Verified |
| `REQ-MOD11-05` | Inventory Management | Used & Damaged Quantity Log | Phase 3 | Phase 5 | Logs damaged, defective, or field-consumed consumables with justification. | Stock write-off adjustment test. | Planned |
| `REQ-MOD11-06` | Inventory Management | Real-Time Available Stock Calculation | Phase 3 | Phase 5 | Calculates Available Stock = Physical on Hand - Reserved Stock. | Available stock balance formula test. | Verified |
| `REQ-MOD11-07` | Inventory Management | Minimum Stock Safety Threshold | Phase 3 | Phase 5 | Configures reorder safety threshold per item to prevent stockouts. | Threshold configuration test. | Planned |
| `REQ-MOD11-08` | Inventory Management | Low Stock Alert Trigger | Phase 9 | Phase 5 | Triggers automated alerts to Storekeeper when Available Stock falls below safety level. | Low stock event dispatcher test. | Planned |
| `REQ-MOD11-09` | Inventory Management | Warehouse Stock Balance | Phase 3 | Phase 5 | Tracks physical stock housed in central company depot. | Depot stock balance ledger test. | Verified |
| `REQ-MOD11-10` | Inventory Management | Installation-Site Stock Balance | Phase 14 | Phase 5 | Tracks staged hardware physically delivered to customer rooftop site. | Site stock balance ledger test. | Planned |
| `REQ-MOD11-11` | Inventory Management | Employee / Team-Issued Stock | Phase 24 | Phase 5 | Tracks tools, consumables, and parts issued into technician custody. | Technician bag balance test. | Planned |
| `REQ-MOD11-12` | Inventory Management | Stock Reservation Lifecycle | Phase 9 | Phase 5 | Reserves stock on Order -> Consumes on Dispatch / Releases on Order Cancel. | Two-phase reservation lifecycle test. | Verified |
| `REQ-MOD11-13` | Inventory Management | Material Issue Slip Authorization | Phase 2 | Phase 5 | Generates formal issue slip requiring storekeeper and technician sign-off. | Material issue authorization test. | Verified |
| `REQ-MOD11-14` | Inventory Management | Anti-Negative Stock Concurrency Guard | Phase 3 | Phase 5 | Blocks material issue if available stock is deficient; atomic update prevents negative stock. | High-concurrency race condition unit test. | Verified |
| `REQ-MOD11-15` | Inventory Management | Hardware Serial Number Tracking | Phase 6, Phase 8 | Phase 5 | Captures module barcodes, inverter serials, and battery BMS IDs on dispatch. | Serial number uniqueness and asset link test. | Verified |

### Module 12: Purchase Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD12-01` | Purchase Management | Purchase Order ID Generation | Phase 3 | Phase 5 | Sequential format PO-YYYY-XXXXX, uniquely allocated. | PO sequence counter test. | Verified |
| `REQ-MOD12-02` | Purchase Management | Vendor Relational Binding | Phase 13 | Phase 5 | Binds purchase order to registered vendor in Vendor Master. | Vendor reference integrity test. | Verified |
| `REQ-MOD12-03` | Purchase Management | Purchase Date Capture | Phase 3 | Phase 5 | Records date of purchase order issuance. | Date schema test. | Verified |
| `REQ-MOD12-04` | Purchase Management | Itemized Hardware Line Items | Phase 10 | Phase 5 | Captures products, specifications, and ordered quantities. | PO line items schema test. | Verified |
| `REQ-MOD12-05` | Purchase Management | Quantity & Unit Ordered | Phase 10 | Phase 5 | Validates positive order quantity against standard UOM. | Positive boundary validation test. | Verified |
| `REQ-MOD12-06` | Purchase Management | Agreed Purchase Unit Rate | Phase 3 | Phase 5 | Records negotiated acquisition unit price in integer paise. | Rate precision test. | Verified |
| `REQ-MOD12-07` | Purchase Management | Input Tax Credit (ITC) GST | Phase 3 | Phase 5 | Calculates applicable purchase GST lines eligible for input tax credit. | Purchase tax calculation test. | Verified |
| `REQ-MOD12-08` | Purchase Management | Gross Purchase Order Total | Phase 3 | Phase 5 | Computes Gross PO Value = Subtotal + Tax Lines in Paise. | PO total summation test. | Verified |
| `REQ-MOD12-09` | Purchase Management | Accounts Payable Status | Phase 7 | Phase 5 | Tracks payment status: Unpaid, Partially Paid, Paid. | Payable status transition test. | Verified |
| `REQ-MOD12-10` | Purchase Management | Purchase Invoice & GRN Verification | Phase 11, Phase 26 | Phase 5 | Uploads vendor tax invoice and creates Goods Receipt Note (GRN) matching items. | Three-way match (PO vs GRN vs Invoice) test. | Verified |
| `REQ-MOD12-11` | Purchase Management | Purchase Approval Hierarchy | Phase 2 | Phase 5 | POs exceeding configured monetary threshold require Admin approval to release. | PO approval threshold gate test. | Verified |

### Module 13: Vendor Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD13-01` | Vendor Management | Vendor Legal Business Name | Phase 3 | Phase 5 | Records legal vendor firm name; validated against duplicates. | Vendor name uniqueness test. | Verified |
| `REQ-MOD13-02` | Vendor Management | Contact Details & Person | Phase 3 | Phase 5 | Captures primary contact representative, phone, and business email. | Contact validation schema test. | Verified |
| `REQ-MOD13-03` | Vendor Management | Registered Business Address | Phase 3 | Phase 5 | Captures vendor billing and warehouse dispatch address. | Address schema test. | Verified |
| `REQ-MOD13-04` | Vendor Management | Vendor GSTIN & PAN | Phase 3 | Phase 5 | Validates 15-char Indian GSTIN and 10-char PAN for purchase tax compliance. | GSTIN checksum and PAN regex test. | Verified |
| `REQ-MOD13-05` | Vendor Management | Products Supplied Mapping | Phase 10 | Phase 5 | Maps approved vendor to supplied component categories (e.g. Tier-1 Panels). | Category mapping relation test. | Verified |
| `REQ-MOD13-06` | Vendor Management | Historical Purchase Orders Log | Phase 12 | Phase 5 | Consolidated view of all historical purchase orders placed with vendor. | Purchase order history query test. | Verified |
| `REQ-MOD13-07` | Vendor Management | Accounts Payable Outstanding | Phase 7 | Phase 5 | Real-time calculation of net balance owed to vendor in integer paise. | Accounts payable balance test. | Verified |
| `REQ-MOD13-08` | Vendor Management | Disbursement Payment History | Phase 7 | Phase 5 | Ledger of bank disbursements, UTR numbers, and payment vouchers issued. | Disbursement ledger query test. | Planned |

### Module 14: Project Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD14-01` | Project Management | Project ID Generation | Phase 3 | Phase 6 | Sequential format PRJ-YYYY-XXXXX, instantiated upon confirmed order. | Project ID generation test. | Verified |
| `REQ-MOD14-02` | Project Management | Customer & Site Link | Phase 3 | Phase 6 | Binds project to customer profile and verified physical site. | Reference integrity test. | Verified |
| `REQ-MOD14-03` | Project Management | Contracted Plant Capacity | Phase 9 | Phase 6 | Records contracted capacity in kWp from originating order. | Capacity consistency test. | Verified |
| `REQ-MOD14-04` | Project Management | Contracted Order Revenue | Phase 9 | Phase 6 | Records contracted revenue in integer paise for budget tracking. | Revenue monetary precision test. | Verified |
| `REQ-MOD14-05` | Project Management | Project Manager Assignment | Phase 2, Phase 24 | Phase 6 | Designates lead project manager accountable for timeline and quality. | PM assignment update test. | Verified |
| `REQ-MOD14-06` | Project Management | Project Start Date Baseline | Phase 3 | Phase 6 | Records baseline project mobilization date. | Date validation test. | Verified |
| `REQ-MOD14-07` | Project Management | Expected Completion Milestone | Phase 3 | Phase 6 | Calculates scheduled commissioning date with delay deviation tracking. | Timeline deviation formula test. | Verified |
| `REQ-MOD14-08` | Project Management | Current Stage Tracking | Phase 3 | Phase 6 | Tracks current stage across the 10 standard installation milestones. | Stage attribute query test. | Verified |
| `REQ-MOD14-09` | Project Management | Overall Project Status | Phase 3 | Phase 6 | High-level status: Planning, In Progress, On Hold, Completed, Cancelled. | Status state machine test. | Verified |
| `REQ-MOD14-10` | Project Management | Ten-Stage Stage-Gate Progression | Phase 3 | Phase 6 | Enforces ordered progression across 10 stages; cannot advance without checklist sign-off. | Stage transition validation guard test. | Verified |

### Module 15: Installation Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD15-01` | Installation Management | Project Relational Binding | Phase 14 | Phase 6 | Binds installation work order directly to active Project record. | Project reference validation test. | Planned |
| `REQ-MOD15-02` | Installation Management | Installation Shift Date | Phase 14 | Phase 6 | Schedules field crew shift and mobilization dates. | Calendar date validator test. | Planned |
| `REQ-MOD15-03` | Installation Management | Field Installation Crew Team | Phase 24 | Phase 6 | Allocates technicians, certified electricians, and scaffolders to site. | Team assignment schema test. | Planned |
| `REQ-MOD15-04` | Installation Management | Panels Installed Verification | Phase 14 | Phase 6 | Logs actual count and string configuration of modules mounted on roof. | Panel mounting count test. | Planned |
| `REQ-MOD15-05` | Installation Management | Inverter Mounted & Terminated | Phase 14 | Phase 6 | Logs inverter mounting, IP protection check, and DC/AC cable terminations. | Inverter mounting log test. | Planned |
| `REQ-MOD15-06` | Installation Management | Mounting Structure Completion | Phase 14 | Phase 6 | Logs torque-checked fasteners, civil foundation curing, and cold galvanizing. | Structure completion sign-off test. | Planned |
| `REQ-MOD15-07` | Installation Management | DC & AC Wiring Execution | Phase 14 | Phase 6 | Logs string cabling in UV conduits, MC4 crimping, and AC trunk wiring. | Wiring progress log test. | Planned |
| `REQ-MOD15-08` | Installation Management | Earthing & LA Pits Resistance | Phase 14 | Phase 6 | Logs earth pit construction and measured earth resistance (< 5 Ohms). | Resistance numeric value validation test. | Planned |
| `REQ-MOD15-09` | Installation Management | Pre-Commissioning Testing | Phase 14 | Phase 6 | Records string Voc, Isc, megger insulation resistance, and grid synchronization. | Electrical test log validation test. | Planned |
| `REQ-MOD15-10` | Installation Management | Field Handover & Completion | Phase 14 | Phase 6 | Field completion sign-off triggering commissioning inspection readiness. | Field handover state transition test. | Planned |

### Module 16: Installation Checklist & QA

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD16-01` | Installation Checklist & QA | Site Preparation Checklist | Phase 15 | Phase 6 | Verifies roof cleaned, obstacles removed, safety lines rigged, hazard signs posted. | Checklist item boolean validation test. | Verified |
| `REQ-MOD16-02` | Installation Checklist & QA | Structure Quality Checklist | Phase 15 | Phase 6 | Verifies anchor torque calibration, tilt angle compliance, structural rigidity. | Structure QA item validation test. | Verified |
| `REQ-MOD16-03` | Installation Checklist & QA | Panel Installation Checklist | Phase 15 | Phase 6 | Verifies zero cell micro-cracks, mid/end clamp positions, alignment tolerances. | Module QA item validation test. | Verified |
| `REQ-MOD16-04` | Installation Checklist & QA | Inverter & Protection Checklist | Phase 15 | Phase 6 | Verifies IP weatherproofing, DC polarity check, AC breaker ratings, SPD status. | Inverter QA item validation test. | Verified |
| `REQ-MOD16-05` | Installation Checklist & QA | AC / DC Wiring Checklist | Phase 15 | Phase 6 | Verifies UV cable conduit support, cable gland dressing, color coding compliance. | Wiring QA item validation test. | Verified |
| `REQ-MOD16-06` | Installation Checklist & QA | Earthing & Lightning Checklist | Phase 15 | Phase 6 | Verifies separate array/inverter/LA earth pits and measured resistance under 5 Ohms. | Earthing QA item validation test. | Verified |
| `REQ-MOD16-07` | Installation Checklist & QA | Safety & Warning Signs Checklist | Phase 15 | Phase 6 | Verifies dual supply caution notices, emergency shut-off labels, rubber mats. | Safety signage checklist test. | Verified |
| `REQ-MOD16-08` | Installation Checklist & QA | Electrical Pre-Commissioning Testing | Phase 15 | Phase 6 | Mandatory capture of string Voc, Isc, and megger insulation test data. | Test readings data completeness test. | Verified |
| `REQ-MOD16-09` | Installation Checklist & QA | Mandatory Geotagged Site Photos | Phase 15, Phase 26 | Phase 6 | Checklist cannot be approved without uploaded timestamped photos for each category. | Checklist submission rejection test if photos missing. | Verified |
| `REQ-MOD16-10` | Installation Checklist & QA | Quality Lead Digital Sign-off | Phase 2 | Phase 6 | Digital approval locks checklist permanently against modifications. | Checklist lock immutability test. | Planned |

### Module 17: Net Metering / Subsidy

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD17-01` | Net Metering / Subsidy | Utility Application Number | Phase 14 | Phase 6 | Records official DISCOM / National Portal application registration ID. | Registration ID schema test. | Planned |
| `REQ-MOD17-02` | Net Metering / Subsidy | Customer & Project Association | Phase 14 | Phase 6 | Binds net metering tracking to Customer profile and Project. | Reference integrity test. | Planned |
| `REQ-MOD17-03` | Net Metering / Subsidy | DISCOM Office Identification | Phase 14 | Phase 6 | Records DISCOM name, circle, division, and local subdivision office. | DISCOM hierarchy schema test. | Planned |
| `REQ-MOD17-04` | Net Metering / Subsidy | Application Submission Date | Phase 14 | Phase 6 | Records date when formal net metering application was filed. | Date validation test. | Planned |
| `REQ-MOD17-05` | Net Metering / Subsidy | Regulatory Document Checklist | Phase 26 | Phase 6 | Verifies upload of Electricity Bill, Single Line Diagram (SLD), and Aadhaar/KYC. | Document completeness checklist test. | Planned |
| `REQ-MOD17-06` | Net Metering / Subsidy | DISCOM Feasibility & Site Inspection | Phase 14 | Phase 6 | Tracks utility inspection date, feasibility approval, and demand note payment. | Milestone progression test. | Planned |
| `REQ-MOD17-07` | Net Metering / Subsidy | Bi-Directional Meter Installation | Phase 14 | Phase 6 | Records net meter work order, meter serial number, testing, and install date. | Meter installation record test. | Planned |
| `REQ-MOD17-08` | Net Metering / Subsidy | Subsidy Application Lifecycle | Phase 14 | Phase 6 | Tracks subsidy: Eligible -> Applied -> Claimed -> Disbursed to Customer -> Rejected. | Subsidy state machine test. | Planned |
| `REQ-MOD17-09` | Net Metering / Subsidy | Liaison Remarks & Action Notes | Phase 14 | Phase 6 | Captures notes on DISCOM officer interactions and demand note status. | Remarks schema test. | Planned |
| `REQ-MOD17-10` | Net Metering / Subsidy | Subsidy Eligibility Verification | Phase 14 | Phase 6 | Verifies rooftop residential ownership and consumer name match against bill. | Eligibility rule validator test. | Planned |
| `REQ-MOD17-11` | Net Metering / Subsidy | DISCOM Escalation Reminders | Phase 29 | Phase 6 | Automated reminders to liaison officer if utility inspection exceeds 15 days. | Scheduled reminder cron test. | Planned |

### Module 18: Payment Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD18-01` | Payment Management | Payment Receipt ID Generation | Phase 3 | Phase 7 | Sequential format REC-YYYY-XXXXX, uniquely allocated. | Receipt sequence counter test. | Planned |
| `REQ-MOD18-02` | Payment Management | Customer Master Binding | Phase 3 | Phase 7 | Binds payment receipt to customer master record. | Customer reference test. | Planned |
| `REQ-MOD18-03` | Payment Management | Project / Order Attribution | Phase 9, Phase 14 | Phase 7 | Allocates payment to specific Project ID or Order ID. | Project allocation test. | Planned |
| `REQ-MOD18-04` | Payment Management | Invoice Reference Link | Phase 7 | Phase 7 | Links payment receipt to Proforma Invoice or Tax Invoice. | Invoice foreign key test. | Planned |
| `REQ-MOD18-05` | Payment Management | Payment Amount in Integer Paise | Phase 3 | Phase 7 | Enforces positive integer paise representation without floating point math. | Positive integer currency test. | Planned |
| `REQ-MOD18-06` | Payment Management | Payment Realization Date | Phase 3 | Phase 7 | Records date when funds were received or cleared in company account. | Date validation test. | Planned |
| `REQ-MOD18-07` | Payment Management | Payment Mode Classification | Phase 3 | Phase 7 | Categorizes mode: NEFT/RTGS, UPI/IMPS, Cheque, Online Gateway, Cash. | Payment mode enum validation test. | Planned |
| `REQ-MOD18-08` | Payment Management | Collector / Received By Identity | Phase 2 | Phase 7 | Records authenticated staff member who logged the transaction. | User reference audit test. | Planned |
| `REQ-MOD18-09` | Payment Management | Running Project Balance | Phase 9 | Phase 7 | Dynamically computes remaining unpaid balance on Project/Order. | Ledger balance formula test. | Planned |
| `REQ-MOD18-10` | Payment Management | Payment Clearance Status | Phase 3 | Phase 7 | Tracks status: Pending Clearance, Cleared, Bounced, Refunded. | Status state machine test. | Planned |
| `REQ-MOD18-11` | Payment Management | Advances & Partial Installments | Phase 9 | Phase 7 | Handles multiple milestone installments against a single order. | Partial payment allocation test. | Planned |
| `REQ-MOD18-12` | Payment Management | Refunds & Reversal Vouchers | Phase 2 | Phase 7 | Requires Admin approval; creates balancing reversal entries without deleting originals. | Immutability reversal audit test. | Planned |
| `REQ-MOD18-13` | Payment Management | Duplicate Submission Prevention | Phase 1 | Phase 7 | Requires client Idempotency-Key and unique bank UTR index; rejects duplicate submissions. | Concurrency duplicate payment rejection test. | Planned |
| `REQ-MOD18-14` | Payment Management | Downloadable Payment Voucher PDF | Phase 1, Phase 8 | Phase 7 | Compiles branded downloadable receipt PDF with transaction UTR and company seal. | Receipt PDF compiler test. | Planned |

### Module 19: Expense Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD19-01` | Expense Management | Expense Incurred Date | Phase 3 | Phase 7 | Records date cost was incurred. | Date schema test. | Planned |
| `REQ-MOD19-02` | Expense Management | Expense Category Classification | Phase 3 | Phase 7 | Classifies category: Travel/Fuel, Freight, Crane, Civil, Labor, Liaison, Consumables. | Category enum validation test. | Planned |
| `REQ-MOD19-03` | Expense Management | Project Attribution vs Overhead | Phase 14 | Phase 7 | Links directly to Project ID or flags as General Company Overhead. | Attribution schema validation test. | Planned |
| `REQ-MOD19-04` | Expense Management | Claimant Employee / Vendor Link | Phase 2, Phase 13 | Phase 7 | Binds expense to employee claiming reimbursement or vendor being paid. | Claimant reference test. | Planned |
| `REQ-MOD19-05` | Expense Management | Expense Description Narrative | Phase 3 | Phase 7 | Detailed business justification for the expenditure. | Text field schema test. | Planned |
| `REQ-MOD19-06` | Expense Management | Expense Amount in Integer Paise | Phase 3 | Phase 7 | Enforces positive integer paise representation. | Numeric currency boundary test. | Planned |
| `REQ-MOD19-07` | Expense Management | Disbursement Payment Mode | Phase 3 | Phase 7 | Categorizes mode: Company Card, Bank Transfer, Petty Cash, Employee Reimbursement. | Disbursement mode enum test. | Planned |
| `REQ-MOD19-08` | Expense Management | Administrative Remarks | Phase 3 | Phase 7 | Internal accounts notes regarding reimbursement status. | Remarks schema test. | Planned |
| `REQ-MOD19-09` | Expense Management | Receipt Voucher Attachment | Phase 26 | Phase 7 | Uploads photo/scan of vendor cash bill or fuel voucher to private S3. | Receipt attachment upload test. | Planned |
| `REQ-MOD19-10` | Expense Management | Tiered Approval Hierarchy | Phase 2 | Phase 7 | Expenses exceeding configured limit (e.g. ₹5,000) require manager approval before payout. | Expense approval workflow test. | Planned |

### Module 20: Project Costing & Profit

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD20-01` | Project Costing & Profit | Landed Solar Panel Cost | Phase 11, Phase 14 | Phase 7 | Aggregates actual landed acquisition cost of modules issued to project in Paise. | Panel cost aggregation test. | Planned |
| `REQ-MOD20-02` | Project Costing & Profit | Landed Inverter Cost | Phase 11, Phase 14 | Phase 7 | Aggregates actual acquisition cost of inverters issued to project in Paise. | Inverter cost aggregation test. | Planned |
| `REQ-MOD20-03` | Project Costing & Profit | Landed Structure Cost | Phase 11, Phase 14 | Phase 7 | Aggregates landed cost of rails, clamps, fasteners, and steel structure in Paise. | Structure cost aggregation test. | Planned |
| `REQ-MOD20-04` | Project Costing & Profit | Subcontractor & Internal Labor | Phase 19 | Phase 7 | Aggregates installation contractor fees and internal labor allocations in Paise. | Labor cost roll-up test. | Planned |
| `REQ-MOD20-05` | Project Costing & Profit | Freight & Staged Logistics Cost | Phase 19 | Phase 7 | Aggregates transport, crane, and loading/unloading costs in Paise. | Logistics cost roll-up test. | Planned |
| `REQ-MOD20-06` | Project Costing & Profit | Installation & Civil Material Cost | Phase 19 | Phase 7 | Aggregates cement, sand, masonry, and civil foundation expenditures in Paise. | Civil expense roll-up test. | Planned |
| `REQ-MOD20-07` | Project Costing & Profit | Other Incidental Project Expenses | Phase 19 | Phase 7 | Sums all approved project-attributed incidentals and liaison fees in Paise. | Incidental cost roll-up test. | Planned |
| `REQ-MOD20-08` | Project Costing & Profit | Total Actual Project Cost | Phase 19 | Phase 7 | Total Cost = Panel + Inverter + Structure + Labor + Freight + Civil + Incidentals. | Total cost formula calculation test. | Planned |
| `REQ-MOD20-09` | Project Costing & Profit | Net Contracted Sale Value | Phase 9 | Phase 7 | Extracts contracted sale value (excluding net tax pass-throughs) in Paise. | Sale value extraction test. | Planned |
| `REQ-MOD20-10` | Project Costing & Profit | Gross Profit & Margin Percentage | Phase 7 | Phase 7 | Computes Profit = Sale Value - Total Cost; Margin % = (Profit / Sale Value) * 100. | Margin percentage calculation test. | Planned |
| `REQ-MOD20-11` | Project Costing & Profit | Estimated vs Actual Cost Variance | Phase 7 | Phase 7 | Compares estimated quotation BOM cost against actual landed execution cost; flags variance. | Cost variance formula and alert test. | Planned |

### Module 21: Service / Complaint Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD21-01` | Service / Complaint Management | Complaint Ticket ID Generation | Phase 3 | Phase 8 | Sequential format TKT-YYYY-XXXXX, uniquely allocated. | Ticket sequence counter test. | Planned |
| `REQ-MOD21-02` | Service / Complaint Management | Customer Master Association | Phase 3 | Phase 8 | Binds ticket to customer profile. | Customer reference test. | Planned |
| `REQ-MOD21-03` | Service / Complaint Management | Installed Solar Plant Link | Phase 14 | Phase 8 | Associates ticket with specific installed solar plant and serial numbers. | Asset link reference test. | Planned |
| `REQ-MOD21-04` | Service / Complaint Management | Complaint Intake Date | Phase 3 | Phase 8 | Records timestamp when defect was reported. | Date validation test. | Planned |
| `REQ-MOD21-05` | Service / Complaint Management | Issue Category Classification | Phase 3 | Phase 8 | Classifies fault: Inverter Error, Zero Generation, Glass Damage, Leakage, Meter Fault. | Issue category schema test. | Planned |
| `REQ-MOD21-06` | Service / Complaint Management | Assigned Service Technician | Phase 24 | Phase 8 | Dispatches accountable technician to investigate and resolve. | Technician assignment test. | Planned |
| `REQ-MOD21-07` | Service / Complaint Management | Scheduled Site Visit Date | Phase 3 | Phase 8 | Schedules customer appointment date with SLA countdown. | SLA countdown calculation test. | Planned |
| `REQ-MOD21-08` | Service / Complaint Management | Root Cause & Technical Resolution | Phase 3 | Phase 8 | Documents diagnostic findings, corrective action, and test readings. | Resolution report schema test. | Planned |
| `REQ-MOD21-09` | Service / Complaint Management | Replacement Parts Consumed | Phase 11 | Phase 8 | Tracks inventory parts used for repairs; decrements stock and flags warranty/billable. | Inventory decrement on repair test. | Planned |
| `REQ-MOD21-10` | Service / Complaint Management | Ticket Resolution & Customer Sign-off | Phase 2 | Phase 8 | Captures customer digital signature or OTP verification prior to ticket closure. | Ticket closure verification test. | Planned |
| `REQ-MOD21-11` | Service / Complaint Management | Hardware Warranty Verification | Phase 11 | Phase 8 | Verifies active manufacturer/installation warranty against component serial numbers. | Warranty status check test. | Planned |

### Module 22: AMC Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD22-01` | AMC Management | AMC Contract ID Generation | Phase 3 | Phase 8 | Sequential format AMC-YYYY-XXXXX, uniquely allocated. | AMC sequence counter test. | Planned |
| `REQ-MOD22-02` | AMC Management | Customer Master Link | Phase 3 | Phase 8 | Binds AMC contract to customer master record. | Customer reference test. | Planned |
| `REQ-MOD22-03` | AMC Management | System Capacity under Contract | Phase 14 | Phase 8 | Records covered solar plant capacity in kWp. | Capacity consistency test. | Planned |
| `REQ-MOD22-04` | AMC Management | Contract Start Date | Phase 3 | Phase 8 | Records date when maintenance coverage commences. | Date schema test. | Planned |
| `REQ-MOD22-05` | AMC Management | Contract End Date | Phase 3 | Phase 8 | Records coverage expiration date (1, 3, or 5 year terms). | Validity date range test. | Planned |
| `REQ-MOD22-06` | AMC Management | AMC Fee & Billing Cadence | Phase 7 | Phase 8 | Records annual fee in integer paise and billing schedule (Annual, Semi-Annual, Quarterly). | Fee monetary precision test. | Planned |
| `REQ-MOD22-07` | AMC Management | Agreed Service Frequency | Phase 3 | Phase 8 | Defines visit cadence (e.g. Quarterly - 4 visits/yr; Bi-Monthly - 6 visits/yr). | Visit frequency enum test. | Planned |
| `REQ-MOD22-08` | AMC Management | Next Scheduled Service Date | Phase 23 | Phase 8 | Dynamically calculates and displays upcoming scheduled visit date. | Next visit date calculation test. | Planned |
| `REQ-MOD22-09` | AMC Management | Contract Lifecycle Status | Phase 3 | Phase 8 | Tracks status: Active, Expiring Soon, Expired, Renewed, Terminated. | AMC status state machine test. | Planned |
| `REQ-MOD22-10` | AMC Management | Automated Renewal Alerts | Phase 29 | Phase 8 | Automated alerts to AMC sales coordinator 30 days and 15 days prior to expiration. | AMC expiry cron test. | Planned |

### Module 23: Service Visit Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD23-01` | Service Visit Management | Customer Master Link | Phase 3 | Phase 8 | Binds visit to customer profile. | Customer reference test. | Planned |
| `REQ-MOD23-02` | Service Visit Management | Installed System Association | Phase 14 | Phase 8 | Binds visit to specific plant asset and AMC contract. | System reference test. | Planned |
| `REQ-MOD23-03` | Service Visit Management | Service Visit Execution Date | Phase 3 | Phase 8 | Records date when physical maintenance was performed. | Date validation test. | Planned |
| `REQ-MOD23-04` | Service Visit Management | Assigned Lead Technician | Phase 24 | Phase 8 | Records technician conducting inspection. | Technician reference test. | Planned |
| `REQ-MOD23-05` | Service Visit Management | Generation Status & Meter Reading | Phase 3 | Phase 8 | Records cumulative kWh generation reading and instantaneous kW output. | Meter reading numeric test. | Planned |
| `REQ-MOD23-06` | Service Visit Management | Module Soiling & Physical Condition | Phase 3 | Phase 8 | Inspects module surfaces: soiling, hotspots, glass damage, frame integrity. | Module inspection schema test. | Planned |
| `REQ-MOD23-07` | Service Visit Management | Inverter Operating Status | Phase 3 | Phase 8 | Checks heatsink temp, fault logs, cooling fans, and DC/AC voltages. | Inverter inspection schema test. | Planned |
| `REQ-MOD23-08` | Service Visit Management | Cleaning Verification Sign-off | Phase 3 | Phase 8 | Confirms module washing completed with water quality and method logged. | Cleaning verification boolean test. | Planned |
| `REQ-MOD23-09` | Service Visit Management | Issues Found & Preventative Actions | Phase 3 | Phase 8 | Documents identified defects, clamp re-torquing, and earthing pit watering. | Findings narrative schema test. | Planned |
| `REQ-MOD23-10` | Service Visit Management | Digital Service Report & Sign-off | Phase 8 | Phase 8 | Compiles field service report PDF with technician notes and customer signature. | Field service report generation test. | Planned |

### Module 24: Employee & Team Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD24-01` | Employee & Team Management | Employee Legal Name | Phase 2 | Phase 8 | Captures full name and unique employee code EMP-XXXX. | Employee code uniqueness test. | Planned |
| `REQ-MOD24-02` | Employee & Team Management | Designation & Hierarchy | Phase 2 | Phase 8 | Captures corporate designation and reporting line. | Designation schema test. | Planned |
| `REQ-MOD24-03` | Employee & Team Management | Mobile & Contact Information | Phase 2 | Phase 8 | Captures E.164 phone, official email, and emergency contact details. | Contact validation schema test. | Planned |
| `REQ-MOD24-04` | Employee & Team Management | Operating Department Assignment | Phase 2 | Phase 8 | Assigns employee to Admin, Sales, Ops, Accounts, Service, or Inventory. | Department enum validation test. | Planned |
| `REQ-MOD24-05` | Employee & Team Management | Assigned Leads Workload | Phase 4 | Phase 8 | Dashboard visibility into active assigned leads and pipeline volume. | Workload query aggregation test. | Planned |
| `REQ-MOD24-06` | Employee & Team Management | Assigned Projects Workload | Phase 14 | Phase 8 | Dashboard visibility into active installations managed by employee. | Project workload query test. | Planned |
| `REQ-MOD24-07` | Employee & Team Management | Attendance & Availability Status | Phase 3 | Phase 8 | Tracks availability (Active, On Site, On Leave) to prevent task assignment conflicts. | Availability guard test. | Planned |
| `REQ-MOD24-08` | Employee & Team Management | Employee Performance Metrics | Phase 27 | Phase 8 | Calculates leads converted, surveys completed within SLA, and projects delivered. | Performance KPI formula test. | Planned |
| `REQ-MOD24-09` | Employee & Team Management | Field Installation Team Grouping | Phase 15 | Phase 8 | Assembles technicians into specialized crews (e.g. Structure Crew, Electrical Crew). | Crew composition relationship test. | Planned |

### Module 25: Task Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD25-01` | Task Management | Task Title & Description | Phase 3 | Phase 8 | Captures clear operational deliverable with narrative description. | Task schema validation test. | Planned |
| `REQ-MOD25-02` | Task Management | Assigned Employee Accountability | Phase 24 | Phase 8 | Binds task execution to designated employee. | User assignment test. | Planned |
| `REQ-MOD25-03` | Task Management | Relational Project / Lead Link | Phase 4, Phase 14 | Phase 8 | Links task directly to a Lead, Customer, Project, or Purchase Order. | Contextual reference integrity test. | Planned |
| `REQ-MOD25-04` | Task Management | Priority Matrix Classification | Phase 3 | Phase 8 | Classifies priority: Low, Medium, High, Urgent. | Priority enum test. | Planned |
| `REQ-MOD25-05` | Task Management | Task Start Date Baseline | Phase 3 | Phase 8 | Records scheduled mobilization date. | Start date validation test. | Planned |
| `REQ-MOD25-06` | Task Management | Task Due Date & Countdown | Phase 3 | Phase 8 | Sets deadline with automated countdown indicator. | Due date boundary test. | Planned |
| `REQ-MOD25-07` | Task Management | Kanban Workflow Status | Phase 3 | Phase 8 | Transitions across: To Do -> In Progress -> Under Review -> Completed. | Kanban state transition test. | Planned |
| `REQ-MOD25-08` | Task Management | Remarks & Activity Comment Thread | Phase 3 | Phase 8 | Supports internal comments and file attachments. | Comment append test. | Planned |
| `REQ-MOD25-09` | Task Management | Overdue Task Escalation | Phase 29 | Phase 8 | Triggers escalation notification to department head when task passes due date. | Overdue task escalation cron test. | Planned |

### Module 26: Document Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD26-01` | Document Management | Customer Documents Category | Phase 3 | Phase 6 | Categorizes KYC, application forms, and customer letters. | Document categorization test. | Planned |
| `REQ-MOD26-02` | Document Management | Government ID Proof Storage | Phase 3 | Phase 6 | Uploads Aadhaar, PAN, Voter ID with MIME validation and checksum hashing. | File MIME type validation test. | Planned |
| `REQ-MOD26-03` | Document Management | Electricity Utility Bill Storage | Phase 3 | Phase 6 | Stores historical electricity bills linked to Site Survey. | Electricity bill document test. | Planned |
| `REQ-MOD26-04` | Document Management | Property & Roof Ownership Deeds | Phase 3 | Phase 6 | Stores property tax receipts and roof lease agreements. | Property document link test. | Planned |
| `REQ-MOD26-05` | Document Management | Quotation Proposal Archives | Phase 8 | Phase 6 | Stores generated and signed proposal PDFs. | Quotation document archive test. | Planned |
| `REQ-MOD26-06` | Document Management | Signed EPC Legal Agreement | Phase 9 | Phase 6 | Stores formal signed turnkey contracts and work orders. | Legal agreement upload test. | Planned |
| `REQ-MOD26-07` | Document Management | Installation Quality Documentation | Phase 16 | Phase 6 | Stores checklist sign-offs, megger reports, and SLD drawings. | Installation documentation test. | Planned |
| `REQ-MOD26-08` | Document Management | Hardware Warranty Certificates | Phase 10 | Phase 6 | Stores module 25-yr and inverter 5/10-yr warranty cards. | Warranty document association test. | Planned |
| `REQ-MOD26-09` | Document Management | Private Object Storage Architecture | Phase 1 | Phase 6 | Enforces private S3 bucket storage with zero direct public HTTP access. | S3 bucket private policy check test. | Planned |
| `REQ-MOD26-10` | Document Management | Short-Lived Signed URL Access | Phase 2 | Phase 6 | Issues pre-signed URLs with TTL <= 15 min only to verified authenticated sessions. | Pre-signed URL expiry security test. | Planned |

### Module 27: Reports & Analytics

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD27-01` | Reports & Analytics | Lead Pipeline Funnel Report | Phase 4 | Phase 7 | Analyzes conversion rates, stage drop-offs, and source ROI. | Lead funnel aggregation pipeline test. | Planned |
| `REQ-MOD27-02` | Reports & Analytics | Booked Sales Performance Report | Phase 5 | Phase 7 | Analyzes booked sales by rep, branch, and topology (On-Grid vs Off-Grid vs Hybrid). | Sales aggregation query test. | Planned |
| `REQ-MOD27-03` | Reports & Analytics | Quotation Conversion & Discount Report | Phase 7 | Phase 7 | Analyzes quote win/loss ratio, turnaround time, and discount distribution. | Quotation report aggregation test. | Planned |
| `REQ-MOD27-04` | Reports & Analytics | Installation Cycle Time Report | Phase 14 | Phase 7 | Analyzes days taken per installation stage and bottleneck delays. | Cycle time aggregation query test. | Planned |
| `REQ-MOD27-05` | Reports & Analytics | Inventory Valuation & Velocity Report | Phase 11 | Phase 7 | Computes landed stock valuation and categorizes fast vs slow moving items. | Stock valuation calculation test. | Planned |
| `REQ-MOD27-06` | Reports & Analytics | Payment Cash Collection Report | Phase 18 | Phase 7 | Cash inflow ledger broken down by payment mode and bank accounts. | Payment collection aggregation test. | Planned |
| `REQ-MOD27-07` | Reports & Analytics | Project Expense & Overhead Report | Phase 19 | Phase 7 | Categorized operational expense report across projects and company overhead. | Expense report aggregation test. | Planned |
| `REQ-MOD27-08` | Reports & Analytics | Project Gross Profitability Report | Phase 20 | Phase 7 | Project-by-project gross profit and margin variance against estimates. | Profitability report calculation test. | Planned |
| `REQ-MOD27-09` | Reports & Analytics | AMC Contract & Service Compliance | Phase 22 | Phase 7 | Tracks active AMC revenue, preventive visit compliance rate, and renewal rates. | AMC analytics calculation test. | Planned |
| `REQ-MOD27-10` | Reports & Analytics | Streaming Multi-Format Export Engine | Phase 1 | Phase 7 | Streams report data into formatted CSV, Excel (.xlsx), and printable PDF. | Export format encoding and stream test. | Planned |

### Module 28: User & Role Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD28-01` | User & Role Management | Admin / Superadmin Role Scope | Phase 2 | Phase 2 | Unrestricted operational, financial, configuration, and audit access. | Verified in `security.test.ts` (Scenario 9 & 15). | Verified |
| `REQ-MOD28-02` | User & Role Management | Sales Executive Role Scope | Phase 2 | Phase 2 | Restricted to Leads, Follow-ups, Customers, Surveys, and Quotations. | Verified in `auth.test.ts` & `security.test.ts` (Scenario 9). | Verified |
| `REQ-MOD28-03` | User & Role Management | Surveyor Role Scope | Phase 2 | Phase 2 | Restricted to assigned Site Surveys, roof assessments, and photo uploads. | Verified in `auth.test.ts` role mappings. | Verified |
| `REQ-MOD28-04` | User & Role Management | Installation Team Role Scope | Phase 2 | Phase 2 | Restricted to Active Projects, Installation Checklists, and site logs. | Verified in `auth.test.ts` role mappings. | Verified |
| `REQ-MOD28-05` | User & Role Management | Accounts Officer Role Scope | Phase 2 | Phase 2 | Restricted to Invoicing, Payments, Expenses, Purchase Orders, and Costing. | Verified in `auth.test.ts` & `security.test.ts` (Scenario 8). | Verified |
| `REQ-MOD28-06` | User & Role Management | Service Technician Role Scope | Phase 2 | Phase 2 | Restricted to Break-fix Complaints, AMC Contracts, and Service Visits. | Verified in `auth.test.ts` role mappings. | Verified |
| `REQ-MOD28-07` | User & Role Management | Granular Permissions Engine | Phase 2 | Phase 2 | Enforces resource:action tokens (e.g. quote:discount_approve, inv:adjust). | Verified in `security.test.ts` (Scenario 9). | Verified |
| `REQ-MOD28-08` | User & Role Management | Module Access Control Matrix | Phase 2 | Phase 2 | Server-side enforcement of panel and module route access. | Verified in `security.test.ts` (Scenarios 1, 8, 9). | Verified |
| `REQ-MOD28-09` | User & Role Management | Department Head Supervisory Scope | Phase 2 | Phase 2 | Department managers can view and authorize records across their entire team. | Verified in `security.test.ts` (Scenario 17). | Verified |
| `REQ-MOD28-10` | User & Role Management | Custom Permission Overrides | Phase 2 | Phase 2 | Allows assigning ad-hoc permissions to specific individual employees. | Verified in `security.test.ts` (Scenario 9). | Verified |
| `REQ-MOD28-11` | User & Role Management | Employee Deactivation Kill-Switch | Phase 2 | Phase 2 | Deactivating employee flag immediately blocks authentication. | Verified in `security.test.ts` (Scenario 4). | Verified |
| `REQ-MOD28-12` | User & Role Management | Instant Global Session Revocation | Phase 2 | Phase 2 | Deactivation or password reset immediately deletes all active session records. | Verified in `security.test.ts` (Scenarios 3, 4, 13). | Verified |
| `REQ-MOD28-13` | User & Role Management | Privileged User MFA (TOTP) | Phase 2 | Phase 2 | Mandatory RFC 6238 TOTP 2FA for Admin and Accounts roles with recovery codes. | Verified in `security.test.ts` (Scenario 8) & `crypto.test.ts`. | Verified |

### Module 29: Notification & Reminders Engine

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD29-01` | Notification & Reminders Engine | Follow-up Schedule Reminder | Phase 4 | Phase 9 | Dispatches reminder to sales executive 2 hours before scheduled customer call. | Follow-up reminder cron test. | Planned |
| `REQ-MOD29-02` | Notification & Reminders Engine | Payment Milestone Due Reminder | Phase 18 | Phase 9 | Dispatches alert 3 days prior to payment due date and weekly on overdue balances. | Payment reminder event test. | Planned |
| `REQ-MOD29-03` | Notification & Reminders Engine | Installation Stalled Stage Reminder | Phase 14 | Phase 9 | Daily digest to Project Managers highlighting projects stalled over 5 days in a stage. | Stalled stage alert cron test. | Planned |
| `REQ-MOD29-04` | Notification & Reminders Engine | AMC Contract Expiry Reminder | Phase 22 | Phase 9 | Automated alerts 30 days and 15 days prior to maintenance contract expiration. | AMC expiry alert test. | Planned |
| `REQ-MOD29-05` | Notification & Reminders Engine | Service Visit Due Reminder | Phase 23 | Phase 9 | Alerts service coordinator 3 days prior to scheduled quarterly cleaning visit. | Service due reminder test. | Planned |
| `REQ-MOD29-06` | Notification & Reminders Engine | Low Stock Threshold Alert | Phase 11 | Phase 9 | Instant alert dispatched to Storekeeper when item stock breaches safety minimum. | Low stock event listener test. | Planned |
| `REQ-MOD29-07` | Notification & Reminders Engine | In-App Real-time Notification Center | Phase 1 | Phase 9 | Dropdown notification center with unread counters, mark-as-read, and deep links. | Notification API and state test. | Planned |
| `REQ-MOD29-08` | Notification & Reminders Engine | Transactional HTML Email Dispatcher | Phase 1 | Phase 9 | Dispatches responsive HTML emails for quotes, milestones, and payment vouchers. | Transactional mailer delivery test. | Planned |
| `REQ-MOD29-09` | Notification & Reminders Engine | Configurable WhatsApp Webhook / API | Phase 1 | Phase 9 | Integrates with third-party WhatsApp provider to dispatch pre-approved templates. | WhatsApp provider adapter mock test. | Planned |

### Module 30: Settings & Master Data Management

| Req ID | Module / Area | Exact Feature / Business Rule | Dependencies | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD30-01` | Settings & Master Data Management | Solar Brand Masters | Phase 3 | Phase 9 | Manages approved brands for Solar Panels, Inverters, and Batteries. | Brand master CRUD test. | Planned |
| `REQ-MOD30-02` | Settings & Master Data Management | Solar Panel Types Master | Phase 3 | Phase 9 | Manages panel technology types (Mono PERC, TopCon, Bifacial, Poly). | Panel types master test. | Planned |
| `REQ-MOD30-03` | Settings & Master Data Management | Inverter Types & Models Master | Phase 3 | Phase 9 | Manages inverter topologies (String, Hybrid, Micro) and phase ratings. | Inverter master test. | Planned |
| `REQ-MOD30-04` | Settings & Master Data Management | System Capacity Brackets Master | Phase 3 | Phase 9 | Manages standard turnkey capacity offerings (3kW, 5kW, 8kW, 10kW, etc.). | Capacity brackets master test. | Planned |
| `REQ-MOD30-05` | Settings & Master Data Management | Turnkey Pricing Rate Cards | Phase 3 | Phase 9 | Manages base turnkey rates per watt peak (₹/Wp) by capacity and topology. | Rate card lookup unit test. | Planned |
| `REQ-MOD30-06` | Settings & Master Data Management | GST & Tax Configuration Master | Phase 3 | Phase 9 | Maintains date-effective tax profiles, HSN codes, and tax components (CGST/SGST/IGST). | Tax settings schema and audit test. | Planned |
| `REQ-MOD30-07` | Settings & Master Data Management | Lead Sources Master | Phase 3 | Phase 9 | Configures dropdown values for marketing lead intake channels. | Lead source master test. | Planned |
| `REQ-MOD30-08` | Settings & Master Data Management | Service & Maintenance Types Master | Phase 3 | Phase 9 | Configures breakdown ticket categories and AMC visit scopes. | Service types master test. | Planned |
| `REQ-MOD30-09` | Settings & Master Data Management | Payment Modes Master | Phase 3 | Phase 9 | Configures accepted payment modes and company collection accounts. | Payment modes master test. | Planned |
| `REQ-MOD30-10` | Settings & Master Data Management | Company Profile & Letterhead | Phase 3 | Phase 9 | Manages corporate legal name, CIN, GSTIN, PAN, bank accounts, and letterhead logo. | Company profile API test. | Planned |
| `REQ-MOD30-11` | Settings & Master Data Management | Document Numbering Sequences | Phase 3 | Phase 9 | Configures prefix, year format, and padding for quotes, orders, invoices, receipts. | Sequence formatting helper test. | Planned |
| `REQ-MOD30-12` | Settings & Master Data Management | Corporate Policy & Approval Limits | Phase 2 | Phase 9 | Configures max discount %, expense auto-approval limit, PO limit, and validity days. | Policy limits enforcement test. | Planned |

---

## 3. Role-Based Panels & Customer Portal Matrix

| Req ID | Panel Name | Target Scope / Roles | Planned Phase | Acceptance Criteria | Required Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-PNL-01` | Admin Panel Scope | Admin Panel | Phase 10 | Unrestricted access to Executive Dashboard, CRM, Operations, Accounts, HR, and Settings. | Admin route guard and RBAC access test. | Planned |
| `REQ-PNL-02` | Sales Panel Scope | Sales Panel | Phase 10 | Restricted to Leads, Follow-ups, Customers, Surveys, System Design, and Quotations. | Sales route guard blocking Accounts/Inventory. | Planned |
| `REQ-PNL-03` | Installation Panel Scope | Installation Panel | Phase 10 | Restricted to Active Projects, Installation Stages, Checklists, Photos, and Handover. | Installation route guard blocking CRM/Finance. | Planned |
| `REQ-PNL-04` | Accounts Panel Scope | Accounts Panel | Phase 10 | Restricted to Payments, Expenses, Purchase Orders, Vendor Payables, and Project Costing. | Accounts route guard blocking operational configs. | Planned |
| `REQ-PNL-05` | Service Panel Scope | Service Panel | Phase 10 | Restricted to Break-fix Complaints, AMC Contracts, and Scheduled Service Visits. | Service route guard blocking sales/purchases. | Planned |
| `REQ-PNL-06` | Inventory Panel Scope | Inventory Panel | Phase 10 | Restricted to Item Master, Multi-Location Stock, GRN Receipts, Issuances, and Stock Alerts. | Inventory route guard verifying stock isolation. | Planned |
| `REQ-PNL-07` | Secure Customer Portal Scope | Secure Customer Portal | Phase 9 | External portal for customers: view project milestones, download quotes, upload KYC, view receipts. | Security test verifying strict customer data isolation. | Planned |

---

## 4. Confirmed Business Decisions Traceability

| Req ID | Business Rule | System Architecture & Implementation Impact | Planned Phase | Verification Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-BIZ-01` | Single-Company Enterprise System | Dedicated database schema for INS Solar; zero multi-tenant partitioning complexity. | Phase 1 | Verified in Phase 1 (`health.test.ts`). | Verified |
| `REQ-BIZ-02` | Order-Driven Project Creation | Projects instantiated strictly upon confirmed Order event; never speculatively. | Phase 5 | Order confirmation event listener test. | Planned |
| `REQ-BIZ-03` | Dual GST / Non-GST Invoicing | Invoicing engine supports both taxable GST and exempt/composite non-GST regimes. | Phase 4 | Tax engine regime selection test. | Planned |
| `REQ-BIZ-04` | Tri-Topology Solar Engineering | First-class calculation, BOM, and workflow support for On-Grid, Off-Grid, and Hybrid. | Phase 4 | Topology sizing calculation tests. | Planned |
| `REQ-BIZ-05` | Multi-Location Stock Tracking | Tracks balances across Warehouse, Installation Site, and Employee Issued. | Phase 5 | Multi-tier stock balance assertion test. | Planned |
| `REQ-BIZ-06` | Hard Stock-out Blocking | Blocks material issue if available stock is insufficient; zero negative stock permitted. | Phase 5 | Atomic conditional write refusal test. | Planned |
| `REQ-BIZ-07` | Two-Phase Stock Lifecycle | Order confirmation reserves stock; physical issue decrements stock balance. | Phase 5 | Two-phase reservation lifecycle test. | Planned |
| `REQ-BIZ-08` | Controlled Approvals Hierarchy | Hierarchical approval gates for discounts, POs, expenses, stock adjustments, refunds. | Phase 2 | Verified in `security.test.ts` (Scenario 10). | Verified |
| `REQ-BIZ-09` | RBAC with Department Heads | Individual credentials, departmental supervisory scopes, custom permission overrides. | Phase 2 | Verified in `security.test.ts` (Scenarios 2, 4, 9, 17). | Verified |
| `REQ-BIZ-10` | English-Language Interface | All internal panels, customer portal interfaces, and transactional documents in English. | Phase 1 | Verified in Phase 1 (`App.test.tsx`). | Verified |
| `REQ-BIZ-11` | Low-Cost Managed Hosting | Monolith architecture deployable to low-cost Linux VPS + Atlas M0/M10. | Phase 1 | Verified in Phase 1 build pipeline. | Verified |
| `REQ-BIZ-12` | Secure Customer Portal | Authenticated portal for customers to inspect milestone progress and documents. | Phase 9 | Customer portal integration test. | Planned |
| `REQ-BIZ-13` | Customer Self-Service Actions | Customers can digitally accept/reject proposals and upload KYC files. | Phase 9 | Customer action security validation test. | Planned |
| `REQ-BIZ-14` | Assisted Quotation Preparation | Manual proposal configuration with automated tax and subtotal computation. | Phase 4 | Quotation calculation accuracy test. | Planned |
| `REQ-BIZ-15` | Flexible Cash Flow Management | Handles advances, partial payments, multiple receipts, and running balances. | Phase 7 | Payment ledger allocation test. | Planned |
| `REQ-BIZ-16` | Stage-Gated Installation Governance | Linear stage progression with mandatory photo & checklist gates before advancement. | Phase 6 | Stage transition guard test. | Planned |
| `REQ-BIZ-17` | Serial Number & Warranty Tracking | Captures module, inverter, and battery serials tied to warranty records. | Phase 5 | Serial uniqueness and warranty query test. | Planned |
| `REQ-BIZ-18` | Pragmatic Net Metering / Subsidy | Internal milestone tracking; no direct scraping of utility portals. | Phase 6 | DISCOM milestone tracking test. | Planned |
| `REQ-BIZ-19` | Omnichannel Notification Dispatch | In-app notification center, transactional emails, and optional WhatsApp templates. | Phase 9 | Notification dispatcher test. | Planned |
| `REQ-BIZ-20` | Operational Accounts Scope | Focuses on collections, expenses, POs, payables, receivables, and project margins. | Phase 7 | Project gross margin calculation test. | Planned |
| `REQ-BIZ-21` | Greenfield Data Inception | System starts with clean master data; legacy migration out of scope. | Phase 3 | Master seed verification test. | Planned |
| `REQ-BIZ-22` | Private Object Storage Architecture | Private S3 storage with short-lived pre-signed URLs (TTL <= 15 min). | Phase 1 | Verified in Phase 1 (`env.test.ts`). | Verified |
| `REQ-BIZ-23` | 11-30 Employees Operating Scale | Optimized for low-concurrency internal teams and high transactional data integrity. | Phase 10 | Load test at 50 concurrent sessions. | Planned |
| `REQ-BIZ-24` | Traceable Append-Only Ledgers | Corrections executed via reversing entries or voids; zero silent historical overwrites. | Phase 7 | Ledger immutability audit test. | Planned |
| `REQ-BIZ-25` | Idempotent Financial Transactions | Unique bank UTR constraints and client idempotency keys on payment endpoints. | Phase 7 | Duplicate payment rejection test. | Planned |
| `REQ-BIZ-26` | Integer Currency Precision | Base currency stored in integer paise preventing IEEE 754 floating point errors. | Phase 1 | Verified in Phase 1 (`schemas.test.ts`). | Verified |
| `REQ-BIZ-27` | Atomic Concurrency Control | MongoDB atomic operators ($inc with $gte guards) prevent negative balances. | Phase 5 | Race condition concurrency test. | Planned |
| `REQ-BIZ-28` | Orthogonal State Separation | Project stage, payment state, installation state, subsidy state operate independently. | Phase 6 | Independent state transition test. | Planned |
| `REQ-BIZ-29` | Quotation Snapshot Immutability | Confirmed orders permanently lock agreed BOM prices against future catalog changes. | Phase 5 | Price lock immutability test. | Planned |
| `REQ-BIZ-30` | Empirical Quality & Reliability | Verified via automated test suites, structured Pino logging, and automated backups. | Phase 10 | Automated CI test run in deployment pipeline. | Planned |
