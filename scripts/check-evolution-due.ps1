# Requires PowerShell 5.1+. Run from anywhere: checks whether an evolution review is due.
# Exit 0 = not due. Exit 1 = review due (run docs/agent/evolution-review.md).

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot 'docs\agent\evolution-state.md'

if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Output "EVOLUTION-DUE: state file missing at $statePath - treat as due."
    exit 1
}

$content = Get-Content -LiteralPath $statePath -Raw
if ($content -notmatch '(?m)^\s*next_due:\s*(\d{4}-\d{2}-\d{2})') {
    Write-Output "EVOLUTION-DUE: next_due field missing/unparseable - treat as due."
    exit 1
}

$nextDue = [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', $null)
$today = Get-Date -Date ((Get-Date).ToString('yyyy-MM-dd'))

if ($today -ge $nextDue) {
    Write-Output ("EVOLUTION-DUE: YES - next_due {0:yyyy-MM-dd} <= today {1:yyyy-MM-dd}. Run docs/agent/evolution-review.md." -f $nextDue, $today)
    exit 1
}
else {
    Write-Output ("EVOLUTION-DUE: no - next review {0:yyyy-MM-dd}." -f $nextDue)
    exit 0
}
