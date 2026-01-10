package com.sistema54

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Toast
import android.widget.TextView
import android.widget.ProgressBar
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sistema54.vpn.WireGuardManager
import com.sistema54.vpn.VPNConfig
import com.sistema54.vpn.ConfigStorage
import com.sistema54.vpn.WireGuardConfigParser
import com.sistema54.vpn.VPNConfigData
import com.sistema54.webview.WebAppActivity
import kotlinx.coroutines.launch
import com.sistema54.R
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : AppCompatActivity() {
    private lateinit var vpnManager: WireGuardManager
    private lateinit var configStorage: ConfigStorage
    private val VPN_REQUEST_CODE = 100
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
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        statusText = findViewById(R.id.statusText)
        progressBar = findViewById(R.id.progressBar)
        importButton = findViewById(R.id.importButton)
        
        vpnManager = WireGuardManager(this)
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
        
        // Richiedi permesso VPN se necessario
        val intent = VpnService.prepare(this)
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE)
            return
        }
        
        runOnUiThread { statusText.text = "Caricamento configurazione..." }
        
        runOnUiThread { statusText.text = "Creazione tunnel VPN..." }
        
        // Crea configurazione WireGuard
        val wgConfig = vpnManager.createVPNConfig(
            serverIP = config.serverIP,
            serverPort = config.serverPort,
            serverPublicKey = config.serverPublicKey,
            clientPrivateKey = config.clientPrivateKey,
            clientIP = config.clientIP,
            allowedIPs = config.allowedIPs,
            dns = config.dns,
            persistentKeepalive = config.persistentKeepalive
        )
        
        runOnUiThread { statusText.text = "Connessione in corso..." }
        
        // Avvia VPN
        if (vpnManager.startVPN(wgConfig)) {
            runOnUiThread { statusText.text = "VPN connessa! Apertura web app..." }
            
            // Aspetta che la VPN sia completamente attiva
            kotlinx.coroutines.delay(2000)
            
            // VPN attiva, apri WebView
            openWebApp(config.webAppUrl)
        } else {
            showError("Errore attivazione VPN. Verifica la configurazione e che il server sia raggiungibile.")
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
    
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            lifecycleScope.launch {
                initializeAndStartVPN(null)
            }
        } else if (requestCode == VPN_REQUEST_CODE) {
            showError("Permesso VPN negato. L'app richiede VPN per funzionare.")
        }
    }
}
