from rest_framework import serializers


class TeamWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    leader_id = serializers.IntegerField(min_value=1)
    default_worksite = serializers.CharField(max_length=160, allow_blank=True, required=False, default="")
    active = serializers.BooleanField(required=False, default=True)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
        required=False,
        default=list,
    )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Denumirea echipei este obligatorie.")
        return value

    def validate_member_ids(self, value):
        return list(dict.fromkeys(value))


class TeamMembersSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=("add", "remove"))


class TemporaryWorkerRequestWriteSerializer(serializers.Serializer):
    requester_team_id = serializers.IntegerField(min_value=1)
    employee_id = serializers.IntegerField(min_value=1)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "Data finală nu poate fi înaintea datei de început."})
        attrs["reason"] = attrs.get("reason", "").strip()
        return attrs


class TemporaryWorkerRequestActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject", "cancel"))
