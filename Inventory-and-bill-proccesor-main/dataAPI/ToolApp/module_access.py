from collections import OrderedDict


MODULE_DEFINITIONS = OrderedDict([
    ("attendance", {
        "label": "Pontaj",
        "description": "Prezență zilnică, rapoarte și fișe de angajat.",
        "icon": "schedule",
        "main_route": "/dashboard",
        "routes": [
            {"path": "/dashboard", "label": "Dashboard", "icon": "dashboard"},
            {"path": "/pontaj", "label": "Prezență zilnică", "icon": "schedule"},
            {"path": "/pontaj/rapoarte", "label": "Rapoarte", "icon": "bar_chart"},
            {"path": "/pontaj/fisa-angajat", "label": "Fișe angajați", "icon": "badge"},
            {"path": "/pontaj/cazari", "label": "Cazări", "icon": "apartment"},
        ],
    }),
    ("teams_schedule", {
        "label": "Echipe și program",
        "description": "Echipe permanente, situația zilei și personal disponibil.",
        "icon": "groups",
        "main_route": "/pontaj/echipe",
        "routes": [
            {"path": "/pontaj/echipe", "label": "Echipe permanente", "icon": "groups"},
            {"path": "/pontaj/echipa-mea", "label": "Echipa mea", "icon": "group"},
            {"path": "/pontaj/concedii", "label": "Concedii", "icon": "calendar_month"},
            {"path": "/pontaj/notificari", "label": "Notificări", "icon": "notifications"},
            {"path": "/pontaj/echipe-azi", "label": "Echipele de azi", "icon": "today"},
            {"path": "/pontaj/personal", "label": "Personal", "icon": "group_add"},
        ],
    }),
    ("warehouse", {
        "label": "Magazie",
        "description": "Privire generală, inventar și istoric magazie.",
        "icon": "warehouse",
        "main_route": "/magazie",
        "routes": [
            {"path": "/magazie", "label": "Privire generală", "icon": "warehouse"},
            {"path": "/magazie/scule", "label": "Scule", "icon": "construction"},
            {"path": "/magazie/echipamente-ssm", "label": "Echipamente SSM", "icon": "health_and_safety"},
            {"path": "/magazie/istoric", "label": "Istoric", "icon": "history"},
        ],
    }),
    ("human_resources", {
        "label": "Resurse umane",
        "description": "Documentele și informațiile administrative ale angajaților.",
        "icon": "description",
        "main_route": "/hr/documente",
        "routes": [
            {"path": "/hr/documente", "label": "Documente", "icon": "description"},
        ],
    }),
    ("tools", {
        "label": "Unelte",
        "description": "Registrul separat pentru adăugarea și predarea uneltelor.",
        "icon": "construction",
        "main_route": "/unelte",
        "routes": [
            {"path": "/unelte", "label": "Registru unelte", "icon": "construction"},
            {"path": "/unelte/adauga-unealta", "label": "Adaugă unealtă", "icon": "add_circle"},
            {"path": "/predare-unealta", "label": "Predare unealtă", "icon": "swap_horiz"},
        ],
    }),
])

MODULE_ORDER = tuple(MODULE_DEFINITIONS.keys())
STANDARD_ROUTE_MODULES = {
    route["path"]: code
    for code, definition in MODULE_DEFINITIONS.items()
    for route in definition["routes"]
}


def serialize_module_definitions():
    return [
        {"code": code, **definition}
        for code, definition in MODULE_DEFINITIONS.items()
    ]


def effective_module_codes(app_user):
    if not app_user:
        return []
    codes = set(
        app_user.module_accesses.filter(can_access=True).values_list("module_code", flat=True)
    )
    # Șefii de echipă păstrează accesul implicit necesar administrării propriei echipe.
    if app_user.employee.led_employee_teams.filter(active=True).exists():
        codes.add("teams_schedule")
    return [code for code in MODULE_ORDER if code in codes]


def app_user_has_module(app_user, module_code):
    return module_code in effective_module_codes(app_user)


def app_user_has_standard_route(app_user, route):
    module_code = STANDARD_ROUTE_MODULES.get(route)
    return bool(module_code and app_user_has_module(app_user, module_code))


def default_module_route(app_user):
    codes = effective_module_codes(app_user)
    return MODULE_DEFINITIONS[codes[0]]["main_route"] if codes else None
