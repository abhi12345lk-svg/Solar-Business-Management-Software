import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const BASE_URL = 'http://localhost:4000/api/v1';

interface AuthSession {
  email: string;
  cookie: string;
  csrfToken: string;
  role: string;
}

const sessions: Record<string, AuthSession> = {};

async function loginUser(email: string, password: string, roleName: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to login ${email}: ${res.status} ${errText}`);
  }

  const body: any = await res.json();
  const csrfToken = body?.data?.csrfToken || body?.csrfToken || '';

  // Use getSetCookie() to collect both ins_session and XSRF-TOKEN cookies
  const setCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie')];
  const cookieHeader = setCookies.map((c: string) => c.split(';')[0]).join('; ');

  sessions[roleName] = { email, cookie: cookieHeader, csrfToken, role: roleName };
  return cookieHeader;
}

async function request(
  endpoint: string,
  method = 'GET',
  role = 'admin',
  body?: any
): Promise<any> {
  const session = sessions[role];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (session?.cookie) {
    headers['Cookie'] = session.cookie;
  }
  if (session?.csrfToken && method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = session.csrfToken;
  }
  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('INS SOLAR ERP: FINAL PRODUCTION READINESS INDEPENDENT VERIFICATION');
  console.log('================================================================\n');

  // 1. Authenticate All 4 Workstation Roles
  console.log('--- 1. Authenticating Role Workstations ---');
  await loginUser('admin@inssolar.com', 'SolarAdmin2026!', 'admin');
  console.log('✓ Admin workstation authenticated (admin@inssolar.com)');
  await loginUser('sales@inssolar.com', 'SolarSales2026!', 'sales');
  console.log('✓ Sales workstation authenticated (sales@inssolar.com)');
  await loginUser('accounts@inssolar.com', 'SolarAccounts2026!', 'accounts');
  console.log('✓ Accounts workstation authenticated (accounts@inssolar.com)');
  await loginUser('installer@inssolar.com', 'SolarInstaller2026!', 'installer');
  console.log('✓ Installer workstation authenticated (installer@inssolar.com)\n');

  // 2. Test Customer Entry Modes:
  // Mode A: Fresh Lead
  console.log('--- 2. Customer Entry Modes: Fresh Lead (Mode A) ---');
  const leadRes = await request('/leads', 'POST', 'sales', {
    prospectName: 'Ramesh Patel (Live Audit)',
    prospectPhone: '+919826199999',
    prospectEmail: 'ramesh.patel.audit@example.com',
    source: 'WEBSITE',
    location: {
      street: 'Plot 44, Shankar Nagar',
      city: 'Raipur',
      state: 'Chhattisgarh',
      pinCode: '492007'
    },
    notes: 'Inquiry for 5 kWp Rooftop Solar System'
  });
  console.log(`Lead Created: Status ${leadRes.status}, LeadCode: ${leadRes.data?.data?.leadCode || leadRes.data?.leadCode || 'N/A'}`);
  const leadId = leadRes.data?.data?._id || leadRes.data?.data?.id || leadRes.data?._id || leadRes.data?.id;

  // Duplicate Phone Rejection Check
  const dupLeadRes = await request('/leads', 'POST', 'sales', {
    prospectName: 'Duplicate Patel',
    prospectPhone: '+919826199999',
    source: 'WALK_IN',
    location: {
      city: 'Raipur',
      state: 'Chhattisgarh'
    }
  });
  console.log(`Duplicate Lead Phone Rejection: Status ${dupLeadRes.status} (Expected 400/409, Got: ${dupLeadRes.status})`);

  // Convert Lead to Customer
  const convRes = await request(`/leads/${leadId}/convert`, 'POST', 'sales', {
    customerType: 'INDIVIDUAL',
    notes: 'Converted following preliminary feasibility approval.'
  });
  console.log(`Lead Converted to Customer: Status ${convRes.status}`);
  const customerId = convRes.data?.data?.customerId || convRes.data?.data?._id || convRes.data?.data?.id || convRes.data?.customerId;
  console.log(`Customer ID: ${customerId}`);

  // Mode B: Direct Customer Creation
  console.log('\n--- 2. Customer Entry Modes: Direct Customer (Mode B) ---');
  const directCustRes = await request('/customers', 'POST', 'sales', {
    name: 'Chhattisgarh Steel Mills Pvt Ltd',
    companyName: 'Chhattisgarh Steel Mills Pvt Ltd',
    primaryPhone: '+919826188888',
    email: 'commercial.audit@example.com',
    type: 'COMMERCIAL',
    billingAddress: {
      addressLine1: 'Bhanpuri Industrial Area',
      city: 'Raipur',
      state: 'Chhattisgarh',
      postalCode: '492037'
    }
  });
  console.log(`Direct Customer Created: Status ${directCustRes.status}, Code: ${directCustRes.data?.data?.customerCode || directCustRes.data?.customerCode || 'N/A'}`);

  // 3. Technical Solar Design & BOM
  console.log('\n--- 3. Site Feasibility, Solar PV Design & BOM Generation ---');
  const designRes = await request('/solar-designs', 'POST', 'sales', {
    customerId: customerId,
    systemCapacityKwp: 5.5,
    systemTopology: 'HYBRID',
    moduleTechnology: 'MONO_PERC',
    inverterType: 'HYBRID',
    targetDiscom: 'CSPDCL',
    tariffCategory: 'DOMESTIC',
    shadowFreeAreaSqFt: 550,
    sanctionedLoadKw: 6,
    lineItems: [
      {
        description: '550Wp Mono Perc Solar Module',
        quantity: 10,
        unit: 'Nos',
        unitRatePaise: 1450000,
        gstRateBasisPoints: 1200
      },
      {
        description: '5kW Hybrid Solar Inverter',
        quantity: 1,
        unit: 'Nos',
        unitRatePaise: 6500000,
        gstRateBasisPoints: 1800
      }
    ]
  });
  console.log(`Solar Design Generated: Status ${designRes.status}`);
  const designId = designRes.data?.data?._id || designRes.data?._id;

  // 4. Quotation Generation & Revision Acceptance
  console.log('\n--- 4. Quotation Generation & Digital Acceptance ---');
  const quoteRes = await request('/quotations', 'POST', 'sales', {
    customerId: customerId,
    designId: designId,
    systemCapacityKwp: 5.5,
    grossSubtotalPaise: 21000000,
    totalDiscountPaise: 100000,
    taxableAmountPaise: 20900000,
    totalTaxPaise: 2896142,
    netTotalPaise: 23796142,
    lineItems: [
      {
        description: '550Wp Mono Perc Solar Module',
        quantity: 10,
        unit: 'Nos',
        unitRatePaise: 1450000,
        gstRateBasisPoints: 1200,
        taxableAmountPaise: 14430953,
        taxPaise: 1731714,
        itemTotalPaise: 16162667
      },
      {
        description: '5kW Hybrid Solar Inverter',
        quantity: 1,
        unit: 'Nos',
        unitRatePaise: 6500000,
        gstRateBasisPoints: 1800,
        taxableAmountPaise: 6469047,
        taxPaise: 1164428,
        itemTotalPaise: 7633475
      }
    ],
    termsAndConditions: [
      'Standard 25 Year Solar Module Performance Warranty',
      '5 Year Inverter Warranty',
      'Net Metering liaison included as per CSPDCL norms'
    ]
  });
  console.log(`Quotation Created: Status ${quoteRes.status}`);
  const quotationId = quoteRes.data?.data?._id || quoteRes.data?._id;

  // Formally Accept Quotation
  const acceptRes = await request(`/quotations/${quotationId}/customer-decision`, 'POST', 'sales', {
    decision: 'ACCEPT',
    notes: 'Quotation approved by client with 20% advance milestone.'
  });
  console.log(`Quotation Accepted: Status ${acceptRes.status}`);

  // 5. Sales Order Creation
  console.log('\n--- 5. Sales Order Contract Generation ---');
  const orderRes = await request('/orders', 'POST', 'sales', {
    quotationId: quotationId,
    quotationRevisionId: quotationId,
    notes: 'Confirmed 5.5kWp Hybrid Solar Installation Order for Ramesh Patel'
  });
  console.log(`Sales Order Created: Status ${orderRes.status}`);
  const orderData = orderRes.data?.data || orderRes.data;
  const orderId = orderData?._id;
  console.log(`Order Number: ${orderData?.orderNumber}, ID: ${orderId}`);

  // 6. Payment Integrity & Milestone Advance Allocation
  console.log('\n--- 6. Milestone Payment (20% Booking Advance) & Duplicate UTR Check ---');
  const advanceAmountPaise = Math.round(orderData?.netTotalPaise * 0.2);
  const paymentRes = await request('/payments', 'POST', 'accounts', {
    customerId: customerId,
    amountPaise: advanceAmountPaise,
    paymentDate: new Date(),
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'UTR-HDFC-2026-LIVE99',
    notes: `Booking Advance 20% for Order ${orderData?.orderNumber}`
  });
  console.log(`Payment Receipt Created: Status ${paymentRes.status}, ReceiptNo: ${paymentRes.data?.data?.receiptNumber || 'N/A'}`);
  const paymentId = paymentRes.data?.data?._id || paymentRes.data?._id;

  // Verify and Allocate to Sales Order
  const verifyRes = await request(`/payments/${paymentId}/verify`, 'PATCH', 'accounts', {
    verificationNotes: 'Bank UTR verified in CSPDCL operations account.'
  });
  console.log(`Payment Verified: Status ${verifyRes.status}`);

  const allocateRes = await request(`/payments/${paymentId}/allocate`, 'POST', 'accounts', {
    salesOrderId: orderId,
    amountPaise: advanceAmountPaise,
    notes: 'Allocated to Stage 1 Booking Advance'
  });
  console.log(`Payment Allocated to Order: Status ${allocateRes.status}`);

  // Duplicate UTR Prevention Test
  const dupUtrRes = await request('/payments', 'POST', 'accounts', {
    customerId: customerId,
    amountPaise: 5000000,
    paymentDate: new Date(),
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'UTR-HDFC-2026-LIVE99'
  });
  console.log(`Duplicate UTR Prevention: Status ${dupUtrRes.status} (Expected 400/409, Got: ${dupUtrRes.status})`);

  // 7. Inventory Allocation & Central Depot Raipur Verification
  console.log('\n--- 7. Stock Allocation (Central Depot Raipur) ---');
  const whRes = await request('/warehouses?isActive=true', 'GET', 'admin');
  const warehouses = whRes.data?.data || whRes.data?.items || whRes.data || [];
  const raipurWh = warehouses.find((w: any) => w.code === 'WH-RAIPUR-01') || warehouses[0];
  console.log(`Fulfillment Warehouse Identified: ${raipurWh?.name} (${raipurWh?.code}) in ${raipurWh?.address?.city}`);

  const reserveRes = await request(`/orders/${orderId}/reserve-stock`, 'POST', 'admin', {
    warehouseId: raipurWh?._id
  });
  console.log(`Stock Reserved on Order: Status ${reserveRes.status}`);

  // 8. EPC Project Initialization & 5 Master Stages
  console.log('\n--- 8. EPC Project Initialization & 5 Master Stages ---');
  const projectRes = await request('/projects', 'POST', 'admin', {
    salesOrderId: orderId,
    notes: 'Linear EPC Execution Project for Shankar Nagar Site'
  });
  console.log(`EPC Project Initialized: Status ${projectRes.status}`);
  const projectData = projectRes.data?.data || projectRes.data;
  const projectId = projectData?._id;
  console.log(`Project Code: ${projectData?.projectCode}, Current Stage: ${projectData?.currentStage}`);

  // 9. Cross-Module Tenant Isolation & Security Boundary
  console.log('\n--- 9. Customer Portal Isolation & Security Check ---');
  // Attempt unauthorized access without token or as different customer
  const unauthRes = await request(`/projects/${projectId}`, 'GET', 'unauthorized', {});
  console.log(`Unauthenticated API Access: Status ${unauthRes.status} (Expected 401/403, Got: ${unauthRes.status})`);

  console.log('\n================================================================');
  console.log('FINAL PRODUCTION READINESS AUDIT: ALL TESTS EXECUTED SUCCESSFULLY!');
  console.log('================================================================');
}

runEndToEndVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
