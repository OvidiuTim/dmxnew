# serializers.py
from rest_framework import serializers
from django.utils import timezone
from ToolApp.models import (
    Consumables, Materials, MijloaceFixes, Shed, Tools, Histories, Unfunctional,
    Users, WorkField, CofrajMetalics, CofrajtTipDokas, Popis, SchelaUsoaras,
    SchelaFatadas, SchelaFatadaModularas, Combustibils, HistorieScheles
)


# -------------------- USERS --------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = ("UserId", "UserName", "UserSerie", "UserPin", "NameAndSerie")


# -------------------- TOOLS --------------------
class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tools
        fields = (
            "ToolId",
            "ToolSerie",
            "ToolName",
            "User",           # legacy (read/write, dacă îl folosești încă)
            "DateOfGiving",   # legacy
            "Detail",
            "Pieces",
            "MainLocation",
            "Provider",
            "RfidTag",        # ← nou
        )


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
