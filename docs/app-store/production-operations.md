# 问衡正式服务部署与恢复

核对日期：2026-09-08。以下为实际运行位置，配置副本在 `scripts/release/deployment/`；生产密钥不入库。

## 流量与服务

- `qisw.top` 入口：阿里云 `101.37.21.147`，Docker nginx，配置 `/opt/nginx/conf.d/site.conf`。根路径仍为原有门户，原有其他产品路径保持可用。
- `/wenheng/` 静态链接：`/data/website/wenheng` → 相对路径 `wenheng-releases/20260908-r2`。相对链接适用于 nginx 容器内的挂载路径。旧静态版本保留用于回退。
- `/wenheng/api/` 从入口以 HTTPS 转发到腾讯云 `124.223.200.182`，SNI 为 `wenheng-origin.internal`，启用证书验证。私有源站证书保留在 `/opt/wenheng/ssl/`，入口仅保存公钥证书。证书于 2027-09-08 到期，续期时需同步更新入口信任证书并验证 nginx。
- 源站只接受入口服务器和回环地址访问新 API；代理到 `127.0.0.1:3082`。
- 腾讯云 `/opt/wenheng/compose.yml` 管理 `wenheng-api`、`wenheng-lifecycle`、`wenheng-outbox`。当前镜像 `wenheng-api:20260908-r3`，仅 API 端口绑定回环地址。
- 复用已有 `online-exam-system_default` Docker 网络、MySQL、Redis、上传和服务密钥卷。`.env` 为 600 权限。
- 原 `/exam/` 网页入口跳转至新路径；旧 `/exam/api/` 也已转到当前 Node API，避免迁移后的新账号字段与旧 Java 写入逻辑不兼容。旧容器保留，但不再承担公开账号 API。

## 备份与注销清单

- 增量迁移前备份：`/opt/online-exam-system-backups/appstore-20260908/`，含原 SQL 压缩备份和配置副本，目录权限 700。
- 每日备份：腾讯云 `/opt/wenheng/backups/exam_system-*.sql.gz`，权限 600。`wenheng-maintenance.timer` 每日 04:30 执行，启动延迟最多 120 秒；验证压缩文件，并清理该每日备份目录中超过 30 天的匹配备份。
- 迁移前的专项备份不属于每日备份清理范围，恢复作业应另行管理其生命周期。
- 注销指纹独立保存在阿里云 `/var/lib/wenheng-manifests`，不与业务数据库放在同一备份恢复单元。`wenheng-manifests.service` 以独立非 root 用户运行，Bearer 认证、限制字段和请求大小；不保存邮箱或原用户 ID。
- 清单接收地址 `https://qisw.top/wenheng/internal/deletion-manifest`。密钥在接收服务环境文件及后端受限环境文件中；不要放到命令行参数、仓库或日志。
- 每日维护会认证访问清单接收器，触发 1095 天保留期限清理。重复写入内容一致时幂等成功，不一致时拒绝。
- 恢复业务数据库后，**先保持服务不对外开放，运行 `apps/backend/scripts/privacy/replay-deletion-manifest.ts` 对应的 `privacy:manifest:replay` 流程**，应用独立注销清单并验证，再恢复业务流量。不可只恢复旧备份后直接开放账号登录。

## 部署与回退

1. 本地按 `apps/backend/Dockerfile.release` 构建 `linux/amd64` 镜像；构建上下文排除真实 `.env`、上传、密钥和依赖缓存，但不要排除源码中名为 `logs` 的模块。
2. 镜像传输后，先保留当前 compose 副本，再更新镜像标签，执行 `docker compose up -d --wait`。生命周期和 outbox 必须同时运行。
3. 静态资源先部署到新的独立目录，最后原子替换 `/data/website/wenheng` 相对链接。
4. 只需回退应用代码时，可用 `/opt/wenheng/compose.before-r3.yml` 回到前一兼容镜像；本次 6 个迁移后的数据库不应直接交回旧 Java API。
5. 需要恢复数据库时，按上一节执行注销清单重放；不能覆盖上线后数据而不评估新增业务记录。
6. 检查健康接口、审核账号登录/刷新、题库与学习进度，以及 nginx 原有产品路径。

本次操作没有提交或推送 Git；工作区原有改动予以保留。
