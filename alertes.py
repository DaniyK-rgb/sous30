#!/usr/bin/env python3
"""Prévient par e-mail les comptes dont un favori vient de revenir en promo.

    python3 alertes.py <deals.json d'avant> <deals.json d'après> [--essai] [--comptes fichier.json]

Lancé par la publication automatique, juste après la mise en ligne des nouveaux prix.
Un jeu « revient en promo » s'il est dans le relevé d'après et pas dans celui d'avant.
Seuls les comptes qui ont activé « Alertes par e-mail » sur le site reçoivent quelque chose.

Réglages, lus dans l'environnement (des « secrets » du dépôt GitHub, jamais écrits dans le code) :
    SUPABASE_SECRET   clé secrète du projet Supabase, pour lire la liste des comptes
    SMTP_USER         adresse Gmail qui envoie les e-mails
    SMTP_PASS         mot de passe d'application de cette adresse
S'il en manque un, le programme ne fait rien et sort sans erreur.

--essai   : n'envoie rien, affiche ce qui partirait (sans les adresses).
--test    : envoie un seul e-mail d'exemple à l'adresse SMTP_USER elle-même, pour vérifier que l'envoi marche.
--comptes : lit les comptes dans un fichier au lieu de Supabase (pour les essais).

Le journal de la publication est public : ce programme n'y écrit jamais d'adresse e-mail.
"""
from __future__ import annotations

import html
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = "https://daniyk-rgb.github.io/sous30/"
STORE = "https://store.steampowered.com/"
MAX_EMAILS = 300          # plafond par passage, bien sous la limite quotidienne de Gmail
MAX_GAMES = 12            # jeux détaillés dans un même e-mail


def log(message: str) -> None:
    print(f"[alertes] {message}", flush=True)


def euros(cents: int) -> str:
    return f"{cents / 100:.2f}".replace(".", ",") + " €"


def read_items(path: str) -> dict[int, dict]:
    """Les offres d'un relevé, rangées par numéro de jeu. Fichier absent ou illisible : aucun jeu."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return {int(item["a"]): item for item in data["items"]}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def supabase_url() -> str:
    found = re.search(r"supabaseUrl:\s*'([^']+)'", (ROOT / "public" / "config.js").read_text(encoding="utf-8"))
    return found.group(1).rstrip("/") if found else ""


def fetch_accounts(base: str, secret: str) -> list[dict]:
    """Tous les comptes du projet, page par page."""
    accounts: list[dict] = []
    for page in range(1, 200):
        request = urllib.request.Request(
            f"{base}/auth/v1/admin/users?page={page}&per_page=1000",
            headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
        batch = data.get("users", []) if isinstance(data, dict) else data
        accounts.extend(batch)
        if len(batch) < 1000:
            break
    return accounts


def wanted(account: dict, back: dict[int, dict]) -> list[dict]:
    """Les favoris de ce compte qui viennent de revenir en promo (vide si les alertes sont coupées)."""
    meta = account.get("user_metadata") or {}
    if meta.get("alerts") is not True or not account.get("email"):
        return []
    favs = meta.get("favs")
    if not isinstance(favs, list):
        return []
    games = [back[fav] for fav in favs if isinstance(fav, int) and fav in back]
    return sorted(games, key=lambda item: -item["d"])


def compose(sender: str, to: str, games: list[dict], lang: str = "fr") -> EmailMessage:
    """L'e-mail d'alerte, en français ou en anglais (lang = "en") selon la langue du site choisie par le compte."""
    en = lang == "en"
    count = len(games)
    first = games[0]
    if en:
        subject = (f"{first['t']} is back on sale: −{first['d']}%" if count == 1
                   else f"{count} of your favourites are back on sale")
    else:
        subject = (f"{first['t']} est de retour en promo : −{first['d']} %" if count == 1
                   else f"{count} de tes favoris sont de retour en promo")
    shown, more = games[:MAX_GAMES], count - MAX_GAMES
    lines, rows = [], []
    for item in shown:
        link = f"{STORE}{item['u']}/"
        price = (f"€{item['f'] / 100:.2f} instead of €{item['o'] / 100:.2f} (−{item['d']}%)" if en
                 else f"{euros(item['f'])} au lieu de {euros(item['o'])} (−{item['d']} %)")
        lines.append(f"- {item['t']} : {price}\n  {link}")
        rows.append(
            f'<li style="margin:0 0 12px"><a href="{html.escape(link)}" style="color:#ffd22e;font-weight:700">'
            f'{html.escape(item["t"])}</a><br>{html.escape(price)}</li>')
    if en:
        extra = f"… and {more} more on the site." if more > 0 else ""
        intro = "A game you added to your favourites is back on sale:" if count == 1 \
            else "Games you added to your favourites are back on sale:"
        stop = "To stop these emails: open the site, click your name at the top right, " \
               "then “Email alerts” to switch it to “No”."
        hello, all_deals, see_all, site = "Hi,", "All deals:", "See all deals", SITE + "?lang=en"
    else:
        extra = f"… et {more} autre{'s' if more > 1 else ''} sur le site." if more > 0 else ""
        intro = "Un jeu que tu as mis en favori est de retour en promo :" if count == 1 \
            else "Des jeux que tu as mis en favori sont de retour en promo :"
        stop = "Pour ne plus recevoir ces e-mails : ouvre le site, clique sur ton nom en haut à droite, " \
               "puis sur « Alertes par e-mail » pour le passer sur « Non »."
        hello, all_deals, see_all, site = "Salut,", "Toutes les promos :", "Voir toutes les promos", SITE

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr(("Sous 30", sender))
    message["To"] = to
    message["Auto-Submitted"] = "auto-generated"
    message.set_content("\n".join([
        hello, "", intro, "", *lines, *([extra] if extra else []), "",
        f"{all_deals} {site}", "", stop, "", "— Sous 30"]))
    message.add_alternative(
        '<div style="background:#05031a;color:#ece8ff;font-family:Segoe UI,Arial,sans-serif;padding:28px;border-radius:16px">'
        '<p style="font-size:22px;font-weight:800;margin:0 0 16px;color:#ffd22e">Sous 30</p>'
        f'<p>{hello}</p><p>{html.escape(intro)}</p><ul style="padding-left:18px">{"".join(rows)}</ul>'
        + (f"<p>{html.escape(extra)}</p>" if extra else "")
        + f'<p><a href="{site}" style="color:#ff8a1c">{see_all}</a></p>'
        f'<p style="font-size:12px;color:#9c97c9;margin-top:24px">{html.escape(stop)}</p></div>',
        subtype="html")
    return message


def main() -> int:
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    dry = "--essai" in sys.argv
    accounts_file = sys.argv[sys.argv.index("--comptes") + 1] if "--comptes" in sys.argv else ""
    if accounts_file:
        args.remove(accounts_file)
    if len(args) != 2:
        print(__doc__)
        return 2

    secret = os.environ.get("SUPABASE_SECRET", "").strip()
    sender = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASS", "").replace(" ", "")
    if not dry and not (secret and sender and password):
        log("alertes pas encore réglées (secrets absents) : rien à faire")
        return 0

    before, after = read_items(args[0]), read_items(args[1])
    if "--test" in sys.argv:        # un e-mail d'exemple, envoyé à l'adresse d'envoi elle-même
        sample = sorted(after.values(), key=lambda item: -item["d"])[:2]
        if not sample:
            log("test impossible : aucun relevé à citer")
            return 1
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as server:
            server.login(sender, password)
            server.send_message(compose(sender, sender, sample))
        log("e-mail de test envoyé à l'adresse d'envoi")
        return 0
    # Sans relevé d'avant fiable, tout aurait l'air nouveau : on n'envoie rien plutôt qu'un déluge d'e-mails.
    if not after or len(before) < len(after) * .5:
        log(f"relevé d'avant absent ou trop court ({len(before)} offres contre {len(after)}) : aucun envoi")
        return 0
    back = {appid: item for appid, item in after.items() if appid not in before}
    log(f"{len(back)} jeux revenus en promo depuis le relevé précédent")
    if not back:
        return 0

    if accounts_file:
        accounts = json.loads(Path(accounts_file).read_text(encoding="utf-8"))
    elif secret:
        accounts = fetch_accounts(supabase_url(), secret)
    else:
        log("essai sans liste de comptes : ajoute --comptes fichier.json")
        return 0
    mails = [(account["email"], games, (account.get("user_metadata") or {}).get("lang"))
             for account in accounts if (games := wanted(account, back))]
    log(f"{len(accounts)} comptes, {len(mails)} à prévenir")
    if len(mails) > MAX_EMAILS:
        log(f"plafond de {MAX_EMAILS} e-mails par passage : les suivants ne sont pas prévenus cette fois")
        mails = mails[:MAX_EMAILS]
    if not mails:
        return 0

    if dry:
        for index, (to, games, lang) in enumerate(mails, 1):
            message = compose(sender or "essai@exemple.fr", to, games, lang)
            log(f"essai, e-mail {index} : « {message['Subject']} »")
            print(message.get_body(("plain",)).get_content())
        return 0

    sent = failed = 0
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as server:
        server.login(sender, password)
        for to, games, lang in mails:
            try:
                server.send_message(compose(sender, to, games, lang))
                sent += 1
            except smtplib.SMTPException as error:      # une adresse refusée n'arrête pas les autres
                failed += 1
                log(f"un envoi a échoué ({type(error).__name__})")
    log(f"{sent} e-mails envoyés, {failed} en échec")
    return 0


if __name__ == "__main__":
    sys.exit(main())
