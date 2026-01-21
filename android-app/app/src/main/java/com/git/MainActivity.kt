package com.git

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Toast
import android.widget.TextView
import android.widget.ProgressBar
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.git.vpn.WireGuardManager
import com.git.vpn.VPNConfig
import com.git.vpn.ConfigStorage
import com.git.vpn.WireGuardConfigParser
import com.git.vpn.VPNConfigData
import com.wireguard.android.backend.Tunnel
import com.git.webview.WebAppActivity
import kotlinx.coroutines.launch
import com.git.R
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher
import java.net.InetSocketAddress
import java.net.Socket

class MainActivity : AppCompatActivity() {
    private val vpnManager: WireGuardManager by lazy {
        (application as GitApplication).vpnManager
    }
    private lateinit var configStorage: ConfigStorage
    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var importButton: Button
    private lateinit var webAppUrlInput: EditText
    private lateinit var saveUrlButton: Button
    private lateinit var useSavedConfigButton: Button
    
    // File picker per importare .conf
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            importConfigFile(it)
        }
    }
    
    // Launcher per richiesta permesso VPN (sostituisce startActivityForResult)
    private val vpnPermissionLauncher: ActivityResultLauncher<Intent> = 
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                lifecycleScope.launch {
                    initializeAndStartVPN(null)
                }
            } else {
                showError("Permesso VPN negato. L'app richiede VPN per funzionare.")
            }
        }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        statusText = findViewById(R.id.statusText)
        progressBar = findViewById(R.id.progressBar)
        importButton = findViewById(R.id.importButton)
        webAppUrlInput = findViewById(R.id.webAppUrlInput)
        saveUrlButton = findViewById(R.id.saveUrlButton)
        useSavedConfigButton = findViewById(R.id.useSavedConfigButton)
        
        configStorage = ConfigStorage(this)
        
        // Verifica se esiste già una configurazione
        val hasConfig = configStorage.hasConfig()
        val firstRunSetupNeeded = !configStorage.hasCompletedSetup()
        if (!hasConfig || firstRunSetupNeeded) {
            // Mostra schermata setup iniziale
            showImportScreen(hasConfig)
        } else {
            // Configurazione esistente, procedi con VPN
            lifecycleScope.launch {
                initializeAndStartVPN()
            }
        }
        
        // Listener per pulsante importazione
        importButton.setOnClickListener {
            val pendingUrl = webAppUrlInput.text?.toString()?.trim()
            if (!pendingUrl.isNullOrEmpty()) {
                configStorage.setPendingWebAppUrl(pendingUrl)
            }
            openFilePicker()
        }
        
        saveUrlButton.setOnClickListener {
            val url = webAppUrlInput.text?.toString()?.trim() ?: ""
            if (!isValidWebAppUrl(url)) {
                showError("Inserisci un URL valido (es. http://192.168.1.119:26080)")
                return@setOnClickListener
            }
            configStorage.setPendingWebAppUrl(url)
            Toast.makeText(this, "URL salvato", Toast.LENGTH_SHORT).show()
        }

        useSavedConfigButton.setOnClickListener {
            val url = webAppUrlInput.text?.toString()?.trim().orEmpty()
            if (url.isNotEmpty()) {
                if (!isValidWebAppUrl(url)) {
                    showError("Inserisci un URL valido (es. http://192.168.1.119:26080)")
                    return@setOnClickListener
                }
                if (!configStorage.updateWebAppUrl(url)) {
                    showError("Configurazione non trovata. Importa un file .conf WireGuard.")
                    return@setOnClickListener
                }
            }
            configStorage.setCompletedSetup()
            lifecycleScope.launch {
                initializeAndStartVPN()
            }
        }
    }
    
    private fun showImportScreen(hasConfig: Boolean) {
        runOnUiThread {
            statusText.text = "Imposta l'URL della web app e importa il file .conf WireGuard"
            importButton.visibility = android.view.View.VISIBLE
            progressBar.visibility = android.view.View.GONE
            webAppUrlInput.visibility = android.view.View.VISIBLE
            saveUrlButton.visibility = android.view.View.VISIBLE
            useSavedConfigButton.visibility = if (hasConfig) android.view.View.VISIBLE else android.view.View.GONE
            webAppUrlInput.setText(configStorage.getPendingWebAppUrl() ?: "")
        }
    }
    
    private fun openFilePicker() {
        filePickerLauncher.launch("*/*")
    }
    
    private fun importConfigFile(uri: Uri) {
        try {
            runOnUiThread {
                statusText.text = "Lettura file .conf..."
                importButton.visibility = android.view.View.GONE
                progressBar.visibility = android.view.View.VISIBLE
            }
            
            // Leggi il file
            val inputStream = contentResolver.openInputStream(uri)
            if (inputStream == null) {
                showError("Impossibile leggere il file. Verifica i permessi.")
                return
            }
            
            // Verifica che sia un file .conf valido
            val isValid = try {
                val checkStream = contentResolver.openInputStream(uri)
                checkStream?.use {
                    WireGuardConfigParser.isValidConfig(it)
                } ?: false
            } catch (e: Exception) {
                false
            }
            
            if (!isValid) {
                showError("File .conf non valido. Verifica che contenga [Interface] e [Peer] con le chiavi necessarie.")
                return
            }
            
            // Parse configurazione
            val configStream = contentResolver.openInputStream(uri)
            val pendingUrl = configStorage.getPendingWebAppUrl()
            val config = configStream?.use {
                WireGuardConfigParser.parseConfig(it, pendingUrl)
            }
            
            if (config == null) {
                showError("Errore parsing file .conf. Verifica il formato del file.")
                return
            }
            
            // Salva configurazione
            configStorage.saveConfig(config)
            configStorage.clearPendingWebAppUrl()
            configStorage.setCompletedSetup()
            
            runOnUiThread {
                statusText.text = "Configurazione importata! Avvio VPN..."
            }
            
            // Procedi con l'inizializzazione VPN
            lifecycleScope.launch {
                initializeAndStartVPN(config)
            }
            
        } catch (e: Exception) {
            e.printStackTrace()
            showError("Errore importazione configurazione: ${e.message}")
        }
    }
    
    private suspend fun initializeAndStartVPN(configData: VPNConfigData? = null) {
        runOnUiThread { 
            statusText.text = "Inizializzazione VPN..."
            progressBar.visibility = android.view.View.VISIBLE
        }
        
        // Carica configurazione: da parametro, da storage, o default
        var config = configData ?: configStorage.loadConfig() ?: run {
            // Fallback a default (per retrocompatibilità)
            val defaultConfig = VPNConfig.getDefaultConfig()
            if (defaultConfig.serverIP == "YOUR_SERVER_IP" || 
                defaultConfig.serverPublicKey == "SERVER_PUBLIC_KEY" ||
                defaultConfig.clientPrivateKey == "CLIENT_PRIVATE_KEY") {
                showError("Configurazione VPN non trovata. Importa un file .conf WireGuard.")
                return
            }
            defaultConfig
        }

        val effectiveAllowedIps = ensureWebAppInAllowedIps(config.allowedIPs, config.webAppUrl)
        if (effectiveAllowedIps != config.allowedIPs) {
            android.util.Log.w(
                "MainActivity",
                "AllowedIPs aggiornati per includere WebAppUrl: $effectiveAllowedIps"
            )
            config = config.copy(allowedIPs = effectiveAllowedIps)
            configStorage.updateAllowedIps(effectiveAllowedIps)
        }
        
        // Inizializza WireGuard
        if (!vpnManager.initialize()) {
            showError("Errore inizializzazione VPN")
            return
        }

        // Assicura tunnel pulito prima della riconnessione
        try {
            vpnManager.stopVPN()
        } catch (_: Exception) {
            // Ignora errori di stop: serve solo a pulire stato precedente
        }
        
        runOnUiThread { statusText.text = "Richiesta permesso VPN..." }
        
        // Richiedi permesso VPN se necessario (usando ActivityResultLauncher invece di startActivityForResult)
        val intent = VpnService.prepare(this)
        if (intent != null) {
            vpnPermissionLauncher.launch(intent)
            return
        }
        
        runOnUiThread { statusText.text = "Caricamento configurazione..." }
        
        // Crea configurazione WireGuard con gestione errori
        val wgConfig = try {
            runOnUiThread { statusText.text = "Creazione tunnel VPN..." }
            android.util.Log.d("MainActivity", "Creazione configurazione VPN con:")
            android.util.Log.d("MainActivity", "  Server: ${config.serverIP}:${config.serverPort}")
            android.util.Log.d("MainActivity", "  Client IP: ${config.clientIP}")
            android.util.Log.d("MainActivity", "  AllowedIPs: ${config.allowedIPs}")
            android.util.Log.d("MainActivity", "  WebApp URL: ${config.webAppUrl}")

            if (!isWebAppHostAllowed(config.webAppUrl, config.allowedIPs)) {
                runOnUiThread {
                    statusText.text = "Attenzione: l'URL della web app non è incluso in AllowedIPs."
                }
                android.util.Log.w(
                    "MainActivity",
                    "WebAppUrl fuori AllowedIPs. URL=${config.webAppUrl}, AllowedIPs=${config.allowedIPs}"
                )
            }
            
            vpnManager.createVPNConfig(
                serverIP = config.serverIP,
                serverPort = config.serverPort,
                serverPublicKey = config.serverPublicKey,
                clientPrivateKey = config.clientPrivateKey,
                clientIP = config.clientIP,
                allowedIPs = config.allowedIPs,
                dns = config.dns,
                persistentKeepalive = config.persistentKeepalive,
                presharedKey = config.presharedKey
            )
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Errore creazione configurazione VPN", e)
            showError("Errore creazione configurazione VPN: ${e.message}")
            return
        }
        
        runOnUiThread { statusText.text = "Connessione in corso..." }
        
        // Avvia VPN con retry
        var vpnStarted = false
        var attempts = 0
        val maxAttempts = 3
        
        while (!vpnStarted && attempts < maxAttempts) {
            attempts++
            android.util.Log.d("MainActivity", "Tentativo connessione VPN: $attempts/$maxAttempts")
            
            try {
                vpnStarted = vpnManager.startVPN(wgConfig)
                if (vpnStarted) {
                    android.util.Log.d("MainActivity", "VPN avviata con successo al tentativo $attempts")
                } else {
                    android.util.Log.w("MainActivity", "VPN non avviata al tentativo $attempts")
                    if (attempts < maxAttempts) {
                        kotlinx.coroutines.delay(1000) // Attesa prima del retry
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Errore durante avvio VPN al tentativo $attempts", e)
                if (attempts < maxAttempts) {
                    kotlinx.coroutines.delay(1000)
                } else {
                    showError("Errore attivazione VPN dopo $maxAttempts tentativi: ${e.message}")
                    return
                }
            }
        }
        
        if (!vpnStarted) {
            showError("Errore attivazione VPN dopo $maxAttempts tentativi. Verifica la configurazione.")
            return
        }
        
        runOnUiThread { statusText.text = "VPN connessa! Verifica connessione..." }
        
        // Aspetta che la VPN sia completamente attiva e verifica lo stato
        var retries = 0
        val maxRetries = 20 // Aumentato a 20 retry (10 secondi)
        var vpnReady = false
        
        while (retries < maxRetries && !vpnReady) {
            kotlinx.coroutines.delay(500)
            retries++
            
            val vpnState = try {
                vpnManager.getVPNState()
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Errore verifica stato VPN", e)
                null
            }
            
            android.util.Log.d("MainActivity", "Verifica stato VPN (tentativo $retries/$maxRetries): $vpnState")
            
            if (vpnState == Tunnel.State.UP) {
                vpnReady = true
                android.util.Log.d("MainActivity", "VPN attiva dopo $retries tentativi")
            } else {
                runOnUiThread { 
                    statusText.text = "Attesa VPN... ($retries/$maxRetries)"
                }
            }
        }
        
        if (vpnReady) {
            runOnUiThread { statusText.text = "VPN attiva! Stabilizzazione connessione..." }
            // Attesa più lunga per stabilizzazione completa della VPN
            kotlinx.coroutines.delay(2000)
            
            android.util.Log.d("MainActivity", "Apertura web app con URL: ${config.webAppUrl}")
            val reachable = checkServerReachable(config.webAppUrl)
            runOnUiThread {
                statusText.text = if (reachable) {
                    "Apertura web app..."
                } else {
                    "VPN attiva ma server non raggiungibile. Verifica IP, AllowedIPs e firewall."
                }
            }
            
            // VPN attiva, apri WebView
            openWebApp(config.webAppUrl)
        } else {
            android.util.Log.w("MainActivity", "VPN non completamente attiva dopo $maxRetries tentativi, apro comunque web app")
            runOnUiThread { statusText.text = "VPN in attesa... Apertura web app..." }
            // Attesa anche se non completamente pronta
            kotlinx.coroutines.delay(2000)
            openWebApp(config.webAppUrl)
        }
    }
    
    private fun openWebApp(url: String) {
        val intent = Intent(this, WebAppActivity::class.java).apply {
            putExtra("WEB_APP_URL", url)
        }
        startActivity(intent)
        finish()
    }

    private fun isValidWebAppUrl(url: String): Boolean {
        return try {
            val parsed = Uri.parse(url)
            !parsed.scheme.isNullOrEmpty() && !parsed.host.isNullOrEmpty()
        } catch (e: Exception) {
            false
        }
    }

    private fun checkServerReachable(url: String): Boolean {
        return try {
            val uri = Uri.parse(url)
            val host = uri.host ?: return false
            val port = uri.port.takeIf { it > 0 } ?: if (uri.scheme == "https") 443 else 80
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), 3000)
            }
            true
        } catch (e: Exception) {
            android.util.Log.w("MainActivity", "Server non raggiungibile: ${e.message}")
            false
        }
    }

    private fun isWebAppHostAllowed(url: String, allowedIps: String): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host ?: return true
        if (!isIpv4(host)) return true
        val ipLong = ipv4ToLong(host)
        val ranges = allowedIps.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        return ranges.any { cidr ->
            if (cidr.contains(":")) {
                false
            } else if (cidr == "0.0.0.0/0") {
                true
            } else {
                isIpInCidr(ipLong, cidr)
            }
        }
    }

    private fun isIpInCidr(ipLong: Long, cidr: String): Boolean {
        val parts = cidr.split("/")
        if (parts.size != 2) return false
        val baseIp = parts[0]
        val prefix = parts[1].toIntOrNull() ?: return false
        if (prefix < 0 || prefix > 32) return false
        val mask = if (prefix == 0) 0L else (-1L shl (32 - prefix)) and 0xFFFFFFFFL
        val baseLong = ipv4ToLong(baseIp)
        return (ipLong and mask) == (baseLong and mask)
    }

    private fun ipv4ToLong(ip: String): Long {
        val parts = ip.split(".").map { it.toIntOrNull() ?: 0 }
        if (parts.size != 4) return 0L
        return ((parts[0].toLong() shl 24) or
            (parts[1].toLong() shl 16) or
            (parts[2].toLong() shl 8) or
            parts[3].toLong()) and 0xFFFFFFFFL
    }

    private fun isIpv4(host: String): Boolean {
        val parts = host.split(".")
        if (parts.size != 4) return false
        return parts.all { it.toIntOrNull()?.let { v -> v in 0..255 } ?: false }
    }

    private fun ensureWebAppInAllowedIps(allowedIps: String, webAppUrl: String): String {
        if (allowedIps.isBlank()) {
            return webAppHostNetworkCidr(webAppUrl) ?: allowedIps
        }
        if (isWebAppHostAllowed(webAppUrl, allowedIps)) {
            return allowedIps
        }
        val cidr = webAppHostNetworkCidr(webAppUrl) ?: return allowedIps
        return allowedIps.trim().trimEnd(',') + ",$cidr"
    }

    private fun webAppHostCidr(url: String): String? {
        val uri = Uri.parse(url)
        val host = uri.host ?: return null
        return if (isIpv4(host)) "$host/32" else null
    }

    private fun webAppHostNetworkCidr(url: String): String? {
        val uri = Uri.parse(url)
        val host = uri.host ?: return null
        if (!isIpv4(host)) return null
        val parts = host.split(".")
        if (parts.size != 4) return null
        val network24 = "${parts[0]}.${parts[1]}.${parts[2]}.0/24"
        return network24
    }
    
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
}
