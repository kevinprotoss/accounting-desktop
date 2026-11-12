#!/usr/bin/env bash
set -euo pipefail

# 跨平台构建脚本（Linux / macOS）
# 使用 electronuserland/builder:18-wine 打包 Windows portable x64 与 macOS x64/arm64 zip

IMAGE="electronuserland/builder:18-wine"

# 脚本所在目录（scripts/）与项目根目录（上一级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "==> 镜像: $IMAGE"
echo "==> 项目目录: $PROJECT_ROOT"

docker run --rm \
  -v "$PROJECT_ROOT:/project" \
  -w /project \
  "$IMAGE" \
  sh -c "npm install && npm run pack"

echo "==> 构建完成，产物位于: $PROJECT_ROOT/dist"
if [ -d "$PROJECT_ROOT/dist" ]; then
  ls -lh "$PROJECT_ROOT/dist"
fi