# 跨平台构建脚本（Windows PowerShell）
# 使用 electronuserland/builder:18-wine 打包 Windows portable x64 与 macOS x64/arm64 zip

$ErrorActionPreference = "Stop"

$Image = "electronuserland/builder:18-wine"

# 脚本所在目录（scripts\）与项目根目录（上一级）
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

Write-Host "==> 镜像: $Image"
Write-Host "==> 项目目录: $ProjectRoot"

docker run --rm `
  -v "${ProjectRoot}:/project" `
  -w /project `
  $Image `
  sh -c "npm install && npm run pack"

Write-Host "==> 构建完成，产物位于: $ProjectRoot\dist"
$dist = Join-Path $ProjectRoot "dist"
if (Test-Path $dist) {
    Get-ChildItem -Path $dist | Format-Table Name, Length, LastWriteTime -AutoSize
}