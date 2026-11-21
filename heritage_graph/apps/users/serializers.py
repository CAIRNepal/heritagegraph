import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
USERNAME_MIN = 3
USERNAME_MAX = 30


class UpdateUsernameSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username"]

    def validate_username(self, value):
        value = (value or "").strip().lower()
        if not value:
            raise serializers.ValidationError("Username cannot be empty.")
        if len(value) < USERNAME_MIN:
            raise serializers.ValidationError(
                f"Username must be at least {USERNAME_MIN} characters."
            )
        if len(value) > USERNAME_MAX:
            raise serializers.ValidationError(
                f"Username must be at most {USERNAME_MAX} characters."
            )
        if not USERNAME_RE.match(value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, underscores, and dashes."
            )
        qs = User.objects.exclude(pk=self.instance.pk).filter(username=value)
        if qs.exists():
            raise serializers.ValidationError("Username already taken.")
        return value

