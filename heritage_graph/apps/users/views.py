from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .serializers import UpdateUsernameSerializer


class UpdateUsernameView(generics.UpdateAPIView):
    serializer_class = UpdateUsernameSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

