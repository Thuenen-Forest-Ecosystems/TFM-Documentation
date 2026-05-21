
<script setup lang="ts">
    import VimeoPlayer from '../components/VimeoPlayer.vue';
</script>
<template>
  <div>
    <v-row class="d-flex align-baseline ma-1">
        <v-col>
            <div class="text-title-1 mb-2">Installation</div>
        </v-col>
        <v-col class="d-flex justify-end">
            <VimeoPlayer vimeoId="1194296619" h="e8acbb75e4" btnTitle="Installation & Update" title="Installation & Update" :iconOnly="false" />
        </v-col>
    </v-row>
        <v-expansion-panels>
            <v-expansion-panel title="Windows">
                <v-expansion-panel-text>
                    <ol>
                        <li>Gehe zu <v-btn href="https://github.com/Thuenen-Forest-Ecosystems/TFM-client-app/releases/latest" target="_blank">Releases</v-btn></li>
                        <li>Lade TFM-Setup.exe herunter, bei Rückfrage der Datei vertrauen</li>
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
