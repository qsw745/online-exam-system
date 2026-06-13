# ================== backend-refactor.ps1 (可直接粘贴运行) ==================
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Now { (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
$ROOT = (Resolve-Path ".").Path
$LOG  = Join-Path $ROOT ("refactor_log_{0}.txt" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
"[$(Now)] Start backend structure refactor at $ROOT" | Out-File $LOG -Encoding utf8

function Log { param([string]$msg) $line="[$(Now)] $msg"; $line | Tee-Object -FilePath $LOG -Append }
function MkdirSafe { param($p) if (-not (Test-Path $p)) { if($DryRun){ Log "MKDIR $p" } else { New-Item -ItemType Directory -Force -Path $p | Out-Null; Log "MKDIR $p" } } }
function MoveSafe {
  param($src, $dst)
  if (-not (Test-Path $src)) { Log "MISS  $src (skip)"; return }
  $dstDir = Split-Path $dst -Parent
  MkdirSafe $dstDir
  if (Test-Path $dst) {
    $conflictDir = Join-Path $ROOT "_conflict"
    MkdirSafe $conflictDir
    $dst = Join-Path $conflictDir ((Split-Path $dst -Leaf) -replace '\.ts$','_conflict.ts')
    Log "CONF  $src -> $dst (target existed)"
  } else {
    Log "MOVE  $src -> $dst"
  }
  if (-not $DryRun) { Move-Item -Force -Path $src -Destination $dst }
}

# 1) 目标目录
$dirs = @(
  "src/common/dto","src/common/errors","src/common/middleware","src/common/utils",
  "src/infrastructure/db/migrations","src/infrastructure/db/seeds",
  "src/infrastructure/email","src/infrastructure/logging",
  "src/modules/auth","src/modules/users","src/modules/orgs",
  "src/modules/roles","src/modules/questions","src/modules/exams",
  "src/modules/favorites","src/modules/tasks","src/modules/notifications",
  "src/modules/analytics","src/modules/leaderboard","src/modules/learning-progress",
  "db/migrations","db/seeds","scripts"
)
$dirs | ForEach-Object { MkdirSafe $_ }

# 2) 基础设施/配置/公共
MoveSafe "src\services\logger.service.ts" "src\infrastructure\logging\logger.ts"
MoveSafe "src\utils\email.service.ts"     "src\infrastructure\email\email.service.ts"
MoveSafe "src\constants\roles.ts"         "src\config\roles.ts"

# 中间件重命名收口
MoveSafe "src\middleware\auth.middleware.ts"    "src\common\middleware\auth.ts"
MoveSafe "src\middleware\roleAuth.ts"           "src\common\middleware\role-auth.ts"
MoveSafe "src\middleware\upload.middleware.ts"  "src\common\middleware\upload.ts"
MoveSafe "src\middleware\validation.ts"         "src\common\middleware\validation.ts"

# 3) 数据库相关
# database.ts/init-db.ts 归位
MoveSafe "src\config\database.ts"   "src\infrastructure\db\index.ts"
MoveSafe "src\config\init-db.ts"    "scripts\init-db.ts"

# 把 src/config/migrations 与 src/migrations 下的 *.sql 合并到 db/migrations
Get-ChildItem -ErrorAction SilentlyContinue -Path "src\config\migrations","src\migrations" -Include *.sql -Recurse | ForEach-Object {
  MoveSafe $_.FullName ("db\migrations\" + $_.Name)
}

# 根目录 *.sql 分发：含 seed/insert 的进 seeds，其它进 migrations
Get-ChildItem -ErrorAction SilentlyContinue -Path "." -File -Include *.sql | ForEach-Object {
  $name = $_.Name.ToLower()
  if ($name -match 'seed' -or $name -match '^insert_' ) {
    MoveSafe $_.FullName ("db\seeds\" + $_.Name)
  } else {
    MoveSafe $_.FullName ("db\migrations\" + $_.Name)
  }
}

# 4) 模块化搬迁（controller / routes / services / models）
# —— controller
$controllerMap = @{
  "analytics.controller.ts"        = "analytics"
  "auth.controller.ts"             = "auth"
  "dashboard.controller.ts"        = "analytics"
  "discussions.controller.ts"      = "notifications"
  "exam.controller.ts"             = "exams"
  "favorite.controller.ts"         = "favorites"
  "favorites.controller.ts"        = "favorites"
  "leaderboard.controller.ts"      = "leaderboard"
  "learning-progress.controller.ts"= "learning-progress"
  "log.controller.ts"              = "analytics"
  "menu.controller.ts"             = "roles"
  "notification.controller.ts"     = "notifications"
  "org.controller.ts"              = "orgs"
  "org-user.controller.ts"         = "orgs"
  "paper.controller.ts"            = "exams"
  "password-reset.controller.ts"   = "auth"
  "question.controller.ts"         = "questions"
  "result.controller.ts"           = "exams"
  "role.controller.ts"             = "roles"
  "task.controller.ts"             = "tasks"
  "user.controller.ts"             = "users"
  "wrong-question.controller.ts"   = "wrong-questions"
}
Get-ChildItem "src\controllers" -Filter *.ts -ErrorAction SilentlyContinue | ForEach-Object {
  $mod = $controllerMap[$_.Name]
  if ($null -ne $mod) {
    MkdirSafe ("src\modules\$mod")
    MoveSafe $_.FullName ("src\modules\$mod\" + $_.Name)
  } else {
    Log "WARN  controller not mapped: $($_.Name)"
  }
}

# —— services
$serviceMap = @{
  "discussions.service.ts"       = "notifications"
  "favorites.service.ts"         = "favorites"
  "leaderboard.service.ts"       = "leaderboard"
  "learning-progress.service.ts" = "learning-progress"
  "logger.service.ts"            = ""   # 已在上面迁移
  "menu.service.ts"              = "roles"
  "org-user.service.ts"          = "orgs"
  "role.service.ts"              = "roles"
  "wrong-question.service.ts"    = "wrong-questions"
}
Get-ChildItem "src\services" -Filter *.ts -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.Name -eq "logger.service.ts") { return }
  $mod = $serviceMap[$_.Name]
  if ($null -ne $mod -and $mod -ne "") {
    MkdirSafe ("src\modules\$mod")
    MoveSafe $_.FullName ("src\modules\$mod\" + $_.Name)
  } else {
    Log "WARN  service not mapped: $($_.Name)"
  }
}

# —— routes
$routesMap = @{
  "analytics.routes.ts"        = "analytics"
  "auth.routes.ts"             = "auth"
  "dashboard.routes.ts"        = "analytics"
  "discussions.routes.ts"      = "notifications"
  "exam.routes.ts"             = "exams"
  "exam_result.routes.ts"      = "exams"
  "favorite.routes.ts"         = "favorites"
  "favorites.routes.ts"        = "favorites"
  "leaderboard.routes.ts"      = "leaderboard"
  "learning-progress.routes.ts"= "learning-progress"
  "log.routes.ts"              = "analytics"
  "menu.routes.ts"             = "roles"
  "notification.routes.ts"     = "notifications"
  "org.routes.ts"              = "orgs"
  "org-user.routes.ts"         = "orgs"
  "paper.routes.ts"            = "exams"
  "password-reset.routes.ts"   = "auth"
  "question.routes.ts"         = "questions"
  "result.routes.ts"           = "exams"
  "role.routes.ts"             = "roles"
  "task.routes.ts"             = "tasks"
  "user.routes.ts"             = "users"
  "wrong-question.routes.ts"   = "wrong-questions"
}
Get-ChildItem "src\routes" -Filter *.ts -ErrorAction SilentlyContinue | ForEach-Object {
  $mod = $routesMap[$_.Name]
  if ($null -ne $mod) {
    MkdirSafe ("src\modules\$mod")
    MoveSafe $_.FullName ("src\modules\$mod\" + $_.Name)
  } else {
    Log "WARN  route not mapped: $($_.Name)"
  }
}

# —— models 先集中到各模块 models 子目录（保持命名，不强制改成 repo）
$modelsMap = @{
  "menu.model.ts"          = "roles"
  "notification.model.ts"  = "notifications"
  "result.model.ts"        = "exams"
  "task.model.ts"          = "tasks"
}
Get-ChildItem "src\models" -Filter *.ts -ErrorAction SilentlyContinue | ForEach-Object {
  $mod = $modelsMap[$_.Name]
  if ($null -ne $mod) {
    MkdirSafe ("src\modules\$mod\models")
    MoveSafe $_.FullName ("src\modules\$mod\models\" + $_.Name)
  } else {
    Log "WARN  model not mapped: $($_.Name)"
  }
}

# 5) 生成基础骨架文件（若不存在则创建）
function EnsureFile {
  param($path, [string]$content)
  if (Test-Path $path) { Log "KEEP  $path"; return }
  MkdirSafe (Split-Path $path -Parent)
  Log "MAKE  $path"
  if (-not $DryRun) { $content | Out-File -Encoding utf8 $path }
}

EnsureFile "src\common\dto\response.ts" @'
export type ApiSuccess<T = any> = { success: true; data: T; total?: number; page?: number; limit?: number }
export type ApiFailure = { success: false; error: string; code?: string }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
export const ok = <T>(data: T): ApiSuccess<T> => ({ success: true, data })
export const fail = (error: string, code?: string): ApiFailure => ({ success: false, error, code })
'@

EnsureFile "src\common\errors\http-error.ts" @'
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}
'@

EnsureFile "src\common\utils\date.ts" @'
export const nowFmt = () =>
  new Date().toISOString().replace("T", " ").split(".")[0]; // yyyy-MM-dd HH:mm:ss
'@

EnsureFile "src\routes.ts" @'
// Unified route registrar (fill in after moving modules)
import { Router } from "express"
const router = Router()
// import authRoutes from "./modules/auth/auth.routes"
// router.use("/auth", authRoutes)
export default router
'@

# 6) 可选：创建 Git 分支（若未创建）
try {
  git rev-parse --abbrev-ref HEAD 2>$null | Out-Null
  $current = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($current -notlike "refactor/*") {
    if ($DryRun) { Log "GIT   would create branch refactor/structure (dry-run)" }
    else {
      git checkout -b refactor/structure | Out-Null
      Log "GIT   created and switched to branch refactor/structure"
    }
  } else { Log "GIT   stay on $current" }
} catch { Log "GIT   not a git repo or git not found (skip)" }

Log "DONE  refactor completed. Review $LOG"
# ================== end of backend-refactor.ps1 =================================
