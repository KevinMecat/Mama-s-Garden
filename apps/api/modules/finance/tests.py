import base64
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from modules.accounts.models import User
from modules.projects.models import Project, ProjectMember

from .models import FinancialCategory, Transaction, TransactionAttachment

TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.fixture
def finance_setup():
    admin = User.objects.create_superuser(
        email="finance-admin@example.com",
        password="una-clave-segura",
    )
    worker = User.objects.create_user(
        email="finance-worker@example.com",
        password="una-clave-segura",
    )
    project = Project.objects.create(
        name="Proyecto financiero",
        type=Project.Type.POULTRY_PRODUCTION,
        status=Project.Status.ACTIVE,
    )
    category = FinancialCategory.objects.create(name="Alimento de prueba")
    ProjectMember.objects.create(project=project, user=worker)
    return admin, worker, project, category


@pytest.mark.django_db
def test_worker_can_only_create_draft_in_assigned_project(finance_setup):
    _, worker, project, category = finance_setup
    client = APIClient()
    client.force_authenticate(worker)
    payload = {
        "project": project.id,
        "category": category.id,
        "type": Transaction.Type.EXPENSE,
        "amount": "125.50",
        "transaction_date": "2026-09-03",
        "description": "Compra de alimento",
    }

    draft_response = client.post("/api/v1/finance/transactions/", payload, format="json")
    posted_response = client.post(
        "/api/v1/finance/transactions/",
        {**payload, "status": Transaction.Status.POSTED},
        format="json",
    )

    assert draft_response.status_code == 201
    assert draft_response.json()["status"] == Transaction.Status.DRAFT
    assert posted_response.status_code == 400

    transaction_id = draft_response.json()["id"]
    promote_response = client.patch(
        f"/api/v1/finance/transactions/{transaction_id}/",
        {"status": Transaction.Status.POSTED},
        format="json",
    )
    assert promote_response.status_code == 400


@pytest.mark.django_db
def test_worker_cannot_create_transaction_in_unassigned_project(finance_setup):
    _, worker, _, category = finance_setup
    private_project = Project.objects.create(
        name="Proyecto sin asignar",
        type=Project.Type.INFRASTRUCTURE,
        status=Project.Status.ACTIVE,
    )
    client = APIClient()
    client.force_authenticate(worker)

    response = client.post(
        "/api/v1/finance/transactions/",
        {
            "project": private_project.id,
            "category": category.id,
            "type": Transaction.Type.INVESTMENT,
            "amount": "500.00",
            "transaction_date": "2026-09-03",
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_can_create_posted_transaction(finance_setup):
    admin, _, project, category = finance_setup
    client = APIClient()
    client.force_authenticate(admin)

    response = client.post(
        "/api/v1/finance/transactions/",
        {
            "project": project.id,
            "category": category.id,
            "type": Transaction.Type.INVESTMENT,
            "status": Transaction.Status.POSTED,
            "amount": "2500.00",
            "transaction_date": "2026-09-03",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["status"] == Transaction.Status.POSTED


@pytest.mark.django_db
def test_only_admin_can_manage_financial_categories(finance_setup):
    admin, worker, _, _ = finance_setup
    client = APIClient()
    client.force_authenticate(worker)
    denied_response = client.post(
        "/api/v1/finance/categories/",
        {"name": "Categoría restringida"},
        format="json",
    )

    client.force_authenticate(admin)
    create_response = client.post(
        "/api/v1/finance/categories/",
        {"name": "Combustible"},
        format="json",
    )
    category_id = create_response.json()["id"]
    update_response = client.patch(
        f"/api/v1/finance/categories/{category_id}/",
        {"description": "Diésel y gasolina"},
        format="json",
    )
    delete_response = client.delete(f"/api/v1/finance/categories/{category_id}/")

    assert denied_response.status_code == 403
    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_multipart_transaction_creates_optional_receipt(finance_setup, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    admin, _, project, category = finance_setup
    client = APIClient()
    client.force_authenticate(admin)
    receipt = SimpleUploadedFile("factura.png", TINY_PNG, content_type="image/png")

    response = client.post(
        "/api/v1/finance/transactions/",
        {
            "project": project.id,
            "category": category.id,
            "type": Transaction.Type.EXPENSE,
            "status": Transaction.Status.POSTED,
            "amount": "389.75",
            "transaction_date": "2026-09-03",
            "description": "Factura con fotografía",
            "receipt": receipt,
        },
        format="multipart",
    )

    assert response.status_code == 201
    transaction_record = Transaction.objects.get(pk=response.json()["id"])
    attachment = TransactionAttachment.objects.get(transaction=transaction_record)
    assert attachment.original_name == "factura.png"
    assert attachment.file.storage.exists(attachment.file.name)
    assert response.json()["attachments"][0]["file_url"].startswith("/media/")


@pytest.mark.django_db
def test_standalone_attachment_endpoint_accepts_multipart(finance_setup, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    admin, _, project, category = finance_setup
    transaction_record = Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.EXPENSE,
        status=Transaction.Status.DRAFT,
        amount=Decimal("49.99"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    client = APIClient()
    client.force_authenticate(admin)

    create_response = client.post(
        "/api/v1/finance/attachments/",
        {
            "transaction": transaction_record.id,
            "file": SimpleUploadedFile(
                "comprobante.png",
                TINY_PNG,
                content_type="image/png",
            ),
        },
        format="multipart",
    )
    assert create_response.status_code == 201
    attachment_id = create_response.json()["id"]
    delete_response = client.delete(f"/api/v1/finance/attachments/{attachment_id}/")

    assert create_response.json()["file_url"].startswith("/media/")
    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_transactions_can_be_filtered(finance_setup):
    admin, _, project, category = finance_setup
    Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.EXPENSE,
        status=Transaction.Status.DRAFT,
        amount=Decimal("10.00"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.INVESTMENT,
        status=Transaction.Status.POSTED,
        amount=Decimal("20.00"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    client = APIClient()
    client.force_authenticate(admin)

    response = client.get("/api/v1/finance/transactions/?status=POSTED&type=INVESTMENT")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["amount"] == "20.00"
