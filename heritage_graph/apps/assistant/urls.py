from django.urls import path

from . import views

urlpatterns = [
    path("chat/", views.chat_completion, name="assistant-chat"),
]
