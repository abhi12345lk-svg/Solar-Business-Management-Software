/**
 * INS Solar Business Management Software — Proposal Compiler Service
 *
 * Compiles server-side validated proposal documents from persisted quotation snapshots,
 * embedding company insignia, bill of materials, integer paise tax breakdowns,
 * commercial payment milestones, and digital acceptance records.
 */

import { Quotation } from '../models/Quotation.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { Customer } from '../models/Customer.js';
import { SolarDesign } from '../models/SolarDesign.js';
import { formatPaiseToInr, TAX_DISCLAIMER_TEXT } from '@ins-solar/shared';
import { AppError } from '../errors/AppError.js';

export class ProposalCompilerService {
  /**
   * Compiles printable, branded proposal document HTML based strictly on persisted data.
   */
  public static async compileProposalHtml(quotationId: string): Promise<string> {
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      throw AppError.notFound('Quotation not found for document compilation.');
    }

    const [customer, settings, solarDesign] = await Promise.all([
      Customer.findById(quotation.customerId),
      CompanySettings.findOne({ key: 'COMPANY_SETTINGS' }),
      quotation.solarDesignId ? SolarDesign.findById(quotation.solarDesignId) : null
    ]);

    const companyName = settings?.companyName || 'INS Solar Private Limited';
    const companyAddress = settings?.registeredAddress
      ? `${settings.registeredAddress.addressLine1}, ${settings.registeredAddress.city}, ${settings.registeredAddress.state} - ${settings.registeredAddress.postalCode}`
      : 'Gujarat, India';
    const companyGstin = settings?.gstin || '24AAACI1234A1Z5';
    const companyPan = settings?.pan || 'AAACI1234A';
    const companyContact = settings?.contactPhone || '+91 98765 43210';
    const companyEmail = settings?.contactEmail || 'commercial@inssolar.com';

    const customerName =
      (customer as any)?.name || (customer as any)?.legalName || 'Valued Customer';
    const customerPhone = customer?.primaryPhone || '';
    const customerEmail = customer?.email || '';
    const customerAddress = customer?.billingAddress
      ? `${customer.billingAddress.addressLine1}, ${customer.billingAddress.city}, ${customer.billingAddress.state} - ${customer.billingAddress.postalCode}`
      : 'Site Location';

    const lineItemsHtml = (quotation.lineItems || [])
      .map(
        (item, index) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <strong>${item.description}</strong>
            ${item.sku ? `<div style="font-size: 11px; color: #64748b;">SKU: ${item.sku}</div>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} ${item.unit}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPaiseToInr(item.unitRatePaise || 0)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPaiseToInr(item.taxableAmountPaise || 0)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${((item.gstRateBasisPoints || 0) / 100).toFixed(0)}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatPaiseToInr(item.totalAmountPaise ?? item.taxableAmountPaise ?? 0)}</td>
        </tr>
      `
      )
      .join('');

    const termsHtml = (quotation.termsAndConditions || [])
      .map(term => `<li style="margin-bottom: 6px;">${term}</li>`)
      .join('');

    const milestonesHtml = (quotation.paymentMilestones || [])
      .map(
        ms => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px;">
          <span><strong>${ms.milestoneName || (ms as any).name || 'Milestone'}</strong> (${ms.percentage}%):</span>
          <span>${formatPaiseToInr(Math.round(((quotation.netTotalPaise || 0) * ms.percentage) / 100))}</span>
        </div>
      `
      )
      .join('');

    const isAccepted = quotation.status === 'ACCEPTED';
    const acceptanceStampHtml = isAccepted
      ? `
      <div style="margin-top: 25px; padding: 15px; background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px;">
        <h4 style="margin: 0 0 5px 0; color: #065f46; font-size: 14px;">DIGITALLY ACCEPTED PROPOSAL</h4>
        <div style="font-size: 12px; color: #047857;">
          Accepted on: <strong>${quotation.acceptedAt?.toISOString() || new Date().toISOString()}</strong><br />
          Signatory Customer: <strong>${customerName}</strong><br />
          Verification IP: <strong>${quotation.decisionIpAddress || 'Authenticated Session'}</strong>
        </div>
      </div>
    `
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Proposal — ${quotation.fullQuotationCode}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1e293b;
      line-height: 1.5;
      background: #ffffff;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
    .header-table { width: 100%; border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 13px; }
    table.data-table th { background: #0f172a; color: #ffffff; padding: 10px; text-align: left; font-weight: 600; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800;">INS SOLAR</h1>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          ${companyName}<br />
          ${companyAddress}<br />
          GSTIN: ${companyGstin} | PAN: ${companyPan}<br />
          Phone: ${companyContact} | Email: ${companyEmail}
        </div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div style="display: inline-block; padding: 6px 12px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 700; font-size: 14px;">
          PROPOSAL / QUOTATION
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 8px;">
          ${quotation.fullQuotationCode}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          Issue Date: ${new Date(quotation.createdAt).toLocaleDateString()}<br />
          Valid Until: ${new Date(quotation.validUntil).toLocaleDateString()}
        </div>
      </td>
    </tr>
  </table>

  <table style="width: 100%; margin-bottom: 20px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 15px;">
        <div class="meta-box">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Client Details</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;">${customerName}</div>
          <div style="font-size: 12px; color: #334155; margin-top: 2px;">
            ${customerAddress}<br />
            Phone: ${customerPhone} | Email: ${customerEmail}
          </div>
        </div>
      </td>
      <td style="width: 50%; vertical-align: top; padding-left: 15px;">
        <div class="meta-box">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Engineered Solar Plant Specifications</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;">
            ${quotation.systemCapacityKwp} kWp (${quotation.systemTopology})
          </div>
          <div style="font-size: 12px; color: #334155; margin-top: 2px;">
            Status: <strong>${quotation.status}</strong> | Revision: <strong>R${quotation.revisionNumber}</strong><br />
            ${solarDesign ? `Linked Design: <strong>${solarDesign.designNumber}</strong>` : 'Direct Engineering Proposal'}
          </div>
        </div>
      </td>
    </tr>
  </table>

  <h3 style="font-size: 15px; color: #0f172a; margin-bottom: 5px;">Itemized Bill of Materials (BOM) & Pricing</h3>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">#</th>
        <th style="width: 35%;">Component / Service Description</th>
        <th style="width: 10%; text-align: center;">Qty</th>
        <th style="width: 15%; text-align: right;">Unit Rate</th>
        <th style="width: 15%; text-align: right;">Taxable Amount</th>
        <th style="width: 8%; text-align: center;">GST</th>
        <th style="width: 12%; text-align: right;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <table style="width: 100%; margin-top: 15px;">
    <tr>
      <td style="width: 55%; vertical-align: top; padding-right: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Payment Milestone Schedule</div>
          ${milestonesHtml}
        </div>
        ${acceptanceStampHtml}
      </td>
      <td style="width: 45%; vertical-align: top;">
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span>Subtotal (Paise):</span>
            <span>${formatPaiseToInr(quotation.subtotalPaise || 0)}</span>
          </div>
          ${
            (quotation.totalDiscountPaise || 0) > 0
              ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #b91c1c;">
              <span>Total Commercial Discount (${quotation.discountPercent || 0}%):</span>
              <span>-${formatPaiseToInr(quotation.totalDiscountPaise || 0)}</span>
            </div>
          `
              : ''
          }
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-weight: 600; border-top: 1px solid #cbd5e1; margin-top: 4px;">
            <span>Taxable Amount:</span>
            <span>${formatPaiseToInr(quotation.taxableAmountPaise || 0)}</span>
          </div>
          ${
            quotation.taxProfile?.isInterState
              ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
              <span>IGST (Integrated Tax):</span>
              <span>${formatPaiseToInr(quotation.igstAmountPaise || 0)}</span>
            </div>
          `
              : `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
              <span>CGST (Central Tax):</span>
              <span>${formatPaiseToInr(quotation.cgstAmountPaise || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
              <span>SGST (State Tax):</span>
              <span>${formatPaiseToInr(quotation.sgstAmountPaise || 0)}</span>
            </div>
          `
          }
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 800; color: #0369a1; border-top: 2px solid #0284c7; margin-top: 8px;">
            <span>Net Proposal Total:</span>
            <span>${formatPaiseToInr(quotation.netTotalPaise || 0)}</span>
          </div>
        </div>
      </td>
    </tr>
  </table>

  <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
    <h4 style="font-size: 13px; color: #0f172a; margin-bottom: 6px;">Commercial Terms & Conditions:</h4>
    <ol style="font-size: 12px; color: #475569; padding-left: 20px; margin: 0;">
      ${termsHtml}
    </ol>
  </div>

  <div style="margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; font-size: 11px; color: #92400e;">
    <strong>Statutory Notice:</strong> ${TAX_DISCLAIMER_TEXT}
  </div>
</body>
</html>
    `;
  }
}
