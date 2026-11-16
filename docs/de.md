# LibreTranslate

[LibreTranslate](https://libretranslate.com) ist ein freier Open-Source-Server für maschinelle
Übersetzung, den du selbst betreibst. Mit dieser Integration können deine Gladys-Szenen einen
Text übersetzen, mit Informationen aus der Szene darin, und die Übersetzung in den nächsten
Aktionen verwenden: als Nachricht senden oder vorlesen lassen. Außerdem erkennt sie die Sprache eines
Textes. Alles bleibt in deinem Netzwerk: kein Konto, keine Cloud, kein Kontingent.

Diese Integration ist die lokale Alternative zu DeepL. Außerdem überwacht sie den Server: online oder
nicht, seine Version, die Zahl der geladenen Sprachen, mit einem Widget fürs Dashboard.

Nicht mit LibreTranslate verbunden. Getestet mit einem echten LibreTranslate-1.9.6-Server.

## Was du brauchst

- Gladys 5.1 oder neuer.
- Einen LibreTranslate-Server in deinem Netzwerk. Mit Docker:
  `docker run -d -p 5000:5000 libretranslate/libretranslate --load-only en,fr,de,es`.
  `--load-only` behält nur die Sprachen, die du brauchst: Jedes Sprachpaar ist ein Modell zum
  Herunterladen und im Speicher (rechne mit etwa 2 GB RAM für vier Sprachen).
- Oder eine öffentliche Instanz, die dir einen API-Schlüssel gibt (libretranslate.com ist ein
  kostenpflichtiger Dienst).

## Einrichtung

1. Öffne in Gladys **Integrationen**, suche **LibreTranslate** und installiere sie.
2. Fülle unter **Konfiguration** aus:
   - **Serveradresse**: IP-Adresse oder Name des Servers, z. B. `192.168.1.20` (Port 5000 wird
     ergänzt), `192.168.1.20:5001` oder die volle URL eines Reverse-Proxys;
   - **API-Schlüssel (optional)**: nur wenn der Server einen verlangt (mit `--api-keys`
     gestartet, oder eine öffentliche Instanz);
   - **Sprache der Namen**: die Sprache der Funktionsnamen und des Sprachnamens, den die
     Erkennung liefert.
3. Klicke auf **Verbindung testen**: Der Test zeigt Version und Sprachen des Servers und übersetzt
   dann ein Wort, um den Schlüssel zu prüfen.
4. Füge unter **Erkennung** das Gerät **LibreTranslate** hinzu, wenn du seine Zustände in Gladys
   willst (optional: Die Szenenaktionen funktionieren ohne es).

## Das Gerät LibreTranslate

Der Server wird alle fünf Minuten gelesen:

- **Online**: ja, wenn der Server antwortet; nein nach zwei fehlgeschlagenen Lesungen
  hintereinander, im Abstand von 15 Sekunden.
- **Verfügbare Sprachen**: die Zahl der Sprachen, die der Server geladen hat.
- **Version**: die Version von LibreTranslate.

## Dashboard

Das Widget **LibreTranslate** zeigt die Zahl der Sprachen, die Übersetzungen der letzten 24
Stunden, den Zustand des Servers, die letzte Übersetzung (Sprachen und Uhrzeit) und die Liste der
Sprachen. Eine Einstellung blendet die Liste aus.

## Szenen

### Aktionen

- **LibreTranslate: Text übersetzen**:
  - **Zu übersetzender Text**: Tippe `{{`, um Informationen aus der Szene einzufügen, z. B. einen
    Wert des Auslösers oder die empfangene Nachricht;
  - **Nach**: die Sprache der Übersetzung;
  - **Von**: leer, damit der Server sie erkennt.

  Die Ergebnisse stehen den folgenden Aktionen zur Verfügung: **Übersetzung**
  (`{{0.1.translation}}` für die erste Aktion der zweiten Zeile) und **Ausgangssprache (Code)**
  (`{{0.1.source_language}}`, z. B. `fr`). Tippe in einer Aktion **Nachricht senden** `{{` und
  wähle **Übersetzung**.

- **LibreTranslate: Sprache erkennen**: nennt die Sprache eines **Text**es unter denen, die der
  Server geladen hat. Ergebnisse: **Sprache (Code)** (`{{0.1.language}}`, z. B. `de`), **Sprache
  (Name)** (`{{0.1.language_name}}`, in der Sprache der Konfiguration) und **Sicherheit (%)**
  (`{{0.1.confidence}}`).

Wenn eine Aktion fehlschlägt (Server aus, Sprache nicht geladen, Schlüssel abgelehnt, leerer
Text), zeigt Gladys den Grund in Rot, die Aktion liefert kein Ergebnis und die Szene läuft weiter.

### Szenenideen

- **Nachrichten für einen Gast**: Wenn ein Gastmodus aktiv ist, übersetze die Benachrichtigungen
  in seine Sprache, bevor du sie sendest.
- **Gesprochene Warnungen in zwei Sprachen**: Übersetze „Die Waschmaschine ist fertig.“ und lies
  beide Fassungen auf einem Lautsprecher vor.
- **In der richtigen Sprache antworten**: Erkenne die Sprache einer empfangenen Nachricht und
  übersetze die Antwort in diese Sprache.

## Fehlerbehebung

- **„keine Antwort“**: Prüfe Adresse und Port (5000), ob der Server läuft und
  bei Docker, ob der Port veröffentlicht ist. Der erste Start lädt die Modelle herunter: Das kann
  einige Minuten dauern.
- **„Sprache … ist auf dem Server nicht geladen“**: Der Server wurde mit `--load-only` ohne diese
  Sprache gestartet. Füge sie hinzu und starte den Server neu.
- **„dieser Server verlangt einen API-Schlüssel“** / **„API-Schlüssel vom Server abgelehnt“**:
  Gib den Schlüssel in der Konfiguration ein oder erstelle einen mit `ltmanage keys add` auf dem
  Server.
- **„zu viele Anfragen“**: Der Server begrenzt die Anfragen (`--req-limit`, oder das Angebot
  einer öffentlichen Instanz).
- Probleme und Ideen:
  [GitHub-Issues](https://github.com/guim31/gladys-libretranslate/issues).

## Grenzen

- Maschinelle Übersetzung: gut für kurze Benachrichtigungen, weniger für lange oder feine Texte.
- Nur Text, bis zu 10.000 Zeichen pro Aktion (was Gladys an eine Szene zurückgibt).
- Die Erkennung ist bei einem Satz zuverlässig, bei ein oder zwei Wörtern viel weniger.
- Die Texte und ihre Übersetzungen landen nie in den Protokollen der Integration.
