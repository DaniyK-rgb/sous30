# Sous 30

Toutes les promotions Steam à moins de 30 €, relevées sur la boutique française (prix en euros) et réunies sur une seule page. Plus la réduction est forte, plus la carte « chauffe ».

**Made by Daniel, Nicolas and Samuel.** Site et design © 2026 Daniel, Nicolas et Samuel. Tous droits réservés.

Projet indépendant, sans lien avec Valve. Steam est une marque de Valve Corporation.

## Comment ça marche

- `public/` contient le site : une page, une feuille de style, un script.
- `server.py` relève les promotions auprès de l'API publique de la boutique Steam. Il ne dépend que de Python 3.10 ou plus récent, sans rien à installer.
- Le site lit ses données dans `deals.json`, que `server.py` fabrique.

## Comptes et favoris

Le site n'a pas de serveur : un compte créé sur le site est enregistré dans le navigateur du visiteur, sur son appareil, avec ses favoris. Rien n'est envoyé sur Internet, et un compte n'existe donc que sur l'appareil où il a été créé. Le mot de passe n'est jamais gardé tel quel, seulement son empreinte.

Les boutons Facebook, Google, Apple et Discord sont affichés mais pas encore actifs : ces connexions demandent un service de comptes en ligne et une inscription comme développeur auprès de chaque service.

## Sur son ordinateur

```
python server.py
```

Puis ouvrir http://localhost:5173. Sous Windows, un double-clic sur `demarrer.bat` fait la même chose et ouvre le navigateur. Les prix sont relevés à nouveau toutes les 30 minutes.

## En ligne

Le fichier `.github/workflows/publier.yml` publie le dossier `public/` sur GitHub Pages et régénère `deals.json`. Il vise un relevé toutes les 30 minutes environ ; GitHub ne garantit pas l'horaire des tâches planifiées, et l'heure du dernier relevé est affichée en haut du site. Il suffit d'activer Pages dans les réglages du dépôt (Settings → Pages → Source : GitHub Actions).

## Réglages

En haut de `server.py` : prix maximum (`MAX_PRICE`), pays de la boutique (`COUNTRY`), fréquence des relevés (`TTL`) et affichage des jeux réservés aux adultes (`HIDE_ADULT`).
