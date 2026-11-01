[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Get-AndroidArchive.ps1')
$toolRoot = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools\wff'
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
# google/watchface release 414757309, published 2026-10-16.
# Digests are from GitHub's release asset metadata. The moving release tag is
# deliberately checked against these pinned digests before anything is run.
$tools = @(
    @{Name='wff-validator.jar'; Size=8812895; Sha256='fb3262aa146de24c169a1d451901b4df2bfedca28a27c3c168a487e02d393771'},
    @{Name='memory-footprint.jar'; Size=17611616; Sha256='98892722dcb0cf3c872776fa5ec1ba5aea1289621f04d15324e854b1cdaa3460'},
    @{Name='wff-xsd.zip'; Size=492114; Sha256='6d7f7f189a553e55da0ed6b48608b26d9b9a24d47911dfcff8a8a706d6114906'}
)
foreach ($tool in $tools) {
    $destination = Join-Path $toolRoot $tool.Name
    if (-not (Test-Path -LiteralPath $destination)) {
        Get-AndroidArchive -Url ('https://github.com/google/watchface/releases/download/release/' + $tool.Name) -Destination $destination -ExpectedSize $tool.Size
    }
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $tool.Sha256) {
        throw "Checksum mismatch for $($tool.Name); inspect the pinned release before updating."
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $toolRoot 'xsd'))) {
    Expand-Archive -LiteralPath (Join-Path $toolRoot 'wff-xsd.zip') -DestinationPath (Join-Path $toolRoot 'xsd')
}
Write-Host "Verified Google WFF tools are ready at $toolRoot"
