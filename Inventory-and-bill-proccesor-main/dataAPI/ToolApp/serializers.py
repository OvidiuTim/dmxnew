# serializers.py
import hashlib
import uuid

from rest_framework import serializers
from django.core.cache import cache
from django.utils import timezone
from ToolApp.models import (
    Consumables, Materials, MijloaceFixes, Shed, Tools, Histories, Unfunctional,
    Accommodation, AccommodationRoom, Users, WorkField, CofrajMetalics, CofrajtTipDokas, Popis, SchelaUsoaras,
    SchelaFatadas, SchelaFatadaModularas, Combustibils, HistorieScheles,DailyPay
)


# -------------------- USERS --------------------
class UserSerializer(serializers.ModelSerializer):
    UserPin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_pin = serializers.SerializerMethodField(read_only=True)
    accommodation_id = serializers.PrimaryKeyRelatedField(
        source="accommodation",
        queryset=Accommodation.objects.all(),
        required=False,
        allow_null=True,
    )
    accommodation = serializers.SerializerMethodField(read_only=True)
    accommodation_room_id = serializers.PrimaryKeyRelatedField(
        source="accommodation_room",
        queryset=AccommodationRoom.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Users
        fields = (
            "UserId",
            "UserName",
            "UserSerie",
            "UserPin",
            "has_pin",
            "uid",
            "NameAndSerie",
            "hourly_rate",
            "total_salary_ron",
            "salary_advance_ron",
            "salary_remainder_ron",
            "meal_vouchers_ron",
            "person_type",
            "employment_status",
            "dismissed_at",
            "Company",
            "equipment_size",
            "received_equipment",
            "phone_number",
            "email",
            "photo",
            "trade",
            "hire_date",
            "prior_paid_leave_days",
            "prior_paid_leave_year",
            "leave_remaining_override_days",
            "leave_remaining_override_year",
            "leave_remaining_override_used_days",
            "leave_remaining_override_accrued_days",
            "housing_location",
            "accommodation_id",
            "accommodation",
            "accommodation_room_id",
            "attendance_exempt",
            "active",
        )
        extra_kwargs = {
            "UserSerie": {"required": False, "allow_blank": True},
            "NameAndSerie": {"required": False, "allow_null": True, "allow_blank": True},
            "uid": {"required": False, "allow_null": True, "allow_blank": True},
            "hourly_rate": {"required": False, "allow_null": True},
            "total_salary_ron": {"required": False, "allow_null": True, "min_value": 0},
            "salary_advance_ron": {"required": False, "allow_null": True, "min_value": 0},
            "salary_remainder_ron": {"required": False, "allow_null": True, "min_value": 0},
            "meal_vouchers_ron": {"required": False, "allow_null": True, "min_value": 0},
            "person_type": {"required": False},
            "employment_status": {"required": False},
            "dismissed_at": {"required": False, "allow_null": True},
            "Company": {"required": False, "allow_null": True, "allow_blank": True},
            "equipment_size": {"required": False, "allow_null": True, "allow_blank": True},
            "received_equipment": {"required": False, "allow_null": True},
            "phone_number": {"required": False, "allow_null": True, "allow_blank": True},
            "email": {"required": False, "allow_blank": True},
            "photo": {"required": False, "allow_null": True, "allow_blank": True},
            "trade": {"required": False, "allow_null": True, "allow_blank": True},
            "hire_date": {"required": False, "allow_null": True},
            "prior_paid_leave_days": {"required": False, "min_value": 0},
            "prior_paid_leave_year": {"required": False, "allow_null": True, "min_value": 2000, "max_value": 2200},
            "leave_remaining_override_days": {"required": False, "allow_null": True, "min_value": 0},
            "leave_remaining_override_year": {"read_only": True},
            "leave_remaining_override_used_days": {"read_only": True},
            "leave_remaining_override_accrued_days": {"read_only": True},
            "housing_location": {"required": False, "allow_blank": True},
            "attendance_exempt": {"required": False},
            "active": {"required": False},
        }

    def get_has_pin(self, obj):
        return bool(getattr(obj, "UserPin", None))

    def get_accommodation(self, obj):
        if not obj.accommodation_id:
            return None
        return {
            "id": obj.accommodation_id,
            "name": obj.accommodation.name,
            "address": obj.accommodation.address,
            "room": ({
                "id": obj.accommodation_room_id,
                "name": obj.accommodation_room.name,
            } if obj.accommodation_room_id else None),
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        person_type = attrs.get("person_type", getattr(self.instance, "person_type", Users.PersonType.EMPLOYEE))
        if person_type == Users.PersonType.COLLABORATOR:
            if not str(attrs.get("Company", getattr(self.instance, "Company", "")) or "").strip():
                raise serializers.ValidationError({"Company": "Numele companiei este obligatoriu."})
            if not str(attrs.get("phone_number", getattr(self.instance, "phone_number", "")) or "").strip():
                raise serializers.ValidationError({"phone_number": "Contactul responsabilului este obligatoriu."})
            if not self.instance and not str(attrs.get("UserSerie") or "").strip():
                attrs["UserSerie"] = f"COL-{uuid.uuid4().hex[:12].upper()}"
        elif not str(attrs.get("UserSerie", getattr(self.instance, "UserSerie", "")) or "").strip():
            raise serializers.ValidationError({"UserSerie": "Seria angajatului este obligatorie."})

        accommodation = attrs.get("accommodation", getattr(self.instance, "accommodation", None))
        room = attrs.get("accommodation_room", getattr(self.instance, "accommodation_room", None))
        if room and (not accommodation or room.accommodation_id != accommodation.pk):
            raise serializers.ValidationError({"accommodation_room_id": "Camera nu aparține cazării selectate."})
        if accommodation:
            if accommodation.rooms.exists() and not room:
                raise serializers.ValidationError({"accommodation_room_id": "Selectează camera pentru cazarea aleasă."})
            assigned = accommodation.employees.filter(
                active=True,
                person_type=Users.PersonType.EMPLOYEE,
                employment_status=Users.EmploymentStatus.ACTIVE,
            )
            if self.instance:
                assigned = assigned.exclude(pk=self.instance.pk)
            if accommodation.total_places and assigned.count() >= accommodation.total_places:
                raise serializers.ValidationError({"accommodation_id": "Cazarea selectată nu mai are locuri disponibile."})
        return attrs

    def create(self, validated_data):
        raw_pin = validated_data.pop("UserPin", None)
        accommodation = validated_data.get("accommodation")
        if accommodation:
            validated_data["housing_location"] = accommodation.name
        self._normalize_employment_status(validated_data)
        user = Users(**validated_data)
        if raw_pin is not None:
            user.set_pin(raw_pin)
        user.save()
        self._apply_employment_transition(user)
        return user

    def update(self, instance, validated_data):
        raw_pin = validated_data.pop("UserPin", None)
        override_provided = "leave_remaining_override_days" in validated_data
        override_value = validated_data.get("leave_remaining_override_days")
        if "accommodation" in validated_data:
            accommodation = validated_data.get("accommodation")
            validated_data["housing_location"] = accommodation.name if accommodation else ""
            if not accommodation:
                validated_data["accommodation_room"] = None
        self._normalize_employment_status(validated_data, instance)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if raw_pin is not None:
            instance.set_pin(raw_pin)
        if override_provided:
            if override_value is None:
                instance.leave_remaining_override_year = None
                instance.leave_remaining_override_used_days = 0
                instance.leave_remaining_override_accrued_days = 0
            else:
                from ToolApp.mobile_services import accrued_leave_days, used_paid_leave_days

                today = timezone.localdate()
                current_year = today.year
                instance.leave_remaining_override_year = current_year
                instance.leave_remaining_override_used_days = used_paid_leave_days(instance, current_year)
                instance.leave_remaining_override_accrued_days = accrued_leave_days(instance, today)
        instance.save()
        self._apply_employment_transition(instance)
        return instance

    def _normalize_employment_status(self, validated_data, instance=None):
        status = validated_data.get(
            "employment_status",
            getattr(instance, "employment_status", Users.EmploymentStatus.ACTIVE),
        )
        if status == Users.EmploymentStatus.DISMISSED:
            validated_data["active"] = False
            if not validated_data.get("dismissed_at"):
                validated_data["dismissed_at"] = timezone.localdate()
        elif "employment_status" in validated_data:
            validated_data["active"] = True
            validated_data["dismissed_at"] = None

    def _apply_employment_transition(self, instance):
        if instance.employment_status != Users.EmploymentStatus.DISMISSED:
            return
        from ToolApp.models import AppUser, EmployeeTeam, EmployeeTeamMember

        EmployeeTeamMember.objects.filter(employee=instance, active=True).update(active=False)
        EmployeeTeam.objects.filter(leader=instance, active=True).update(active=False)
        AppUser.objects.filter(employee=instance, is_active=True).update(is_active=False)
        if instance.UserPin:
            digest = hashlib.sha256(str(instance.UserPin).strip().encode("utf-8")).hexdigest()
            cache.delete(f"pin-login-user:{digest}")



# -------------------- TOOLS --------------------
class ToolSerializer(serializers.ModelSerializer):
    AssignedUserId = serializers.PrimaryKeyRelatedField(
        source="AssignedTo",
        queryset=Users.objects.all(),
        required=False,
        allow_null=True,
    )
    AssignedUserName = serializers.SerializerMethodField(read_only=True)
    AssignedPersonType = serializers.SerializerMethodField(read_only=True)
    AssignedPersonTypeLabel = serializers.SerializerMethodField(read_only=True)
    AssignedTeamId = serializers.SerializerMethodField(read_only=True)
    AssignedTeamName = serializers.SerializerMethodField(read_only=True)
    Location = serializers.SerializerMethodField(read_only=True)
    DateReceived = serializers.SerializerMethodField(read_only=True)
    StatusLabel = serializers.SerializerMethodField(read_only=True)
    DisplaySerie = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Tools
        fields = (
            "ToolId",
            "ToolSerie",
            "DisplaySerie",
            "ToolName",
            "BatchId",
            "User",           # legacy (read/write, dacă îl folosești încă)
            "DateOfGiving",   # legacy
            "ExpiryDate",
            "Detail",
            "Pieces",
            "MainLocation",
            "Provider",
            "SourceInventoryNumber",
            "Category",
            "Brand",
            "Model",
            "SerialNumber",
            "SourceStatus",
            "RequiresVerification",
            "SourcePhoto",
            "RfidTag",        # ← nou
            "AssignedUserId",
            "AssignedUserName",
            "AssignedPersonType",
            "AssignedPersonTypeLabel",
            "AssignedTeamId",
            "AssignedTeamName",
            "IsSSM",
            "Status",
            "StatusLabel",
            "IsReturned",
            "IsLost",
            "DateReturned",
            "DateLost",
            "Location",
            "DateReceived",
        )
        extra_kwargs = {
            "ToolSerie": {"required": False, "allow_null": True, "allow_blank": True},
            "ToolName": {"required": True, "allow_blank": False},
            "BatchId": {"required": False, "allow_blank": True},
            "User": {"required": False, "allow_null": True, "allow_blank": True},
            "DateOfGiving": {"required": False, "allow_null": True},
            "ExpiryDate": {"required": False, "allow_null": True},
            "Detail": {"required": False, "allow_null": True, "allow_blank": True},
            "Pieces": {"required": False, "allow_null": True},
            "MainLocation": {"required": False, "allow_null": True, "allow_blank": True},
            "Provider": {"required": False, "allow_null": True, "allow_blank": True},
            "SourceInventoryNumber": {"required": False, "allow_null": True},
            "Category": {"required": False, "allow_null": True, "allow_blank": True},
            "Brand": {"required": False, "allow_null": True, "allow_blank": True},
            "Model": {"required": False, "allow_null": True, "allow_blank": True},
            "SerialNumber": {"required": False, "allow_null": True, "allow_blank": True},
            "SourceStatus": {"required": False, "allow_null": True, "allow_blank": True},
            "RequiresVerification": {"required": False},
            "SourcePhoto": {"required": False, "allow_null": True, "allow_blank": True},
            "RfidTag": {"required": False, "allow_null": True, "allow_blank": True},
            "IsSSM": {"required": False},
            "Status": {"required": False},
            "IsReturned": {"required": False},
            "IsLost": {"required": False},
            "DateReturned": {"required": False, "allow_null": True},
            "DateLost": {"required": False, "allow_null": True},
        }

    def get_AssignedUserName(self, obj):
        return obj.AssignedTo.UserName if obj.AssignedTo else None

    def get_AssignedPersonType(self, obj):
        return obj.AssignedTo.person_type if obj.AssignedTo else None

    def get_AssignedPersonTypeLabel(self, obj):
        return obj.AssignedTo.get_person_type_display() if obj.AssignedTo else None

    def _assigned_team(self, obj):
        if not obj.AssignedTo_id:
            return None
        if obj.AssignedTo.person_type != Users.PersonType.EMPLOYEE:
            return None

        cache_key = "_tool_serializer_assigned_team"
        if hasattr(obj, cache_key):
            return getattr(obj, cache_key)

        memberships = sorted(
            (
                membership
                for membership in obj.AssignedTo.team_memberships.all()
                if membership.active and membership.team.active
            ),
            key=lambda membership: (membership.team.name, membership.id),
        )
        led_teams = sorted(
            (team for team in obj.AssignedTo.led_employee_teams.all() if team.active),
            key=lambda team: (team.name, team.id),
        )
        team = memberships[0].team if memberships else (led_teams[0] if led_teams else None)
        setattr(obj, cache_key, team)
        return team

    def get_AssignedTeamId(self, obj):
        team = self._assigned_team(obj)
        return team.id if team else None

    def get_AssignedTeamName(self, obj):
        team = self._assigned_team(obj)
        return team.name if team else None

    def get_Location(self, obj):
        return obj.MainLocation

    def get_DateReceived(self, obj):
        return obj.DateOfGiving

    def get_StatusLabel(self, obj):
        return obj.get_Status_display()

    def get_DisplaySerie(self, obj):
        serie = str(obj.ToolSerie or "").strip()
        if serie:
            return serie

        serial_number = str(getattr(obj, "SerialNumber", "") or "").strip()
        if serial_number:
            return serial_number

        batch_id = str(getattr(obj, "BatchId", "") or "").strip()
        if not batch_id:
            return None

        batch_tool = (
            Tools.objects
            .filter(BatchId=batch_id)
            .exclude(ToolSerie__isnull=True)
            .exclude(ToolSerie__exact="")
            .order_by("AssignedTo_id", "ToolId")
            .first()
        )
        return batch_tool.ToolSerie if batch_tool else None

    def to_internal_value(self, data):
        mutable = data.copy()

        if "Location" in mutable and "MainLocation" not in mutable:
            mutable["MainLocation"] = mutable.get("Location")

        if "DateReceived" in mutable and "DateOfGiving" not in mutable:
            mutable["DateOfGiving"] = mutable.get("DateReceived")

        for key in ("AssignedUserId", "DateOfGiving", "DateReceived", "ExpiryDate", "DateReturned", "DateLost", "ToolSerie", "RfidTag"):
            if mutable.get(key) == "":
                mutable[key] = None

        return super().to_internal_value(mutable)

    def validate_Status(self, value):
        normalized = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
        aliases = {
            "in_lucru": Tools.ToolStatus.IN_LUCRU,
            "lucru": Tools.ToolStatus.IN_LUCRU,
            "inlucru": Tools.ToolStatus.IN_LUCRU,
            "functionala": Tools.ToolStatus.FUNCTIONALA,
            "functional": Tools.ToolStatus.FUNCTIONALA,
            "magazie": Tools.ToolStatus.FUNCTIONALA,
            "in_magazie": Tools.ToolStatus.FUNCTIONALA,
            "nefunctionala": Tools.ToolStatus.NEFUNCTIONALA,
            "nefunctional": Tools.ToolStatus.NEFUNCTIONALA,
            "defect": Tools.ToolStatus.NEFUNCTIONALA,
            "defecta": Tools.ToolStatus.NEFUNCTIONALA,
            "stricata": Tools.ToolStatus.NEFUNCTIONALA,
            "stricat": Tools.ToolStatus.NEFUNCTIONALA,
        }
        if normalized in aliases:
            return aliases[normalized]
        raise serializers.ValidationError("Valori permise: functionala, nefunctionala, in_lucru.")

    def validate_Pieces(self, value):
        if value in (None, ""):
            return value
        if int(value) < 1:
            raise serializers.ValidationError("Numarul de bucati trebuie sa fie cel putin 1.")
        return int(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance is None and not attrs.get("ToolSerie"):
            attrs["ToolSerie"] = f"TOOL-{uuid.uuid4().hex[:10].upper()}"
        elif "ToolSerie" in attrs and not attrs.get("ToolSerie"):
            attrs.pop("ToolSerie")

        if self.instance is None and not attrs.get("BatchId"):
            attrs["BatchId"] = f"TOOLBATCH-{uuid.uuid4().hex[:12].upper()}"

        if attrs.get("IsLost"):
            attrs["IsReturned"] = False

        if attrs.get("IsReturned"):
            attrs["IsLost"] = False

        assigned = attrs.get("AssignedTo")
        if "AssignedTo" in attrs:
            attrs["User"] = assigned.UserName if assigned else None

        status = attrs.get("Status")
        if "Status" not in attrs and (self.instance is None or "AssignedTo" in attrs):
            status = Tools.ToolStatus.IN_LUCRU if assigned else Tools.ToolStatus.FUNCTIONALA
            attrs["Status"] = status
        if status == Tools.ToolStatus.FUNCTIONALA and not attrs.get("MainLocation"):
            attrs["MainLocation"] = "Magazie"
        elif status == Tools.ToolStatus.IN_LUCRU and assigned and not attrs.get("MainLocation"):
            attrs["MainLocation"] = assigned.UserName

        if (self.instance is None or "Pieces" in attrs) and attrs.get("Pieces") in (None, ""):
            attrs["Pieces"] = 1

        return attrs


# -------------------- HISTORIES --------------------
# serializers.py
from rest_framework import serializers
from django.utils import timezone
from ToolApp.models import Histories, Users, Tools

class HistorySerializer(serializers.ModelSerializer):
    # input pe serii (nu pe ID/FK)
    user_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tool_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)
    issued_by_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # câmpuri read-only utile în răspuns
    user = serializers.SerializerMethodField(read_only=True)
    tool = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Histories
        fields = (
            "HistoryId",
            "timestamp",
            "direction",
            "quantity",
            "note",
            "user_fk", "tool_fk", "issued_by",
            "user", "tool",
            # input pe serie:
            "user_serie", "tool_serie", "issued_by_serie",
            # legacy (read-only pt UI vechi)
            "User", "Tool", "DateOfGiving", "ToolSerie", "GiveRecive", "Pieces",
        )
        read_only_fields = (
            "HistoryId", "timestamp", "user", "tool",
            "User", "Tool", "DateOfGiving", "ToolSerie", "GiveRecive", "Pieces",
        )

    def get_user(self, obj):
        if obj.user_fk:
            return {
                "UserId": obj.user_fk.UserId,
                "UserName": obj.user_fk.UserName,
                "UserSerie": obj.user_fk.UserSerie,
                "person_type": obj.user_fk.person_type,
                "person_type_label": obj.user_fk.get_person_type_display(),
            }
        return None

    def get_tool(self, obj):
        if obj.tool_fk:
            return {
                "ToolId": obj.tool_fk.ToolId,
                "ToolName": obj.tool_fk.ToolName,
                "ToolSerie": obj.tool_fk.ToolSerie,
            }
        return None

    def validate(self, attrs):
        # combin ce a venit brut cu attrs ca să pot citi *serie* și să setez FK-urile
        data = {**getattr(self, "initial_data", {}), **attrs}

        # mapăm SERIE → FK (user)
        if not attrs.get("user_fk"):
            us = (data.get("user_serie") or "").strip()
            if us:
                try:
                    attrs["user_fk"] = Users.objects.get(UserSerie=us)
                except Users.DoesNotExist:
                    raise serializers.ValidationError({"user_serie": f"User cu seria '{us}' nu există."})

        # mapăm SERIE → FK (tool)
        if not attrs.get("tool_fk"):
            ts = (data.get("tool_serie") or "").strip()
            if ts:
                try:
                    attrs["tool_fk"] = Tools.objects.get(ToolSerie=ts)
                except Tools.DoesNotExist:
                    raise serializers.ValidationError({"tool_serie": f"Unealtă cu seria '{ts}' nu există."})

        # mapăm SERIE → FK (issued_by)
        if not attrs.get("issued_by"):
            ibs = (data.get("issued_by_serie") or "").strip()
            if ibs:
                try:
                    attrs["issued_by"] = Users.objects.get(UserSerie=ibs)
                except Users.DoesNotExist:
                    raise serializers.ValidationError({"issued_by_serie": f"User (issued_by) cu seria '{ibs}' nu există."})

        # quantity implicit
        attrs["quantity"] = int(attrs.get("quantity", 1) or 1)

        # direcție validă
        d = (attrs.get("direction") or "").upper()
        if d not in ("OUT", "IN", "ADJ"):
            raise serializers.ValidationError({"direction": "Valori permise: OUT / IN / ADJ"})
        attrs["direction"] = d

        return attrs

    # utilitar: elimină câmpurile virtuale înainte de create/update
    def _strip_virtual(self, d: dict):
        d.pop("user_serie", None)
        d.pop("tool_serie", None)
        d.pop("issued_by_serie", None)
        return d

    def create(self, validated_data):
        vd = self._strip_virtual(validated_data.copy())
        obj = Histories.objects.create(**vd)

        # --- completez câmpurile legacy pt compat cu UI existent ---
        obj.User = obj.user_fk.UserName if obj.user_fk else None
        obj.Tool = obj.tool_fk.ToolName if obj.tool_fk else None
        obj.ToolSerie = obj.tool_fk.ToolSerie if obj.tool_fk else None
        obj.DateOfGiving = timezone.localtime(obj.timestamp).date()
        obj.GiveRecive = (
            "a luat" if obj.direction == "OUT"
            else "a adus" if obj.direction == "IN"
            else "ajustare"
        )
        obj.Pieces = float(obj.quantity or 1)
        obj.save(update_fields=["User", "Tool", "ToolSerie", "DateOfGiving", "GiveRecive", "Pieces"])
        return obj

    def update(self, instance, validated_data):
        vd = self._strip_virtual(validated_data.copy())
        return super().update(instance, vd)






# -------------------- MATERIALS --------------------
class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materials
        fields = (
            "MaterialId",
            "MaterialName",
            "Quantity",
            "Amount",
            "MaterialLocation",
            "Provider",
            "DateOfGiving",
            "OneUnity",
            "UnityOfMesurment",
            "TypeOfUnityOfMesurment",
        )


# -------------------- CONSUMABLES --------------------
class ConsumableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consumables
        fields = (
            "ConsumeId",
            "User",
            "Material",
            "MaterialSerie",
            "DateOfGiving",
            "MaterialAmount",
            "GiveRecive",
        )


# -------------------- SHED --------------------
class ShedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shed
        fields = (
            "ShedId",
            "ToolSerie",
            "ToolName",
            "User",
            "DateOfGiving",
            "Pin",
            "Status",
            "Pieces",
            "Provider",
            "Components",
            "Detail",
        )


# -------------------- WORKFIELD --------------------
class WorkFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkField
        fields = (
            "WorkFieldId",
            "ToolSerie",
            "ToolName",
            "User",
            "DateOfGiving",
            "Pin",
            "Status",
            "Pieces",
            "Provider",
            "Components",
            "Detail",
        )


# -------------------- UNFUNCTIONAL --------------------
class UnfunctionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unfunctional
        fields = (
            "UnfunctionalId",
            "ToolSerie",
            "ToolName",
            "Detail",
            "Service",
            "Status",
            "Pieces",
            "Provider",
            "Components",
        )


# -------------------- COFRAJE / SCHELĂ / ETC. --------------------
class CofrajMetalicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CofrajMetalics
        fields = ("CofrajMetalicId", "CofrajMetalicName", "CofrajMetalicCantitate", "Location")


class CofrajtTipDokaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CofrajtTipDokas
        fields = ("CofrajtTipDokaId", "CofrajtTipDokaName", "CofrajtTipDokaCantitate", "Location")


class PopiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Popis
        fields = ("PopiDokaId", "PopiName", "PopiCantitate", "Location")


class SchelaUsoaraSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaUsoaras
        fields = ("SchelaUsoaraId", "SchelaUsoaraName", "SchelaUsoaraCantitate", "Location")


class SchelaFatadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaFatadas
        fields = ("SchelaFatadaId", "SchelaFatadaName", "SchelaFatadaCantitate", "Location")


class SchelaFatadaModularaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaFatadaModularas
        fields = ("SchelaFatadaModularaId", "SchelaFatadaModularaName", "SchelaFatadaModularaCantitate", "Location")


class CombustibilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Combustibils
        fields = ("CombustibilId", "CombustibilName", "CombustibilCantitate")


class HistorieScheleSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorieScheles
        fields = ("HistoriesScheleId", "SchelaName", "UserName", "CombustibilCantitate", "DateSchela", "Directie")


class MijloaceFixeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MijloaceFixes
        fields = ("MijloaceFixeId", "MijloaceFixeName", "MijloaceFixeCantitate", "Location")



# nou:
class DailyPaySerializer(serializers.ModelSerializer):
    UserId = serializers.IntegerField(source='user_fk.UserId', read_only=True)
    UserName = serializers.CharField(source='user_fk.UserName', read_only=True)
    class Meta:
        model = DailyPay
        fields = ('UserId','UserName','work_date','total_seconds','hourly_rate_snapshot','day_pay')
