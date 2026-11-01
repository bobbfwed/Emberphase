function Get-AndroidArchive {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][long]$ExpectedSize
    )

    # Range requests avoid stalled whole-file transfers on this network.
    $chunkRoot = Join-Path (Split-Path -Parent $Destination) 'parts'
    New-Item -ItemType Directory -Path $chunkRoot -Force | Out-Null
    $chunkSize = 8MB
    $chunkCount = [int][math]::Ceiling($ExpectedSize / $chunkSize)
    $configLines = New-Object 'System.Collections.Generic.List[string]'
    for ($chunkIndex = 0; $chunkIndex -lt $chunkCount; $chunkIndex++) {
        if ($chunkIndex -gt 0) { $configLines.Add('next') }
        $chunkStart = [long]$chunkIndex * $chunkSize
        $chunkEnd = [math]::Min($chunkStart + $chunkSize - 1, $ExpectedSize - 1)
        $chunkPath = Join-Path $chunkRoot ('{0:D4}.part' -f $chunkIndex)
        $configLines.Add('url = "' + $Url + '"')
        $configLines.Add('output = "' + $chunkPath.Replace('\', '\\') + '"')
        $configLines.Add('range = "' + $chunkStart + '-' + $chunkEnd + '"')
        foreach ($curlOption in @('fail', 'location', 'silent', 'show-error', 'retry = 2', 'connect-timeout = 30', 'max-time = 120')) {
            $configLines.Add($curlOption)
        }
    }
    $configPath = Join-Path $chunkRoot 'download.conf'
    [System.IO.File]::WriteAllLines($configPath, $configLines, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Downloading $chunkCount parts with up to six simultaneous transfers..."
    & curl.exe --parallel --parallel-immediate --parallel-max 6 --config $configPath
    if ($LASTEXITCODE -ne 0) { throw "Archive download failed with exit code $LASTEXITCODE. Parts retained at $chunkRoot." }

    $destinationStream = [System.IO.File]::Create($Destination)
    try {
        for ($chunkIndex = 0; $chunkIndex -lt $chunkCount; $chunkIndex++) {
            $chunkPath = Join-Path $chunkRoot ('{0:D4}.part' -f $chunkIndex)
            $expectedChunkSize = [math]::Min($chunkSize, $ExpectedSize - [long]$chunkIndex * $chunkSize)
            if ((Get-Item -LiteralPath $chunkPath).Length -ne $expectedChunkSize) {
                throw "Unexpected size for download part $chunkIndex."
            }
            $sourceStream = [System.IO.File]::OpenRead($chunkPath)
            try { $sourceStream.CopyTo($destinationStream) } finally { $sourceStream.Dispose() }
        }
    } finally {
        $destinationStream.Dispose()
    }
    # Delete individual part files only after assembling the full archive.
    for ($chunkIndex = 0; $chunkIndex -lt $chunkCount; $chunkIndex++) {
        Remove-Item -LiteralPath (Join-Path $chunkRoot ('{0:D4}.part' -f $chunkIndex))
    }
    Remove-Item -LiteralPath $configPath
}
