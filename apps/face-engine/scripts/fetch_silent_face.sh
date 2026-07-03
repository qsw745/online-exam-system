#!/usr/bin/env bash
# 拉取上游 Silent-Face-Anti-Spoofing 的源码与模型权重，vendoring 到 app/vendor/silent_face/。
# 上游：https://github.com/minivision-ai/Silent-Face-Anti-Spoofing (Apache-2.0)
set -euo pipefail
cd "$(dirname "$0")/.."

VENDOR_DIR="app/vendor/silent_face"
MODEL_DIR="models/silent_face"
# 直连 GitHub 受限时，可用镜像：FETCH_MIRROR=https://ghproxy.com/ ./scripts/fetch_silent_face.sh
MIRROR="${FETCH_MIRROR:-}"
REPO="${MIRROR}https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git"

mkdir -p "$(dirname "$VENDOR_DIR")" "$MODEL_DIR"

if [ ! -d "$VENDOR_DIR/.git" ] && [ ! -f "$VENDOR_DIR/src/anti_spoof_predict.py" ]; then
  echo "[fetch] 克隆上游仓库 ... ${MIRROR:+(经镜像 $MIRROR)}"
  tmp="$(mktemp -d)"
  git clone --depth 1 "$REPO" "$tmp"
  mkdir -p "$VENDOR_DIR"
  # 只需要 src/（含 MiniFASNet 与预处理）与其 __init__
  cp -R "$tmp/src" "$VENDOR_DIR/src"
  touch "$VENDOR_DIR/__init__.py"
  # 上游把模型放在 resources/anti_spoof_models/
  if [ -d "$tmp/resources/anti_spoof_models" ]; then
    cp "$tmp/resources/anti_spoof_models/"*.pth "$MODEL_DIR/" 2>/dev/null || true
  fi
  rm -rf "$tmp"
fi

echo "[fetch] 完成。"
echo "  源码: $VENDOR_DIR/src"
echo "  模型: $MODEL_DIR ($(ls "$MODEL_DIR"/*.pth 2>/dev/null | wc -l | tr -d ' ') 个 .pth)"
echo "若模型目录为空，请到上游 release 手动下载 .pth 放入 $MODEL_DIR"
