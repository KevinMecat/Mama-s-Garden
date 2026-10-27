import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection, connections
from rest_framework.test import APIClient

from .models import Task
from .tests import ROOT, create, setup  # noqa: F401 -- shared isolated fixture


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_key", [False, True])
def test_simultaneous_commands_are_serialized(setup, same_key):  # noqa: F811
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL; covered by remote CI")
    task = create(setup)
    barrier = Barrier(2)
    key = str(uuid.uuid4())

    def request(index):
        close_old_connections()
        client = APIClient()
        client.force_authenticate(setup[1])
        barrier.wait(timeout=10)
        try:
            result = client.post(
                f"{ROOT}{task['id']}/command/",
                {
                    "action": "start",
                    "revision": task["revision"],
                    "key": key if same_key else str(uuid.uuid4()),
                },
                format="json",
            )
            return result.status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(pool.map(request, range(2)))
    assert results == ([200, 200] if same_key else [200, 409])
    assert Task.objects.get(pk=task["id"]).revision == 2
    assert Task.objects.get(pk=task["id"]).events.count() == 2
