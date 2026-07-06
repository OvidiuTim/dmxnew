from django.contrib import admin

from ToolApp.models import Tools


@admin.register(Tools)
class ToolsAdmin(admin.ModelAdmin):
    list_display = (
        "ToolSerie",
        "ToolName",
        "Brand",
        "Category",
        "Pieces",
        "Status",
        "MainLocation",
        "RequiresVerification",
    )
    list_filter = ("Status", "IsSSM", "RequiresVerification", "Category", "Brand")
    search_fields = (
        "ToolSerie",
        "ToolName",
        "SerialNumber",
        "Brand",
        "Category",
        "Detail",
    )
