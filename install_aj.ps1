# Apple Juice CLI Global Installer (Premium & Robust)
$ErrorActionPreference = "Stop"

# Safer ANSI escape sequence approach for Windows PowerShell
$E = [char]27
$RESET = "$E[0m"
$BOLD = "$E[1m"
$GREEN = "$E[32m"
$YELLOW = "$E[33m"
$CYAN = "$E[36m"
$BRIGHT_GREEN = "$E[92m"

Clear-Host
Write-Host "$E[96m┌────────────────────────────────────────────────────────┐$RESET"
Write-Host "$E[96m│      🥤 APPLE JUICE CLI WINDOWS GLOBAL INSTALLER       │$RESET"
Write-Host "$E[96m└────────────────────────────────────────────────────────┘$RESET"
Write-Host ""

# 1. Locate Source or Download
$InstallDir = "$Home\.apple-juice\bin"
$DestExe = "$InstallDir\aj.exe"

$SourceExe = ""
if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\dist\aj.exe")) {
    $SourceExe = "$PSScriptRoot\dist\aj.exe"
    Write-Host "$CYAN Installing from local build...$RESET"
} elseif (Test-Path "dist\aj.exe") {
    $SourceExe = "dist\aj.exe"
    Write-Host "$CYAN Installing from local build...$RESET"
} else {
    Write-Host "$CYAN Downloading standalone binary from Apple Juice...$RESET"
    $DownloadUrl = "https://apple-juice.online/aj.exe"
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        Write-Host "  Created: $InstallDir"
    }
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $DestExe -UseBasicParsing
        Write-Host "  $GREEN Download complete!$RESET"
    } catch {
        Write-Host "$RED Error: Failed to download aj.exe from $DownloadUrl.$RESET"
        Write-Host "  Please ensure you have internet access and try again."
        exit 1
    }
}

# 2. Setup and Copy (for local builds)
if ($SourceExe) {
    Write-Host "$CYAN Preparing installation folder...$RESET"
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        Write-Host "  Created: $InstallDir"
    }
    Write-Host "$CYAN Installing binaries...$RESET"
    Copy-Item -Path $SourceExe -Destination $DestExe -Force
    $SourceBgExe = Join-Path (Split-Path $SourceExe) "aj-bg.exe"
    $DestBgExe = Join-Path $InstallDir "aj-bg.exe"
    if (Test-Path $SourceBgExe) {
        Copy-Item -Path $SourceBgExe -Destination $DestBgExe -Force
    } else {
        Copy-Item -Path $SourceExe -Destination $DestBgExe -Force
    }
    Write-Host "  Installed to: $GREEN$InstallDir$RESET"
}

# 4. Register PATH
Write-Host "$CYAN Registering global environment variables...$RESET"
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($null -eq $UserPath) { $UserPath = "" }

$PathList = $UserPath -split ";" | Where-Object { $_ -ne "" }
if ($PathList -notcontains $InstallDir) {
    $NewPath = ($PathList + $InstallDir) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "  $GREEN Success! Added to your User PATH.$RESET"
} else {
    Write-Host "  Already registered in PATH."
}

Write-Host ""
Write-Host "$E[92m┌────────────────────────────────────────────────────────┐$RESET"
Write-Host "$E[92m│ 🎉 APPLE JUICE CLI INSTALLED SUCCESSFULLY!             │$RESET"
Write-Host "$E[92m└────────────────────────────────────────────────────────┘$RESET"
Write-Host ""
Write-Host "  $BOLD Type 'aj' from ANY folder on your computer!$RESET"
Write-Host "  $CYAN (Please open a NEW terminal window to refresh).$RESET"
Write-Host ""
