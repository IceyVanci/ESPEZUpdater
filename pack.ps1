# ============================================================================
# pack.ps1 —— ESPEZUpdater 打包发布
#
# 产物（写入 -OutDir，缺省 <工具根>\dist）：
#   1) ESPEZUpdater_v<版本>.zip            运行时工具（最终用户 / -Bundle 的 runtimeToolDir）
#   2) ESPEZUpdater-buildkit_v<版本>.zip   构建套件 + 文档（项目集成用）
#   3) -Exe：ESPEZUpdater_v<版本>.exe       单文件自解压（IExpress，可选）
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1 -Exe
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\pack.ps1 -Slim   # 运行时 zip 不含 esptool.exe
# ============================================================================
param(
    [string]$Version = '',
    [switch]$Exe,
    [switch]$Slim,
    [string]$OutDir = '',
    [switch]$NoZip
)
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }

function Fail([string]$msg) { Write-Host "[ERROR] $msg"; exit 1 }

if ($Exe) { $NoZip = $false }

# ---- 版本号 ----
if (-not $Version) {
    $vf = Join-Path $Root 'version.json'
    if (Test-Path -LiteralPath $vf) {
        try { $Version = (Get-Content -LiteralPath $vf -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch { }
    }
}
if (-not $Version) { $Version = Get-Date -Format 'yyyyMMdd' }

if (-not $OutDir) { $OutDir = Join-Path $Root 'dist' }
if (-not [System.IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path (Get-Location).Path $OutDir }
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RuntimeZip = Join-Path $OutDir "ESPEZUpdater_v$Version.zip"
$KitZip     = Join-Path $OutDir "ESPEZUpdater-buildkit_v$Version.zip"

function New-ZipFromFiles([string]$zipPath, [System.Collections.IEnumerable]$items) {
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($it in $items) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $it.FullName, $it.Entry) | Out-Null
        }
    } finally { $zip.Dispose() }
}

# ---------------------------------------------------------------- 运行时包
$runtimeNames = @('server.ps1', 'version.json', 'VERSION', 'flash_cli.bat', '一键升级.bat', 'upgrade.bat', 'README.md', 'esptool.exe')
if ($Slim) { $runtimeNames = $runtimeNames | Where-Object { $_ -ne 'esptool.exe' } }

$runtimeItems = @()
foreach ($n in $runtimeNames) {
    $p = Join-Path $Root $n
    if (Test-Path -LiteralPath $p) { $runtimeItems += [pscustomobject]@{ FullName = $p; Entry = $n } }
    elseif ($n -eq 'version.json' -or $n -eq 'VERSION') { Fail "缺少 $n（请先生成版本文件）" }
    elseif ($n -eq 'esptool.exe' -and -not $Slim) { Fail "缺少 esptool.exe" }
}
$pub = Join-Path $Root 'public'
if (-not (Test-Path -LiteralPath (Join-Path $pub 'app.js'))) { Fail "缺少 public\app.js" }

Get-ChildItem -LiteralPath $pub -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($pub.Length + 1) -replace '\\', '/'
    $runtimeItems += [pscustomobject]@{ FullName = $_.FullName; Entry = 'public/' + $rel }
}

if (-not $NoZip) {
    New-ZipFromFiles -zipPath $RuntimeZip -items $runtimeItems
    Write-Host ("[OK] {0}  ({1:N0} bytes)" -f (Split-Path -Leaf $RuntimeZip), (Get-Item -LiteralPath $RuntimeZip).Length)
}

# ---------------------------------------------------------------- 构建套件包
$kitRoot = Join-Path $Root 'build-kit'
$docsRoot = Join-Path $Root 'docs'
$kitItems = @()
if (Test-Path -LiteralPath $kitRoot) {
    Get-ChildItem -LiteralPath $kitRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($Root.Length + 1) -replace '\\', '/'
        $kitItems += [pscustomobject]@{ FullName = $_.FullName; Entry = $rel }
    }
}
if (Test-Path -LiteralPath $docsRoot) {
    Get-ChildItem -LiteralPath $docsRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($Root.Length + 1) -replace '\\', '/'
        $kitItems += [pscustomobject]@{ FullName = $_.FullName; Entry = $rel }
    }
}
$readme = Join-Path $Root 'README.md'
if (Test-Path -LiteralPath $readme) { $kitItems += [pscustomobject]@{ FullName = $readme; Entry = 'README.md' } }

if (-not $NoZip) {
    New-ZipFromFiles -zipPath $KitZip -items $kitItems
    Write-Host ("[OK] {0}  ({1:N0} bytes)" -f (Split-Path -Leaf $KitZip), (Get-Item -LiteralPath $KitZip).Length)
}

# ---------------------------------------------------------------- 单文件 EXE
if ($Exe) {
    if ($Slim) { Write-Host "[WARN] -Slim 与 -Exe 同用时 EXE 内不含 esptool.exe（Web Serial 仍可烧录）" }
    $iexpress = Join-Path $env:SystemRoot 'System32\iexpress.exe'
    if (-not (Test-Path -LiteralPath $iexpress)) { Fail "未找到 iexpress.exe，无法生成单文件 EXE" }
    if (-not (Test-Path -LiteralPath $RuntimeZip)) { Fail "缺少运行时 zip，无法生成 EXE" }

    $stage = Join-Path $OutDir 'exe_stage'
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Copy-Item -LiteralPath $RuntimeZip -Destination (Join-Path $stage 'app.zip') -Force

    $startCmd = @"
@echo off
setlocal
set "DEST=%TEMP%\ESPEZUpdater_$Version"
if exist "%DEST%" rmdir /s /q "%DEST%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0app.zip' -DestinationPath '%DEST%' -Force"
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\server.ps1"
endlocal
"@
    [System.IO.File]::WriteAllText((Join-Path $stage 'start.cmd'), $startCmd, (New-Object System.Text.ASCIIEncoding))

    $exePath = Join-Path $OutDir "ESPEZUpdater_v$Version.exe"
    if (Test-Path -LiteralPath $exePath) { Remove-Item -LiteralPath $exePath -Force }
    $sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$exePath
FriendlyName=ESPEZUpdater $Version
AppLaunched=cmd /c start.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$stage\
[SourceFiles0]
app.zip=
start.cmd=
"@
    $sedPath = Join-Path $OutDir 'espezupdater.sed'
    [System.IO.File]::WriteAllText($sedPath, $sed, (New-Object System.Text.ASCIIEncoding))

    Write-Host "[..] 生成单文件 EXE（IExpress）..."
    & $iexpress /N /Q $sedPath | Out-Null
    if (-not (Test-Path -LiteralPath $exePath)) { Fail "IExpress 未生成 EXE（可手动运行: iexpress /N $sedPath）" }
    Write-Host ("[OK] {0}  ({1:N0} bytes)" -f (Split-Path -Leaf $exePath), (Get-Item -LiteralPath $exePath).Length)
    Write-Host "     注意：EXE 未签名，可能被 SmartScreen/杀软拦截；主推 zip 分发。"
}

Write-Host ""
Write-Host "DONE -> $OutDir"
