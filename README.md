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

## Nouveautés (version 1.2)

- **Poids par série** : le poids général reste fixe ; chaque série peut avoir son propre poids (bouton « revenir au général »).
- **Pop-up à 2 min 30 de repos** : bannière, vibration et bip (réglable dans Réglages → Repos), envoyé aussi en notification si elles sont activées.
- **Widget chronomètre** : pastille flottante et déplaçable, visible sur tous les onglets ; mode chronomètre libre hors séance.
- **Salles** : Fitness Park, On Air, Basic-Fit ou ta propre salle (Réglages → Mes salles). « Dernière fois » reprend en priorité les charges de la même salle, et les stats se filtrent par salle.
- **Catalogue** : 459 exercices, filtrables par portion du muscle (ex. pectoraux haut / milieu / bas), par type (polyarticulaire / isolation), par matériel, avec articulations et calories estimées.
- Les anciennes sauvegardes et les données déjà sur le téléphone restent compatibles.

## Nouveautés (version 1.3)

- **Compte et sauvegarde en ligne** : e-mail + mot de passe (proposé au premier lancement). Tout est sauvegardé automatiquement ; sur un autre téléphone ou un PC, il suffit de se connecter. Nécessite Upstash Redis connecté au projet Vercel (Storage).
- **Programmes HIIT** : Tabata, Circuit HIIT force et EMOM, avec repos réglé automatiquement (10, 30 et 45 s).
- **Bannière « Objectif de repos atteint »** en haut de l'écran.
- **Widget** : n'affiche plus que le chrono de repos.
- **Stats** : barres sous les onglets centrées, plus de contour blanc dans les graphiques.
