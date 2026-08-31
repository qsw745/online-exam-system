import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptOutboxValue, encryptOutboxValue, parseOutboxKeyring } from './outbox-crypto'

test('消息箱密文不包含邮箱或原始载荷', () => {
  const envelope=encryptOutboxValue(Buffer.alloc(32,9),'user@example.com',()=>Buffer.alloc(12,3))
  assert.doesNotMatch(JSON.stringify(envelope),/user@example\.com/)
  assert.equal(decryptOutboxValue(Buffer.alloc(32,9),envelope),'user@example.com')
})
test('认证标签被篡改和未知密钥版本都失败关闭',()=>{
  const key=Buffer.alloc(32,9), envelope=encryptOutboxValue(key,'secret')
  assert.throws(()=>decryptOutboxValue(key,{...envelope,authTag:Buffer.alloc(16).toString('base64url')}),/认证|authenticate|Unsupported/i)
  assert.throws(()=>parseOutboxKeyring({LIFECYCLE_OUTBOX_KEY_V1:'bad'}),(error:any)=>error.code==='LIFECYCLE_OUTBOX_KEY_INVALID')
})
