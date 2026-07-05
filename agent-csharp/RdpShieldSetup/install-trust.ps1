#Requires -RunAsAdministrator
param(
    [string]$CerPath = ".\RDPShield-CodeSign.cer"
)

$ErrorActionPreference = 'Stop'

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " RDPShield Certificate Trust Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check if CER exists
$resolvedPath = Resolve-Path $CerPath -ErrorAction SilentlyContinue
if ($null -eq $resolvedPath) {
    Write-Error "No se encontro el archivo del certificado en: $CerPath"
    exit 1
}
$fullPath = $resolvedPath.Path
Write-Host "Usando certificado: $fullPath"

# 2. Read certificate thumbprint to make the script idempotent and informative
try {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($fullPath)
    $thumbprint = $cert.Thumbprint
    $subject = $cert.Subject
    Write-Host "Detalles del certificado:"
    Write-Host "   Subject: $subject"
    Write-Host "   Thumbprint: $thumbprint"
} catch {
    Write-Error "El archivo no es un certificado X.509 valido."
    exit 1
}

# Helper to check if cert already exists in a store
function Test-CertInStore {
    param([string]$storeName, [string]$thumb)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "LocalMachine")
    $store.Open("ReadOnly")
    $exists = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumb }
    $store.Close()
    return ($null -ne $exists)
}

# 3. Import to Trusted Root Certification Authorities (Root)
if (Test-CertInStore "Root" $thumbprint) {
    Write-Host "[OK] El certificado ya existe en Entidades de certificacion de raiz de confianza (Root)." -ForegroundColor Green
} else {
    Write-Host "Importando a Entidades de certificacion de raiz de confianza (Root)..." -ForegroundColor Cyan
    Import-Certificate -FilePath $fullPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Write-Host "[OK] Importacion en Root completada." -ForegroundColor Green
}

# 4. Import to Trusted Publishers (TrustedPublisher)
if (Test-CertInStore "TrustedPublisher" $thumbprint) {
    Write-Host "[OK] El certificado ya existe en Editores de confianza (TrustedPublisher)." -ForegroundColor Green
} else {
    Write-Host "Importando a Editores de confianza (TrustedPublisher)..." -ForegroundColor Cyan
    Import-Certificate -FilePath $fullPath -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null
    Write-Host "[OK] Importacion en TrustedPublisher completada." -ForegroundColor Green
}

Write-Host "=========================================" -ForegroundColor Green
Write-Host " Confianza del certificado establecida con exito!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
