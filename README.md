# SüffIQ

SüffIQ ist ein mobiles Multiplayer-Partyspiel für mehrere Handys. Ein Spieler erstellt einen Raum, teilt den fünfstelligen Code und wird zum Roundmaster. Es gibt keine Accounts und kein Einstellungsmenü: Der Kategorienmix läuft automatisch.

## Enthalten

- 13 wählbare Kategorien mit abwechslungsreicher Rotation
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
- Synchronisierte Songrunden mit iTunes-Vorschau, gleichem Startzeitpunkt auf allen Geräten und mobilem Ton-Fallback
- Acht einzeln wählbare Minigames: Zeichnen & Raten, Alle malen, Reaktion, Tap Battle, Farbfolge, Zeitgefühl, Pong und Blackjack
- Zufällige Hausregeln als eigene gemeinsame Regelrunde; nach Bestätigung aller Spieler pinnt der Host sie für höchstens zehn normale Runden oben an
- Radierer und freie RGB-Farbauswahl in beiden Zeichenmodi
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

`render.yaml` ist für einen Node-Web-Service vorbereitet. `npm start` startet den Produktionsserver in einem Prozess. Der Healthcheck liegt unter `/health`; Auto-Deploy ist in der Render-Konfiguration aktiviert.

## Musikmodus

Songrunden lösen serverseitig eine passende iTunes-Vorschau auf und liefern sie über einen gleichursprünglichen Audio-Endpunkt an alle Geräte aus. Der Host startet einen gemeinsamen Zeitpunkt; blockiert ein Mobilbrowser die automatische Wiedergabe, erscheint direkt in der Songkarte ein Knopf zum Fortsetzen an der richtigen Stelle.

## Hinweis

SüffIQ ist als Partyspiel für Erwachsene gedacht. Die angezeigten „Schlücke“ sind Spielpunkte; Alkohol ist nicht erforderlich.
