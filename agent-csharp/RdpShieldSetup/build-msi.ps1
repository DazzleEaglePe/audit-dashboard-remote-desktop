param(
    [string]$PfxPath = $null,
    [string]$PfxPassword = $null,
    [string]$CertThumbprint = $null
)

$ErrorActionPreference = 'Stop'

# Helper to find signtool.exe dynamically (DEV-1 & FIX-1 & FIX-2)
function Find-SignTool {
    $signtool = Get-Command signtool -ErrorAction SilentlyContinue
    if ($signtool) {
        return $signtool.Source
    }

    $programFiles = ${env:ProgramFiles(x86)}
    if ($null -eq $programFiles) {
        $programFiles = ${env:ProgramFiles}
    }
    if ($null -ne $programFiles) {
        $kitsPath = Join-Path $programFiles "Windows Kits\10\bin"
        if (Test-Path $kitsPath) {
            # Try to find x64 version first, sorted by SDK version number (FIX-2)
            $signtoolMatches = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
                               Where-Object { $_.FullName -like "*\x64\*" } |
                               Sort-Object {
                                   if ($_.FullName -match '\\10\\bin\\([\d.]+)\\') { [version]$matches[1] } else { [version]'0.0' }
                               } -Descending
            if ($signtoolMatches.Count -gt 0) {
                return $signtoolMatches[0].FullName
            }

            # Fallback to any version if x64 isn't found
            $signtoolMatchesAny = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
                                  Sort-Object {
                                      if ($_.FullName -match '\\10\\bin\\([\d.]+)\\') { [version]$matches[1] } else { [version]'0.0' }
                                  } -Descending
            if ($signtoolMatchesAny.Count -gt 0) {
                return $signtoolMatchesAny[0].FullName
            }
        }
    }
    return $null
}

# 1. Publish the agent to a self-contained release folder
Write-Host "1. Publicando agente C#..." -ForegroundColor Cyan
dotnet publish ../RdpShieldAgent/RdpShieldAgent.csproj -c Release -r win-x64 --self-contained true -o ../publish

# 2. Optionally sign custom binaries before packaging (FIX-3 Option B)
$signtoolPath = $null
$shouldSign = ($PfxPath -or $CertThumbprint)

if ($shouldSign) {
    if ($PfxPath -and -not (Test-Path $PfxPath)) {
        Write-Error "El archivo PFX no existe en la ruta especificada: $PfxPath"
        exit 1
    }
    $signtoolPath = Find-SignTool
    if ($null -eq $signtoolPath) {
        Write-Error "signtool.exe no fue encontrado. Instale el Windows SDK para firmar."
        exit 1
    }
    
    Write-Host "Firma opcional habilitada. Usando: $signtoolPath" -ForegroundColor Cyan
    
    # Sign main executable
    Write-Host "   -> Firmando RdpShieldAgent.exe..." -ForegroundColor Cyan
    if ($CertThumbprint) {
        & $signtoolPath sign /sha1 $CertThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 ../publish/RdpShieldAgent.exe
    } else {
        & $signtoolPath sign /fd SHA256 /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td SHA256 ../publish/RdpShieldAgent.exe
    }
    
    # Sign any custom RdpShield dlls
    $dlls = Get-ChildItem -Path "../publish" -Filter "RdpShield*.dll"
    foreach ($dll in $dlls) {
        Write-Host "   -> Firmando dll: $($dll.Name)..." -ForegroundColor Cyan
        if ($CertThumbprint) {
            & $signtoolPath sign /sha1 $CertThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $dll.FullName
        } else {
            & $signtoolPath sign /fd SHA256 /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td SHA256 $dll.FullName
        }
    }
}

# 3. Harvest files into Files.wxs
Write-Host "2. Cosechando archivos de publicacion en Files.wxs..." -ForegroundColor Cyan
$publishDir = (Resolve-Path "../publish").Path
$wxsPath = "./Files.wxs"

$xml = @"
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Fragment>
    <ComponentGroup Id="AgentPublishComponents" Directory="INSTALLDIR">
"@

# Helper to generate unique ID
function Get-FileId([string]$relPath) {
    $id = $relPath.Replace("\", "_").Replace("/", "_").Replace(".", "_").Replace("-", "_")
    return "file_" + $id
}

# Recursively get all files
$files = Get-ChildItem -Path $publishDir -File -Recurse

foreach ($file in $files) {
    $relative = $file.FullName.Substring($publishDir.Length + 1)
    # Skip main executable and pdb brdpshielduse RdpShieldAgent.exe is defined manually in Package.wxs
    if ($relative -eq "RdpShieldAgent.exe" -or $relative -eq "RdpShieldAgent.pdb" -or $relative -eq "config.json") {
        continue
    }
    
    $fileId = Get-FileId $relative
    $source = "..\publish\$relative"
    
    $xml += "`n      <Component Guid=`"*`">`n        <File Id=`"$fileId`" Source=`"$source`" />`n      </Component>"
}

$xml += @"

    </ComponentGroup>
  </Fragment>
</Wix>
"@

[System.IO.File]::WriteAllText($wxsPath, $xml)
Write-Host "   -> Files.wxs generado exitosamente." -ForegroundColor Green

# 4. Compile the MSI using WiX Toolset
Write-Host "3. Compilando instalador MSI con WiX..." -ForegroundColor Cyan
wix build -o RdpShieldAgent.msi Package.wxs Files.wxs

# 5. Optionally sign the output MSI
if ($shouldSign) {
    Write-Host "4. Firmando instalador MSI RdpShieldAgent.msi..." -ForegroundColor Cyan
    if ($CertThumbprint) {
        & $signtoolPath sign /sha1 $CertThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 RdpShieldAgent.msi
    } else {
        & $signtoolPath sign /fd SHA256 /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td SHA256 RdpShieldAgent.msi
    }
    
    Write-Host "5. Verificando firma de RdpShieldAgent.msi..." -ForegroundColor Cyan
    & $signtoolPath verify /pa RdpShieldAgent.msi
}

Write-Host "=========================================" -ForegroundColor Green
Write-Host " Instalador RdpShieldAgent.msi creado con exito!" -ForegroundColor Green
if ($shouldSign) {
    Write-Host " Instalador firmado digitalmente con exito!" -ForegroundColor Green
}
Write-Host "=========================================" -ForegroundColor Green
