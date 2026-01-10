package com.sistema54

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Toast
import android.widget.TextView
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sistema54.vpn.WireGuardManager
import com.sistema54.vpn.VPNConfig
import com.sistema54.webview.WebAppActivity
import kotlinx.coroutines.launch
import com.sistema54.R

class MainActivity : AppCompatActivity() {
    private lateinit var vpnManager: WireGuardManager
    private val VPN_REQUEST_CODE = 100
    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        statusText = findViewById(R.id.statusText)
        progressBar = findViewById(R.id.progressBar)
        
        vpnManager = WireGuardManager(this)
        
        lifecycleScope.launch {
            initializeAndStartVPN()
        }
    }
    
    private suspend fun initializeAndStartVPN() {
        runOnUiThread { statusText.text = "Inizializzazione VPN..." }
        
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
        
        // Carica configurazione VPN
        val config = VPNConfig.getDefaultConfig()
        
        // Verifica che la configurazione sia valida
        if (config.serverIP == "YOUR_SERVER_IP" || 
            config.serverPublicKey == "SERVER_PUBLIC_KEY" ||
            config.clientPrivateKey == "CLIENT_PRIVATE_KEY") {
            showError("Configurazione VPN non valida. Modifica VPNConfig.kt con le tue credenziali.")
            return
        }
        
        runOnUiThread { statusText.text = "Creazione tunnel VPN..." }
        
        // Crea configurazione WireGuard
        val wgConfig = vpnManager.createVPNConfig(
            serverIP = config.serverIP,
            serverPort = config.serverPort,
            serverPublicKey = config.serverPublicKey,
            clientPrivateKey = config.clientPrivateKey,
            allowedIPs = config.allowedIPs
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
                initializeAndStartVPN()
            }
        } else if (requestCode == VPN_REQUEST_CODE) {
            showError("Permesso VPN negato. L'app richiede VPN per funzionare.")
        }
    }
}
