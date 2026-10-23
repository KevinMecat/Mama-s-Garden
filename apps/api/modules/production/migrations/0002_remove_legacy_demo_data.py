import uuid

from django.db import migrations


LEGACY_PROJECT_CODES = (
    uuid.UUID("00000000-0000-0000-0000-000000000001"),
    uuid.UUID("10000000-0000-0000-0000-000000000001"),
    uuid.UUID("10000000-0000-0000-0000-000000000002"),
    uuid.UUID("20000000-0000-0000-0000-000000000001"),
    uuid.UUID("20000000-0000-0000-0000-000000000002"),
)
LEGACY_TRANSACTION_KEYS = (
    (
        uuid.UUID("20000000-0000-0000-0000-000000000001"),
        "Compra de concentrado para lote de 1,000 aves",
    ),
    (
        uuid.UUID("20000000-0000-0000-0000-000000000002"),
        "Bomba de agua Max Flo o sistema de bombeo",
    ),
)
LEGACY_CATEGORY_NAMES = ("Alimento", "Medicamentos", "Infraestructura", "Planilla")


def remove_legacy_demo_data(apps, schema_editor):
    project_model = apps.get_model("projects", "Project")
    category_model = apps.get_model("finance", "FinancialCategory")
    transaction_model = apps.get_model("finance", "Transaction")

    for project_code, description in LEGACY_TRANSACTION_KEYS:
        transaction_model.objects.filter(
            project__code=project_code,
            description=description,
        ).delete()

    project_model.objects.filter(
        code__in=LEGACY_PROJECT_CODES,
        transactions__isnull=True,
        production_records__isnull=True,
        sales__isnull=True,
    ).delete()
    category_model.objects.filter(
        name__in=LEGACY_CATEGORY_NAMES,
        transactions__isnull=True,
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("production", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(remove_legacy_demo_data, migrations.RunPython.noop),
    ]
