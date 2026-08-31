import assert from 'node:assert/strict'
import test from 'node:test'
import { encryptOutboxValue } from '../domain/outbox-crypto'
import { MemoryLifecycleMetrics } from './lifecycle-observability'
import {
  assertLifecycleMailerConfigured,
  dispatchLifecycleOutboxOnce,
  type LifecycleOutboxRepositoryContract,
} from './lifecycle-notification.service'

const key=Buffer.alloc(32,9), now=new Date('2026-08-31T08:00:00.000Z')
class MemoryOutbox implements LifecycleOutboxRepositoryContract{
  message:any={messageId:'a132689c-4a5d-42a2-86c5-3661e62d4d1f',requestId:'b132689c-4a5d-42a2-86c5-3661e62d4d1f',dataRegion:'CN',messageType:'DELETION_REQUESTED',recipientEnvelope:encryptOutboxValue(key,'user@example.com'),payloadEnvelope:encryptOutboxValue(key,JSON.stringify({status:'SCHEDULED',scheduledFor:'2026-09-30T08:00:00.000Z'})),attemptCount:0,expiresAt:new Date('2026-09-07T08:00:00.000Z')}
  expired=0
  async purgeExpired(){
    let expiredNow=0
    if(this.message&&this.message.expiresAt<=now&&this.message.status!=='SENT'&&this.message.status!=='EXPIRED'){
      this.message.status='EXPIRED';this.message.recipientEnvelope=null;this.message.payloadEnvelope=null;this.expired+=1;expiredNow=1
    }
    return expiredNow
  }
  async readQueueStats(){return{depth:this.message&&['PENDING','RETRYING','RUNNING'].includes(this.message.status??'PENDING')?1:0,oldestAgeMs:2000}}
  async claimDue(){return this.message&&this.message.status!=='SENT'&&this.message.status!=='EXPIRED'?this.message:null}
  async markSent(){this.message.recipientEnvelope=null;this.message.payloadEnvelope=null;this.message.status='SENT'}
  async markRetry(){this.message.attemptCount+=1;this.message.status='RETRYING'}
}
test('发送最小化通知后立即清除密文且不泄露敏感明细',async()=>{
  const repo=new MemoryOutbox(),sent:any[]=[],metrics=new MemoryLifecycleMetrics()
  const options={repository:repo,keyring:{v1:key},mailer:{async sendPlainEmail(to:string,subject:string,body:string){sent.push({to,subject,body})}},workerId:'outbox-a',now,leaseMs:30000,metrics}
  const result=await dispatchLifecycleOutboxOnce(options)
  assert.equal(result.sent,1);assert.equal(repo.message.recipientEnvelope,null)
  assert.equal(sent[0].to,'user@example.com');assert.doesNotMatch(sent[0].body,/成绩|监考|人脸|删除统计/)
  const replay=await dispatchLifecycleOutboxOnce(options)
  assert.equal(replay.claimed,0);assert.equal(sent.length,1)
  assert.deepEqual(metrics.events.slice(0,2).map(event=>event.name),['lifecycle_outbox_queue_depth','lifecycle_outbox_oldest_age_ms'])
  assert.equal(metrics.events.every(event=>!('requestId'in event.labels)&&!('messageId'in event.labels)),true)
})
test('发送失败进入退避且不伪装成已发送',async()=>{
  const repo=new MemoryOutbox(),metrics=new MemoryLifecycleMetrics()
  const result=await dispatchLifecycleOutboxOnce({repository:repo,keyring:{v1:key},mailer:{async sendPlainEmail(){throw Object.assign(new Error('temporary'),{code:'LIFECYCLE_MAIL_TEMPORARY'})}},workerId:'outbox-a',now,leaseMs:30000,metrics})
  assert.equal(result.retried,1);assert.equal(repo.message.status,'RETRYING')
  assert.equal(metrics.events.some(event=>event.name==='lifecycle_outbox_retried'),true)
})
test('七天后未发送消息也会清空收件地址与载荷且只过期一次',async()=>{
  const repo=new MemoryOutbox(),metrics=new MemoryLifecycleMetrics()
  repo.message.expiresAt=new Date('2026-08-31T07:59:59.000Z')
  const options={repository:repo,keyring:{v1:key},mailer:{async sendPlainEmail(){throw new Error('不应发送')}},workerId:'outbox-a',now,leaseMs:30000,metrics}
  const first=await dispatchLifecycleOutboxOnce(options)
  const second=await dispatchLifecycleOutboxOnce(options)
  assert.equal(first.expired,1);assert.equal(second.expired,0)
  assert.equal(repo.message.recipientEnvelope,null);assert.equal(repo.message.payloadEnvelope,null)
})
test('生命周期消息 Worker 未配置真实邮件适配器时拒绝启动',()=>{
  assert.throws(
    ()=>assertLifecycleMailerConfigured({}),
    (error:unknown)=>(error as {code?:string}).code==='LIFECYCLE_MAILER_REQUIRED',
  )
  assert.throws(
    ()=>assertLifecycleMailerConfigured({EMAIL_HOST:'smtp.example.com',EMAIL_USER:'your_email@qq.com',EMAIL_PASS:'secret'}),
    (error:unknown)=>(error as {code?:string}).code==='LIFECYCLE_MAILER_REQUIRED',
  )
  assert.doesNotThrow(()=>assertLifecycleMailerConfigured({EMAIL_HOST:'smtp.example.com',EMAIL_USER:'sender@example.com',EMAIL_PASS:'secret'}))
})
