

<template>
  <div>
    <div class="text-subtitle-2 mb-2">Installation</div>
        <v-expansion-panels>
            <v-expansion-panel title="Windows">
                <v-expansion-panel-text>
                    <ol>
                        <li>Gehe zu <v-btn href="https://github.com/Thuenen-Forest-Ecosystems/TFM-client-app/releases/latest" target="_blank">Releases</v-btn></li>
                        <li>Lade TFM-Setup.exe herunter</li>
                        <li>Doppelklick auf TFM-Setup.exe</li>
                        <li>Folge den Anweisungen des Installationsassistenten</li>
                        <li>Such die Anwendung "Install SSL Certificates" und führe diese aus. (dieser SSchritt muss nur einmal durchgeführt werden)</li>
                        <li>Starte die TFM Anwendung</li>
                    </ol>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
        <v-expansion-panels>
            <v-expansion-panel title="Android">
                <v-expansion-panel-text>
                    <ol>
                        <li>Gehe zu <v-btn href="https://github.com/Thuenen-Forest-Ecosystems/TFM-client-app/releases/latest" target="_blank">Releases</v-btn></li>
                        <li>Lade app-release.apk herunter</li>
                        <li>Öffne die heruntergeladene Datei</li>
                        <li>Falls notwendig, erlaube die Installation von Apps aus unbekannten Quellen in den Einstellungen deines Geräts</li>
                        <li>Folge den Anweisungen des Installationsassistenten</li>
                        <li>Starte die TFM Anwendung</li>
                    </ol>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
  </div>
</template>