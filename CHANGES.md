# CHANGES – SüffIQ v2

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
