#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sous 30 — serveur local.

Il fait deux choses :
  1. il sert le site (dossier public/) ;
  2. il relève les promotions de la boutique Steam France (prix en euros) et les
     donne au site via /deals.json. Un navigateur ne peut pas interroger Steam
     directement, d'où ce relais.

Lancement :  python server.py                  puis ouvrir http://localhost:5173
             python server.py --ouvrir         ouvre aussi le navigateur
             python server.py --export public  écrit public/deals.json et s'arrête
                                               (version en ligne : voir .github/workflows/publier.yml)

Aucune dépendance : uniquement la bibliothèque standard de Python 3.9+.
"""
from __future__ import annotations

import gzip
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# --------------------------------------------------------------------------- réglages
PORT = int(os.environ.get("PORT", "5173"))
MAX_PRICE = 30          # en euros : on garde les jeux strictement en dessous
COUNTRY = "FR"          # boutique Steam France, donc prix en euros
LANG = "french"
TTL = 30 * 60           # durée (s) avant de relever les prix à nouveau
HIDE_ADULT = True       # comme la boutique Steam par défaut : sans les jeux réservés aux adultes
WORKERS = 3             # requêtes simultanées vers Steam : on reste poli
USER_AGENT = "Sous30/1.0"

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
CACHE_FILE = ROOT / ".cache" / "catalogue.json"
CACHE_FORMAT = 3

# API publique de la boutique Steam : jusqu'à 1000 articles par requête.
QUERY_URL = "https://api.steampowered.com/IStoreQueryService/Query/v1/"
BATCH = 1000
SORT_NAME = 1           # ordre alphabétique : stable d'une page à l'autre, sert à ne manquer aucune offre
SORT_POPULAR = 12       # meilleures ventes parmi les jeux en promotion : sert au classement « Populaires »
DATA_REQUEST = {
    "include_assets": True, "include_release": True, "include_platforms": True,
    "include_reviews": True, "include_tag_count": 7,
}
CDN = "https://shared.fastly.steamstatic.com/store_item_assets/"


def log(message: str) -> None:
    print(time.strftime("[%H:%M:%S]"), message, flush=True)


# --------------------------------------------------------------------------- accès à Steam
def http_get(url: str, tries: int = 4, timeout: float = 45.0) -> bytes:
    """GET avec quelques nouvelles tentatives espacées (Steam limite parfois le débit)."""
    last: Exception | None = None
    for attempt in range(tries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read()
                if response.headers.get("Content-Encoding", "").lower() == "gzip":
                    body = gzip.decompress(body)
                return body
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
        if attempt < tries - 1:
            time.sleep(2 * (attempt + 1) ** 2)      # 2 s, 8 s, 18 s
    raise RuntimeError(f"{url.split('?')[0]} : {last}")


def steam_query(start: int, sort: int, with_data: bool) -> dict:
    """Une page de jeux en promotion. Sans with_data, Steam ne renvoie que les identifiants."""
    filters = {
        "released_only": True,
        "type_filters": {"include_games": True},
        "price_filters": {"min_discount_percent": 1, "exclude_free_items": True},
    }
    if HIDE_ADULT:
        filters["content_descriptors_excluded"] = [3, 4]
    request = {
        "query": {"start": start, "count": BATCH, "sort": sort, "filters": filters},
        "context": {"language": LANG, "country_code": COUNTRY},
    }
    if with_data:
        request["data_request"] = DATA_REQUEST
    url = QUERY_URL + "?input_json=" + urllib.parse.quote(json.dumps(request, separators=(",", ":")))
    return json.loads(http_get(url)).get("response") or {}


def to_row(item: dict) -> dict | None:
    """Fiche Steam → fiche compacte pour le site (None si l'offre ne nous concerne pas)."""
    offer = item.get("best_purchase_option") or {}
    appid = int(item.get("appid") or 0)
    pct = int(offer.get("discount_pct") or 0)
    final = int(offer.get("final_price_in_cents") or 0)
    if not appid or not item.get("name") or pct <= 0 or final <= 0 or final >= MAX_PRICE * 100:
        return None
    if offer.get("hide_discount_pct_for_compliance") or offer.get("price_cannot_be_displayed_as_discount"):
        return None
    original = int(offer.get("original_price_in_cents") or 0)
    if original <= final:
        if pct >= 100:
            return None
        original = round(final / (1 - pct / 100))

    # Visuels : noms de fichiers relatifs à steam/apps/<appid>/ quand c'est possible (fiches plus légères).
    assets = item.get("assets") or {}
    prefix, _, suffix = (assets.get("asset_url_format") or "").partition("${FILENAME}")
    stamp = re.fullmatch(r"\?t=(\d+)", suffix)
    compact = prefix == f"steam/apps/{appid}/" and bool(stamp or not suffix)

    def ref(name: str | None) -> str:
        if not name or not prefix:
            return ""
        return name if compact else CDN + prefix + name + suffix

    reviews = (item.get("reviews") or {}).get("summary_filtered") or {}
    grade = int(reviews.get("review_score") or 0)        # 1-4 négatif, 5 mitigé, 6-9 positif, 0 trop peu d'avis
    platforms = item.get("platforms") or {}
    release = item.get("release") or {}
    ends = [int(d["discount_end_date"]) for d in offer.get("active_discounts") or [] if d.get("discount_end_date")]
    return {
        "a": appid,
        "t": item["name"].strip(),
        "u": item.get("store_url_path") or f"app/{appid}",                 # page du jeu sur Steam
        "h": ref(assets.get("header")),                                     # bannière 460×215
        "v": ref(assets.get("library_capsule_2x") or assets.get("library_capsule")),   # affiche verticale
        "i": ref(assets.get("small_capsule")),                              # vignette de secours
        "ts": int(stamp.group(1)) if compact and stamp else 0,
        "y": int(release.get("steam_release_date") or release.get("original_release_date") or 0),
        "p": ("w" if platforms.get("windows") else "") + ("m" if platforms.get("mac") else "")
             + ("l" if platforms.get("steamos_linux") else "")
             + ("d" if platforms.get("steam_deck_compat_category") == 3 else ""),   # d = Steam Deck vérifié
        "c": "" if not grade else "p" if grade >= 6 else "m" if grade == 5 else "n",
        "l": reviews.get("review_score_label") or "" if grade else "",
        "s": int(reviews.get("percent_positive") or 0) if grade else 0,
        "n": int(reviews.get("review_count") or 0),
        "d": pct, "o": original, "f": final,                                # réduction, prix en centimes
        "z": min(ends) if ends else 0,                                      # fin de l'offre (horodatage)
        "g": [int(t) for t in item.get("tagids") or []],                    # tags (genres)
    }


def crawl(publish=None) -> tuple[list[dict], int]:
    """Relève toutes les offres. Renvoie (fiches classées par popularité, nombre de pages en échec).

    publish(fiches, total_annoncé), s'il est fourni, est appelé au fur et à mesure du relevé.
    """
    # 1) Les 1000 offres les plus populaires d'abord : le site peut s'afficher tout de suite.
    head = steam_query(0, SORT_POPULAR, True)
    total = int((head.get("metadata") or {}).get("total_matching_records") or 0)
    if not head.get("store_items"):
        raise RuntimeError("réponse vide de Steam")

    build: list[dict] = []
    seen: set[int] = set()

    def add(rows: list[dict]) -> None:
        fresh = []
        for row in rows:
            if row["a"] not in seen:
                seen.add(row["a"])
                fresh.append(row)
        build.extend(fresh)
        if publish:
            publish(fresh, total)

    def rows_of(response: dict) -> list[dict]:
        return [row for row in map(to_row, response.get("store_items") or []) if row]

    def safe_query(start: int, sort: int, with_data: bool) -> dict | None:
        try:
            return steam_query(start, sort, with_data)
        except Exception as exc:  # noqa: BLE001
            log(f"page {start // BATCH + 1} ignorée ({exc})")
            return None

    add(rows_of(head))

    # 2) Tout le catalogue en ordre alphabétique (ordre stable : aucune offre oubliée),
    #    et en parallèle le classement de popularité (identifiants seuls) pour ordonner la suite.
    starts = list(range(0, max(total, 1), BATCH))
    with ThreadPoolExecutor(WORKERS) as pool:
        rank_jobs = [pool.submit(safe_query, start, SORT_POPULAR, False) for start in starts[1:]]
        data_jobs = [pool.submit(safe_query, start, SORT_NAME, True) for start in starts]
        rank_pages = [job.result() for job in rank_jobs]
        data_pages = [job.result() for job in data_jobs]

    rank: dict[int, int] = {}
    for page in rank_pages:
        for entry in (page or {}).get("ids") or []:
            rank.setdefault(int(entry.get("appid") or 0), len(rank))
    rest = [row for page in data_pages if page for row in rows_of(page)]
    rest.sort(key=lambda row: (rank.get(row["a"], len(rank)), -row["n"]))
    add(rest)
    return build, sum(page is None for page in data_pages)


def export(folder: Path) -> None:
    """Relève le catalogue une fois et l'écrit dans <dossier>/deals.json.

    Sert à l'hébergement statique (GitHub Pages) : le site y lit ce fichier au lieu d'interroger ce serveur.
    En cas de relevé incomplet, rien n'est écrit et le programme sort en erreur : la version en ligne reste en place.
    """
    started = time.time()
    try:
        rows, failed = crawl()
    except Exception as exc:  # noqa: BLE001
        sys.exit(f"relevé impossible : {exc}")
    if failed or len(rows) < 200:
        sys.exit(f"relevé incomplet ({len(rows)} offres, {failed} pages en échec) : deals.json n'a pas été écrit")
    payload = {
        "v": int(started * 1000), "reset": False, "total": len(rows), "loaded": len(rows), "done": True,
        "updatedAt": int(time.time() * 1000), "error": "", "maxPrice": MAX_PRICE, "items": rows,
    }
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / "deals.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # Heure du relevé, dans un fichier minuscule : la publication automatique le lit pour savoir si les prix sont récents.
    (folder / "releve.txt").write_text(str(int(time.time())), encoding="ascii")
    log(f"{len(rows)} offres écrites dans {target} en {time.time() - started:.1f} s")


# --------------------------------------------------------------------------- catalogue en mémoire
class Catalogue:
    """Garde le dernier relevé et en relance un quand il est trop vieux."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.items: list[dict] = []
        self.version = 0        # identifiant du relevé servi
        self.expected = 0       # total annoncé par Steam pendant le premier relevé
        self.done = False
        self.updated = 0.0
        self.crawling = False
        self.error = ""
        self.retry_at = 0.0

    # -- cache disque : évite de tout relever à chaque redémarrage du serveur
    def load_cache(self) -> None:
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        signature = (data.get("format"), data.get("maxPrice"), data.get("country"), data.get("hideAdult"))
        if signature != (CACHE_FORMAT, MAX_PRICE, COUNTRY, HIDE_ADULT):
            return
        self.items = data.get("items") or []
        self.version, self.updated = int(data.get("version") or 0), float(data.get("updated") or 0)
        self.expected, self.done = len(self.items), bool(self.items)
        if self.done:
            age = max(0, int((time.time() - self.updated) / 60))
            log(f"{len(self.items)} offres relues depuis le cache (relevé il y a {age} min)")

    def save_cache(self) -> None:
        try:
            with self.lock:
                text = json.dumps({
                    "format": CACHE_FORMAT, "maxPrice": MAX_PRICE, "country": COUNTRY, "hideAdult": HIDE_ADULT,
                    "version": self.version, "updated": self.updated, "items": self.items,
                }, ensure_ascii=False, separators=(",", ":"))
            CACHE_FILE.parent.mkdir(exist_ok=True)
            temp = CACHE_FILE.with_suffix(".tmp")
            temp.write_text(text, encoding="utf-8")
            os.replace(temp, CACHE_FILE)
        except OSError as exc:
            log(f"cache non enregistré ({exc})")

    # -- relevé
    def ensure_fresh(self) -> None:
        now = time.time()
        with self.lock:
            if self.crawling or now < self.retry_at:
                return
            if self.done and now - self.updated < TTL:
                return
            self.crawling = True
        threading.Thread(target=self._crawl, name="releve-steam", daemon=True).start()

    def _crawl(self) -> None:
        started = time.time()
        try:
            self._crawl_inner(started)
        except Exception as exc:  # noqa: BLE001
            log(f"relevé interrompu : {exc}")
            with self.lock:
                self.retry_at = time.time() + 20
                if not self.done:
                    self.error = "Steam ne répond pas pour le moment."
        finally:
            with self.lock:
                self.crawling = False

    def _crawl_inner(self, started: float) -> None:
        log("relevé des promotions Steam…")
        mode = {"live": None}

        def publish(rows: list[dict], total: int) -> None:
            with self.lock:
                if mode["live"] is None:
                    mode["live"] = not self.done       # premier relevé : on publie au fil de l'eau
                    if mode["live"]:
                        self.version = int(started * 1000)
                        self.items, self.expected, self.error = [], total, ""
                if mode["live"]:
                    self.items.extend(rows)

        build, failed = crawl(publish)
        live = bool(mode["live"])
        with self.lock:
            if failed and not live:
                # relevé incomplet : on garde l'ancien catalogue et on réessaiera bientôt
                self.retry_at = time.time() + 5 * 60
                log(f"relevé incomplet ({failed} pages en échec), ancien catalogue conservé")
                return
            if not live:
                self.version, self.items = int(started * 1000), build
            self.expected, self.done, self.error = len(build), True, ""
            self.updated = time.time() - (TTL - 5 * 60 if failed else 0)
        log(f"{len(build)} offres à moins de {MAX_PRICE} € relevées en {time.time() - started:.1f} s"
            + (f" ({failed} pages en échec, nouvel essai dans 5 min)" if failed else ""))
        self.save_cache()

    # -- lecture par le site
    def snapshot(self, start: int, known_version: int) -> dict:
        with self.lock:
            reset = bool(known_version) and known_version != self.version
            if reset:
                start = 0
            return {
                "v": self.version,
                "reset": reset,
                "total": len(self.items) if self.done else max(self.expected, len(self.items)),
                "loaded": len(self.items),
                "done": self.done,
                "updatedAt": int(self.updated * 1000),
                "error": self.error,
                "maxPrice": MAX_PRICE,
                "items": self.items[start:],
            }


CATALOGUE = Catalogue()


# --------------------------------------------------------------------------- serveur web
class Handler(SimpleHTTPRequestHandler):
    server_version = "Sous30"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".png": "image/png",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        self._json = False
        if parsed.path == "/deals.json":      # même adresse que le fichier servi par l'hébergement statique
            query = urllib.parse.parse_qs(parsed.query)
            CATALOGUE.ensure_fresh()
            self.send_json(CATALOGUE.snapshot(self._int(query, "from"), self._int(query, "v")))
        elif parsed.path.startswith("/api/"):
            self.send_json({"error": "adresse inconnue"}, 404)
        else:
            super().do_GET()

    @staticmethod
    def _int(query: dict, name: str) -> int:
        try:
            return max(0, int(query.get(name, ["0"])[0]))
        except ValueError:
            return 0

    def send_json(self, payload: dict, status: int = 200) -> None:
        self._json = True
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        zipped = "gzip" in self.headers.get("Accept-Encoding", "") and len(body) > 1024
        if zipped:
            body = gzip.compress(body, 5)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if zipped:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except ConnectionError:
            pass

    def end_headers(self) -> None:
        if not getattr(self, "_json", False):
            self.send_header("Cache-Control", "no-cache")   # les fichiers du site se rechargent à chaque modification
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            log(f"{self.address_string()} {format % args}")


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    if "--export" in sys.argv:
        position = sys.argv.index("--export")
        export(Path(sys.argv[position + 1]) if len(sys.argv) > position + 1 else PUBLIC)
        return
    if not (PUBLIC / "index.html").exists():
        sys.exit("Dossier public/ introuvable à côté de server.py.")

    CATALOGUE.load_cache()
    CATALOGUE.ensure_fresh()
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as exc:
        sys.exit(f"Impossible d'ouvrir le port {PORT} ({exc}). Un autre serveur tourne peut-être déjà.")
    httpd.daemon_threads = True
    address = f"http://localhost:{PORT}"
    log(f"Sous 30 est en ligne : {address}   (Ctrl+C pour arrêter)")
    if "--ouvrir" in sys.argv:
        threading.Timer(0.6, webbrowser.open, args=(address,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("arrêt.")


if __name__ == "__main__":
    main()
