package com.sistema54.webview

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.sistema54.R

class WebAppActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_webapp)
        
        // URL della web app (da intent o default)
        val webAppUrl = intent.getStringExtra("WEB_APP_URL") 
            ?: "http://10.0.0.1:26081"
        
        webView = findViewById(R.id.webView)
        
        // Configurazione WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // Permetti accesso a risorse locali (utile per sviluppo)
            allowUniversalAccessFromFileURLs = true
            allowFileAccessFromFileURLs = true
        }
        
        // Client custom per gestire navigazione e errori
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                // Carica tutte le URL nella WebView
                return false
            }
            
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                
                // Mostra errore solo se è l'URL principale
                if (request?.isForMainFrame == true) {
                    Toast.makeText(
                        this@WebAppActivity,
                        "Errore caricamento: ${error?.description}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
        
        webView.webChromeClient = WebChromeClient()
        
        // Carica la web app
        webView.loadUrl(webAppUrl)
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
