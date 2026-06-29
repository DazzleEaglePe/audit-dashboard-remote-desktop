# Runbook — Firma de Código y Despliegue por GPO (EcaAgent)

Este documento detalla el procedimiento para firmar digitalmente el instalador `EcaAgent.msi` y configurar la confianza en el cliente para permitir despliegues masivos y silenciosos (GPO/RMM) libres de advertencias del sistema de protección SmartScreen de Windows.

---

## 🟦 PARTE 1 — PARA EL ADMINISTRADOR DE ECA (Generar y Firmar)

### 1. Generar el Certificado de Firma de Código (Self-Signed)
En una máquina segura (de preferencia fuera del entorno de compilación público), ejecute el siguiente comando en una consola de PowerShell elevada para crear una clave de firma de código con validez de 5 años:

```powershell
# Crear certificado de firma de código en el almacén personal del usuario actual
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject "CN=ECA RDP Auditing, O=ECA, C=CL" `
    -FriendlyName "ECA Code Signing Certificate" `
    -KeyUsage DigitalSignature `
    -NotAfter (Get-Date).AddYears(5) `
    -CertStoreLocation Cert:\CurrentUser\My
```

### 2. Exportar el Certificado (`.pfx` y `.cer`)
Para firmar el MSI en el entorno de desarrollo o pipeline, necesitamos exportar la clave privada (`.pfx`). Para que los clientes confíen en el instalador, exportamos la clave pública (`.cer`).

```powershell
# Definir una contraseña segura para el archivo PFX
$pwd = ConvertTo-SecureString "CONTRASEÑA_SUPER_SEGURA_AQUI" -AsPlainText -Force

# Exportar clave privada (PFX) - ¡PROTEGER Y MANTENER OFFLINE!
Export-PfxCertificate -Cert $cert -FilePath ".\ECA-CodeSign.pfx" -Password $pwd

# Exportar clave pública (CER) - Se entrega al cliente
Export-Certificate -Cert $cert -FilePath ".\ECA-CodeSign.cer"
```

> [!WARNING]
> **Seguridad Crítica:** Nunca guarde el archivo `.pfx` ni su contraseña en repositorios públicos de Git. Estos archivos están configurados en el `.gitignore` del proyecto para evitar subidas accidentales.

### 3. Compilar y Firmar el instalador MSI

Existen dos opciones de firma soportadas por `build-msi.ps1`:

#### Opción A: Archivo PFX Local (Desarrollo / Pruebas)
Pase las credenciales y ruta del archivo `.pfx` directamente:
```powershell
# Compilar y firmar automáticamente con archivo PFX local
.\build-msi.ps1 -PfxPath ".\ECA-CodeSign.pfx" -PfxPassword "CONTRASEÑA_SUPER_SEGURA_AQUI"
```

#### Opción B: Almacén de Certificados de Windows (Recomendado para CI/CD y Producción)
Para evitar ataques de lectura de línea de comando o procesos espiando contraseñas `/p` en texto plano durante la compilación, se puede importar el certificado en el almacén de Windows de la máquina compiladora y firmar usando su huella digital (`Thumbprint` / `SHA-1`):

1. Importe el `.pfx` en el almacén de certificados personal del usuario:
   ```powershell
   Import-PfxCertificate -FilePath ".\ECA-CodeSign.pfx" -CertStoreLocation Cert:\CurrentUser\My
   ```
2. Ejecute el script pasando únicamente el `-CertThumbprint` (la huella del certificado):
   ```powershell
   # Compila y firma de forma segura sin exponer contraseñas en consola
   .\build-msi.ps1 -CertThumbprint "HUella_Digital_SHA1_DEL_CERTIFICADO"
   ```

El script firmará los binarios compilados, generará el instalador `EcaAgent.msi` y firmará el paquete `.msi` completo aplicando una firma digital SHA256 con marcas de tiempo (timestamping) de DigiCert, asegurando la validez perpetua de la firma incluso tras la expiración del certificado.

---

## 🟧 PARTE 2 — PARA EL ADMINISTRADOR DEL CLIENTE (Confianza y Despliegue)

El cliente final debe confiar en el certificado público de ECA antes de realizar el despliegue silencioso para evitar que Windows Installer aborte la instalación por falta de privilegios o firmas válidas.

### Opción A: Configuración Manual (1 sola máquina / Laboratorio)
Copie los archivos `ECA-CodeSign.cer` y `install-trust.ps1` a la máquina destino y ejecute el script como Administrador:

```powershell
# Ejecutar setup de confianza
powershell.exe -ExecutionPolicy Bypass -File .\install-trust.ps1 -CerPath .\ECA-CodeSign.cer
```

### Opción B: Despliegue Masivo mediante Active Directory (GPO de Dominio)
Para implementar de forma masiva en toda la red corporativa del cliente, siga estos pasos:

#### 1. Configurar la Confianza del Certificado vía GPO
1. Abra la consola **Group Policy Management** (`gpmc.msc`) en el Domain Controller.
2. Cree una nueva GPO (ej. *ECA Agent Certificate Trust*) y edítela.
3. Navegue a: **Computer Configuration** ➔ **Policies** ➔ **Windows Settings** ➔ **Security Settings** ➔ **Public Key Policies**.
4. Importe el archivo **`ECA-CodeSign.cer`** en los siguientes dos almacenes:
   * **Trusted Root Certification Authorities** (Entidades de certificación de raíz de confianza).
   * **Trusted Publishers** (Editores de confianza).
5. Vincule la GPO a la Unidad Organizativa (OU) donde residen los servidores/PCs destino.

#### 2. Despliegue Silencioso del Agente MSI
Una vez propagado el certificado de confianza (las políticas de GPO se actualizan cada 90 minutos, o puede forzarlo con `gpupdate /force`), proceda con el despliegue del MSI:

* **Mediante GPO (Software Installation):**
  Configure una directiva de instalación de software en la GPO apuntando al recurso compartido UNC de red donde se aloja el MSI.
* **Mediante Comando Silencioso (RMM, Startup Script, SCCM):**
  Ejecute la instalación silenciosa especificando los parámetros de enrolamiento requeridos:
  ```cmd
  msiexec /qn /i "\\UNC-PATH\EcaAgent.msi" API_URL="https://tu-dominio-audit.com" ENROLL_TOKEN="eca_enroll_TU_TOKEN_AQUI"
  ```

---

## 🤖 AUTOMATIZACIÓN DE CI/CD (GitHub Actions)

El proyecto cuenta con el workflow de integración continua [**`build-agent-msi.yml`**](file:///c:/Users/sofia/OneDrive/Escritorio/AUDITORIA-ECA/.github/workflows/build-agent-msi.yml) que compila y firma automáticamente el instalador en cada publicación de Release en GitHub.

### Configuración de Secretos en GitHub:
Para habilitar la firma automática en el pipeline, configure los siguientes dos secretos en su repositorio (`Settings` ➔ `Secrets and variables` ➔ `Actions`):

1. **`SIGNING_PFX_PASSWORD`**: La contraseña utilizada para cifrar el archivo `.pfx`.
2. **`SIGNING_PFX_BASE64`**: El archivo `.pfx` codificado en formato Base64.
   * *Para obtener este valor en Windows, ejecute el siguiente comando:*
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\ECA-CodeSign.pfx")) | Set-Clipboard
     ```
     *(El comando copiará la cadena Base64 directamente a su portapapeles para pegarla en el secreto).*

Cada vez que publique una versión (Release) o ejecute manualmente el pipeline mediante `workflow_dispatch`, el workflow decodificará la clave, firmará los binarios y el MSI de forma aislada, y adjuntará el instalador `EcaAgent.msi` firmado directamente en los assets del Release.

---

## 🔍 VERIFICACIÓN DE FIRMA

Para comprobar localmente que un MSI esté correctamente firmado:
1. Haga clic derecho sobre `EcaAgent.msi` ➔ **Propiedades**.
2. Deberá visualizarse la pestaña **Firmas Digitales** mostrando el firmante `ECA RDP Auditing` junto a su correspondiente algoritmo hash `SHA256` y marca de tiempo.
3. Alternativamente, ejecute desde consola:
   ```cmd
   signtool verify /pa EcaAgent.msi
   ```
