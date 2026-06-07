# Apple Juice CLI Global Installer
$ErrorActionPreference = "Stop"

$E = [char]27
$RESET = "$E[0m"
$BOLD = "$E[1m"
$GREEN = "$E[32m"
$CYAN = "$E[36m"

Clear-Host
Write-Host "$E[96m┌────────────────────────────────────────────────────────┐$RESET"
Write-Host "$E[96m│      🥤 APPLE JUICE CLI WINDOWS GLOBAL INSTALLER       │$RESET"
Write-Host "$E[96m└────────────────────────────────────────────────────────┘$RESET"
Write-Host ""

$TempDir = "$env:TEMP\apple-juice-install"
$InstallerExe = "$TempDir\install.exe"
$DownloadUrl = "https://github.com/inetixus/apple-juice/releases/download/v0.5.2/install.exe"

Write-Host "$CYAN Downloading Apple Juice CLI installer...$RESET"

if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallerExe -UseBasicParsing
    Write-Host "  $GREEN Download complete.$RESET"
} catch {
    Write-Host "$E[31mError: Failed to download installer from GitHub.$RESET"
    Write-Host "  Try downloading manually: $DownloadUrl"
    exit 1
}

Write-Host "$CYAN Running installer...$RESET"
Write-Host ""

Start-Process -FilePath $InstallerExe -Wait

# Cleanup
Remove-Item $InstallerExe -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "$E[92m Done! Open a new terminal and type $BOLD`"aj`"$RESET$E[92m to get started.$RESET"
Write-Host ""
