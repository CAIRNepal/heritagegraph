from __future__ import annotations

from rest_framework import serializers


class ChatMessageInSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant", "system"])
    content = serializers.CharField(
        max_length=16_000, allow_blank=False, trim_whitespace=True
    )


class ChatCompletionRequestSerializer(serializers.Serializer):
    messages = ChatMessageInSerializer(many=True)
    # JSON key is `context`; field name avoids clashing with DRF `Serializer.context`.
    client_context = serializers.DictField(
        child=serializers.CharField(allow_blank=True, required=False),
        required=False,
        source="context",
    )
    maxContextEntities = serializers.IntegerField(
        min_value=1,
        max_value=50,
        required=False,
        default=12,
        source="maxContextEntities",
    )

    def validate_messages(self, value: list) -> list:
        if not value:
            message = "At least one message is required."
            raise serializers.ValidationError(message)
        return value
