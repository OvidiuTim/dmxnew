from django.contrib import admin
from django.utils import timezone

from ToolApp.models import (
    EmployeeSalaryProfile,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    LeaveRequest,
    Tools,
    Users,
)


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
    list_display = ("UserName", "UserSerie", "Company", "trade", "hire_date", "housing_location")
    list_filter = ("Company", "trade")
    search_fields = ("UserName", "UserSerie", "phone_number", "housing_location")
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
    list_display = ("employee", "leave_type", "start_date", "end_date", "status")
    list_filter = ("status", "leave_type", "start_date")
    search_fields = ("employee__UserName", "employee__UserSerie")
    readonly_fields = ("created_at", "approved_at", "approved_by")

    def save_model(self, request, obj, form, change):
        if obj.status == LeaveRequest.Status.APPROVED and not obj.approved_at:
            obj.approved_at = timezone.now()
            obj.approved_by = request.user
        elif obj.status != LeaveRequest.Status.APPROVED:
            obj.approved_at = None
            obj.approved_by = None
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
    list_display = ("name", "leader", "active")
    list_filter = ("active",)
    search_fields = ("name", "leader__UserName")
    inlines = (EmployeeTeamMemberInline,)
