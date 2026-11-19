# LibreTranslate

[LibreTranslate](https://libretranslate.com) est un serveur de traduction automatique libre et
open source, que vous faites tourner vous-même. Cette intégration permet à vos scènes Gladys de
traduire un texte, avec des informations de la scène dedans, et d'utiliser la traduction dans les
actions suivantes : l'envoyer en message, la faire lire à voix haute. Elle sait aussi reconnaître
la langue d'un texte. Tout reste sur votre réseau : pas de compte, pas de cloud, pas de quota.

C'est l'alternative locale à l'intégration DeepL. Elle suit aussi le serveur : en ligne ou non, sa
version, le nombre de langues chargées, avec un widget pour le tableau de bord.

Sans lien avec LibreTranslate. Testée avec un vrai serveur LibreTranslate 1.9.6.

## Ce qu'il vous faut

- Gladys 5.1 ou plus récent.
- Un serveur LibreTranslate sur votre réseau. Avec Docker :
  `docker run -d -p 5000:5000 libretranslate/libretranslate --load-only en,fr,de,es`.
  `--load-only` ne garde que les langues utiles : chaque paire de langues est un modèle à
  télécharger et à garder en mémoire (comptez environ 2 Go de RAM pour quatre langues).
- Ou une instance publique qui vous donne une clé d'API (libretranslate.com est un service
  payant).

## Mise en place

1. Dans Gladys, ouvrez **Intégrations**, cherchez **LibreTranslate** et installez-la.
2. Dans **Configuration**, renseignez :
   - **Adresse du serveur** : l'adresse IP ou le nom du serveur, par exemple `192.168.1.20` (le
     port 5000 est ajouté), `192.168.1.20:5001`, ou l'URL complète d'un proxy inverse ;
   - **Clé d'API (facultative)** : seulement si le serveur en exige une (lancé avec
     `--api-keys`, ou une instance publique) ;
   - **Langue des noms** : la langue des noms des fonctionnalités et du nom de langue donné par
     la détection.
3. Cliquez sur **Tester la connexion** : elle affiche la version et les langues du serveur, puis
   traduit un mot pour vérifier la clé.
4. Dans **Découverte**, ajoutez l'appareil **LibreTranslate** si vous voulez ses états dans
   Gladys (facultatif : les actions de scène fonctionnent sans lui).

## L'appareil LibreTranslate

Le serveur est lu toutes les cinq minutes :

- **En ligne** : oui quand le serveur répond ; non après deux lectures ratées de suite, à 15
  secondes d'intervalle.
- **Langues disponibles** : le nombre de langues chargées par le serveur.
- **Version** : la version de LibreTranslate.

## Tableau de bord

Le widget **LibreTranslate** affiche le nombre de langues, les traductions des dernières 24
heures, l'état du serveur, la dernière traduction (langues et heure) et la liste des langues. Des
réglages masquent les chiffres, la dernière traduction et la liste.

## Scènes

### Actions

- **LibreTranslate : traduire un texte** :
  - **Texte à traduire** : tapez `{{` pour insérer des informations de la scène, par exemple une
    valeur du déclencheur ou le message reçu ;
  - **Vers** : la langue de la traduction ;
  - **Depuis** : vide pour laisser le serveur la détecter.

  Ses résultats sont disponibles pour les actions suivantes : **Traduction**
  (`{{0.1.translation}}` pour la première action de la deuxième ligne) et **Langue source
  (code)** (`{{0.1.source_language}}`, par exemple `fr`). Dans une action **Envoyer un
  message**, tapez `{{` et choisissez **Traduction**.

- **LibreTranslate : détecter la langue** : donne la langue d'un **Texte**, parmi celles que le
  serveur a chargées. Résultats : **Langue (code)** (`{{0.1.language}}`, par exemple `de`),
  **Langue (nom)** (`{{0.1.language_name}}`, dans la langue de la configuration) et **Confiance
  (%)** (`{{0.1.confidence}}`).

Quand une action échoue (serveur arrêté, langue non chargée, clé refusée, texte vide), Gladys
affiche la raison en rouge, l'action ne donne aucun résultat et la scène continue.

### Idées de scènes

- **Messages pour un invité** : quand un mode invité est actif, traduisez les notifications dans
  sa langue avant de les envoyer.
- **Alertes parlées en deux langues** : traduisez « La machine à laver a terminé. » et lisez les
  deux versions sur une enceinte.
- **Répondre dans la bonne langue** : détectez la langue d'un message reçu, puis traduisez la
  réponse dans cette langue.

## Dépannage

- **« pas de réponse »** : vérifiez l'adresse et le port (5000), que le serveur
  est démarré et, avec Docker, que le port est publié. Le premier démarrage télécharge les
  modèles : cela peut prendre plusieurs minutes.
- **« langue … non chargée sur le serveur »** : le serveur a été lancé avec `--load-only` sans
  cette langue. Ajoutez-la et redémarrez le serveur.
- **« ce serveur exige une clé d'API »** / **« clé d'API refusée »** : saisissez la clé dans la
  configuration, ou créez-en une avec `ltmanage keys add` sur le serveur.
- **« trop de requêtes »** : le serveur limite les requêtes (`--req-limit`, ou l'offre d'une
  instance publique).
- Problèmes et idées :
  [issues GitHub](https://github.com/guim31/gladys-libretranslate/issues).

## Limites

- Traduction automatique : bien pour des notifications courtes, moins pour des textes longs ou
  nuancés.
- Texte seulement, jusqu'à 10 000 caractères par action (ce que Gladys rend à une scène).
- La détection est fiable sur une phrase, beaucoup moins sur un ou deux mots.
- Les textes et leurs traductions ne vont jamais dans les journaux de l'intégration.
