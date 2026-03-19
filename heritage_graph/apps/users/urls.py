from django.urls import path

from .views import UpdateUsernameView


urlpatterns = [
    path("username/", UpdateUsernameView.as_view(), name="update-username"),
]

