from collections import OrderedDict


MODULE_DEFINITIONS = OrderedDict([
    ("attendance", {
        "label": "Pontaj",
        "description": "Prezență zilnică, rapoarte și fișe de angajat.",
        "icon": "schedule",
        "main_route": "/pontaj",
    }),
    ("teams_schedule", {
        "label": "Echipe și program",
        "description": "Echipe permanente, situația zilei și personal disponibil.",
        "icon": "groups",
        "main_route": "/pontaj/echipe",
    }),
    ("warehouse", {
        "label": "Magazie",
        "description": "Privire generală, inventar și istoric magazie.",
        "icon": "warehouse",
        "main_route": "/magazie",
    }),
    ("human_resources", {
        "label": "Resurse umane",
        "description": "Documentele și informațiile administrative ale angajaților.",
        "icon": "description",
        "main_route": "/hr/documente",
    }),
    ("tools", {
        "label": "Unelte",
        "description": "Registrul separat pentru adăugarea și predarea uneltelor.",
        "icon": "construction",
        "main_route": "/unelte",
    }),
])

MODULE_ORDER = tuple(MODULE_DEFINITIONS.keys())


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


def default_module_route(app_user):
    codes = effective_module_codes(app_user)
    return MODULE_DEFINITIONS[codes[0]]["main_route"] if codes else None
