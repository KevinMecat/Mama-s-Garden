from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.accounts.models import User
from modules.finance.models import FinancialCategory, Transaction
from modules.projects.models import Project, ProjectMember

from .models import Product, ProductionRecord, Sale


@pytest.fixture
def production_setup():
    admin = User.objects.create_superuser(
        email="production-admin@example.com",
        password="una-clave-segura",
    )
    worker = User.objects.create_user(
        email="production-worker@example.com",
        password="una-clave-segura",
    )
    project = Project.objects.create(
        name="Proyecto de prueba aislada",
        type=Project.Type.POULTRY_PRODUCTION,
        status=Project.Status.ACTIVE,
    )
    product = Product.objects.create(name="Producto de prueba", unit_of_measure="unidades")
    category = FinancialCategory.objects.create(name="Ventas de prueba")
    ProjectMember.objects.create(project=project, user=worker)
    return admin, worker, project, product, category


@pytest.mark.django_db
def test_product_crud_is_complete_and_admin_only(production_setup):
    admin, worker, *_ = production_setup
    client = APIClient()
    client.force_authenticate(worker)
    assert (
        client.post(
            "/api/v1/production/products/",
            {"name": "No permitido", "unit_of_measure": "libras"},
            format="json",
        ).status_code
        == 403
    )

    client.force_authenticate(admin)
    create_response = client.post(
        "/api/v1/production/products/",
        {"name": "Producto gestionado", "unit_of_measure": "libras"},
        format="json",
    )
    product_id = create_response.json()["id"]
    update_response = client.patch(
        f"/api/v1/production/products/{product_id}/",
        {"unit_of_measure": "quintales", "is_active": False},
        format="json",
    )
    delete_response = client.delete(f"/api/v1/production/products/{product_id}/")

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert update_response.json()["unit_of_measure"] == "quintales"
    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_production_record_crud(production_setup):
    admin, _, project, product, _ = production_setup
    client = APIClient()
    client.force_authenticate(admin)
    create_response = client.post(
        "/api/v1/production/records/",
        {
            "project": project.id,
            "product": product.id,
            "production_date": "2026-09-03",
            "quantity": "100.500",
            "notes": "Registro inicial",
        },
        format="json",
    )
    record_id = create_response.json()["id"]
    update_response = client.patch(
        f"/api/v1/production/records/{record_id}/",
        {"quantity": "125.250", "notes": "Cantidad corregida"},
        format="json",
    )
    delete_response = client.delete(f"/api/v1/production/records/{record_id}/")

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert update_response.json()["quantity"] == "125.250"
    assert delete_response.status_code == 204
    assert not ProductionRecord.objects.filter(pk=record_id).exists()


@pytest.mark.django_db
def test_sale_crud_keeps_income_transaction_in_sync(production_setup):
    admin, _, project, product, category = production_setup
    client = APIClient()
    client.force_authenticate(admin)
    create_response = client.post(
        "/api/v1/production/sales/",
        {
            "project": project.id,
            "product": product.id,
            "category": category.id,
            "sale_date": "2026-09-03",
            "quantity": "10.000",
            "unit_price": "12.55",
            "customer": "Cliente inicial",
            "status": Transaction.Status.POSTED,
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.json()
    sale_id = create_response.json()["id"]
    transaction_id = create_response.json()["transaction"]
    linked_transaction = Transaction.objects.get(pk=transaction_id)
    assert linked_transaction.type == Transaction.Type.INCOME
    assert linked_transaction.amount == Decimal("125.50")

    update_response = client.patch(
        f"/api/v1/production/sales/{sale_id}/",
        {
            "quantity": "12.000",
            "unit_price": "13.25",
            "customer": "Cliente corregido",
            "status": Transaction.Status.VOID,
        },
        format="json",
    )
    linked_transaction.refresh_from_db()
    assert update_response.status_code == 200, update_response.json()
    assert update_response.json()["total_amount"] == "159.00"
    assert linked_transaction.amount == Decimal("159.00")
    assert linked_transaction.status == Transaction.Status.VOID
    assert linked_transaction.supplier_or_customer == "Cliente corregido"

    delete_response = client.delete(f"/api/v1/production/sales/{sale_id}/")
    assert delete_response.status_code == 204
    assert not Sale.objects.filter(pk=sale_id).exists()
    assert not Transaction.objects.filter(pk=transaction_id).exists()


@pytest.mark.django_db
def test_worker_sale_is_always_a_draft(production_setup):
    _, worker, project, product, category = production_setup
    client = APIClient()
    client.force_authenticate(worker)
    payload = {
        "project": project.id,
        "product": product.id,
        "category": category.id,
        "sale_date": "2026-09-03",
        "quantity": "2.000",
        "unit_price": "20.00",
    }
    denied = client.post(
        "/api/v1/production/sales/",
        {**payload, "status": Transaction.Status.POSTED},
        format="json",
    )
    accepted = client.post("/api/v1/production/sales/", payload, format="json")

    assert denied.status_code == 400
    assert accepted.status_code == 201
    assert accepted.json()["status"] == Transaction.Status.DRAFT


@pytest.mark.django_db
def test_project_metrics_use_only_posted_operating_values(production_setup):
    admin, _, project, product, category = production_setup
    ProductionRecord.objects.create(
        project=project,
        product=product,
        production_date="2026-09-03",
        quantity=Decimal("100.000"),
        created_by=admin,
    )
    Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.EXPENSE,
        status=Transaction.Status.POSTED,
        amount=Decimal("500.00"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.INVESTMENT,
        status=Transaction.Status.POSTED,
        amount=Decimal("9999.00"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    income = Transaction.objects.create(
        project=project,
        category=category,
        type=Transaction.Type.INCOME,
        status=Transaction.Status.POSTED,
        amount=Decimal("800.00"),
        transaction_date="2026-09-03",
        created_by=admin,
    )
    Sale.objects.create(
        project=project,
        product=product,
        sale_date="2026-09-03",
        quantity=Decimal("20.000"),
        unit_price=Decimal("40.00"),
        transaction=income,
    )
    client = APIClient()
    client.force_authenticate(admin)

    response = client.get(f"/api/v1/projects/{project.id}/metrics/")

    assert response.status_code == 200
    assert response.json() == {
        "project": project.id,
        "operating_expense": "500.00",
        "total_produced": "100.000",
        "confirmed_sales": "800.00",
        "unit_cost": "5.00",
        "operating_result": "300.00",
        "operating_roi": "60.00",
    }


@pytest.mark.django_db
def test_project_metrics_return_zero_without_activity(production_setup):
    admin, _, project, *_ = production_setup
    client = APIClient()
    client.force_authenticate(admin)
    response = client.get(f"/api/v1/projects/{project.id}/metrics/")

    assert response.status_code == 200
    assert response.json()["unit_cost"] == "0.00"
    assert response.json()["operating_roi"] == "0.00"
