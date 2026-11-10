param(
    [string]$Port = '',
    [string]$DatabaseUrl = 'https://diet-planner-3bdf3-default-rtdb.firebaseio.com/water_purifier.json'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'serial-packet.ps1')

if (-not $Port) {
    $ports = @([System.IO.Ports.SerialPort]::GetPortNames())
    if ($ports.Count -ne 1) {
        throw "Specify a port with -Port COM13. Available ports: $($ports -join ', ')"
    }
    $Port = $ports[0]
}

$serial = New-Object System.IO.Ports.SerialPort $Port, 9600, None, 8, One
$serial.NewLine = "`n"
$serial.WriteTimeout = 2000
$serial.ReadTimeout = 500
$serial.DtrEnable = $true
$lastPacket = ''
$lastError = ''
try {
    $serial.Open()
    Write-Output "Connected to $Port at 9600 baud. Close Arduino Serial Monitor while this bridge runs."
    # USB serial opening can reset an Uno. Allow its bootloader/TFT setup to finish.
    Start-Sleep -Seconds 3
    while ($true) {
        if ($serial.BytesToRead -gt 0) {
            $reply = $serial.ReadExisting().Trim()
            if ($reply) { Write-Output "Arduino: $reply" }
        }
        try {
            $data = Invoke-RestMethod -Uri $DatabaseUrl -TimeoutSec 3 -Headers @{'Cache-Control'='no-cache'}
            $packet = ConvertTo-DisplayPacket -Data $data
        } catch {
            $message = $_.Exception.Message
            if ($message -ne $lastError) { Write-Output "Display paused: $message" }
            $lastError = $message
            # No cached or fabricated readings: the sketch clears values after 5 seconds.
            Start-Sleep -Seconds 1
            continue
        }
        $serial.WriteLine($packet)
        if ($packet -ne $lastPacket -or $lastError) {
            Write-Output "$(Get-Date -Format 'HH:mm:ss') Sent: $packet"
        }
        $lastPacket = $packet
        $lastError = ''
        Start-Sleep -Seconds 1
    }
} finally {
    if ($serial.IsOpen) { $serial.Close() }
    $serial.Dispose()
}
