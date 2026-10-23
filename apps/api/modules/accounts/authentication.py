from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """Exige CSRF incluso cuando la solicitud aun no tiene una sesion autenticada."""

    def authenticate(self, request):
        result = super().authenticate(request)

        if result is None:
            self.enforce_csrf(request)

        return result
