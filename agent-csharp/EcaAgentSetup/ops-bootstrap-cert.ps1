param(
    [string]$Subject = "CN=ECA RDP Auditing, O=ECA, C=PE",
    [string]$FriendlyName = "ECA Code Signing Certificate",
    [int]$Years = 5,
    [string]$OutDir = ".",
    [securestring]$PfxPassword,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ECA Code Signing Certificate Generator" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Resolve output files
$pfx = Join-Path $OutDir "ECA-CodeSign.pfx"
$cer = Join-Path $OutDir "ECA-CodeSign.cer"

$pfxResolved = Resolve-Path $pfx -ErrorAction SilentlyContinue
if ($null -ne $pfxResolved -and -not $Force) {
    Write-Error "Ya existe un certificado en la ruta: $pfx. Usa -Force si quieres regenerarlo (¡CUIDADO! Esto invalidara la confianza ya distribuida en clientes)."
    exit 1
}

# 2. Securely read password if not provided
if (-not $PfxPassword) {
    $PfxPassword = Read-Host "Ingrese la contrasena para proteger la llave privada (.pfx)" -AsSecureString
}

# 3. Create the self-signed code signing certificate
Write-Host "Generando certificado autofirmado..." -ForegroundColor Cyan
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject $Subject -FriendlyName $FriendlyName `
    -KeyUsage DigitalSignature -NotAfter (Get-Date).AddYears($Years) `
    -CertStoreLocation Cert:\CurrentUser\My

# 4. Export private key (.pfx) and public key (.cer)
Write-Host "Exportando llave privada (.pfx) y publica (.cer)..." -ForegroundColor Cyan
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $PfxPassword | Out-Null
Export-Certificate    -Cert $cert -FilePath $cer | Out-Null

Write-Host "=========================================" -ForegroundColor Green
Write-Host " ¡Certificado creado y exportado con exito!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
Write-Host "Expira: $($cert.NotAfter)" -ForegroundColor Yellow
Write-Host "PFX (PRIVADO, offline): $pfx"
Write-Host "CER (publico, para clientes): $cer"
Write-Host "`nRECOMENDACION DE SEGURIDAD:" -ForegroundColor Yellow
Write-Host "Guarde el archivo .pfx cifrado y offline. NO lo suba al repositorio de Git." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Green
