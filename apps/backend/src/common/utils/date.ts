export const nowFmt = () =>
  new Date().toISOString().replace("T", " ").split(".")[0]; // yyyy-MM-dd HH:mm:ss
