##################################################
# Turn Defender Real Time Monitoring off

# turns defender real time monitoring -on or -off 
# Has to run under an Admin prompt
#
# Syntax:
#
#    Defender        - turns Monitoring off (default)
#    Defender -off   - turns Monitoring off
#    Defender -on    - turns Monitoring on
##################################################


param(
    [switch] $on = $false,
    [switch] $off = $false
)

$setTo = $true;

if ($on.Equals($true)) {
    $setTo = $false
}
if ($off.Equals($true)) {
    $setTo = $true
}

Write-Host "Defender Real Time Protection"

if ($setTo.equals( $true)) {
    "Set to: Off"
}
else {
    "Set to: On"
}

Set-MpPreference -DisableRealtimeMonitoring $setTo

# Delay to let the settings take
Start-Sleep -MilliSeconds 1000

$defenderOptions = Get-MpComputerStatus
if($defenderOptions) {
    $setting = "On"
    if (-not $defenderOptions.RealTimeProtectionEnabled ) {
        $setting = "Off"
    }
    Write-Host  "Actual Setting: "  $setting
}