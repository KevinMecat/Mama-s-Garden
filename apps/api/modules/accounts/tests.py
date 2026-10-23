import pytest
from django.test import Client

from .models import User


@pytest.mark.django_db
def test_user_uses_email_as_identifier():
    user = User.objects.create_user(
        email="trabajador@example.com",
        password="una-clave-segura",
    )

    assert user.username is None
    assert user.email == "trabajador@example.com"
    assert user.check_password("una-clave-segura")


@pytest.mark.django_db
def test_superuser_has_admin_flags():
    user = User.objects.create_superuser(
        email="admin@example.com",
        password="otra-clave-segura",
    )

    assert user.is_active
    assert user.is_staff
    assert user.is_superuser
    assert user.role == User.Role.ADMINISTRATOR


@pytest.mark.django_db
def test_regular_user_defaults_to_worker_role():
    user = User.objects.create_user(
        email="campo@example.com",
        password="una-clave-segura",
    )

    assert user.role == User.Role.WORKER
    assert not user.is_administrator


@pytest.mark.django_db
def test_login_requires_csrf_token():
    User.objects.create_user(
        email="trabajador@example.com",
        password="una-clave-segura",
    )
    browser = Client(enforce_csrf_checks=True)

    response = browser.post(
        "/api/v1/auth/login/",
        data={
            "email": "trabajador@example.com",
            "password": "una-clave-segura",
        },
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_session_login_me_and_logout_flow():
    user = User.objects.create_superuser(
        email="admin@example.com",
        password="una-clave-segura",
    )
    browser = Client(enforce_csrf_checks=True)

    csrf_response = browser.get("/api/v1/auth/csrf/")
    csrf_token = csrf_response.json()["csrfToken"]
    login_response = browser.post(
        "/api/v1/auth/login/",
        data={"email": user.email, "password": "una-clave-segura"},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert login_response.status_code == 200
    assert login_response.json()["user"]["role"] == User.Role.ADMINISTRATOR
    assert login_response.cookies["finca_sessionid"]["httponly"] is True

    me_response = browser.get("/api/v1/auth/me/")
    assert me_response.status_code == 200
    assert me_response.json()["user"]["email"] == user.email

    refreshed_csrf_token = browser.get("/api/v1/auth/csrf/").json()["csrfToken"]
    logout_response = browser.post(
        "/api/v1/auth/logout/",
        HTTP_X_CSRFTOKEN=refreshed_csrf_token,
    )

    assert logout_response.status_code == 204
    assert browser.get("/api/v1/auth/me/").status_code in {401, 403}
