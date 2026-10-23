from datetime import date

import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from modules.accounts.models import User

from .models import Project, ProjectMember


@pytest.mark.django_db
def test_project_rejects_end_date_before_start_date():
    project = Project(
        name="Proyecto inválido",
        type=Project.Type.INFRASTRUCTURE,
        start_date=date(2026, 9, 2),
        end_date=date(2026, 9, 1),
    )

    with pytest.raises(ValidationError):
        project.full_clean()


@pytest.mark.django_db
def test_administrator_can_create_and_list_projects():
    administrator = User.objects.create_superuser(
        email="admin-projects@example.com",
        password="una-clave-segura",
    )
    client = APIClient()
    client.force_authenticate(administrator)

    create_response = client.post(
        "/api/v1/projects/",
        {
            "name": "Lote Avícola - 1,000 aves",
            "description": "Ciclo productivo de prueba.",
            "type": Project.Type.POULTRY_PRODUCTION,
            "status": Project.Status.ACTIVE,
            "start_date": "2026-09-03",
            "end_date": None,
        },
        format="json",
    )

    assert create_response.status_code == 201
    assert create_response.json()["type_label"] == "Producción avícola"
    assert client.get("/api/v1/projects/").status_code == 200


@pytest.mark.django_db
def test_worker_only_sees_assigned_projects_and_cannot_create():
    worker = User.objects.create_user(
        email="worker-projects@example.com",
        password="una-clave-segura",
    )
    assigned = Project.objects.create(
        name="Proyecto asignado",
        type=Project.Type.CITRUS_CULTIVATION,
        status=Project.Status.ACTIVE,
    )
    Project.objects.create(
        name="Proyecto privado",
        type=Project.Type.INFRASTRUCTURE,
        status=Project.Status.ACTIVE,
    )
    ProjectMember.objects.create(project=assigned, user=worker)
    client = APIClient()
    client.force_authenticate(worker)

    list_response = client.get("/api/v1/projects/")
    create_response = client.post(
        "/api/v1/projects/",
        {"name": "No permitido", "type": Project.Type.ADMINISTRATION},
        format="json",
    )

    assert list_response.status_code == 200
    assert [project["name"] for project in list_response.json()] == ["Proyecto asignado"]
    assert create_response.status_code == 403
