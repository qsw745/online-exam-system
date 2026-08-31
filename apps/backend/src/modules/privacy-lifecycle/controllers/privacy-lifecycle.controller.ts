import type { Response } from 'express'
import { getServiceDataRegion } from '@/config/data-region'
import { pool } from '@/config/database'
import type { AuthRequest } from '@/types/auth'
import { LifecycleSchemaAuditService } from '../services/lifecycle-schema-audit.service'
import { PrivacyLifecycleAdminService, type LifecycleAdminActor } from '../services/privacy-lifecycle-admin.service'
import { PrivacyLifecycleAdminRepository } from '../repositories/privacy-lifecycle-admin.repository'
import { createLifecycleHandlerMap } from '../handlers'

const dataRegion = getServiceDataRegion() ?? 'CN'
const service = new PrivacyLifecycleAdminService({dataRegion,repository:PrivacyLifecycleAdminRepository,schemaAudit:new LifecycleSchemaAuditService(pool as any),handlers:createLifecycleHandlerMap()})
const actor=(req:AuthRequest):LifecycleAdminActor=>({userId:Number(req.user?.id),role:String(req.user?.role||''),dataRegion:(req.user?.dataRegion??dataRegion)})

export class PrivacyLifecycleController {
  static async listRequests(req:AuthRequest,res:Response){return (res as any).ok(await service.listRequests(actor(req),req.query))}
  static async getRequest(req:AuthRequest,res:Response){return (res as any).ok(await service.getRequest(actor(req),String(req.params.requestId)))}
  static async dryRun(req:AuthRequest,res:Response){return (res as any).ok(await service.dryRun(actor(req),{requestId:req.body?.requestId}))}
  static async createHold(req:AuthRequest,res:Response){return (res as any).ok(await service.createHold(actor(req),req.body))}
  static async releaseHold(req:AuthRequest,res:Response){return (res as any).ok(await service.releaseHold(actor(req),String(req.params.holdId)))}
  static async extendHold(req:AuthRequest,res:Response){return (res as any).ok(await service.extendHold(actor(req),String(req.params.holdId),String(req.body?.expiresAt||'')))}
  static async pause(req:AuthRequest,res:Response){return (res as any).ok(await service.pauseRegion(actor(req),{reason:String(req.body?.reason||''),reviewAt:String(req.body?.reviewAt||'')}))}
  static async resume(req:AuthRequest,res:Response){return (res as any).ok(await service.resumeRegion(actor(req)))}
  static async retry(req:AuthRequest,res:Response){return (res as any).ok(await service.retryStep(actor(req),String(req.params.stepId)))}
}
