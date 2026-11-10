function ConvertTo-DisplayPacket {
    param([Parameter(Mandatory = $true)]$Data)

    # Match the nine-field format in the supplied Arduino sketch exactly.
    $values = @(
        $Data.temperature.hot_temp,
        $Data.temperature.cold_temp,
        $Data.sensor.hot_level_watersensor,
        $Data.sensor.cold_level_watersensor,
        $Data.relay.relay1hot,
        $Data.relay.relay2cold,
        $Data.relay.relay3,
        $Data.relay.relay4,
        $Data.buzzer
    )
    $fields = @()
    for ($index = 0; $index -lt $values.Count; $index++) {
        $value = $values[$index]
        if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) {
            throw "Missing display field $($index + 1). Waiting for complete Firebase data."
        }
        if ($value -is [bool]) {
            if ($index -lt 4) { throw "Invalid sensor field $($index + 1)." }
            $value = [int]$value
        }
        $numeric = 0.0
        if (-not [double]::TryParse([string]$value, [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture, [ref]$numeric) -or
            [double]::IsNaN($numeric) -or [double]::IsInfinity($numeric)) {
            throw "Invalid numeric display field $($index + 1)."
        }
        if ($index -ge 4 -and $numeric -ne 0 -and $numeric -ne 1) {
            throw "Relay and buzzer fields must be 0 or 1."
        }
        if ($index -eq 2 -or $index -eq 3) {
            if ($numeric -lt 0 -or $numeric -gt 32767 -or $numeric -ne [Math]::Truncate($numeric)) {
                throw 'Water levels must be nonnegative integers within the Arduino int range.'
            }
        }
        if ($index -lt 2) {
            # Preserve the -127 sensor error code understood by the sketch.
            if ($numeric -lt -1000 -or $numeric -gt 1000) { throw 'Temperature out of serial packet range.' }
            $fields += $numeric.ToString('0.00', [Globalization.CultureInfo]::InvariantCulture)
        } else {
            $fields += $numeric.ToString('0', [Globalization.CultureInfo]::InvariantCulture)
        }
    }
    $packet = $fields -join ','
    if ($packet.Length -gt 110) { throw 'Packet exceeds the Arduino receive buffer.' }
    return $packet
}
