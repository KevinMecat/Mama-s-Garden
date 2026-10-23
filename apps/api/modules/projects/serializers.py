from rest_framework import serializers

from .models import Project, ProjectMember


class ProjectMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = ("id", "user", "email", "full_name", "created_at")
        read_only_fields = ("id", "email", "full_name", "created_at")

    def get_full_name(self, instance):
        return instance.user.get_full_name().strip() or instance.user.email


class ProjectSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "code",
            "name",
            "description",
            "type",
            "type_label",
            "status",
            "status_label",
            "start_date",
            "end_date",
            "member_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "code",
            "type_label",
            "status_label",
            "member_count",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "La fecha de finalización no puede ser anterior al inicio."}
            )

        return attrs

    def get_member_count(self, instance) -> int:
        annotated_count = getattr(instance, "member_count", None)
        if annotated_count is not None:
            return annotated_count
        return instance.memberships.count()
