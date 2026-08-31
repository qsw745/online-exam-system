import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto'
export type EncryptedEnvelope={keyVersion:string;iv:string;ciphertext:string;authTag:string}
export type OutboxKeyring=Record<string,Buffer>
export function encryptOutboxValue(key:Buffer,value:string,randomIv:()=>Buffer=()=>randomBytes(12),keyVersion='v1'):EncryptedEnvelope{
  if(key.length!==32)throw Object.assign(new Error('消息箱密钥必须为 32 字节'),{code:'LIFECYCLE_OUTBOX_KEY_INVALID'})
  const iv=randomIv();if(iv.length!==12)throw Object.assign(new Error('消息箱 IV 必须为 12 字节'),{code:'LIFECYCLE_OUTBOX_IV_INVALID'})
  const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`wenheng-outbox:${keyVersion}`))
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()])
  return{keyVersion,iv:iv.toString('base64url'),ciphertext:ciphertext.toString('base64url'),authTag:cipher.getAuthTag().toString('base64url')}
}
export function decryptOutboxValue(key:Buffer,envelope:EncryptedEnvelope):string{
  if(key.length!==32)throw Object.assign(new Error('消息箱密钥无效'),{code:'LIFECYCLE_OUTBOX_KEY_INVALID'})
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64url'));decipher.setAAD(Buffer.from(`wenheng-outbox:${envelope.keyVersion}`));decipher.setAuthTag(Buffer.from(envelope.authTag,'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64url')),decipher.final()]).toString('utf8')
}
export function parseOutboxKeyring(env:Record<string,string|undefined>):OutboxKeyring{
  const raw=env.LIFECYCLE_OUTBOX_KEY_V1;if(!raw)throw Object.assign(new Error('缺少消息箱密钥'),{code:'LIFECYCLE_OUTBOX_KEY_REQUIRED'})
  const key=Buffer.from(raw,'base64');if(key.length!==32||key.toString('base64').replace(/=+$/,'')!==raw.replace(/=+$/,''))throw Object.assign(new Error('消息箱密钥格式无效'),{code:'LIFECYCLE_OUTBOX_KEY_INVALID'})
  return{v1:key}
}
