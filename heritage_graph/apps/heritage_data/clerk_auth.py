# middleware.py
import os
from datetime import datetime

import jwt
import pytz
import requests
from django.contrib.auth.models import User
from django.core.cache import cache
from dotenv import load_dotenv
from jwt.algorithms import RSAAlgorithm
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import UserProfile

load_dotenv()

CLERK_API_URL = "https://api.clerk.com/v1"
CLERK_FRONTEND_API_URL = os.getenv("CLERK_FRONTEND_API_URL")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CACHE_KEY = "jwks_data"


class JWTAuthenticationMiddleware(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        try:
            token = auth_header.split(" ")[1]
        except IndexError:
            raise AuthenticationFailed("Bearer token not provided.")

        # 1. Decode JWT to get Clerk user ID
        payload = self.decode_jwt(token)
        user_id = payload.get("sub")
        if not user_id:
            return None

        # 2. Fetch user info from Clerk
        clerk = ClerkSDK()
        info, found = clerk.fetch_user_info(user_id)

        # 3. Determine Django username
        django_username = payload.get("username")
        user_id = payload.get("sub")  #

        # 4. Get or create Django user
        user, created = User.objects.get_or_create(username=django_username)
        profile, profile_created = UserProfile.objects.get_or_create(user=user)
        profile.clerk_user_id = payload.get("sub")
        profile.first_name = payload.get("first_name", profile.first_name)
        profile.last_name = payload.get("last_name", profile.last_name)
        profile.email = payload.get("email", profile.email)
        profile.save()

        # 5. Update user info if found
        if found:
            user.email = info["email_address"]
            user.first_name = info["first_name"]
            user.last_name = info["last_name"]
            user.last_login = info["last_login"]
            user.save()

        return user, None

    def decode_jwt(self, token):
        clerk = ClerkSDK()
        jwks_data = clerk.get_jwks()
        public_key = RSAAlgorithm.from_jwk(jwks_data["keys"][0])
        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                options={"verify_signature": True},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired.")
        except jwt.DecodeError:
            raise AuthenticationFailed("Token decode error.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Invalid token.")

        return payload


class ClerkSDK:
    def fetch_user_info(self, user_id: str):
        response = requests.get(
            f"{CLERK_API_URL}/users/{user_id}",
            headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
        )
        if response.status_code == 200:
            data = response.json()

            return {
                "data": data,
                "user_name": data["username"],
                "email_address": data["email_addresses"][0]["email_address"],
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "last_login": datetime.fromtimestamp(
                    data["last_sign_in_at"] / 1000, tz=pytz.UTC
                ),
            }, True
        else:
            return {
                "email_address": "",
                "first_name": "",
                "last_name": "",
                "last_login": None,
            }, False

    def get_jwks(self):
        jwks_data = cache.get(CACHE_KEY)
        if not jwks_data:
            response = requests.get(f"{CLERK_FRONTEND_API_URL}/.well-known/jwks.json")
            if response.status_code == 200:
                jwks_data = response.json()
                cache.set(CACHE_KEY, jwks_data)  # cache indefinitely
            else:
                raise AuthenticationFailed("Failed to fetch JWKS.")
        return jwks_data
