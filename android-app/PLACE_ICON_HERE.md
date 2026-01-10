# IMPORTANTE: Posiziona qui l'icona

1. **Salva l'immagine del logo GIT in questa cartella** come `icon_source.png`
2. **Usa Android Asset Studio** (https://icon.kitchen/) per generare le icone in tutte le dimensioni richieste
3. **Estrai le cartelle mipmap-*** dal pacchetto scaricato in `app/src/main/res/`

Oppure usa lo script PowerShell:
```powershell
.\generate_icons.ps1 -SourceImage "icon_source.png"
```

Le icone generate verranno automaticamente utilizzate dall'app.
