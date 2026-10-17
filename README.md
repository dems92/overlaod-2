# Overload

Web app de suivi de musculation et de surcharge progressive, avec notifications.

## Contenu du dossier

- `index.html` : l'application
- `sw.js`, `manifest.webmanifest`, `icons/` : installation sur l'écran d'accueil, mode hors connexion, notifications
- `api/` : le petit serveur (notifications de fin de repos et rappel d'inactivité)
- `package.json`, `vercel.json` : configuration

## Mettre en ligne

1. **GitHub** : dépose **tout le contenu** de ce dossier dans ton dépôt (Add file → Upload files, y compris les dossiers `api` et `icons`), puis Commit.
2. **Vercel** redéploie tout seul.
3. Suis les étapes du fichier `variables-vercel.txt` (base de données, QStash, variables).

## Notifications

Une fois les variables ajoutées : ouvre l'app **depuis l'icône** de l'écran d'accueil → Réglages → Notifications → colle ta clé → Activer.

Les séances restent enregistrées sur le téléphone. Exporte une sauvegarde de temps en temps (Réglages → Exporter mes données).
