# Generazione Icone Android

Per generare le icone Android da un'immagine source, puoi usare diversi metodi:

## Metodo 1: Android Asset Studio (Online - Consigliato)

1. Vai su https://icon.kitchen/
2. Carica l'immagine del logo GIT
3. Seleziona "Android" come piattaforma
4. Scarica il pacchetto ZIP
5. Estrai le cartelle `mipmap-*` in `android-app/app/src/main/res/`

## Metodo 2: ImageMagick (da linea di comando)

Se hai ImageMagick installato, puoi usare questo script:

```bash
# Dimensioni Android standard
convert icon_source.png -resize 48x48 app/src/main/res/mipmap-mdpi/ic_launcher.png
convert icon_source.png -resize 72x72 app/src/main/res/mipmap-hdpi/ic_launcher.png
convert icon_source.png -resize 96x96 app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert icon_source.png -resize 144x144 app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert icon_source.png -resize 192x192 app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

# Icone rotonde (se necessario)
convert icon_source.png -resize 48x48 -gravity center -background transparent -extent 48x48 -roundrectangle 24,24 48,48 24,24 app/src/main/res/mipmap-mdpi/ic_launcher_round.png
convert icon_source.png -resize 72x72 -gravity center -background transparent -extent 72x72 -roundrectangle 36,36 72,72 36,36 app/src/main/res/mipmap-hdpi/ic_launcher_round.png
convert icon_source.png -resize 96x96 -gravity center -background transparent -extent 96x96 -roundrectangle 48,48 96,96 48,48 app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
convert icon_source.png -resize 144x144 -gravity center -background transparent -extent 144x144 -roundrectangle 72,72 144,144 72,72 app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
convert icon_source.png -resize 192x192 -gravity center -background transparent -extent 192x192 -roundrectangle 96,96 192,192 96,96 app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
```

## Metodo 3: GIMP / Photoshop

1. Apri l'immagine del logo GIT
2. Per ogni dimensione richiesta (48x48, 72x72, 96x96, 144x144, 192x192):
   - Ridimensiona l'immagine alla dimensione richiesta
   - Esporta come PNG
   - Salva come `ic_launcher.png` nella cartella `mipmap-*` corrispondente

## Dimensioni Richieste

- **mipmap-mdpi**: 48x48 px
- **mipmap-hdpi**: 72x72 px
- **mipmap-xhdpi**: 96x96 px
- **mipmap-xxhdpi**: 144x144 px
- **mipmap-xxxhdpi**: 192x192 px

## Nota

Il file deve chiamarsi esattamente `ic_launcher.png` per l'icona normale e `ic_launcher_round.png` per quella rotonda (opzionale ma consigliato).
