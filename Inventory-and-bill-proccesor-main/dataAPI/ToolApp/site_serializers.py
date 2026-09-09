from decimal import Decimal
from math import isfinite

from rest_framework import serializers

from ToolApp.models import ConstructionSite, SiteExpense
from ToolApp.worksites import normalize_worksite, InvalidWorksite


class SiteWriteSerializer(serializers.ModelSerializer):
    points = serializers.ListField(child=serializers.CharField(max_length=100), required=False)
    version = serializers.IntegerField(min_value=1, required=False)
    latitude = serializers.FloatField(min_value=-90, max_value=90, allow_null=True, required=False)
    longitude = serializers.FloatField(min_value=-180, max_value=180, allow_null=True, required=False)
    budget = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, allow_null=True, required=False)
    notes = serializers.CharField(max_length=10000, allow_blank=True, required=False)

    class Meta:
        model = ConstructionSite
        fields = ["code", "name", "status", "client", "manager", "address", "latitude", "longitude", "start_date", "end_date", "budget", "notes", "points", "version"]

    def validate_code(self, value):
        value = value.strip().upper()
        query = ConstructionSite.objects.filter(code__iexact=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("Codul este deja folosit.")
        return value

    def validate_points(self, values):
        try:
            return list(dict.fromkeys(normalize_worksite(value) for value in values))
        except InvalidWorksite as exc:
            raise serializers.ValidationError(str(exc))

    def validate(self, attrs):
        def value(key):
            return attrs.get(key, getattr(self.instance, key, None))
        for key in ("latitude", "longitude"):
            if value(key) is not None and not isfinite(value(key)):
                raise serializers.ValidationError({key: "Coordonata trebuie să fie un număr finit."})
        if value("start_date") and value("end_date") and value("start_date") > value("end_date"):
            raise serializers.ValidationError({"end_date": "Data finală trebuie să fie după data de început."})
        if (value("latitude") is None) != (value("longitude") is None):
            raise serializers.ValidationError({"latitude": "Completează ambele coordonate sau lasă-le goale."})
        return attrs


class ExpenseWriteSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    request_id = serializers.UUIDField()
    notes = serializers.CharField(max_length=10000, allow_blank=True, required=False)

    class Meta:
        model = SiteExpense
        fields = ["date", "category", "description", "supplier", "reference", "amount", "notes", "request_id"]
