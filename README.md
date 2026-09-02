# SüffIQ v2

SüffIQ ist ein mobiles Multiplayer-Partyspiel für mehrere Handys. Ein Spieler erstellt einen Raum, teilt den fünfstelligen Code und wird zum Roundmaster. Es gibt keine Accounts und kein Einstellungsmenü: Der Kategorienmix läuft automatisch.

## Enthalten

- 240 eigene Karten in 10 Kategorien
- Ich hab noch nie
- Wahl: jede Stimme = 1 Schluck, maximal 5
- Schätzfragen: je weiter daneben, desto mehr Schlücke; Gleichstand beim besten Tipp bleibt trocken
- Entweder oder
- Quiz
- Wahrheit
- Pflicht mit „Mache ich“ / „Trinke lieber“
- Errate die Person: 45 Sekunden, 5 automatisch nacheinander freigegebene Hinweise, beliebig viele Versuche, Vor- oder Nachname genügt, Tippfehler können als „nah dran“ gelten
- Bei „Errate die Person“ sehen alle falsche Tipps; nahe und richtige Tipps bleiben geheim
- Mehrheit
- Skala 1–10
- Beitritt auch während einer laufenden Runde
- Automatische Auswertung bei vollständigen Antworten oder Ablauf des Timers
- Roundmaster kann an einen anderen verbundenen Spieler übergeben werden
- Reconnect per lokal gespeicherter Raum-/Spieler-ID

## Lokal starten

```bash
npm install
npm start
```

Dann `http://localhost:3000` öffnen. Andere Geräte im selben WLAN können die beim Start ausgegebene lokale IP verwenden.

## Tests

```bash
npm test
```

oder inklusive Syntaxprüfung:

```bash
npm run check
```

## Render

`render.yaml` ist für einen Node-Web-Service vorbereitet. Nach Verbindung des GitHub-Repositories mit Render genügt der normale Blueprint-/Web-Service-Deploy. Der Healthcheck liegt unter `/health`.

## Hinweis

SüffIQ ist als Partyspiel für Erwachsene gedacht. Die angezeigten „Schlücke“ sind Spielpunkte; niemand muss Alkohol trinken.
