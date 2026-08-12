from django.contrib import admin
from django.utils import timezone

from ToolApp.models import (
    Accommodation,
    EmployeeDocument,
    EmployeeDocumentType,
    EmployeeSalaryProfile,
    AppModuleAccess,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    LeaveRequest,
    TemporaryWorkerRequest,
    Tools,
    Users,
)


@admin.register(Accommodation)
class AccommodationAdmin(admin.ModelAdmin):
    list_display = ("name", "address", "active", "updated_at")
    list_filter = ("active",)
    search_fields = ("name", "address", "notes")


@admin.register(EmployeeDocumentType)
class EmployeeDocumentTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "active")
    list_filter = ("category", "active")
    search_fields = ("name",)


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ("employee", "document_type", "has_expiry", "expiry_date", "uploaded_at")
    list_filter = ("document_type__category", "has_expiry", "expiry_date")
    search_fields = ("employee__UserName", "employee__UserSerie", "document_type__name", "original_file_name")


@admin.register(AppModuleAccess)
class AppModuleAccessAdmin(admin.ModelAdmin):
    list_display = ("app_user", "module_code", "can_access", "updated_at")
    list_filter = ("module_code", "can_access")
    search_fields = ("app_user__username", "app_user__employee__UserName")


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


class EmployeeSalaryProfileInline(admin.StackedInline):
    model = EmployeeSalaryProfile
    extra = 0
    max_num = 1


@admin.register(Users)
class UsersAdmin(admin.ModelAdmin):
    list_display = ("UserName", "UserSerie", "email", "Company", "trade", "active", "hire_date", "accommodation")
    list_filter = ("active", "Company", "trade")
    search_fields = ("UserName", "UserSerie", "email", "phone_number", "housing_location")
    inlines = (EmployeeSalaryProfileInline,)


@admin.register(EmployeeSalaryProfile)
class EmployeeSalaryProfileAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "net_salary_eur",
        "net_salary_ron",
        "salary_advance_ron",
        "food_money_enabled",
        "food_money_ron",
    )
    list_filter = ("food_money_enabled",)
    search_fields = ("employee__UserName", "employee__UserSerie")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "team", "assigned_leader", "leave_type", "start_date", "end_date", "status")
    list_filter = ("status", "leave_type", "start_date")
    search_fields = ("employee__UserName", "employee__UserSerie")
    readonly_fields = ("created_at", "approved_at", "approved_by", "reviewed_at", "reviewed_by_app_user")

    def save_model(self, request, obj, form, change):
        if obj.status == LeaveRequest.Status.APPROVED and not obj.approved_at:
            obj.approved_at = timezone.now()
            obj.approved_by = request.user
        elif obj.status != LeaveRequest.Status.APPROVED:
            obj.approved_at = None
            obj.approved_by = None
        if obj.status != LeaveRequest.Status.PENDING and not obj.reviewed_at:
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)


@admin.register(LeaveDay)
class LeaveDayAdmin(admin.ModelAdmin):
    list_display = ("user_fk", "work_date", "reason", "hours", "pay_amount", "source_leave_request")
    list_filter = ("reason", "work_date")
    search_fields = ("user_fk__UserName", "user_fk__UserSerie", "note")
    readonly_fields = ("source_leave_request",)


class EmployeeTeamMemberInline(admin.TabularInline):
    model = EmployeeTeamMember
    extra = 0


@admin.register(EmployeeTeam)
class EmployeeTeamAdmin(admin.ModelAdmin):
    list_display = ("name", "leader", "default_worksite", "active")
    list_filter = ("active",)
    search_fields = ("name", "leader__UserName")
    inlines = (EmployeeTeamMemberInline,)


@admin.register(TemporaryWorkerRequest)
class TemporaryWorkerRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "request_type", "source_team", "requester_team", "start_date", "end_date", "status", "seen_at", "email_sent_at")
    list_filter = ("request_type", "status", "start_date", "source_team", "requester_team")
    search_fields = ("employee__UserName", "source_team__name", "requester_team__name", "reason")
    readonly_fields = ("created_at", "updated_at", "resolved_at", "seen_at", "email_sent_at")
