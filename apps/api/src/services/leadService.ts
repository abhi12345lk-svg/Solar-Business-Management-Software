import mongoose, { Types, FilterQuery } from 'mongoose';
import {
  Lead,
  ILeadDocument,
  LeadActivity,
  ILeadActivityDocument,
  Customer,
  ICustomerDocument,
  User,
  IAddressSubdocument
} from '../models/index.js';
import {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  AssignLeadInput,
  ConvertLeadInput,
  LeadFilterParams,
  CreateLeadActivityInput,
  CompleteFollowUpInput,
  FollowUpFilterParams,
  LeadDto,
  LeadActivityDto,
  LeadStatus,
  LeadPriority,
  LeadSource,
  SolarRequirement,
  SequenceEntityType,
  ActivityType,
  ActivityStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole,
  Department,
  CustomerStatus,
  AddressType,
  ApiPagination
} from '@ins-solar/shared';
import { SequenceService, getCurrentFiscalYear } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export interface UserContext {
  userId: string;
  role: UserRole;
  department: Department;
  permissions?: string[];
}

export class LeadService {
  /**
   * Transforms a Lead Mongoose document to a clean DTO.
   */
  public static toLeadDto(doc: any): LeadDto {
    return {
      id: doc._id.toString(),
      leadCode: doc.leadCode,
      prospectName: doc.prospectName,
      prospectPhone: doc.prospectPhone,
      prospectEmail: doc.prospectEmail,
      companyName: doc.companyName,
      location: {
        street: doc.location?.street,
        city: doc.location?.city,
        district: doc.location?.district,
        state: doc.location?.state,
        pinCode: doc.location?.pinCode,
        geoCoordinates: doc.location?.geoCoordinates
      },
      source: doc.source,
      solarRequirement: doc.solarRequirement,
      estimatedCapacityKw: doc.estimatedCapacityKw,
      assignedToEmployeeId: doc.assignedToEmployeeId
        ? doc.assignedToEmployeeId._id
          ? doc.assignedToEmployeeId._id.toString()
          : doc.assignedToEmployeeId.toString()
        : undefined,
      assignedEmployeeName:
        doc.assignedToEmployeeId && doc.assignedToEmployeeId.firstName
          ? `${doc.assignedToEmployeeId.firstName} ${doc.assignedToEmployeeId.lastName || ''}`.trim()
          : undefined,
      status: doc.status,
      lostReason: doc.lostReason,
      priority: doc.priority,
      notes: doc.notes,
      nextFollowUpDate: doc.nextFollowUpDate
        ? new Date(doc.nextFollowUpDate).toISOString()
        : undefined,
      isActive: doc.isActive !== false,
      convertedCustomerId: doc.convertedCustomerId ? doc.convertedCustomerId.toString() : undefined,
      convertedAt: doc.convertedAt ? new Date(doc.convertedAt).toISOString() : undefined,
      createdBy: doc.createdBy ? doc.createdBy.toString() : undefined,
      updatedBy: doc.updatedBy ? doc.updatedBy.toString() : undefined,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString()
    };
  }

  /**
   * Transforms a LeadActivity document to a clean DTO.
   */
  public static toActivityDto(doc: any): LeadActivityDto {
    return {
      id: doc._id.toString(),
      leadId: doc.leadId
        ? doc.leadId._id
          ? doc.leadId._id.toString()
          : doc.leadId.toString()
        : '',
      customerId: doc.customerId ? doc.customerId.toString() : undefined,
      activityType: doc.activityType,
      summary: doc.summary,
      remarks: doc.remarks,
      activityDate: new Date(doc.activityDate).toISOString(),
      nextFollowUpDate: doc.nextFollowUpDate
        ? new Date(doc.nextFollowUpDate).toISOString()
        : undefined,
      assignedEmployeeId: doc.assignedEmployeeId
        ? doc.assignedEmployeeId._id
          ? doc.assignedEmployeeId._id.toString()
          : doc.assignedEmployeeId.toString()
        : undefined,
      assignedEmployeeName:
        doc.assignedEmployeeId && doc.assignedEmployeeId.firstName
          ? `${doc.assignedEmployeeId.firstName} ${doc.assignedEmployeeId.lastName || ''}`.trim()
          : undefined,
      status: doc.status,
      sentiment: doc.sentiment,
      completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : undefined,
      createdBy: doc.createdBy
        ? doc.createdBy._id
          ? doc.createdBy._id.toString()
          : doc.createdBy.toString()
        : undefined,
      createdByName:
        doc.createdBy && doc.createdBy.firstName
          ? `${doc.createdBy.firstName} ${doc.createdBy.lastName || ''}`.trim()
          : undefined,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString()
    };
  }

  /**
   * Creates a new Lead using atomic sequence numbering.
   */
  public static async createLead(
    input: CreateLeadInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<LeadDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied('Customer portal users cannot create internal leads.');
    }

    let assignedId: Types.ObjectId | undefined;
    if (input.assignedToEmployeeId) {
      if (!Types.ObjectId.isValid(input.assignedToEmployeeId)) {
        throw AppError.validationFailed('Invalid assigned employee ID format.');
      }
      const employee = await User.findById(input.assignedToEmployeeId);
      if (!employee || !employee.isActive) {
        throw AppError.validationFailed('Assigned employee does not exist or is inactive.');
      }
      assignedId = new Types.ObjectId(input.assignedToEmployeeId);
    } else if (user.role === UserRole.SALES_EXECUTIVE) {
      // Default auto-assignment to self if sales executive creates it
      assignedId = new Types.ObjectId(user.userId);
    }

    // Standalone preview fallback when live MongoDB is not connected
    if (mongoose.connection.readyState !== 1) {
      return {
        id: new Types.ObjectId().toString(),
        leadCode: `LEAD-${getCurrentFiscalYear()}-00099`,
        prospectName: input.prospectName,
        prospectPhone: input.prospectPhone,
        prospectEmail: input.prospectEmail,
        companyName: input.companyName,
        location: input.location,
        source: input.source,
        solarRequirement: input.solarRequirement,
        estimatedCapacityKw: input.estimatedCapacityKw,
        status: LeadStatus.NEW,
        priority: input.priority || LeadPriority.MEDIUM,
        notes: input.notes,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    let leadDoc: any;
    const MAX_CREATION_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_CREATION_ATTEMPTS; attempt++) {
      // Atomic monotonic sequence generation
      const seqResult = await SequenceService.generateNumber(SequenceEntityType.LEAD);
      const leadCode = seqResult.formattedNumber;

      try {
        leadDoc = await Lead.create({
          leadCode,
          prospectName: input.prospectName,
          prospectPhone: input.prospectPhone,
          prospectEmail: input.prospectEmail,
          companyName: input.companyName,
          location: input.location,
          source: input.source,
          solarRequirement: input.solarRequirement,
          estimatedCapacityKw: input.estimatedCapacityKw,
          assignedToEmployeeId: assignedId,
          status: LeadStatus.NEW,
          priority: input.priority || LeadPriority.MEDIUM,
          notes: input.notes,
          nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined,
          isActive: true,
          createdBy: Types.ObjectId.isValid(user.userId)
            ? new Types.ObjectId(user.userId)
            : undefined
        });
        break; // Successfully created lead!
      } catch (err: any) {
        const isDuplicateKey =
          (err?.code === 11000 ||
            err?.name === 'MongoServerError' ||
            String(err?.message || '').includes('E11000')) &&
          (String(err?.message || '').includes('leadCode') ||
            JSON.stringify(err?.keyPattern || {}).includes('leadCode'));

        if (isDuplicateKey && attempt < MAX_CREATION_ATTEMPTS) {
          logger.warn(
            { leadCode, attempt },
            'Pre-existing leadCode collision detected; advancing sequence counter past highest existing record and retrying.'
          );

          let targetSeq = seqResult.sequenceNumber + 1;
          try {
            const currentFY = getCurrentFiscalYear();
            const highestLead = await Lead.findOne(
              { leadCode: { $regex: `^LEAD-${currentFY}-` } },
              { leadCode: 1 }
            )
              .sort({ leadCode: -1 })
              .lean();

            if (highestLead?.leadCode) {
              const match = highestLead.leadCode.match(/-(\d+)$/);
              if (match && match[1]) {
                const maxNum = parseInt(match[1], 10);
                if (!isNaN(maxNum) && maxNum >= targetSeq) {
                  targetSeq = maxNum;
                }
              }
            }
          } catch {
            // Fall back to targetSeq
          }

          await SequenceService.ensureCounterAtLeast(SequenceEntityType.LEAD, targetSeq);
          continue;
        }

        if (err?.code === 11000 && String(err?.message || '').includes('prospectPhone')) {
          throw AppError.businessRule('A lead with this phone number already exists.');
        }

        throw err;
      }
    }

    // Record initial capture activity
    await LeadActivity.create({
      leadId: leadDoc._id,
      activityType: ActivityType.NOTE,
      summary: `Lead captured via ${input.source}`,
      remarks: input.notes || 'Initial inquiry recorded.',
      activityDate: new Date(),
      nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined,
      assignedEmployeeId: assignedId,
      status: ActivityStatus.COMPLETED,
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.LEAD_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'Lead',
      targetId: leadDoc._id.toString(),
      details: {
        leadCode: leadDoc.leadCode,
        prospectPhone: input.prospectPhone,
        source: input.source,
        assignedToEmployeeId: assignedId?.toString()
      }
    });

    const populated = await Lead.findById(leadDoc._id).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    return LeadService.toLeadDto(populated || leadDoc);
  }

  /**
   * Lists leads with filtering, search, pagination, and RBAC record scoping.
   */
  public static async listLeads(
    filter: LeadFilterParams,
    user: UserContext
  ): Promise<{ data: LeadDto[]; pagination: ApiPagination }> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied('Customer portal users cannot access internal leads.');
    }

    // Standalone preview fallback when live MongoDB is not connected
    if (mongoose.connection.readyState !== 1) {
      const fallbackLeads: LeadDto[] = [
        {
          id: 'lead-preview-001',
          leadCode: 'LEAD-2026-00001',
          prospectName: 'Amit Verma',
          prospectPhone: '+919829111222',
          prospectEmail: 'amit.verma@example.com',
          companyName: 'Verma Solar Enterprises',
          location: {
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302020',
            street: '12, Malviya Nagar'
          },
          source: LeadSource.WEBSITE,
          solarRequirement: SolarRequirement.RESIDENTIAL,
          estimatedCapacityKw: 5,
          status: LeadStatus.SURVEY_SCHEDULED,
          priority: LeadPriority.HIGH,
          notes: 'PM Surya Ghar rooftop solar prospect',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lead-preview-002',
          leadCode: 'LEAD-2026-00002',
          prospectName: 'Priya Sharma',
          prospectPhone: '+919829333444',
          prospectEmail: 'priya.sharma@example.com',
          companyName: 'Sharma Textiles',
          location: {
            city: 'Udaipur',
            state: 'Rajasthan',
            pinCode: '313001',
            street: '45, Industrial Estate'
          },
          source: LeadSource.COLD_CALL,
          solarRequirement: SolarRequirement.COMMERCIAL,
          estimatedCapacityKw: 25,
          status: LeadStatus.CONTACTED,
          priority: LeadPriority.HIGH,
          notes: 'Commercial rooftop solar installation',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lead-preview-003',
          leadCode: 'LEAD-2026-00003',
          prospectName: 'Rajesh Patel',
          prospectPhone: '+919829555666',
          prospectEmail: 'rajesh.patel@example.com',
          companyName: 'Patel Agro Industries',
          location: {
            city: 'Kota',
            state: 'Rajasthan',
            pinCode: '324005',
            street: '88, Agro Park'
          },
          source: LeadSource.REFERRAL,
          solarRequirement: SolarRequirement.INDUSTRIAL,
          estimatedCapacityKw: 100,
          status: LeadStatus.QUOTED,
          priority: LeadPriority.URGENT,
          notes: 'Industrial captive rooftop solar inquiry',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      return {
        data: fallbackLeads,
        pagination: {
          page: 1,
          limit: 50,
          totalRecords: fallbackLeads.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }

    const query: FilterQuery<ILeadDocument> = {};

    // Record scoping:
    // Superadmin & Admin can see all leads
    // Department Head of Sales can see all leads in sales
    // Sales Executive can see leads assigned to them or unassigned leads unless explicitly filtered
    if (user.role === UserRole.SALES_EXECUTIVE) {
      if (filter.assignedToEmployeeId) {
        query.assignedToEmployeeId = new Types.ObjectId(filter.assignedToEmployeeId);
      } else {
        query.$or = [
          { assignedToEmployeeId: new Types.ObjectId(user.userId) },
          { assignedToEmployeeId: { $exists: false } },
          { assignedToEmployeeId: null }
        ];
      }
    } else if (filter.assignedToEmployeeId) {
      if (Types.ObjectId.isValid(filter.assignedToEmployeeId)) {
        query.assignedToEmployeeId = new Types.ObjectId(filter.assignedToEmployeeId);
      }
    }

    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.source) {
      query.source = filter.source;
    }
    if (filter.priority) {
      query.priority = filter.priority;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    if (filter.search) {
      const s = filter.search.trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { prospectName: { $regex: escaped, $options: 'i' } },
        { prospectPhone: { $regex: escaped, $options: 'i' } },
        { prospectEmail: { $regex: escaped, $options: 'i' } },
        { leadCode: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sortField = filter.sortBy || 'createdAt';
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const [docs, total] = await Promise.all([
      Lead.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assignedToEmployeeId', 'firstName lastName email')
        .lean(),
      Lead.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: docs.map(d => LeadService.toLeadDto(d)),
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Retrieves a single lead by ID or Lead Code with authorization check.
   */
  public static async getLeadById(idOrCode: string, user: UserContext): Promise<LeadDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied('Customer portal users cannot access internal leads.');
    }

    const query = Types.ObjectId.isValid(idOrCode)
      ? { _id: new Types.ObjectId(idOrCode) }
      : { leadCode: idOrCode.toUpperCase() };

    const doc = await Lead.findOne(query).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    if (!doc) {
      throw AppError.notFound(`Lead '${idOrCode}' not found.`);
    }

    return LeadService.toLeadDto(doc);
  }

  /**
   * Updates general lead details without permitting mass assignment of protected fields.
   */
  public static async updateLead(
    id: string,
    input: UpdateLeadInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<LeadDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw AppError.notFound(`Lead '${id}' not found.`);
    }

    if (lead.status === LeadStatus.CONVERTED) {
      throw AppError.businessRule(
        'Converted leads cannot have core inquiry details modified directly.'
      );
    }

    // Apply allowed updates only
    if (input.prospectName !== undefined) lead.prospectName = input.prospectName;
    if (input.prospectPhone !== undefined) lead.prospectPhone = input.prospectPhone;
    if (input.prospectEmail !== undefined) lead.prospectEmail = input.prospectEmail;
    if (input.companyName !== undefined) lead.companyName = input.companyName;
    if (input.location !== undefined) lead.location = input.location;
    if (input.source !== undefined) lead.source = input.source;
    if (input.solarRequirement !== undefined) lead.solarRequirement = input.solarRequirement;
    if (input.estimatedCapacityKw !== undefined) {
      lead.estimatedCapacityKw =
        input.estimatedCapacityKw === null ? undefined : input.estimatedCapacityKw;
    }
    if (input.priority !== undefined) lead.priority = input.priority;
    if (input.notes !== undefined) lead.notes = input.notes;
    if (input.nextFollowUpDate !== undefined) {
      lead.nextFollowUpDate = input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined;
    }
    if (input.isActive !== undefined) lead.isActive = input.isActive;

    lead.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await lead.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.LEAD_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'Lead',
      targetId: lead._id.toString(),
      details: { leadCode: lead.leadCode }
    });

    const populated = await Lead.findById(lead._id).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    return LeadService.toLeadDto(populated);
  }

  /**
   * Updates lead lifecycle status and records status transition activity.
   */
  public static async updateStatus(
    id: string,
    input: UpdateLeadStatusInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<LeadDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw AppError.notFound(`Lead '${id}' not found.`);
    }

    if (lead.status === LeadStatus.CONVERTED) {
      throw AppError.businessRule(
        'Converted leads cannot be transitioned out of CONVERTED status.'
      );
    }

    if (input.status === LeadStatus.CONVERTED) {
      throw AppError.businessRule(
        'Direct status transition to CONVERTED is not allowed. Use the explicit POST /leads/:id/convert endpoint.'
      );
    }

    const oldStatus = lead.status;
    lead.status = input.status;
    if (input.status === LeadStatus.LOST) {
      lead.lostReason = input.lostReason;
    } else {
      lead.lostReason = undefined;
    }
    lead.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await lead.save();

    // Log status transition activity
    await LeadActivity.create({
      leadId: lead._id,
      activityType: ActivityType.NOTE,
      summary: `Status changed from ${oldStatus} to ${input.status}`,
      remarks: input.lostReason ? `Reason: ${input.lostReason}` : undefined,
      activityDate: new Date(),
      status: ActivityStatus.COMPLETED,
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.LEAD_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'Lead',
      targetId: lead._id.toString(),
      details: {
        leadCode: lead.leadCode,
        oldStatus,
        newStatus: input.status,
        lostReason: input.lostReason
      }
    });

    const populated = await Lead.findById(lead._id).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    return LeadService.toLeadDto(populated);
  }

  /**
   * Reassigns lead to an authorized sales employee with audit logging and activity trail.
   */
  public static async assignLead(
    id: string,
    input: AssignLeadInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<LeadDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    // Role check: Only Superadmin, Admin, or Department Head can assign leads
    const canAssign =
      user.role === UserRole.SUPERADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.DEPARTMENT_HEAD && user.department === Department.SALES);

    if (!canAssign) {
      throw AppError.permissionDenied(
        'Only Administrators and Sales Department Heads are authorized to assign or reassign leads.'
      );
    }

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(input.assignedToEmployeeId)) {
      throw AppError.validationFailed('Invalid lead or employee ID format.');
    }

    const targetEmployee = await User.findById(input.assignedToEmployeeId);
    if (!targetEmployee || !targetEmployee.isActive) {
      throw AppError.validationFailed('Target employee does not exist or is inactive.');
    }

    const lead = await Lead.findById(id).populate('assignedToEmployeeId', 'firstName lastName');
    if (!lead) {
      throw AppError.notFound(`Lead '${id}' not found.`);
    }

    const previousEmployee = lead.assignedToEmployeeId as any;
    const prevName = previousEmployee
      ? `${previousEmployee.firstName} ${previousEmployee.lastName || ''}`.trim()
      : 'Unassigned';
    const newName = `${targetEmployee.firstName} ${targetEmployee.lastName || ''}`.trim();

    lead.assignedToEmployeeId = targetEmployee._id;
    lead.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await lead.save();

    // Append activity
    await LeadActivity.create({
      leadId: lead._id,
      activityType: ActivityType.NOTE,
      summary: `Lead assigned to ${newName} (previously ${prevName})`,
      remarks: input.remarks,
      activityDate: new Date(),
      assignedEmployeeId: targetEmployee._id,
      status: ActivityStatus.COMPLETED,
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.LEAD_ASSIGNED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'Lead',
      targetId: lead._id.toString(),
      details: {
        leadCode: lead.leadCode,
        previousEmployeeId: previousEmployee?._id?.toString(),
        newEmployeeId: targetEmployee._id.toString(),
        remarks: input.remarks
      }
    });

    const populated = await Lead.findById(lead._id).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    return LeadService.toLeadDto(populated);
  }

  /**
   * Advisory duplicate contact search using normalized phone number.
   * Does NOT reject creation; returns matches for reviewer guidance.
   */
  public static async checkDuplicatePhone(
    phone: string,
    excludeLeadId?: string
  ): Promise<{
    isDuplicate: boolean;
    matchingLeadsCount: number;
    matchingCustomersCount: number;
    matchingLeads: Array<{
      id: string;
      leadCode: string;
      prospectName: string;
      status: string;
      createdAt: string;
    }>;
    matchingCustomers: Array<{ id: string; customerCode: string; name: string; createdAt: string }>;
  }> {
    const trimmed = phone.trim();
    const leadQuery: FilterQuery<ILeadDocument> = { prospectPhone: trimmed };
    if (excludeLeadId && Types.ObjectId.isValid(excludeLeadId)) {
      leadQuery._id = { $ne: new Types.ObjectId(excludeLeadId) };
    }

    const [matchingLeads, matchingCustomers] = await Promise.all([
      Lead.find(leadQuery).select('leadCode prospectName status createdAt').limit(10).lean(),
      Customer.find({ primaryPhone: trimmed })
        .select('customerCode name createdAt')
        .limit(10)
        .lean()
    ]);

    const isDuplicate = matchingLeads.length > 0 || matchingCustomers.length > 0;

    return {
      isDuplicate,
      matchingLeadsCount: matchingLeads.length,
      matchingCustomersCount: matchingCustomers.length,
      matchingLeads: matchingLeads.map(l => ({
        id: l._id.toString(),
        leadCode: l.leadCode,
        prospectName: l.prospectName,
        status: l.status,
        createdAt: new Date(l.createdAt).toISOString()
      })),
      matchingCustomers: matchingCustomers.map(c => ({
        id: c._id.toString(),
        customerCode: c.customerCode,
        name: c.name,
        createdAt: new Date(c.createdAt).toISOString()
      }))
    };
  }

  /**
   * Explicit, idempotent lead-to-customer conversion.
   * Links or creates a Customer, locks lead conversion, preserves all history.
   */
  public static async convertLead(
    id: string,
    input: ConvertLeadInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<{
    lead: LeadDto;
    customerId: string;
    customerCode: string;
    isAlreadyConverted: boolean;
  }> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      throw AppError.notFound(`Lead '${id}' not found.`);
    }

    // Idempotency defense: check if already converted
    if (lead.status === LeadStatus.CONVERTED && lead.convertedCustomerId) {
      const existingCust = await Customer.findById(lead.convertedCustomerId);
      if (existingCust) {
        logger.info(
          { leadCode: lead.leadCode, customerCode: existingCust.customerCode },
          'Lead is already converted; returning idempotent conversion result.'
        );
        const populated = await Lead.findById(lead._id).populate(
          'assignedToEmployeeId',
          'firstName lastName email'
        );
        return {
          lead: LeadService.toLeadDto(populated),
          customerId: existingCust._id.toString(),
          customerCode: existingCust.customerCode,
          isAlreadyConverted: true
        };
      }
    }

    let customerDoc!: ICustomerDocument;

    // Option A: Link to existing customer if ID supplied
    if (input.existingCustomerId) {
      if (!Types.ObjectId.isValid(input.existingCustomerId)) {
        throw AppError.validationFailed('Invalid existing customer ID format.');
      }
      const found = await Customer.findById(input.existingCustomerId);
      if (!found) {
        throw AppError.notFound(`Customer '${input.existingCustomerId}' not found.`);
      }
      customerDoc = found;
    } else {
      // Option B: Create new Customer with atomic customer sequence and collision retry
      const loc = lead.location || { city: '', state: '' };
      const installationAddress: IAddressSubdocument = {
        type: AddressType.SITE_INSTALLATION,
        addressLine1: loc.street || loc.city || 'Address',
        city: loc.city || 'City',
        district: loc.district,
        state: loc.state || 'State',
        postalCode: loc.pinCode || '100000',
        country: 'India',
        geoCoordinates: loc.geoCoordinates
      };

      const billingAddress: IAddressSubdocument = {
        type: AddressType.BILLING,
        addressLine1: loc.street || loc.city || 'Address',
        city: loc.city || 'City',
        district: loc.district,
        state: loc.state || 'State',
        postalCode: loc.pinCode || '100000',
        country: 'India',
        geoCoordinates: loc.geoCoordinates
      };

      const MAX_CUSTOMER_ATTEMPTS = 5;
      for (let attempt = 1; attempt <= MAX_CUSTOMER_ATTEMPTS; attempt++) {
        const seqResult = await SequenceService.generateNumber(SequenceEntityType.CUSTOMER);
        const customerCode = seqResult.formattedNumber;

        try {
          customerDoc = await Customer.create({
            customerCode,
            name: lead.prospectName,
            companyName: input.companyName || lead.companyName,
            primaryPhone: lead.prospectPhone,
            email: lead.prospectEmail,
            type: input.customerType,
            status: CustomerStatus.ACTIVE,
            isActive: true,
            gstin: input.gstin,
            pan: input.pan,
            billingAddress,
            installationAddress,
            notes: input.notes || `Converted from Lead ${lead.leadCode}`
          });
          break;
        } catch (err: any) {
          const isDupCustomerCode =
            (err?.code === 11000 || String(err?.message || '').includes('E11000')) &&
            (String(err?.message || '').includes('customerCode') ||
              JSON.stringify(err?.keyPattern || {}).includes('customerCode'));

          if (isDupCustomerCode && attempt < MAX_CUSTOMER_ATTEMPTS) {
            await SequenceService.ensureCounterAtLeast(
              SequenceEntityType.CUSTOMER,
              seqResult.sequenceNumber + 1
            );
            continue;
          }
          throw err;
        }
      }
    }

    // Update lead record to reflect conversion
    lead.status = LeadStatus.CONVERTED;
    lead.convertedCustomerId = customerDoc._id;
    lead.convertedAt = new Date();
    lead.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await lead.save();

    // Record conversion activity
    await LeadActivity.create({
      leadId: lead._id,
      customerId: customerDoc._id,
      activityType: ActivityType.NOTE,
      summary: `Lead converted to Customer ${customerDoc.customerCode}`,
      remarks: input.notes || 'Successfully converted prospect to customer account.',
      activityDate: new Date(),
      status: ActivityStatus.COMPLETED,
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.LEAD_CONVERTED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'Lead',
      targetId: lead._id.toString(),
      details: {
        leadCode: lead.leadCode,
        customerId: customerDoc._id.toString(),
        customerCode: customerDoc.customerCode
      }
    });

    const populated = await Lead.findById(lead._id).populate(
      'assignedToEmployeeId',
      'firstName lastName email'
    );
    return {
      lead: LeadService.toLeadDto(populated),
      customerId: customerDoc._id.toString(),
      customerCode: customerDoc.customerCode,
      isAlreadyConverted: false
    };
  }

  /**
   * Adds an interaction activity or follow-up note to the lead timeline.
   */
  public static async addActivity(
    leadId: string,
    input: CreateLeadActivityInput,
    user: UserContext
  ): Promise<LeadActivityDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(leadId)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw AppError.notFound(`Lead '${leadId}' not found.`);
    }

    let assignedId: Types.ObjectId | undefined;
    if (input.assignedEmployeeId && Types.ObjectId.isValid(input.assignedEmployeeId)) {
      assignedId = new Types.ObjectId(input.assignedEmployeeId);
    } else if (lead.assignedToEmployeeId) {
      assignedId = lead.assignedToEmployeeId;
    }

    const activityDoc = await LeadActivity.create({
      leadId: lead._id,
      customerId: lead.convertedCustomerId,
      activityType: input.activityType,
      summary: input.summary,
      remarks: input.remarks,
      activityDate: new Date(input.activityDate),
      nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : undefined,
      assignedEmployeeId: assignedId,
      status: input.status || ActivityStatus.COMPLETED,
      sentiment: input.sentiment,
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    if (input.nextFollowUpDate) {
      lead.nextFollowUpDate = new Date(input.nextFollowUpDate);
      await lead.save();
    }

    const populated = await LeadActivity.findById(activityDoc._id)
      .populate('assignedEmployeeId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    return LeadService.toActivityDto(populated);
  }

  /**
   * Retrieves chronological activity timeline for a lead.
   */
  public static async listActivities(
    leadId: string,
    user: UserContext
  ): Promise<LeadActivityDto[]> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(leadId)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const docs = await LeadActivity.find({ leadId: new Types.ObjectId(leadId) })
      .sort({ activityDate: -1, createdAt: -1 })
      .populate('assignedEmployeeId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .lean();

    return docs.map(d => LeadService.toActivityDto(d));
  }

  /**
   * Queries scheduled, overdue, and upcoming follow-ups with server-side date filtering.
   */
  public static async listFollowUps(
    filter: FollowUpFilterParams,
    user: UserContext
  ): Promise<{ data: any[]; pagination: ApiPagination }> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    const query: FilterQuery<ILeadActivityDocument> = {
      nextFollowUpDate: { $exists: true, $ne: null }
    };

    if (filter.status) {
      query.status = filter.status;
    } else {
      query.status = ActivityStatus.SCHEDULED;
    }

    if (user.role === UserRole.SALES_EXECUTIVE) {
      query.assignedEmployeeId = new Types.ObjectId(user.userId);
    } else if (filter.assignedEmployeeId && Types.ObjectId.isValid(filter.assignedEmployeeId)) {
      query.assignedEmployeeId = new Types.ObjectId(filter.assignedEmployeeId);
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filter.timeframe === 'overdue') {
      query.nextFollowUpDate = { $lt: startOfToday };
    } else if (filter.timeframe === 'today') {
      query.nextFollowUpDate = { $gte: startOfToday, $lte: endOfToday };
    } else if (filter.timeframe === 'upcoming') {
      query.nextFollowUpDate = { $gt: endOfToday };
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      LeadActivity.find(query)
        .sort({ nextFollowUpDate: 1 })
        .skip(skip)
        .limit(limit)
        .populate('leadId', 'leadCode prospectName prospectPhone status')
        .populate('assignedEmployeeId', 'firstName lastName email')
        .lean(),
      LeadActivity.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const formatted = docs.map(d => {
      const isOverdue = d.nextFollowUpDate ? new Date(d.nextFollowUpDate) < startOfToday : false;
      const isDueToday =
        d.nextFollowUpDate &&
        new Date(d.nextFollowUpDate) >= startOfToday &&
        new Date(d.nextFollowUpDate) <= endOfToday;

      return {
        ...LeadService.toActivityDto(d),
        lead: d.leadId
          ? {
              id: (d.leadId as any)._id?.toString(),
              leadCode: (d.leadId as any).leadCode,
              prospectName: (d.leadId as any).prospectName,
              prospectPhone: (d.leadId as any).prospectPhone,
              status: (d.leadId as any).status
            }
          : undefined,
        isOverdue,
        isDueToday
      };
    });

    return {
      data: formatted,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Marks a scheduled follow-up as completed and optionally reschedules next date.
   */
  public static async completeFollowUp(
    activityId: string,
    input: CompleteFollowUpInput,
    user: UserContext
  ): Promise<LeadActivityDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(activityId)) {
      throw AppError.validationFailed('Invalid activity ID format.');
    }

    const activity = await LeadActivity.findById(activityId);
    if (!activity) {
      throw AppError.notFound(`Activity '${activityId}' not found.`);
    }

    activity.status = ActivityStatus.COMPLETED;
    activity.completedAt = new Date();
    if (input.remarks) {
      activity.remarks = activity.remarks ? `${activity.remarks}\n${input.remarks}` : input.remarks;
    }
    if (input.sentiment) {
      activity.sentiment = input.sentiment;
    }

    await activity.save();

    // If next follow up is requested, schedule new activity
    if (input.nextFollowUpDate) {
      const nextDate = new Date(input.nextFollowUpDate);
      await LeadActivity.create({
        leadId: activity.leadId,
        customerId: activity.customerId,
        activityType: ActivityType.FOLLOW_UP,
        summary: `Follow-up scheduled after completing activity`,
        remarks: input.remarks,
        activityDate: nextDate,
        nextFollowUpDate: nextDate,
        assignedEmployeeId: activity.assignedEmployeeId,
        status: ActivityStatus.SCHEDULED,
        sentiment: input.sentiment,
        createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
      });

      await Lead.findByIdAndUpdate(activity.leadId, { nextFollowUpDate: nextDate });
    }

    const populated = await LeadActivity.findById(activity._id)
      .populate('assignedEmployeeId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    return LeadService.toActivityDto(populated);
  }
}
