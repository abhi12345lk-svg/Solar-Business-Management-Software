import { Types, FilterQuery } from 'mongoose';
import {
  SiteSurvey,
  ISiteSurveyDocument,
  Lead,
  Customer,
  User,
  LeadActivity
} from '../models/index.js';
import {
  CreateSiteSurveyInput,
  UpdateSiteSurveyInput,
  UpdateSurveyStatusInput,
  AttachSurveyPhotosInput,
  SurveyFilterParams,
  SiteSurveyDto,
  SurveyStatus,
  LeadStatus,
  SequenceEntityType,
  ActivityType,
  ActivityStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole,
  ApiPagination
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { UserContext } from './leadService.js';

export class SurveyService {
  /**
   * Transforms a SiteSurvey Mongoose document to a clean DTO.
   */
  public static toSurveyDto(doc: any): SiteSurveyDto {
    return {
      id: doc._id.toString(),
      surveyNumber: doc.surveyNumber,
      leadId: doc.leadId
        ? doc.leadId._id
          ? doc.leadId._id.toString()
          : doc.leadId.toString()
        : '',
      leadCode: doc.leadId && doc.leadId.leadCode ? doc.leadId.leadCode : undefined,
      customerId: doc.customerId
        ? doc.customerId._id
          ? doc.customerId._id.toString()
          : doc.customerId.toString()
        : undefined,
      customerCode:
        doc.customerId && doc.customerId.customerCode ? doc.customerId.customerCode : undefined,
      prospectName: doc.leadId && doc.leadId.prospectName ? doc.leadId.prospectName : undefined,
      siteAddress: {
        type: doc.siteAddress?.type,
        addressLine1: doc.siteAddress?.addressLine1 || '',
        addressLine2: doc.siteAddress?.addressLine2,
        landmark: doc.siteAddress?.landmark,
        city: doc.siteAddress?.city || '',
        district: doc.siteAddress?.district,
        state: doc.siteAddress?.state || '',
        stateCode: doc.siteAddress?.stateCode,
        postalCode: doc.siteAddress?.postalCode || '',
        country: doc.siteAddress?.country || 'India',
        geoCoordinates: doc.siteAddress?.geoCoordinates
      },
      roofType: doc.roofType,
      usableRoofAreaSqFt: doc.usableRoofAreaSqFt,
      grossRoofAreaSqFt: doc.grossRoofAreaSqFt,
      monthlyUnitsKwh: doc.monthlyUnitsKwh,
      averageMonthlyBillPaise: doc.averageMonthlyBillPaise,
      sanctionedLoadKw: doc.sanctionedLoadKw,
      connectionPhase: doc.connectionPhase,
      shadowAnalysisNotes: doc.shadowAnalysisNotes,
      orientationAzimuth: doc.orientationAzimuth,
      proposedCapacityKw: doc.proposedCapacityKw,
      surveyorEmployeeId: doc.surveyorEmployeeId
        ? doc.surveyorEmployeeId._id
          ? doc.surveyorEmployeeId._id.toString()
          : doc.surveyorEmployeeId.toString()
        : undefined,
      surveyorName:
        doc.surveyorEmployeeId && doc.surveyorEmployeeId.firstName
          ? `${doc.surveyorEmployeeId.firstName} ${doc.surveyorEmployeeId.lastName || ''}`.trim()
          : undefined,
      status: doc.status,
      scheduledDate: doc.scheduledDate ? new Date(doc.scheduledDate).toISOString() : undefined,
      completedDate: doc.completedDate ? new Date(doc.completedDate).toISOString() : undefined,
      observations: doc.observations,
      constraints: doc.constraints,
      recommendations: doc.recommendations,
      photos: (doc.photos || []).map((p: any) => ({
        storageKey: p.storageKey,
        fileName: p.fileName,
        fileSizeBytes: p.fileSizeBytes,
        mimeType: p.mimeType,
        category: p.category,
        caption: p.caption,
        geoCoordinates: p.geoCoordinates,
        uploadedBy: p.uploadedBy ? p.uploadedBy.toString() : undefined,
        uploadedAt: p.uploadedAt ? new Date(p.uploadedAt).toISOString() : undefined
      })),
      createdBy: doc.createdBy ? doc.createdBy.toString() : undefined,
      updatedBy: doc.updatedBy ? doc.updatedBy.toString() : undefined,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString()
    };
  }

  /**
   * Creates a new SiteSurvey with atomic sequence numbering.
   */
  public static async createSurvey(
    input: CreateSiteSurveyInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<SiteSurveyDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied('Customer portal users cannot create internal site surveys.');
    }

    if (!Types.ObjectId.isValid(input.leadId)) {
      throw AppError.validationFailed('Invalid lead ID format.');
    }

    const lead = await Lead.findById(input.leadId);
    if (!lead) {
      throw AppError.notFound(`Lead '${input.leadId}' not found.`);
    }

    let customerId: Types.ObjectId | undefined;
    if (input.customerId) {
      if (!Types.ObjectId.isValid(input.customerId)) {
        throw AppError.validationFailed('Invalid customer ID format.');
      }
      const customer = await Customer.findById(input.customerId);
      if (!customer) {
        throw AppError.notFound(`Customer '${input.customerId}' not found.`);
      }
      customerId = customer._id;
    } else if (lead.convertedCustomerId) {
      customerId = lead.convertedCustomerId;
    }

    let surveyorId: Types.ObjectId | undefined;
    if (input.surveyorEmployeeId) {
      if (!Types.ObjectId.isValid(input.surveyorEmployeeId)) {
        throw AppError.validationFailed('Invalid surveyor employee ID format.');
      }
      const surveyor = await User.findById(input.surveyorEmployeeId);
      if (!surveyor || !surveyor.isActive) {
        throw AppError.validationFailed('Surveyor employee does not exist or is inactive.');
      }
      surveyorId = surveyor._id;
    } else if (user.role === UserRole.SURVEYOR) {
      surveyorId = new Types.ObjectId(user.userId);
    }

    // Atomic sequential survey ID
    const seqResult = await SequenceService.generateNumber(SequenceEntityType.SITE_SURVEY);
    const surveyNumber = seqResult.formattedNumber;

    const surveyDoc = await SiteSurvey.create({
      surveyNumber,
      leadId: lead._id,
      customerId,
      siteAddress: input.siteAddress,
      roofType: input.roofType,
      usableRoofAreaSqFt: input.usableRoofAreaSqFt,
      grossRoofAreaSqFt: input.grossRoofAreaSqFt,
      monthlyUnitsKwh: input.monthlyUnitsKwh,
      averageMonthlyBillPaise: input.averageMonthlyBillPaise,
      sanctionedLoadKw: input.sanctionedLoadKw,
      connectionPhase: input.connectionPhase,
      shadowAnalysisNotes: input.shadowAnalysisNotes,
      orientationAzimuth: input.orientationAzimuth,
      proposedCapacityKw: input.proposedCapacityKw,
      surveyorEmployeeId: surveyorId,
      status: input.scheduledDate ? SurveyStatus.SCHEDULED : SurveyStatus.DRAFT,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
      observations: input.observations,
      constraints: input.constraints,
      recommendations: input.recommendations,
      photos: [],
      createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
    });

    // Automatically transition lead to SURVEY_SCHEDULED if open
    if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) {
      lead.status = LeadStatus.SURVEY_SCHEDULED;
      await lead.save();

      await LeadActivity.create({
        leadId: lead._id,
        activityType: ActivityType.SITE_VISIT,
        summary: `Site Survey ${surveyNumber} created and scheduled`,
        remarks: input.observations || `Scheduled on: ${input.scheduledDate || 'TBD'}`,
        activityDate: new Date(),
        assignedEmployeeId: surveyorId,
        status: ActivityStatus.SCHEDULED,
        createdBy: Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined
      });
    }

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SURVEY_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'SiteSurvey',
      targetId: surveyDoc._id.toString(),
      details: {
        surveyNumber,
        leadId: lead._id.toString(),
        usableRoofAreaSqFt: input.usableRoofAreaSqFt,
        sanctionedLoadKw: input.sanctionedLoadKw
      }
    });

    const populated = await SiteSurvey.findById(surveyDoc._id)
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('customerId', 'customerCode name')
      .populate('surveyorEmployeeId', 'firstName lastName email');

    return SurveyService.toSurveyDto(populated);
  }

  /**
   * Lists surveys with filtering, search, pagination, and RBAC record scoping.
   */
  public static async listSurveys(
    filter: SurveyFilterParams,
    user: UserContext
  ): Promise<{ data: SiteSurveyDto[]; pagination: ApiPagination }> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied('Customer portal users cannot access internal surveys.');
    }

    const query: FilterQuery<ISiteSurveyDocument> = {};

    if (user.role === UserRole.SURVEYOR) {
      query.surveyorEmployeeId = new Types.ObjectId(user.userId);
    } else if (filter.surveyorEmployeeId && Types.ObjectId.isValid(filter.surveyorEmployeeId)) {
      query.surveyorEmployeeId = new Types.ObjectId(filter.surveyorEmployeeId);
    }

    if (filter.leadId && Types.ObjectId.isValid(filter.leadId)) {
      query.leadId = new Types.ObjectId(filter.leadId);
    }
    if (filter.customerId && Types.ObjectId.isValid(filter.customerId)) {
      query.customerId = new Types.ObjectId(filter.customerId);
    }
    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search) {
      const s = filter.search.trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { surveyNumber: { $regex: escaped, $options: 'i' } },
        { 'siteAddress.city': { $regex: escaped, $options: 'i' } },
        { 'siteAddress.state': { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sortField = filter.sortBy || 'createdAt';
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const [docs, total] = await Promise.all([
      SiteSurvey.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('leadId', 'leadCode prospectName prospectPhone')
        .populate('customerId', 'customerCode name')
        .populate('surveyorEmployeeId', 'firstName lastName email')
        .lean(),
      SiteSurvey.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: docs.map(d => SurveyService.toSurveyDto(d)),
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
   * Retrieves a single site survey by ID or Survey Number.
   */
  public static async getSurveyById(idOrNumber: string, user: UserContext): Promise<SiteSurveyDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    const query = Types.ObjectId.isValid(idOrNumber)
      ? { _id: new Types.ObjectId(idOrNumber) }
      : { surveyNumber: idOrNumber.toUpperCase() };

    const doc = await SiteSurvey.findOne(query)
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('customerId', 'customerCode name')
      .populate('surveyorEmployeeId', 'firstName lastName email');

    if (!doc) {
      throw AppError.notFound(`Site Survey '${idOrNumber}' not found.`);
    }

    // Role check: Surveyor can only access their own surveys
    if (user.role === UserRole.SURVEYOR && doc.surveyorEmployeeId) {
      const assignedId = (doc.surveyorEmployeeId as any)._id
        ? (doc.surveyorEmployeeId as any)._id.toString()
        : doc.surveyorEmployeeId.toString();
      if (assignedId !== user.userId) {
        throw AppError.permissionDenied(
          'You are not authorized to access another surveyor’s survey.'
        );
      }
    }

    return SurveyService.toSurveyDto(doc);
  }

  /**
   * Updates survey measurements, address, observations, and recommendations.
   */
  public static async updateSurvey(
    id: string,
    input: UpdateSiteSurveyInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<SiteSurveyDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid survey ID format.');
    }

    const survey = await SiteSurvey.findById(id);
    if (!survey) {
      throw AppError.notFound(`Site Survey '${id}' not found.`);
    }

    if (
      survey.status === SurveyStatus.COMPLETED &&
      user.role !== UserRole.SUPERADMIN &&
      user.role !== UserRole.ADMIN
    ) {
      throw AppError.businessRule(
        'Completed site surveys cannot be modified without administrator approval.'
      );
    }

    if (input.siteAddress !== undefined) survey.siteAddress = input.siteAddress as any;
    if (input.roofType !== undefined) survey.roofType = input.roofType;
    if (input.usableRoofAreaSqFt !== undefined)
      survey.usableRoofAreaSqFt = input.usableRoofAreaSqFt;
    if (input.grossRoofAreaSqFt !== undefined) survey.grossRoofAreaSqFt = input.grossRoofAreaSqFt;
    if (input.monthlyUnitsKwh !== undefined) survey.monthlyUnitsKwh = input.monthlyUnitsKwh;
    if (input.averageMonthlyBillPaise !== undefined)
      survey.averageMonthlyBillPaise = input.averageMonthlyBillPaise;
    if (input.sanctionedLoadKw !== undefined) survey.sanctionedLoadKw = input.sanctionedLoadKw;
    if (input.connectionPhase !== undefined) survey.connectionPhase = input.connectionPhase;
    if (input.shadowAnalysisNotes !== undefined)
      survey.shadowAnalysisNotes = input.shadowAnalysisNotes;
    if (input.orientationAzimuth !== undefined)
      survey.orientationAzimuth = input.orientationAzimuth;
    if (input.proposedCapacityKw !== undefined)
      survey.proposedCapacityKw = input.proposedCapacityKw;
    if (input.observations !== undefined) survey.observations = input.observations;
    if (input.constraints !== undefined) survey.constraints = input.constraints;
    if (input.recommendations !== undefined) survey.recommendations = input.recommendations;

    if (input.surveyorEmployeeId !== undefined) {
      if (Types.ObjectId.isValid(input.surveyorEmployeeId)) {
        survey.surveyorEmployeeId = new Types.ObjectId(input.surveyorEmployeeId);
      }
    }
    if (input.scheduledDate !== undefined) {
      survey.scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : undefined;
    }
    if (input.completedDate !== undefined) {
      survey.completedDate = input.completedDate ? new Date(input.completedDate) : undefined;
    }

    survey.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await survey.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SURVEY_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'SiteSurvey',
      targetId: survey._id.toString(),
      details: { surveyNumber: survey.surveyNumber }
    });

    const populated = await SiteSurvey.findById(survey._id)
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('customerId', 'customerCode name')
      .populate('surveyorEmployeeId', 'firstName lastName email');

    return SurveyService.toSurveyDto(populated);
  }

  /**
   * Updates survey status (DRAFT -> SCHEDULED -> IN_PROGRESS -> COMPLETED / REJECTED / CANCELLED).
   */
  public static async updateStatus(
    id: string,
    input: UpdateSurveyStatusInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<SiteSurveyDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid survey ID format.');
    }

    const survey = await SiteSurvey.findById(id);
    if (!survey) {
      throw AppError.notFound(`Site Survey '${id}' not found.`);
    }

    const oldStatus = survey.status;
    survey.status = input.status;

    if (input.status === SurveyStatus.COMPLETED && !survey.completedDate) {
      survey.completedDate = new Date();
    }

    survey.updatedBy = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;
    await survey.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SURVEY_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'SiteSurvey',
      targetId: survey._id.toString(),
      details: {
        surveyNumber: survey.surveyNumber,
        oldStatus,
        newStatus: input.status,
        remarks: input.remarks
      }
    });

    const populated = await SiteSurvey.findById(survey._id)
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('customerId', 'customerCode name')
      .populate('surveyorEmployeeId', 'firstName lastName email');

    return SurveyService.toSurveyDto(populated);
  }

  /**
   * Attaches validated photo and document metadata subdocuments to a survey record.
   */
  public static async attachPhotos(
    id: string,
    input: AttachSurveyPhotosInput,
    user: UserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId: string }
  ): Promise<SiteSurveyDto> {
    if (user.role === UserRole.CUSTOMER) {
      throw AppError.permissionDenied();
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid survey ID format.');
    }

    const survey = await SiteSurvey.findById(id);
    if (!survey) {
      throw AppError.notFound(`Site Survey '${id}' not found.`);
    }

    const uploaderObjectId = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : undefined;

    const newPhotos = input.photos.map(p => ({
      storageKey: p.storageKey,
      fileName: p.fileName,
      fileSizeBytes: p.fileSizeBytes,
      mimeType: p.mimeType,
      category: p.category,
      caption: p.caption,
      geoCoordinates: p.geoCoordinates,
      uploadedBy: uploaderObjectId,
      uploadedAt: new Date()
    }));

    survey.photos.push(...(newPhotos as any));
    survey.updatedBy = uploaderObjectId;
    await survey.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SURVEY_PHOTOS_ATTACHED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      targetEntity: 'SiteSurvey',
      targetId: survey._id.toString(),
      details: {
        surveyNumber: survey.surveyNumber,
        photosAddedCount: newPhotos.length
      }
    });

    const populated = await SiteSurvey.findById(survey._id)
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('customerId', 'customerCode name')
      .populate('surveyorEmployeeId', 'firstName lastName email');

    return SurveyService.toSurveyDto(populated);
  }
}
