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
            {"path": "/pontaj/organigrama", "label": "Organigramă", "icon": "account_tree"},
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
    ("team_dashboard", {
        "label": "Team Dashboard",
        "description": "Portal mobil pentru pontajul propriu, fișa salarială, echipa coordonată și notificări.",
        "icon": "space_dashboard",
        "main_route": "/team-dashboard",
        "routes": [
            {"path": "/team-dashboard", "label": "Dashboard echipă", "icon": "space_dashboard"},
            {"path": "/team-dashboard/echipa-mea", "label": "Echipa mea", "icon": "groups"},
            {"path": "/team-dashboard/pontaj", "label": "Attendance", "icon": "schedule"},
            {"path": "/team-dashboard/fisa-angajat", "label": "Fișa angajatului", "icon": "badge"},
            {"path": "/team-dashboard/notificari", "label": "Notificări", "icon": "notifications"},
            {"path": "/team-dashboard/vezi-lipsa", "label": "Vezi lipsă", "icon": "person_search"},
            {"path": "/team-dashboard/lipsa-azi", "label": "Lipsă azi", "icon": "person_off"},
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
TEAM_SCHEDULE_ROUTES = tuple(
    route["path"] for route in MODULE_DEFINITIONS["teams_schedule"]["routes"]
)


def app_user_roles(app_user):
    if not app_user or not getattr(app_user, "employee_id", None):
        return []
    roles = []
    employee = app_user.employee
    if employee.led_employee_teams.filter(active=True).exists():
        roles.append("team_leader")
    if employee.supervised_employee_teams.filter(active=True).exists():
        roles.append("supervisor")
    from ToolApp.models import AttendanceAlertEscalationConfig
    escalation_levels = set(
        AttendanceAlertEscalationConfig.objects.filter(
            app_user=app_user,
            active=True,
        ).values_list("level", flat=True)
    )
    if 1 in escalation_levels:
        roles.append("alert_level_1")
    if 2 in escalation_levels:
        roles.append("alert_level_2")
    return roles


def app_user_has_manual_module(app_user, module_code):
    return bool(app_user and app_user.module_accesses.filter(
        module_code=module_code,
        can_access=True,
    ).exists())


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
    roles = set(app_user_roles(app_user))
    # Șefii și supervisorii păstrează accesul implicit necesar administrării echipelor lor.
    if roles.intersection({"team_leader", "supervisor"}):
        codes.add("teams_schedule")
        codes.add("team_dashboard")
    if roles.intersection({"alert_level_1", "alert_level_2"}):
        codes.add("team_dashboard")
    return [code for code in MODULE_ORDER if code in codes]


def app_user_has_module(app_user, module_code):
    return module_code in effective_module_codes(app_user)


def app_user_has_standard_route(app_user, route):
    module_code = STANDARD_ROUTE_MODULES.get(route)
    return bool(module_code and app_user_has_module(app_user, module_code))


def default_module_route(app_user):
    if app_user_roles(app_user):
        return "/team-dashboard"
    codes = effective_module_codes(app_user)
    return MODULE_DEFINITIONS[codes[0]]["main_route"] if codes else None
