# scoreboard.ps1 — show the basketball scoreboard on this PC over Wi-Fi.
#
# What it does:
#   1. Ensures an adb device is connected (Wi-Fi). If none, asks for the phone's
#      Wireless-debugging "IP address & Port" and connects.
#   2. Tells scrcpy to create its OWN clean virtual display (no launcher / taskbar /
#      nav / status bar, on ANY device) and mirror it into a window on this PC.
#   3. The app's Scoreboard screen auto-detects that PRESENTATION display and draws
#      the LED board onto it. The phone stays as the control panel.
#
# Make sure the app is open ON the Scoreboard screen first, then run this.
#
# Usage:  right-click -> Run with PowerShell      (or)   .\scoreboard.ps1

param(
    [string]$Size = "1280x720",   # virtual display resolution (landscape — board is landscape)
    [int]$Dpi = 213
)

$ErrorActionPreference = "Stop"

# --- locate scrcpy (PATH, else the winget install location) ---
$scrcpy = (Get-Command scrcpy -ErrorAction SilentlyContinue).Source
if (-not $scrcpy) {
    $cand = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.0\scrcpy.exe"
    if (Test-Path $cand) { $scrcpy = $cand } else { Write-Host "scrcpy not found. Install it: winget install Genymobile.scrcpy" -ForegroundColor Red; exit 1 }
}

# --- 1. make sure a device is connected over Wi-Fi ---
$dev = (adb devices) | Select-String "\tdevice$"
if (-not $dev) {
    Write-Host "No phone connected." -ForegroundColor Yellow
    $addr = Read-Host "Paste the phone's Wireless-debugging 'IP address & Port' (e.g. 192.168.1.4:37371)"
    if (-not $addr) { Write-Host "Cancelled." -ForegroundColor Yellow; exit 1 }
    adb connect $addr | Out-Null
    $dev = (adb devices) | Select-String "\tdevice$"
    if (-not $dev) {
        Write-Host "PROBLEM: phone not reachable. Wake it, confirm Wireless debugging is ON and it's on this Wi-Fi, then run again." -ForegroundColor Red
        Write-Host "(First time on this PC you must pair once: adb pair <IP:PAIRING_PORT>)" -ForegroundColor DarkGray
        exit 1
    }
}
Write-Host "Phone connected: $((($dev[0] -split '\s+')[0]))" -ForegroundColor Green
Write-Host "Opening scoreboard window (close it to stop). Make sure the app is on the Scoreboard screen." -ForegroundColor Cyan

# --- 2+3. scrcpy makes its own clean virtual display; the app auto-presents the board onto it ---
#   --no-vd-system-decorations : NO launcher/taskbar/nav/status bar -> board fills the window cleanly
#   --no-audio                 : REQUIRED, else scrcpy dies with "Could not open audio device"
& $scrcpy --new-display="$Size/$Dpi" --no-vd-system-decorations --no-audio --window-title="Basketball Scoreboard"

Write-Host "Scoreboard window closed." -ForegroundColor DarkGray
