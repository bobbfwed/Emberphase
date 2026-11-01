[CmdletBinding()]
param(
    [string]$SdkRoot = (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'Get-AndroidArchive.ps1')
$SdkRoot = [System.IO.Path]::GetFullPath($SdkRoot)
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('watchface-packages-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagingRoot | Out-Null
$repositoryPath = Join-Path $stagingRoot 'repository.xml'

# Google publishes package URLs, sizes, and archive checksums in this manifest.
& curl.exe --fail --location --silent --show-error --range 0-8388607 --max-time 60 --output $repositoryPath 'https://dl.google.com/android/repository/repository2-3.xml'
if ($LASTEXITCODE -ne 0) { throw 'Could not download the official SDK package manifest.' }
[xml]$repository = Get-Content -LiteralPath $repositoryPath -Raw
$remotePackages = $repository.SelectNodes('//*[local-name()="remotePackage"]')

function Register-SdkPackage {
    param([System.Xml.XmlElement]$Package, [string]$PackagePath, [string]$Destination)

    $metadataPath = Join-Path $Destination 'package.xml'
    if (Test-Path -LiteralPath $metadataPath) { return }
    $sourceProperties = Get-Content -LiteralPath (Join-Path $Destination 'source.properties') -Raw
    $revisionMatch = [regex]::Match($sourceProperties, '(?m)^Pkg\.Revision\s*=\s*([0-9.]+)')
    if (-not $revisionMatch.Success) { throw "Missing package revision for $PackagePath." }
    $installedRevision = $revisionMatch.Groups[1].Value.Split('.')
    $remoteRevision = @([int]$Package.revision.major, [int]$Package.revision.minor, [int]$Package.revision.micro)
    for ($component = 0; $component -lt 3; $component++) {
        $installedComponent = 0
        if ($component -lt $installedRevision.Count) { $installedComponent = [int]$installedRevision[$component] }
        if ($installedComponent -ne $remoteRevision[$component]) {
            Write-Warning "Keeping existing metadata for a different revision of $PackagePath."
            return
        }
    }

    # Convert Google's remote package record to the SDK's local package schema.
    $metadata = New-Object System.Xml.XmlDocument
    $metadataRoot = $metadata.CreateElement('common', 'repository', 'http://schemas.android.com/repository/android/common/02')
    $metadata.AppendChild($metadataRoot) | Out-Null
    foreach ($attribute in $repository.DocumentElement.Attributes) {
        if ($attribute.Prefix -eq 'xmlns' -and $attribute.LocalName -ne 'common') {
            $metadataRoot.Attributes.Append($metadata.ImportNode($attribute, $true)) | Out-Null
        }
    }
    $licenseId = $Package.'uses-license'.ref
    $license = $repository.SelectNodes('//*[local-name()="license"]') | Where-Object { $_.id -eq $licenseId } | Select-Object -First 1
    if ($license) { $metadataRoot.AppendChild($metadata.ImportNode($license, $true)) | Out-Null }
    $localPackage = $metadata.CreateElement('localPackage')
    $localPackage.SetAttribute('path', $PackagePath)
    $localPackage.SetAttribute('obsolete', 'false')
    foreach ($child in $Package.ChildNodes) {
        if ($child.LocalName -in @('type-details', 'revision', 'display-name', 'uses-license')) {
            $localPackage.AppendChild($metadata.ImportNode($child, $true)) | Out-Null
        }
    }
    $metadataRoot.AppendChild($localPackage) | Out-Null
    $metadata.Save($metadataPath)
}

$commandToolsDestination = Join-Path $SdkRoot 'cmdline-tools\latest'
$commandToolsProperties = Join-Path $commandToolsDestination 'source.properties'
if (Test-Path -LiteralPath $commandToolsProperties) {
    $toolsRevision = [regex]::Match((Get-Content -LiteralPath $commandToolsProperties -Raw), '(?m)^Pkg\.Revision\s*=\s*([0-9.]+)').Groups[1].Value
    $toolsPackage = $remotePackages | Where-Object { $_.path -eq "cmdline-tools;$toolsRevision" } | Select-Object -First 1
    if ($toolsPackage) { Register-SdkPackage -Package $toolsPackage -PackagePath 'cmdline-tools;latest' -Destination $commandToolsDestination }
}

foreach ($packagePath in @('platform-tools', 'platforms;android-36', 'build-tools;36.0.0', 'emulator')) {
    $relativeDestination = $packagePath.Replace(';', '\')
    $destination = [System.IO.Path]::GetFullPath((Join-Path $SdkRoot $relativeDestination))
    if (-not $destination.StartsWith($SdkRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'SDK package destination must remain inside the SDK root.'
    }
    $package = @($remotePackages | Where-Object { $_.path -eq $packagePath -and $_.channelRef.ref -eq 'channel-0' })
    if ($package.Count -ne 1) { throw "Expected one stable SDK package for $packagePath." }
    if (Test-Path -LiteralPath (Join-Path $destination 'source.properties')) {
        Register-SdkPackage -Package $package[0] -PackagePath $packagePath -Destination $destination
        Write-Host "$packagePath is already installed."
        continue
    }
    $archive = @($package[0].archives.archive | Where-Object { -not $_.'host-os' -or $_.'host-os' -eq 'windows' })
    if ($archive.Count -ne 1) { throw "Expected one Windows archive for $packagePath." }
    $archiveName = [string]$archive[0].complete.url
    if ($archiveName -notmatch '^[A-Za-z0-9_.-]+\.zip$') { throw 'Unexpected archive URL in SDK manifest.' }

    $packageStaging = Join-Path $stagingRoot ($packagePath.Replace(';', '-'))
    New-Item -ItemType Directory -Path $packageStaging | Out-Null
    $archivePath = Join-Path $packageStaging $archiveName
    Write-Host "Downloading $packagePath from Google..."
    Get-AndroidArchive -Url ('https://dl.google.com/android/repository/' + $archiveName) -Destination $archivePath -ExpectedSize ([long]$archive[0].complete.size)
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA1).Hash -ne $archive[0].complete.checksum.'#text') {
        throw "Checksum mismatch for $packagePath."
    }
    Write-Host "Extracting verified $packagePath..."
    $extractionRoot = Join-Path $packageStaging 'extracted'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractionRoot
    $extractedRoots = @(Get-ChildItem -LiteralPath $extractionRoot -Directory)
    if ($extractedRoots.Count -ne 1 -or -not (Test-Path -LiteralPath (Join-Path $extractedRoots[0].FullName 'source.properties'))) {
        throw "Unexpected archive structure for $packagePath."
    }
    $extractedPackage = [System.IO.Path]::GetFullPath($extractedRoots[0].FullName)
    if (-not $extractedPackage.StartsWith($extractionRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Extracted package must remain inside the staging directory.'
    }
    if (Test-Path -LiteralPath $destination) {
        $existingEntries = @(Get-ChildItem -LiteralPath $destination -Force)
        if (@($existingEntries | Where-Object { $_.Name -ne '.installer' }).Count -gt 0) {
            throw "Inspect the incomplete installation at $destination before retrying."
        }
        # Preserve the SDK manager's incomplete operation rather than deleting it.
        $backupPath = [System.IO.Path]::GetFullPath((Join-Path $SdkRoot ('.temp\watchface-incomplete-' + [guid]::NewGuid().ToString('N'))))
        if (-not $backupPath.StartsWith($SdkRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Backup destination must remain inside the SDK root.'
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
        Move-Item -LiteralPath $destination -Destination $backupPath
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Move-Item -LiteralPath $extractedPackage -Destination $destination
    Register-SdkPackage -Package $package[0] -PackagePath $packagePath -Destination $destination
    Remove-Item -LiteralPath $archivePath
    Write-Host "Installed $packagePath at $destination"
}
