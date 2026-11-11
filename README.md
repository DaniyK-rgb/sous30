# Sous 30

Toutes les promotions Steam à moins de 30 €, relevées sur la boutique française (prix en euros) et réunies sur une seule page. Plus la réduction est forte, plus la carte « chauffe ».

Projet indépendant, sans lien avec Valve. Steam est une marque de Valve Corporation.

## Comment ça marche

- `public/` contient le site : une page, une feuille de style, un script.
- `server.py` relève les promotions auprès de l'API publique de la boutique Steam. Il ne dépend que de Python 3.10 ou plus récent, sans rien à installer.
- Le site lit ses données dans `deals.json`, que `server.py` fabrique.

## Sur son ordinateur

```
python server.py
```

Puis ouvrir http://localhost:5173. Sous Windows, un double-clic sur `demarrer.bat` fait la même chose et ouvre le navigateur. Les prix sont relevés à nouveau toutes les 30 minutes.

## En ligne

Le fichier `.github/workflows/publier.yml` publie le dossier `public/` sur GitHub Pages et régénère `deals.json` toutes les 30 minutes. Il suffit d'activer Pages dans les réglages du dépôt (Settings → Pages → Source : GitHub Actions).

## Réglages

En haut de `server.py` : prix maximum (`MAX_PRICE`), pays de la boutique (`COUNTRY`), fréquence des relevés (`TTL`) et affichage des jeux réservés aux adultes (`HIDE_ADULT`).
