import re
import unicodedata


ACCEPTED_WORKSITES = (
    "The Lake Home Bloc A",
    "The Lake Home Bloc B2",
    "The Lake Home Bloc E & F",
    "Birou ingineri",
    "magazie/depozit",
    "Psihiatrie C8",
    "Psihiatrie C16",
    "Spital Victoria",
    "Casa de Cultură Victoria",
    "Bazin Ucea",
    "Bloc Agnita",
    "Grădinița Agnita",
    "Bloc 14 Victoria",
    "Bloc 3 Victoria",
    "Cisnadie",
    "Sibiel - the river chalet",
    "diverse",
)


class InvalidWorksite(ValueError):
    pass


def fold_worksite(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.casefold().replace("&", " si ")
    text = re.sub(r"[/_\-]+", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


_ACCEPTED_BY_KEY = {fold_worksite(name): name for name in ACCEPTED_WORKSITES}


def _aliases():
    groups = {
        "The Lake Home Bloc A": (
            "Bloc A", "Tractorului", "Tractorului Bloc A", "The Lake Home",
            "The Lake Home A", "The Lake Home Blocul A", "Bl.A", "Bl A", "BlA",
        ),
        "The Lake Home Bloc B2": (
            "Bloc B2", "Bloc B 2", "Tractorului Bloc B2", "The Lake Home B2",
            "The Lake Home Blocul B2",
        ),
        "The Lake Home Bloc E & F": (
            "Bloc E & F", "Bloc E si F", "Bloc E", "Bloc F", "Tractorului Bloc E",
            "Tractorului Bloc F", "Tractorului Bloc E si F", "The Lake Home E F",
            "The Lake Home Blocurile E si F", "The Lake Home Bloc E si F",
        ),
        "Birou ingineri": ("Birou", "Biroul inginerilor", "Birou Ingineri", "Chef"),
        "magazie/depozit": ("Magazie", "Depozit", "Magazie depozit", "Warehouse"),
        "Psihiatrie C8": ("C8 Psihiatrie", "Psihiatrie C 8", "C8"),
        "Psihiatrie C16": ("C16 Psihiatrie", "Psihiatrie C 16", "C16"),
        "Spital Victoria": ("Spitalul Victoria",),
        "Casa de Cultură Victoria": ("Casa de Cultura", "Casa Cultura Victoria", "Casa de Cultura Victoria"),
        "Bazin Ucea": ("Bazinul Ucea", "Ucea bazin"),
        "Bloc Agnita": ("Agnita Bloc",),
        "Grădinița Agnita": ("Gradinita Agnita", "Grădiniţa Agnita"),
        "Bloc 14 Victoria": ("Bloc14 Victoria", "Victoria Bloc 14"),
        "Bloc 3 Victoria": ("Bloc3 Victoria", "Victoria Bloc 3"),
        "Cisnadie": ("Cisnădie",),
        "Sibiel - the river chalet": ("Sibiel", "The River Chalet", "Sibiel The River Chalet"),
        "diverse": ("Diverse lucrari", "Diverse lucrări", "Altele", "Alt santier", "Alt șantier"),
    }
    return {
        fold_worksite(alias): canonical
        for canonical, aliases in groups.items()
        for alias in aliases
    }


_ALIASES_BY_KEY = _aliases()


def match_worksite(value):
    """Returnează denumirea standard sau None când asocierea nu este sigură."""
    key = fold_worksite(value)
    if not key:
        return None
    if key in _ACCEPTED_BY_KEY:
        return _ACCEPTED_BY_KEY[key]
    if key in _ALIASES_BY_KEY:
        return _ALIASES_BY_KEY[key]

    tokens = set(key.split())
    if "psihiatrie" in tokens or key.startswith("c8") or key.startswith("c16"):
        if "c16" in tokens or re.search(r"\bc\s*16\b", key):
            return "Psihiatrie C16"
        if "c8" in tokens or re.search(r"\bc\s*8\b", key):
            return "Psihiatrie C8"

    is_lake_home = "lake home" in key or "tractorului" in tokens
    if is_lake_home or "bloc" in tokens:
        if "b2" in tokens or re.search(r"\bbloc\s+b\s*2\b", key):
            return "The Lake Home Bloc B2"
        if (
            re.search(r"\bbloc(?:ul|urile)?\s+[ef]\b", key)
            or ("e" in tokens and "f" in tokens and (is_lake_home or "bloc" in tokens))
        ):
            return "The Lake Home Bloc E & F"
        if "a" in tokens and (is_lake_home or "bloc" in tokens):
            return "The Lake Home Bloc A"
        if key in {"tractorului", "the lake home"}:
            return "The Lake Home Bloc A"

    return None


def normalize_worksite(value, *, allow_blank=False):
    text = str(value or "").strip()
    if not text and allow_blank:
        return ""
    matched = match_worksite(text)
    if matched:
        return matched
    if not text:
        raise InvalidWorksite("Șantierul este obligatoriu.")
    raise InvalidWorksite(
        f"Șantierul «{text}» nu este în lista de șantiere acceptate."
    )
