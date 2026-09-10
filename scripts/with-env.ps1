<#
.SYNOPSIS
  Run a command with .env.local loaded into the environment.

.DESCRIPTION
  Next.js reads .env.local. The Prisma CLI does not — it reads .env — so every
  prisma command run from this repo fails with

      Environment variable not found: DIRECT_URL

  even though the variable is sitting right there. The obvious fix is to copy
  the credentials into a second file, and the reason not to is that two files
  holding the same database password drift: one gets rotated, the other does
  not, and the next person to hit an auth error spends an hour on it. The seed
  script hit this exact wall, which is why prisma/load-env.ts exists; this is
  the same idea for commands we cannot edit.

  Values are never printed. Only the variable NAMES are listed, so this is safe
  to run with someone watching.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\with-env.ps1 npx prisma migrate deploy

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\with-env.ps1 npx prisma studio
#>

param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$Command
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env.local'

if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found at $envFile"
    exit 1
}

$loaded = @()

foreach ($line in Get-Content $envFile) {
    # Blank lines and whole-line comments.
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }

    # KEY=value, tolerating `export ` and spaces around the equals sign.
    if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }

    $name = $Matches[1]
    $value = $Matches[2].Trim()

    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        # Quoted: take it exactly as written. A '#' inside quotes is data.
        $value = $value.Substring(1, $value.Length - 2)
    }
    elseif ($value.Length -ge 2 -and $value.StartsWith("'") -and $value.EndsWith("'")) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    else {
        # Unquoted: a '#' preceded by whitespace starts a comment. A '#' with no
        # space before it is part of the value — which matters enormously here,
        # because '#' is a legal and common character in a generated database
        # password, and truncating the connection string produces an
        # authentication error that looks like a wrong password.
        $value = ($value -split '\s+#', 2)[0].Trim()
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    $loaded += $name
}

Write-Host "Loaded from .env.local: $($loaded -join ', ')" -ForegroundColor DarkGray
Write-Host ""

# Run the command and hand its exit code back, so `&&` and CI both behave.
$exe = $Command[0]
$rest = if ($Command.Length -gt 1) { $Command[1..($Command.Length - 1)] } else { @() }

& $exe @rest
exit $LASTEXITCODE
