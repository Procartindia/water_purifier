$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'serial-packet.ps1')
$data = '{"temperature":{"hot_temp":27.75,"cold_temp":29.2},"sensor":{"hot_level_watersensor":3000,"cold_level_watersensor":400},"relay":{"relay1hot":1,"relay2cold":0,"relay3":1,"relay4":0},"buzzer":1}' | ConvertFrom-Json
$packet = ConvertTo-DisplayPacket $data
if ($packet -ne '27.75,29.20,3000,400,1,0,1,0,1') { throw "Wrong packet: $packet" }
$data.temperature.hot_temp = -127
if (-not (ConvertTo-DisplayPacket $data).StartsWith('-127.00,')) { throw 'Sensor error code lost.' }
foreach ($bad in @($null, '', 'NaN', 2)) {
    $data.buzzer = $bad
    $rejected = $false
    try { $null = ConvertTo-DisplayPacket $data } catch { $rejected = $true }
    if (-not $rejected) { throw "Accepted invalid buzzer: $bad" }
}
$data.buzzer = 0
$data.sensor.hot_level_watersensor = 0
if ((ConvertTo-DisplayPacket $data) -notmatch ',0,400,1,0,1,0,0$') { throw 'Zero readings not preserved.' }
Write-Output 'Serial packet checks passed: field order, raw levels, four relays, zero values, error code, invalid/missing data.'
