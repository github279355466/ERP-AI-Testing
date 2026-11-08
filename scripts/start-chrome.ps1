#requires -Version 7.0
<#
  Launch a dedicated Chrome instance for Athena ERP automation.

  - Profile lives outside any agent session workspace (default: probe/chrome-profile)
  - Enables CDP on the port declared by browser.cdpEndpoint
  - Reuses the proxy declared by browser.proxy

  The profile holds ERP login cookies, so it is never committed to git.
#>
[CmdletBinding()]
param(
    [string]$ConfigPath = '',
    [switch]$Force,
    [switch]$DisableWebSecurity
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $projectRoot 'config/athena.config.json' }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "config not found: $ConfigPath" }

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$browser = $config.browser

$baseUrl = $config.environment.baseUrl
if (-not $baseUrl) { throw 'environment.baseUrl is required' }

$profileRelative = $browser.userDataDir
if (-not $profileRelative) { throw 'browser.userDataDir is required (e.g. probe/chrome-profile)' }
$profileDir = if ([IO.Path]::IsPathRooted($profileRelative)) { $profileRelative } else { Join-Path $projectRoot $profileRelative }
$profileDir = [IO.Path]::GetFullPath($profileDir)

if ($profileDir.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase) -eq $false) {
    Write-Warning "profile dir is outside project root: $profileDir"
}

$cdpEndpoint = $browser.cdpEndpoint
$port = 9333
if ($cdpEndpoint -match ':(\d{2,5})/?$') { $port = [int]$Matches[1] }

$alive = $false
try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 3 -UseBasicParsing
    $alive = $probe.StatusCode -eq 200
} catch {
    $alive = $false
}

if ($alive -and -not $Force) {
    Write-Host "CDP already listening on port $port."
    Write-Host "Stop that Chrome instance first, or re-run with -Force to open another window."
    exit 0
}

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $chrome) { $chrome = (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source }
if (-not $chrome) { throw 'chrome.exe not found; install Chrome or set it on PATH' }

if (-not (Test-Path -LiteralPath $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$viewport = $browser.viewport
$windowSize = if ($viewport) { "$($viewport.width),$($viewport.height)" } else { '1600,950' }

$args = @(
    '--no-sandbox'
    "--remote-debugging-port=$port"
    "--user-data-dir=$profileDir"
    '--ignore-certificate-errors'
    '--no-first-run'
    '--no-default-browser-check'
    "--window-size=$windowSize"
    '--lang=zh-CN'
)
if ($browser.proxy) { $args += "--proxy-server=$($browser.proxy)" }
if ($DisableWebSecurity) {
    # 仅用于专用自动化 profile：测试环境 semc-test 的跨域响应缺少 ACAO，
    # 会导致门户菜单 appWork/click 被浏览器拦截。不得用于日常浏览或生产环境。
    $args += '--disable-web-security'
    $args += '--disable-features=IsolateOrigins,site-per-process'
}
$args += $baseUrl

$quoted = $args | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
Start-Process -FilePath $chrome -ArgumentList ($quoted -join ' ') | Out-Null

Write-Host "chrome    : $chrome"
Write-Host "profile   : $profileDir"
Write-Host "cdp       : http://127.0.0.1:$port"
Write-Host "target    : $baseUrl"
Write-Host 'Log in manually in the opened window; the framework never stores credentials.'
