# CHANGES – SüffIQ

## v3.0.0

- Neuer 18+-Fragenmix mit deutlich frecheren „Ich hab noch nie“, Wahl-, Wahrheit- und Pflichtkarten ergänzt.
- Weitere Schätzfragen ergänzt.
- 4-Antwort-Quiz massiv erweitert, inklusive Sport, Popkultur, Gaming und Musik.
- Neue Bildrunde „Wer ist das?“ ergänzt.
- Die Bildrunde lädt bekannte Personen über Wikipedia/Wikimedia und startet stark verschwommen.
- Das Bild wird innerhalb der Runde automatisch in fünf Stufen immer schärfer.
- Richtige Bild-Tipps bleiben geheim, „nah dran“ bleibt privat, klar falsche Tipps werden live für alle angezeigt.
- Frühes Erkennen wird belohnt; spätes oder fehlendes Erkennen führt zu mehr Schlücken.
- Neue mobile v3-Oberfläche ergänzt.
- Render startet jetzt über `server-v3.js`.
- Der bisherige v2-Server und die v2-Oberfläche bleiben im Repository als Rückfallebene erhalten.

## v2.0.0

- App konsequent auf **SüffIQ** umgestellt.
- Kein Einstellungsmenü: universeller automatischer Mix aus 10 Kategorien.
- Fragenbestand auf 240 eigene Karten vereinheitlicht.
- Raumcodes auf fünf gut lesbare alphanumerische Zeichen erweitert.
- Wahlwertung geändert: jede erhaltene Stimme entspricht einem Schluck, maximal fünf.
- Schätzfragen komplett dynamisch: beste Schätzung(en) bleiben trocken; größere Abweichung führt stufenweise zu mehr Schlücken.
- „Errate die Person“ ergänzt: fünf Hinweise erscheinen automatisch nacheinander innerhalb von 45 Sekunden.
- Personenrunden erlauben beliebig viele Tippversuche.
- Vorname, Nachname und definierte Aliasnamen werden akzeptiert.
- Tippfehler-Erkennung ergänzt: „nah dran“ bleibt privat.
- Nur klar falsche Personentipps werden live für alle Spieler angezeigt.
- Manuelle Auflösen- und Hinweis-Schalter entfernt; Server löst automatisch bei vollständigen Antworten oder Timerende auf.
- Beitritt während laufender Spiele ermöglicht.
- Mehrheits- und Skalenrunden mit dynamischer Schluckvergabe ergänzt.
- Mobile Oberfläche komplett neu aufgebaut und für iPhone/Android optimiert.
- Reconnect, Roundmaster-Übergabe, Healthcheck und Render-Konfiguration ergänzt.
- Kernlogik in `logic.js` ausgelagert und mit Node-Testfällen abgesichert.
