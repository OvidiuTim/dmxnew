from django.urls import path, re_path as url
from ToolApp import views
from .views import (
    nfc_scan, attendance_today, attendance_day, attendance_present, attendance_range,
    monitor_pontaj_page, pontaj_stream
)

urlpatterns = [
    # --- Legacy (existente) ---
    url(r'^user/$', views.userApi),                         url(r'^user/([0-9]+)$', views.userApi),
    url(r'^tool/$', views.toolApi),                         url(r'^tool/([0-9]+)$', views.toolApi),
    url(r'^history/$', views.historyApi),                   url(r'^history/([0-9]+)$', views.historyApi),
    url(r'^material/$', views.materialApi),                 url(r'^material/([0-9]+)$', views.materialApi),
    url(r'^consumable/$', views.consumableApi),             url(r'^consumable/([0-9]+)$', views.consumableApi),
    url(r'^shed/$', views.shedApi),                         url(r'^shed/([0-9]+)$', views.shedApi),
    url(r'^workfield/$', views.workfieldApi),               url(r'^workfield/([0-9]+)$', views.workfieldApi),
    url(r'^unfunctional/$', views.unfunctionalApi),         url(r'^unfunctional/([0-9]+)$', views.unfunctionalApi),
    url(r'^cofrajmetalic/$', views.cofrajmetalicApi),       url(r'^cofrajmetalic/([0-9]+)$', views.cofrajmetalicApi),
    url(r'^cofrajtipdoka/$', views.cofrajtipdokaApi),       url(r'^cofrajtipdoka/([0-9]+)$', views.cofrajtipdokaApi),
    url(r'^popi/$', views.popiApi),                         url(r'^popi/([0-9]+)$', views.popiApi),
    url(r'^schelausoara/$', views.schelausoaraApi),         url(r'^schelausoara/([0-9]+)$', views.schelausoaraApi),
    url(r'^schelafatada/$', views.schelafatadaApi),         url(r'^schelafatada/([0-9]+)$', views.schelafatadaApi),
    url(r'^schelafatadamodulara/$', views.schelafatadamodularaApi),
    url(r'^schelafatadamodulara/([0-9]+)$', views.schelafatadamodularaApi),
    url(r'^mijloacefixe/$', views.mijloacefixeApi),         url(r'^mijloacefixe/([0-9]+)$', views.mijloacefixeApi),
    url(r'^combustibil/$', views.combustibilApi),           url(r'^combustibil/([0-9]+)$', views.combustibilApi),
    url(r'^istoric_schele/$', views.istoricschelaApi),      url(r'^istoric_schele/([0-9]+)$', views.istoricschelaApi),

    # NFC/Tools helpers (existente)
    path('nfc-tag/', views.nfc_tag_view, name='nfc_tag'),
    path('check-nfc-reader/', views.check_nfc_reader, name='check_nfc_reader'),
    path('rfid/entry/', views.rfid_entry_exit),
    path('tools/issue/', views.issue_tool),
    path('tools/return/', views.return_tool),
    path('tools/status/', views.tools_status),

    # --- Pontaj (existente cu /api/) ---
    path('api/nfc/scan/', nfc_scan, name='nfc_scan'),
    path('api/pontaj/day/', attendance_day, name='attendance_day'),
    path('api/pontaj/present/', attendance_present, name='attendance_present'),
    path('api/pontaj/range/', attendance_range, name='attendance_range'),
    path('api/pontaj/today/', attendance_today, name='attendance_today'),
    path('api/pontaj/stream/', pontaj_stream, name='pontaj_stream'),

    # Pagina monitor
    path('pontaj/monitor/', monitor_pontaj_page, name='monitor_pontaj'),

    # Bulk users
    path('api/users/bulk/',  views.users_bulk),
    path('api/users/purge/', views.users_purge),

    # --- Aliasuri noi cu prefix /api/ pentru toate cele de sus (legacy REST) ---
    path('api/user/', views.userApi),
    path('api/user/<int:id>', views.userApi),

    path('api/tool/', views.toolApi),
    path('api/tool/<int:id>', views.toolApi),

    path('api/history/', views.historyApi),
    path('api/history/<int:id>', views.historyApi),

    path('api/material/', views.materialApi),
    path('api/material/<int:id>', views.materialApi),

    path('api/consumable/', views.consumableApi),
    path('api/consumable/<int:id>', views.consumableApi),

    path('api/shed/', views.shedApi),
    path('api/shed/<int:id>', views.shedApi),

    path('api/workfield/', views.workfieldApi),
    path('api/workfield/<int:id>', views.workfieldApi),

    path('api/unfunctional/', views.unfunctionalApi),
    path('api/unfunctional/<int:id>', views.unfunctionalApi),

    path('api/cofrajmetalic/', views.cofrajmetalicApi),
    path('api/cofrajmetalic/<int:id>', views.cofrajmetalicApi),

    path('api/cofrajtipdoka/', views.cofrajtipdokaApi),
    path('api/cofrajtipdoka/<int:id>', views.cofrajtipdokaApi),

    path('api/popi/', views.popiApi),
    path('api/popi/<int:id>', views.popiApi),

    path('api/schelausoara/', views.schelausoaraApi),
    path('api/schelausoara/<int:id>', views.schelausoaraApi),

    path('api/schelafatada/', views.schelafatadaApi),
    path('api/schelafatada/<int:id>', views.schelafatadaApi),

    path('api/schelafatadamodulara/', views.schelafatadamodularaApi),
    path('api/schelafatadamodulara/<int:id>', views.schelafatadamodularaApi),

    path('api/mijloacefixe/', views.mijloacefixeApi),
    path('api/mijloacefixe/<int:id>', views.mijloacefixeApi),

    path('api/combustibil/', views.combustibilApi),
    path('api/combustibil/<int:id>', views.combustibilApi),

    path('api/istoric_schele/', views.istoricschelaApi),
    path('api/istoric_schele/<int:id>', views.istoricschelaApi),
    path('api/pontaj/force_close_1730/', views.attendance_force_close_1730),

    path('api/pay/day/', views.pay_day, name='pay_day'),
    path('api/pay/month/', views.pay_month, name='pay_month'),
    path('api/users/bulk_update/', views.users_bulk_update),

    path('api/auth/login/', views.auth_login),
    path('api/auth/verify/', views.auth_verify),
]
