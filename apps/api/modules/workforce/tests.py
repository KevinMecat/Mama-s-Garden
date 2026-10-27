import uuid
from datetime import date

import pytest
from rest_framework.test import APIClient

from modules.accounts.models import User
from modules.payroll.models import Employee, PayrollPeriod, WorkEntry
from modules.projects.models import Project, ProjectMember

from .models import EmployeeAccount, Task, WorkLog

ROOT = "/api/v1/workforce/tasks/"
pytestmark = pytest.mark.django_db


@pytest.fixture
def setup():
    admin = User.objects.create(email="admin@isolated.example", role="ADMIN")
    worker = User.objects.create(email="worker@isolated.example", role="WORKER")
    other = User.objects.create(email="other@isolated.example", role="WORKER")
    person = Employee.objects.create(
        first_name="Persona", last_name="A", hire_date=date(2026, 1, 1)
    )
    colleague = Employee.objects.create(
        first_name="Persona", last_name="B", hire_date=date(2026, 1, 1)
    )
    project = Project.objects.create(name="Prueba aislada", type="infraestructura", status="active")
    for user, employee in [(worker, person), (other, colleague)]:
        EmployeeAccount.objects.create(user=user, employee=employee)
        ProjectMember.objects.create(project=project, user=user)
    client = APIClient()
    client.force_authenticate(admin)
    return client, admin, worker, other, person, colleague, project


def plan(setup, **extra):
    _, _, _, _, person, _, project = setup
    return {
        "key": str(uuid.uuid4()),
        "title": "Reparar riego",
        "activity": "Reparación",
        "project": project.pk,
        "location": "Sector norte",
        "scheduled_date": "2026-10-27",
        "acceptance_criteria": "Sin fugas",
        "assignees": [person.pk],
        **extra,
    }


def create(setup, **extra):
    response = setup[0].post(ROOT, plan(setup, **extra), format="json")
    assert response.status_code == 201, response.data
    return response.data


def act(setup, task, action, expected=200, **extra):
    response = setup[0].post(
        f"{ROOT}{task['id']}/command/",
        {
            "key": str(uuid.uuid4()),
            "revision": task["revision"],
            "action": action,
            **extra,
        },
        format="json",
    )
    assert response.status_code == expected, response.data
    return response.data


def submit(setup, task, **extra):
    return act(
        setup,
        task,
        "submit",
        result="Sin fugas verificadas",
        criterion_met=True,
        times=[{"employee": setup[4].pk, "minutes": 60}],
        **extra,
    )


def test_complete_day_and_financial_tables_untouched(setup):
    work = WorkEntry.objects.create(
        employee=setup[4],
        project=setup[6],
        work_date=date(2026, 10, 27),
        status="PRESENT",
        created_by=setup[1],
    )
    period = PayrollPeriod.objects.create(
        start_date=work.work_date, end_date=work.work_date, status="PAID"
    )
    attendance_before = list(WorkEntry.objects.values())
    payroll_before = list(PayrollPeriod.objects.values())
    task = create(setup)
    setup[0].force_authenticate(setup[2])
    task = act(setup, task, "start")
    task = submit(setup, task)
    act(setup, task, "accept", expected=403, observations="No autorizado")
    setup[0].force_authenticate(setup[1])
    task = act(setup, task, "accept", observations="Prueba de cierre correcta")
    assert task["state"] == "DONE" and task["productivity"] is None
    assert list(WorkEntry.objects.values()) == attendance_before
    assert list(PayrollPeriod.objects.values()) == payroll_before
    assert period.status == "PAID"
    assert [event["action"] for event in task["events"]] == ["plan", "start", "submit", "accept"]


def test_worker_cannot_read_others_or_outside_project(setup):
    task = create(setup)
    setup[0].force_authenticate(setup[3])
    assert setup[0].get(f"{ROOT}{task['id']}/").status_code == 404
    assert setup[0].get(ROOT).data["count"] == 0
    assert setup[0].post(ROOT, plan(setup), format="json").status_code == 403
    setup[0].force_authenticate(setup[2])
    ProjectMember.objects.filter(user=setup[2]).delete()
    assert setup[0].get(f"{ROOT}{task['id']}/").status_code == 404
    assert setup[0].get(ROOT + "options_data/").data["employees"][0]["id"] == setup[4].pk


def test_block_cancel_and_review_transition_guards(setup):
    task = create(setup)
    act(setup, task, "accept", expected=409, observations="Prematuro")
    act(setup, task, "block", expected=400)
    task = act(setup, task, "block", reason="Falta herramienta")
    assert task["state"] == "TODO"
    act(setup, task, "start", expected=409)
    task = act(setup, task, "unblock")
    task = act(setup, task, "cancel", reason="Cambio de planificación")
    assert task["cancelled_at"] and task["cancelled_reason"]
    act(setup, task, "start", expected=409)
    assert Task.objects.count() == 1


def test_return_correct_and_accept_numeric_result(setup):
    task = create(setup, target_quantity="10.00", unit="metros")
    task = act(setup, task, "start")
    act(
        setup,
        task,
        "submit",
        expected=400,
        result="Falta cantidad",
        criterion_met=True,
        times=[{"employee": setup[4].pk, "minutes": 60}],
    )
    task = submit(setup, task, quantity="8.00")
    act(setup, task, "accept", expected=400, observations="Exceso", accepted_quantity="9")
    task = act(setup, task, "return", observations="Corregir fuga")
    task = submit(setup, task, quantity="10.00")
    task = act(setup, task, "accept", observations="Verificado", accepted_quantity="10.00")
    assert task["productivity"] == "5.00"  # 10 accepted / 2 actual hours including correction
    assert len(task["work_logs"]) == 2
    assert not task["work_logs"][0]["review"]["accepted"]
    assert task["work_logs"][1]["review"]["accepted"]


def test_crew_shared_quantity_and_individual_time(setup):
    task = create(setup, assignees=[setup[4].pk, setup[5].pk], target_quantity="10", unit="metros")
    setup[0].force_authenticate(setup[2])
    task = act(setup, task, "start")
    task = submit(setup, task, quantity="10")
    setup[0].force_authenticate(setup[1])
    act(setup, task, "accept", expected=400, observations="Faltan tiempos", accepted_quantity="10")
    setup[0].force_authenticate(setup[3])
    task = act(setup, task, "time", times=[{"employee": setup[5].pk, "minutes": 60}])
    act(setup, task, "time", expected=409, times=[{"employee": setup[5].pk, "minutes": 60}])
    setup[0].force_authenticate(setup[1])
    task = act(setup, task, "accept", observations="Cuadrilla verificada", accepted_quantity="10")
    assert task["crew"] and task["productivity"] is None and task["hours"] == "2.00"
    assert task["accepted_quantity"] == "10.00"
    assert WorkLog.objects.count() == 1


def test_idempotent_commands_creation_and_conflicting_key(setup):
    payload = plan(setup)
    first = setup[0].post(ROOT, payload, format="json")
    second = setup[0].post(ROOT, payload, format="json")
    assert second.status_code == 200 and first.data["id"] == second.data["id"]
    payload["title"] = "Otra solicitud"
    assert setup[0].post(ROOT, payload, format="json").status_code == 409
    task = first.data
    body = {"key": str(uuid.uuid4()), "revision": task["revision"], "action": "start"}
    for _ in range(2):
        assert setup[0].post(f"{ROOT}{task['id']}/command/", body, format="json").status_code == 200
    assert Task.objects.get().revision == 2
    assert Task.objects.get().events.count() == 2
    act(setup, task, "cancel", expected=409, reason="Revisión desactualizada")


def test_duplicate_copies_only_plan(setup):
    task = create(setup)
    task = submit(setup, act(setup, task, "start"))
    task = act(setup, task, "accept", observations="Correcto")
    copy = act(setup, task, "duplicate", scheduled_date="2026-10-28")
    assert copy["id"] != task["id"] and copy["state"] == "TODO"
    assert copy["work_logs"] == [] and copy["accepted_quantity"] is None
    assert copy["hours"] == "0.00" and not copy["blocked_reason"]
    assert copy["acceptance_criteria"] == task["acceptance_criteria"]


@pytest.mark.parametrize(
    "changes",
    [
        {"target_quantity": "2"},
        {"target_quantity": "0", "unit": "kg"},
        {"unit": "kg"},
        {"assignees": []},
        {"estimated_minutes": 0},
    ],
)
def test_invalid_planning(setup, changes):
    assert setup[0].post(ROOT, plan(setup, **changes), format="json").status_code == 400


def test_absence_and_overbooking_are_warnings_only(setup):
    WorkEntry.objects.create(
        employee=setup[4],
        project=setup[6],
        work_date=date(2026, 10, 27),
        status="ABSENT",
        created_by=setup[1],
    )
    task = create(setup, estimated_minutes=60)
    assert any("ausente" in warning for warning in task["warnings"])
    assert any("superior" in warning for warning in task["warnings"])
    assert task["state"] == "TODO"


def test_no_salary_disclosure_and_explicit_account_linking(setup):
    task = create(setup)
    setup[0].force_authenticate(setup[2])
    data = setup[0].get(f"{ROOT}{task['id']}/").data
    assert "salary" not in str(data).lower() and "daily_rate" not in str(data)
    assert (
        setup[0]
        .post(
            ROOT + "link_account/",
            {
                "employee": setup[4].pk,
                "user": str(setup[2].pk),
            },
        )
        .status_code
        == 403
    )
    assert setup[0].get(ROOT, {"employee": setup[5].pk}).status_code == 404
    assert setup[0].delete(f"{ROOT}{task['id']}/").status_code == 405


def test_zero_result_is_not_pending_and_incomplete_criteria_cannot_finish(setup):
    task = act(setup, create(setup, target_quantity="10", unit="metros"), "start")
    task = act(
        setup,
        task,
        "submit",
        result="No completado",
        criterion_met=False,
        quantity="0",
        times=[{"employee": setup[4].pk, "minutes": 15}],
    )
    act(setup, task, "accept", expected=400, observations="No cumple", accepted_quantity="0")
    assert task["work_logs"][0]["quantity"] == "0.00"
