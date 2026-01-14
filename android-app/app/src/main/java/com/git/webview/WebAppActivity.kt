package com.git.webview

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.widget.Toast
import android.util.Log
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.git.R
import com.git.GitApplication
import com.git.vpn.WireGuardManager

class WebAppActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var disconnectButton: FloatingActionButton
    private val vpnManager: WireGuardManager by lazy {
        (application as GitApplication).vpnManager
    }
    private var isDisconnecting = false
    
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_webapp)
        
        // URL della web app (da intent o default)
        // NOTA: Se la VPN instrada verso la rete locale, usa l'IP della rete locale
        // Se la VPN crea una rete privata, usa l'IP della VPN (es: 10.0.0.1)
        val webAppUrl = intent.getStringExtra("WEB_APP_URL") 
            ?: "http://192.168.1.119:26080"
        
        Log.d("WebAppActivity", "=== INIZIALIZZAZIONE WEBVIEW ===")
        Log.d("WebAppActivity", "URL da caricare: $webAppUrl")
        
        // Verifica stato VPN prima di caricare
        val vpnState = try {
            vpnManager.getVPNState()
        } catch (e: Exception) {
            Log.e("WebAppActivity", "Errore verifica stato VPN", e)
            null
        }
        Log.d("WebAppActivity", "Stato VPN: $vpnState")
        
        webView = findViewById(R.id.webView)
        disconnectButton = findViewById(R.id.disconnectButton)
        
        // Listener per pulsante disconnessione
        disconnectButton.setOnClickListener {
            showDisconnectDialog()
        }
        
        // Configurazione WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // Abilita cache per migliorare le prestazioni
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            // Nota: allowUniversalAccessFromFileURLs e allowFileAccessFromFileURLs
            // sono deprecati e rimossi in Android R+ (API 30+)
            // La sicurezza è gestita automaticamente dal sistema
        }
        
        // Client custom per gestire navigazione e errori
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: ""
                Log.d("WebAppActivity", "Navigazione richiesta: $url")
                // Carica tutte le URL nella WebView
                return false
            }
            
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                
                val errorMessage = error?.description?.toString() ?: "Errore sconosciuto"
                val url = request?.url?.toString() ?: "URL sconosciuto"
                val errorCode = error?.errorCode ?: -1
                
                Log.e("WebAppActivity", "Errore caricamento: $errorMessage (codice: $errorCode) - URL: $url")
                
                // Mostra errore solo se è l'URL principale
                if (request?.isForMainFrame == true) {
                    runOnUiThread {
                        Toast.makeText(
                            this@WebAppActivity,
                            "Errore caricamento: $errorMessage\nURL: $url\nVerifica che la VPN sia attiva e che il server sia raggiungibile.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d("WebAppActivity", "Pagina caricata con successo: $url")
            }
            
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d("WebAppActivity", "Caricamento pagina iniziato: $url")
            }
            
            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: android.webkit.WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val url = request?.url?.toString() ?: "URL sconosciuto"
                val statusCode = errorResponse?.statusCode ?: -1
                Log.w("WebAppActivity", "Errore HTTP $statusCode per URL: $url")
            }
        }
        
        webView.webChromeClient = WebChromeClient()
        
        // Attesa breve prima di caricare per assicurarsi che la VPN sia completamente attiva
        Log.d("WebAppActivity", "Attesa stabilizzazione VPN prima di caricare URL...")
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            Log.d("WebAppActivity", "Caricamento URL: $webAppUrl")
            webView.loadUrl(webAppUrl)
        }, 1000) // Attesa 1 secondo
        
        // Gestione back button usando OnBackPressedDispatcher (sostituisce onBackPressed deprecato)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // Se non c'è history, mostra dialog per disconnettere VPN
                    showDisconnectDialog()
                }
            }
        })
    }
    
    override fun onDestroy() {
        // Disconnette automaticamente la VPN quando l'activity viene distrutta
        if (!isDisconnecting) {
            disconnectVPN()
        }
        webView.destroy()
        super.onDestroy()
    }
    
    /**
     * Mostra un dialog per confermare la disconnessione VPN
     */
    private fun showDisconnectDialog() {
        AlertDialog.Builder(this)
            .setTitle("Disconnettere VPN?")
            .setMessage("Vuoi disconnettere la VPN e uscire dall'app?")
            .setPositiveButton("Disconnetti e Esci") { _, _ ->
                disconnectVPNAndFinish()
            }
            .setNegativeButton("Annulla", null)
            .setNeutralButton("Continua senza VPN") { _, _ ->
                finish()
            }
            .show()
    }
    
    /**
     * Disconnette la VPN e chiude l'app
     */
    private fun disconnectVPNAndFinish() {
        isDisconnecting = true
        disconnectVPN()
        finish()
    }
    
    /**
     * Disconnette la VPN senza chiudere l'app
     */
    private fun disconnectVPN() {
        try {
            Log.d("WebAppActivity", "Disconnessione VPN...")
            val success = vpnManager.stopVPN()
            if (success) {
                Log.d("WebAppActivity", "VPN disconnessa con successo")
                runOnUiThread {
                    Toast.makeText(this@WebAppActivity, "VPN disconnessa", Toast.LENGTH_SHORT).show()
                }
            } else {
                Log.w("WebAppActivity", "Errore durante la disconnessione VPN")
            }
        } catch (e: Exception) {
            Log.e("WebAppActivity", "Errore disconnessione VPN", e)
        }
    }
}
