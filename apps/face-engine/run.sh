#!/usr/bin/env bash
# 启动人脸引擎服务（开发用）。生产建议用 systemd / supervisor 托管。
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "[face-engine] 创建虚拟环境 .venv ..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -r requirements.txt

if [ ! -f .env ]; then
  echo "[face-engine] 未找到 .env，已从 .env.example 复制，请修改 SHARED_SECRET"
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

exec uvicorn app.main:app --host "${FACE_ENGINE_HOST:-127.0.0.1}" --port "${FACE_ENGINE_PORT:-8077}"
