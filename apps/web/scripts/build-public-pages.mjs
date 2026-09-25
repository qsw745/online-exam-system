import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const data = JSON.parse(await readFile(path.join(root, 'src/features/legal/legalContent.json'), 'utf8'))
const output = path.resolve(process.argv[2] || path.join(root, 'public'))
await mkdir(output, { recursive: true })
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const support = [
  ['联系我们', `问衡由${data.operator}运营。遇到登录、学习记录、考试同步、账号注销或隐私问题，请发送邮件至 ${data.email}。`],
  ['反馈时请提供', '请说明 App 版本、设备型号、发生时间和操作步骤。可附不含个人敏感信息的截图；请勿发送密码、验证码、身份文件或人脸照片。'],
  ['登录与同步', '确认设备已联网，并使用注册时的邮箱登录。忘记密码可在登录页选择“忘记密码”。考试出现网络中断时，请保留 App 与本地进度，恢复网络后查看同步结果。'],
  ['成绩与考试复核', '考试内容、时间与成绩规则由考试组织者提供。请优先通过该考试提供的复核入口向组织者提出异议；应用技术问题可联系问衡客服。'],
  ['注销与隐私请求', '在 App 的“我的”中进入账号设置发起注销，可选择立即处理或 30 天后处理。请保存状态凭证以查询进度。如无法登录，或需要更正资料、请求数据副本及反馈隐私问题，请通过客服邮箱联系我们。'],
]
const about = [
  ['让每一步学习都有迹可循', '问衡将学习任务、题目练习、错题复习和成绩记录放在一起，面向个人学习者与机构考生。'],
  ['练习与复习', '按知识点练习题目，回看错题，收藏重要内容，并查看学习进度。'],
  ['任务与考试', '集中查看已分配的学习任务与考试安排，参加考试，并在成绩发布后查看结果。题库与考试内容以账号获得的权限为准。'],
  ['可管理的账号', '个人资料、隐私授权与账号注销入口均可在 App 中访问。基础功能当前免费，需要联网与有效账号。'],
]
for (const [name, title, sections] of [['privacy','问衡隐私政策',data.privacy],['terms','问衡用户协议',data.terms],['support','问衡技术支持',support],['about','问衡 · 学习与测评',about]]) {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title><meta name="description" content="问衡：练习、考试与学习进度管理。隐私政策、用户协议与技术支持。"><style>*{box-sizing:border-box}body{margin:0;background:#f6f9f8;color:#273b35;font:16px/1.9 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:860px;margin:auto;padding:48px 22px}nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;padding:20px 0;border-bottom:1px solid #dce6e1}a{color:#087f67;text-underline-offset:4px}header{padding:30px 0 10px}header p,footer{color:#65786e;font-size:14px}h1{font-size:30px;line-height:1.4;letter-spacing:.02em}h2{font-size:19px;margin:0 0 10px}section{margin-top:22px;background:#fff;padding:24px;border:1px solid #e3ebe7;border-radius:16px}p{margin:0;overflow-wrap:anywhere}footer{padding:30px 0}.contact{display:inline-block;margin-top:18px;padding:10px 20px;border-radius:12px;background:#e2f3ed;font-weight:600}@media(max-width:500px){main{padding:16px}h1{font-size:26px}section{padding:20px}}</style></head><body><main><nav aria-label="网站导航"><a href="about.html">问衡</a><a href="support.html">技术支持</a><a href="privacy.html">隐私政策</a><a href="terms.html">用户协议</a></nav><header><h1>${escape(title)}</h1><p>${escape(data.effectiveDate)} · 运营者：${escape(data.operator)}</p></header>${sections.map(([heading,body])=>`<section><h2>${escape(heading)}</h2><p>${escape(body)}</p></section>`).join('')}<a class="contact" href="mailto:${escape(data.email)}">联系问衡客服</a><footer>© 2026 ${escape(data.operator)} · 问衡</footer></main></body></html>`
  await writeFile(path.join(output, `${name}.html`), html)
}
console.log(`已生成 4 个问衡公开页面：${output}`)
