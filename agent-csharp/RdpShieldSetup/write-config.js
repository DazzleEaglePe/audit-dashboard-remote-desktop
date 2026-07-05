function WriteConfig() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var data = Session.Property("CustomActionData");
        if (!data) {
            return 3; // ERROR_INSTALL_FAILURE
        }
        
        var parts = data.split("|");
        var commonAppData = parts[0];
        var tempFolder = parts[1];
        var apiUrl = parts[2];
        var token = parts[3];

        // Validar URL http(s) y rechazar caracteres que romperían el JSON o el parsing por '|'
        if (!/^https?:\/\/[^"\\|]+$/.test(apiUrl)) {
            return 3; // ERROR_INSTALL_FAILURE
        }

        // Create RDPShield directory in CommonAppData
        var rdpshieldDir = commonAppData + "RDPShield";
        if (!fso.FolderExists(rdpshieldDir)) {
            fso.CreateFolder(rdpshieldDir);
        }

        // Write config.json file
        var configFile = fso.CreateTextFile(rdpshieldDir + "\\config.json", true);
        configFile.WriteLine("{");
        configFile.WriteLine("  \"api_url\": \"" + apiUrl + "\",");
        configFile.WriteLine("  \"enroll_token\": \"" + token + "\",");
        configFile.WriteLine("  \"heartbeat_interval\": 30,");
        configFile.WriteLine("  \"screenshot_interval\": 3");
        configFile.WriteLine("}");
        configFile.Close();
    } catch (err) {
        return 3; // ERROR_INSTALL_FAILURE
    }
    return 1; // ERROR_SUCCESS
}

function CleanupConfig() {
    try {
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var data = Session.Property("CustomActionData");
        if (!data) {
            return 1;
        }
        
        var rdpshieldDir = data + "RDPShield";
        if (fso.FolderExists(rdpshieldDir)) {
            fso.DeleteFolder(rdpshieldDir, true);
        }
    } catch (err) {
        // Ignore errors during cleanup on uninstall
    }
    return 1; // ERROR_SUCCESS
}
