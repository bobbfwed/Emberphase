[CmdletBinding(DefaultParameterSetName='Archive')]
param(
    [Parameter(Mandatory=$true,ParameterSetName='Archive')][string]$ZipPath,
    [Parameter(Mandatory=$true,ParameterSetName='Library')][string]$AarPath
)
$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path -Parent $PSScriptRoot) '.tools\samsung-health'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$target=Join-Path $root 'samsung-health-data-api-1.1.0.aar'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if($PSCmdlet.ParameterSetName -eq 'Archive') {
    $archive=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath).Path)
    try {
        $entries=@($archive.Entries | Where-Object { $_.FullName -match '(^|/)(samsung-)?health-data-api(-1\.1\.0)?\.aar$' })
        if($entries.Count -ne 1) { throw 'Expected one Samsung Health Data SDK 1.1.0 AAR in the downloaded ZIP. You can also use -AarPath with the extracted SDK library.' }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[0],$target,$true)
    } finally { $archive.Dispose() }
} else {
    $source=(Resolve-Path -LiteralPath $AarPath).Path
    if($source -ne $target) { Copy-Item -LiteralPath $source -Destination $target -Force }
}
$library=[IO.Compression.ZipFile]::OpenRead($target)
try {
    $classes=$library.GetEntry('classes.jar')
    if(-not $classes) { throw 'The imported file is not an Android SDK library.' }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($classes,(Join-Path $root 'health-api-classes.jar'),$true)
} finally { $library.Dispose() }
$jar=[IO.Compression.ZipFile]::OpenRead((Join-Path $root 'health-api-classes.jar'))
try {
    if(-not $jar.GetEntry('com/samsung/android/sdk/health/data/HealthDataService.class')) {
        throw 'The library does not contain the Samsung Health Data SDK API.'
    }
} finally { $jar.Dispose() }
Write-Host 'Imported local Samsung SDK. The proprietary library stays in ignored .tools; it is not part of the project MIT license.'
Get-FileHash -LiteralPath $target -Algorithm SHA256 | Format-List
