# SüffIQ v3

SüffIQ ist ein mobiles Multiplayer-Partyspiel für mehrere Handys. Ein Spieler erstellt einen Raum, teilt den fünfstelligen Code und wird zum Roundmaster. Es gibt keine Accounts und kein Einstellungsmenü: Der Kategorienmix läuft automatisch.

## Enthalten

- 11 automatisch gemischte Kategorien
- Ich hab noch nie – inklusive frecherem 18+-Mix
- Wahl: jede Stimme = 1 Schluck, maximal 5
- Schätzfragen: beste Schätzung bleibt trocken, größere Abweichung bedeutet mehr Schlücke
- Entweder oder
- 4-Antwort-Quiz mit Allgemeinwissen, Sport, Musik, Popkultur und Gaming
- Wahrheit 18+
- Pflicht mit „Gemacht“ / „Lieber trinken“
- Errate die Person: fünf Hinweise erscheinen automatisch nacheinander
- Neue Bildrunde „Wer ist das?“: bekannte Personen starten stark verschwommen und werden in fünf Stufen automatisch schärfer
- Bei Personen- und Bildrunden bleiben richtige und nahe Tipps privat; klar falsche Tipps sehen alle
- Mehrheit
- Skala 1–10
- Beitritt auch während einer laufenden Runde
- Automatische Auswertung bei vollständigen Antworten oder Ablauf des Timers
- Roundmaster kann an einen anderen verbundenen Spieler übergeben werden
- Reconnect über lokal gespeicherte Raum-/Spieler-ID
- Mobile Oberfläche für iPhone und Android

## Lokal starten

```bash
npm install
npm start
```

Danach `http://localhost:3000` öffnen. Andere Geräte im selben WLAN können die beim Start ausgegebene lokale IP verwenden.

## Tests

```bash
npm test
```

oder inklusive Syntaxprüfung:

```bash
npm run check
```

## Render

`render.yaml` ist für einen Node-Web-Service vorbereitet. `npm start` startet SüffIQ v3 über `server-v3.js`. Der Healthcheck liegt unter `/health`; Auto-Deploy ist in der Render-Konfiguration aktiviert.

## Musikmodus

Ein Song-Erraten-Modus ist noch nicht aktiviert. Frei abrufbare iTunes-Previews sind laut Apples Nutzungsbedingungen nicht für ein eigenständiges Musikquiz gedacht; bei Spotify kann automatisches Abspielen auf mobilen Browsern zusätzlich durch Autoplay-Regeln blockiert werden. Deshalb wird keine unzuverlässige oder nicht zulässige Audioquelle fest eingebaut.

## Hinweis

SüffIQ ist als Partyspiel für Erwachsene gedacht. Die angezeigten „Schlücke“ sind Spielpunkte; Alkohol ist nicht erforderlich.
