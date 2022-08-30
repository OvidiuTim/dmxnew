from django.urls import re_path as url
from ToolApp import views


urlpatterns=[
    url(r'^user/$',views.userApi),
    url(r'^user/([0-9]+)$',views.userApi),

    url(r'^tool/$',views.toolApi),
    url(r'^tool/([0-9]+)$',views.toolApi),

    url(r'^history/$',views.historyApi),
    url(r'^history/([0-9]+)$',views.historyApi),

    url(r'^material/$',views.materialApi),
    url(r'^material/([0-9]+)$',views.materialApi),

    url(r'^consumable/$',views.consumableApi),
    url(r'^consumable/([0-9]+)$',views.consumableApi),

    url(r'^shed/$',views.shedApi),
    url(r'^shed/([0-9]+)$',views.shedApi),

    url(r'^workfield/$',views.workfieldApi),
    url(r'^workfield/([0-9]+)$',views.workfieldApi),

    url(r'^unfunctional/$',views.unfunctionalApi),
    url(r'^unfunctional/([0-9]+)$',views.unfunctionalApi),

    url(r'^cofrajmetalic/$',views.cofrajmetalicApi),
    url(r'^cofrajmetalic/([0-9]+)$',views.cofrajmetalicApi),

    url(r'^cofrajtipdoka/$',views.cofrajtipdokaApi),
    url(r'^cofrajtipdoka/([0-9]+)$',views.cofrajtipdokaApi),


    url(r'^popi/$',views.popiApi),
    url(r'^popi/([0-9]+)$',views.popiApi),

    url(r'^schelausoara/$',views.schelausoaraApi),
    url(r'^schelausoara/([0-9]+)$',views.schelausoaraApi),


    url(r'^schelafatada/$',views.schelafatadaApi),
    url(r'^schelafatada/([0-9]+)$',views.schelafatadaApi),


    url(r'^schelafatadamodulara/$',views.schelafatadamodularaApi),
    url(r'^schelafatadamodulara/([0-9]+)$',views.schelafatadamodularaApi),

    url(r'^mijloacefixe/$',views.mijloacefixeApi),
    url(r'^mijloacefixe/([0-9]+)$',views.mijloacefixeApi),

    url(r'^combustibil/$',views.combustibilApi),
    url(r'^combustibil/([0-9]+)$',views.combustibilApi),


    url(r'^istoric_schele/$',views.istoricschelaApi),
    url(r'^istoric_schele/([0-9]+)$',views.istoricschelaApi),
] 