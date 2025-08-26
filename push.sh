#!/bin/bash
set -e

# 用法： ./push.sh "提交说明"
msg="$1"
if [ -z "$msg" ]; then
  msg="chore: auto-commit $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 当前分支
branch=$(git rev-parse --abbrev-ref HEAD)
echo "🟦 当前分支: $branch"

# 确保存在远程
if ! git remote | grep -q "^origin$"; then
  echo "❌ 未找到远程 origin，请先添加：git remote add origin <github-url>"
  exit 1
fi
if ! git remote | grep -q "^gitee$"; then
  echo "⚠️ 未找到远程 gitee：git remote add gitee <gitee-url>"
fi

# 显示当前状态
echo "🔎 工作区状态："
git status -sb

# 若有改动则提交
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "➕ git add ."
  git add .
  echo "📝 git commit -m \"$msg\""
  git commit -m "$msg" || true
else
  echo "✅ 无需提交（工作区无改动）"
fi

# 确保有 upstream（第一次推送用到）
if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  echo "🔗 未检测到 upstream，先把 origin/$branch 设为上游"
  git branch --set-upstream-to "origin/$branch" || true
fi

echo "⬇️ 先拉取远程最新（rebase + autostash）"
# autostash 会在拉取前自动暂存未提交改动，结束后自动还原
if ! git pull --rebase --autostash origin "$branch"; then
  echo "❌ rebase 发生冲突。请按以下步骤处理："
  echo "   1) 逐个解决冲突文件"
  echo "   2) git add <已解决的文件>"
  echo "   3) git rebase --continue"
  echo "   解决完后再执行： ./push.sh \"$msg\""
  exit 1
fi

# 再做一次 ahead/behind 检查，仅用于提示（不阻断）
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo origin/$branch)"
if [ -n "$upstream" ]; then
  mapfile -t counts < <(git rev-list --left-right --count "$upstream...HEAD")
  behind=$(echo "${counts[0]}" | awk '{print $1}')
  ahead=$(echo "${counts[0]}" | awk '{print $2}')
  echo "📊 相对 $upstream：ahead=$ahead, behind=$behind"
fi

echo "🚀 推送到 GitHub（origin/$branch）"
git push origin "$branch"

if git remote | grep -q "^gitee$"; then
  echo "🚀 推送到 Gitee（gitee/$branch）"
  git push gitee "$branch"
fi

echo "✅ 完成：$branch 已与远程同步（未使用 --force，安全）"

