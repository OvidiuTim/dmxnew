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
    ("construction_sites", {
        "label": "Șantiere",
        "description": "Centre de cost, pontaje asociate, bugete și cheltuieli pe șantier.",
        "icon": "construction",
        "main_route": "/santiere",
        "routes": [{"path": "/santiere", "label": "Șantiere și costuri", "icon": "construction"}],
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
            {"path": "/team-dashboard/cerere-concediu", "label": "Cerere concediu", "icon": "calendar_month"},
            {"path": "/team-dashboard/notificari", "label": "Notificări", "icon": "notifications"},
            {"path": "/team-dashboard/echipele-mele", "label": "Echipele mele", "icon": "groups_2"},
            {"path": "/team-dashboard/cereri", "label": "Cereri", "icon": "approval"},
            {"path": "/team-dashboard/cereri-concediu", "label": "Cereri de concediu", "icon": "calendar_month"},
            {"path": "/team-dashboard/cereri-transfer", "label": "Cereri de transfer", "icon": "swap_horiz"},
            {"path": "/team-dashboard/personal", "label": "Personal", "icon": "group_search"},
            {"path": "/team-dashboard/vezi-lipsa", "label": "Vezi nepontați", "icon": "person_search"},
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
    ("flota", {
        "label": "Utilaje",
        "description": "Actele utilajelor și sesiunile Iau / Predau.",
        "icon": "local_shipping",
        "main_route": "/utilaje",
        "routes": [
            {"path": "/utilaje/adauga", "label": "Adaugă utilaj", "icon": "add"},
            {"path": "/utilaje", "label": "Flotă", "icon": "space_dashboard"},
            {"path": "/utilaje/lista", "label": "Utilaje", "icon": "local_shipping"},
            {"path": "/utilaje/expirari", "label": "Expirări documente", "icon": "event_upcoming"},
            {"path": "/utilaje/responsabili", "label": "Desemnează responsabili", "icon": "manage_accounts"},
            {"path": "/utilaje/utilizari", "label": "Utilizări", "icon": "history"},
            {"path": "/utilaje/service", "label": "Defecte și service", "icon": "build"},
            {"path": "/utilaje/rapoarte", "label": "Rapoarte flotă", "icon": "bar_chart"},
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
    if getattr(app_user, "is_storekeeper", False):
        roles.append("storekeeper")
    from ToolApp.models import FleetDocumentResponsible, FleetTechnicalResponsible
    if FleetTechnicalResponsible.objects.filter(app_user=app_user, active=True).exists():
        roles.append("technical_responsible")
    if FleetDocumentResponsible.objects.filter(responsabil=employee, activ=True).exists():
        roles.append("document_responsible")
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


def effective_module_codes(app_user, *, roles=None, manual_modules=None):
    if not app_user:
        return []
    # A response serializer can supply data it has just read. Never cache these
    # grants on the model or across requests: revocations must take effect now.
    if manual_modules is None:
        manual_modules = app_user.module_accesses.filter(can_access=True).values_list("module_code", flat=True)
    codes = set(manual_modules)
    roles = set(app_user_roles(app_user) if roles is None else roles)
    employee = getattr(app_user, "employee", None)
    if (
        employee
        and employee.active
        and employee.person_type == "employee"
        and employee.employment_status == "active"
    ):
        codes.add("team_dashboard")
    # Șefii și supervisorii păstrează accesul implicit necesar administrării echipelor lor.
    if roles.intersection({"team_leader", "supervisor"}):
        codes.add("teams_schedule")
        codes.add("team_dashboard")
    if roles.intersection({"alert_level_1", "alert_level_2"}):
        codes.add("team_dashboard")
    if "storekeeper" in roles:
        codes.add("tools")
    return [code for code in MODULE_ORDER if code in codes]


def app_user_has_module(app_user, module_code):
    if not app_user:
        return False
    # These two common portal checks have simple inheritance rules. Do not
    # query every fleet/team/escalation role just to answer one of them.
    if module_code == "team_dashboard":
        employee = app_user.employee
        if (employee.active and employee.person_type == "employee"
                and employee.employment_status == "active"):
            return True
    if module_code == "tools":
        return bool(app_user.is_storekeeper or app_user_has_manual_module(app_user, module_code))
    return module_code in effective_module_codes(app_user)


def app_user_has_standard_route(app_user, route):
    module_code = STANDARD_ROUTE_MODULES.get(route)
    return bool(module_code and app_user_has_module(app_user, module_code))


def default_module_route(app_user):
    employee = getattr(app_user, "employee", None)
    if employee and employee.active and employee.person_type == "employee" and employee.employment_status == "active":
        return "/team-dashboard"
    codes = effective_module_codes(app_user)
    return MODULE_DEFINITIONS[codes[0]]["main_route"] if codes else None
