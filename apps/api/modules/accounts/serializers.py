from typing import ClassVar

from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User


class UserSessionSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "role", "role_label")
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    default_error_messages: ClassVar[dict[str, str]] = {
        "invalid_credentials": "El correo o la contrasena no son correctos.",
    }

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"],
            password=attrs["password"],
        )

        if user is None:
            self.fail("invalid_credentials")

        attrs["user"] = user
        return attrs
