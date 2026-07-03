// 统一按 Vite 的 BASE_URL 拼接 public 静态资源路径，供人脸检测的离线资源加载复用。
export function publicAsset(path: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}${path.replace(/^\/+/, '')}`
}
