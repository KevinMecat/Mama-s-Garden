from typing import ClassVar

from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .authentication import CsrfEnforcedSessionAuthentication
from .serializers import LoginSerializer, UserSessionSerializer


@method_decorator(never_cache, name="dispatch")
@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    authentication_classes: ClassVar[list[type]] = []
    permission_classes: ClassVar[list[type]] = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(never_cache, name="dispatch")
@method_decorator(sensitive_post_parameters("password"), name="dispatch")
class LoginView(APIView):
    authentication_classes: ClassVar[list[type]] = [CsrfEnforcedSessionAuthentication]
    permission_classes: ClassVar[list[type]] = [AllowAny]
    throttle_classes: ClassVar[list[type]] = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        auth_login(request, user)

        return Response(
            {"user": UserSessionSerializer(user).data},
            status=status.HTTP_200_OK,
        )


@method_decorator(never_cache, name="dispatch")
class LogoutView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAuthenticated]

    def post(self, request):
        auth_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(never_cache, name="dispatch")
class CurrentUserView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserSessionSerializer(request.user).data})
