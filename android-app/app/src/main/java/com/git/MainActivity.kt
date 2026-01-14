package com.git

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Toast
import android.widget.TextView
import android.widget.ProgressBar
import android.widget.Button
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

class MainActivity : AppCompatActivity() {
    private val vpnManager: WireGuardManager by lazy {
        (application as GitApplication).vpnManager
    }
    private lateinit var configStorage: ConfigStorage
    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var importButton: Button
    
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
        
        configStorage = ConfigStorage(this)
        
        // Verifica se esiste già una configurazione
        if (!configStorage.hasConfig()) {
            // Mostra pulsante importazione
            showImportScreen()
        } else {
            // Configurazione esistente, procedi con VPN
            lifecycleScope.launch {
                initializeAndStartVPN()
            }
        }
        
        // Listener per pulsante importazione
        importButton.setOnClickListener {
            openFilePicker()
        }
    }
    
    private fun showImportScreen() {
        runOnUiThread {
            statusText.text = "Seleziona il file .conf WireGuard per importare la configurazione"
            importButton.visibility = android.view.View.VISIBLE
            progressBar.visibility = android.view.View.GONE
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
            val config = configStream?.use {
                WireGuardConfigParser.parseConfig(it)
            }
            
            if (config == null) {
                showError("Errore parsing file .conf. Verifica il formato del file.")
                return
            }
            
            // Salva configurazione
            configStorage.saveConfig(config)
            
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
        val config = configData ?: configStorage.loadConfig() ?: run {
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
        
        // Inizializza WireGuard
        if (!vpnManager.initialize()) {
            showError("Errore inizializzazione VPN")
            return
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
            runOnUiThread { statusText.text = "Apertura web app..." }
            
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
    
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
}
