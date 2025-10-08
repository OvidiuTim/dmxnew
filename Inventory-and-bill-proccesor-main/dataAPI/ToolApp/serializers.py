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
class HistorySerializer(serializers.ModelSerializer):
    # Read-only nested info (frumos în răspuns)
    user = UserSerializer(source="user_fk", read_only=True)
    tool = ToolSerializer(source="tool_fk", read_only=True)

    # Scriere alternativă pe serie sau ID (write-only)
    user_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tool_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)
    issued_by_serie = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Histories
        fields = (
            "HistoryId",

            # NOI (model nou)
            "user_fk",
            "tool_fk",
            "issued_by",
            "timestamp",
            "direction",
            "quantity",
            "note",

            # extra read-only pentru răspuns
            "user",
            "tool",

            # scriere alternativă (serie/ID)
            "user_serie",
            "tool_serie",
            "issued_by_serie",

            # Legacy (le expunem în continuare pentru UI vechi)
            "User",
            "Tool",
            "DateOfGiving",
            "ToolSerie",
            "GiveRecive",
            "Pieces",
        )
        read_only_fields = (
            # legacy le completăm în create/update, dar nu le cerem la input
            "User", "Tool", "DateOfGiving", "ToolSerie", "GiveRecive", "Pieces",
            # timestamp de obicei vine din default
        )

    # ---------- rezolvare entități ----------
    @staticmethod
    def _resolve_user(value):
        if value is None or value == "":
            return None
        # accept ID numeric (UserId) sau UserSerie
        if str(value).isdigit():
            try:
                return Users.objects.get(pk=int(value))
            except Users.DoesNotExist:
                raise serializers.ValidationError(f"User cu ID={value} nu există.")
        try:
            return Users.objects.get(UserSerie=value)
        except Users.DoesNotExist:
            raise serializers.ValidationError(f"User cu seria '{value}' nu există.")

    @staticmethod
    def _resolve_tool(value):
        if value is None or value == "":
            return None
        # accept ID numeric (ToolId) sau ToolSerie
        if str(value).isdigit():
            try:
                return Tools.objects.get(pk=int(value))
            except Tools.DoesNotExist:
                raise serializers.ValidationError(f"Unealtă cu ID={value} nu există.")
        try:
            return Tools.objects.get(ToolSerie=value)
        except Tools.DoesNotExist:
            raise serializers.ValidationError(f"Unealtă cu seria '{value}' nu există.")

    # ---------- validare & mapare input ----------
    def validate(self, attrs):
        data = self.initial_data or {}

        # Mapare legacy → nou (direction)
        if not attrs.get("direction") and data.get("GiveRecive"):
            gr = str(data.get("GiveRecive")).strip().upper()
            if gr.startswith(("OUT", "GIVE", "PRED")):
                attrs["direction"] = "OUT"
            elif gr.startswith(("IN", "RET", "INTR")):
                attrs["direction"] = "IN"
            else:
                attrs["direction"] = "ADJ"

        # Mapare legacy → nou (quantity)
        if not attrs.get("quantity") and data.get("Pieces") not in (None, ""):
            try:
                attrs["quantity"] = int(float(data.get("Pieces")))
            except Exception:
                attrs["quantity"] = 1
        attrs.setdefault("quantity", 1)

        # timestamp dacă vrei să permiți override din payload (altfel e default)
        if not attrs.get("timestamp") and data.get("DateOfGiving"):
            # folosim începutul zilei respective ca timestamp
            try:
                # Dacă ajunge aici un string "YYYY-MM-DD"
                dt = timezone.datetime.fromisoformat(str(data["DateOfGiving"]))
                if dt.tzinfo is None:
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                attrs["timestamp"] = dt
            except Exception:
                # lăsăm default-ul modelului
                pass

        # Rezolvare FK-uri din *serie* sau ID, dacă nu sunt deja setate
        if not attrs.get("tool_fk") and data.get("tool_serie"):
            attrs["tool_fk"] = self._resolve_tool(data.get("tool_serie"))
        if not attrs.get("user_fk") and data.get("user_serie"):
            attrs["user_fk"] = self._resolve_user(data.get("user_serie"))
        if not attrs.get("issued_by") and data.get("issued_by_serie"):
            attrs["issued_by"] = self._resolve_user(data.get("issued_by_serie"))

        # Validări minime
        if not attrs.get("tool_fk"):
            raise serializers.ValidationError("tool_fk sau tool_serie este obligatoriu.")
        if not attrs.get("user_fk"):
            raise serializers.ValidationError("user_fk sau user_serie este obligatoriu.")

        # direction default OUT
        attrs.setdefault("direction", "OUT")

        return attrs

    # ---------- create/update: menținem compatibilitatea cu legacy ----------
    def _fill_legacy_fields(self, instance):
        """
        Completează câmpurile legacy din instanță pe baza noilor câmpuri,
        ca UI-ul vechi să continue să vadă informațiile.
        """
        # User, Tool, ToolSerie, GiveRecive, Pieces, DateOfGiving
        if instance.user_fk and not instance.User:
            instance.User = instance.user_fk.UserName
        if instance.tool_fk:
            if not instance.Tool:
                instance.Tool = instance.tool_fk.ToolName
            if not instance.ToolSerie:
                instance.ToolSerie = instance.tool_fk.ToolSerie

        # Mapare direction -> GiveRecive
        if not instance.GiveRecive and instance.direction:
            instance.GiveRecive = instance.direction

        # quantity -> Pieces
        if instance.Pieces in (None, ""):
            instance.Pieces = float(instance.quantity or 1)

        # timestamp -> DateOfGiving (doar data)
        try:
            if not instance.DateOfGiving and instance.timestamp:
                instance.DateOfGiving = instance.timestamp.date()
        except Exception:
            pass

        instance.save(update_fields=["User", "Tool", "ToolSerie", "GiveRecive", "Pieces", "DateOfGiving"])

    def create(self, validated_data):
        obj = super().create(validated_data)
        # completează câmpurile legacy pentru compatibilitate cu UI existent
        self._fill_legacy_fields(obj)
        return obj

    def update(self, instance, validated_data):
        obj = super().update(instance, validated_data)
        self._fill_legacy_fields(obj)
        return obj


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
