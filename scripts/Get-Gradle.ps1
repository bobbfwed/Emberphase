[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Get-AndroidArchive.ps1')
$projectRoot=Split-Path -Parent $PSScriptRoot
$toolRoot=Join-Path $projectRoot '.tools\gradle'
$gradleRoot=Join-Path $toolRoot 'gradle-9.3.1'
if(Test-Path -LiteralPath (Join-Path $gradleRoot 'bin\gradle.bat')) { Write-Host $gradleRoot; return }
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
$url='https://services.gradle.org/distributions/gradle-9.3.1-bin.zip'
$headers=& curl.exe --head --location --silent --show-error --max-time 60 $url
if($LASTEXITCODE -ne 0) { throw 'Could not inspect Gradle distribution.' }
$sizeLine=@($headers | Where-Object { $_ -match '^Content-Length:\s*\d+' })[-1]
if(-not $sizeLine) { throw 'Gradle response did not provide a download size.' }
$size=[long]([regex]::Match($sizeLine,'\d+').Value)
$archivePath=Join-Path $toolRoot 'gradle-9.3.1-bin.zip'
Get-AndroidArchive -Url $url -Destination $archivePath -ExpectedSize $size
if((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne 'b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06') { throw 'Gradle distribution checksum mismatch.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $toolRoot
Write-Host "Verified Gradle ready at $gradleRoot"
