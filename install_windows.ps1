param(
  [switch]$InstallHooks,
  [switch]$CreateStartupTask
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$Settings = Join-Path $ClaudeDir "settings.json"
$Hook = Join-Path $Root "hooks\claude-telemetry-hook.py"

if (-not (Test-Path $Python)) {
  py -3 -m venv (Join-Path $Root ".venv")
}
& $Python -m pip install -r (Join-Path $Root "requirements.txt")

if ($InstallHooks) {
  New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null
  if (Test-Path $Settings) {
    $raw = Get-Content $Settings -Raw
    if ($raw.Trim()) { $cfg = $raw | ConvertFrom-Json } else { $cfg = [pscustomobject]@{} }
  } else {
    $cfg = [pscustomobject]@{}
  }
  if (-not $cfg.hooks) {
    $cfg | Add-Member -NotePropertyName hooks -NotePropertyValue ([pscustomobject]@{}) -Force
  }

  $events = @("SessionStart","UserPromptSubmit","PreToolUse","PostToolUse","Stop")
  foreach ($evt in $events) {
    $existing = @()
    $prop = $cfg.hooks.PSObject.Properties[$evt]
    if ($prop) { $existing = @($prop.Value) }

    $cmd = "python `"$Hook`""
    $entry = [pscustomobject]@{
      hooks = @([pscustomobject]@{
        type = "command"
        command = $cmd
        timeout = 10
      })
    }

    $found = $false
    foreach ($item in $existing) {
      if ($item.hooks) {
        foreach ($h in @($item.hooks)) {
          if ($h.command -eq $cmd) { $found = $true }
        }
      }
    }
    if (-not $found) { $existing += $entry }
    $cfg.hooks | Add-Member -NotePropertyName $evt -NotePropertyValue $existing -Force
  }

  $cfg | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $Settings
  Write-Host "Installed global Claude Code telemetry hooks in $Settings"
}

if ($CreateStartupTask) {
  $TaskName = "Claude Token Telemetry"
  $Action = New-ScheduledTaskAction -Execute $Python -Argument "-m telemetry.daemon" -WorkingDirectory $Root
  $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null
  Write-Host "Created Windows startup task: $TaskName"
}

Write-Host ""
Write-Host "Root: $Root"
Write-Host "Dashboard: $Python -m streamlit run `"$Root\app.py`""
Write-Host "Daemon:    $Python -m telemetry.daemon"
Write-Host "Reconcile: $Python -m telemetry.reconcile"
