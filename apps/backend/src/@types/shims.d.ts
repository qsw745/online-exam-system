// apps/backend/src/@types/shims.d.ts

/* 让 TS 把这些包当作 "有默认导出的 any" 来用，避免 2306/7016 报错 */
declare module 'cors' {
  const anyExport: any
  export default anyExport
}

declare module 'morgan' {
  const anyExport: any
  export default anyExport
}
