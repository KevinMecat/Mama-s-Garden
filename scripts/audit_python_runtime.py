"""Refuse Python development tooling in runtime images."""

from importlib.metadata import distributions

forbidden = {"pytest", "pytest-django", "ruff", "pip-audit", "uv", "coverage", "pip"}
installed = {
    item.metadata["Name"].lower().replace("_", "-") for item in distributions()
}
if forbidden & installed:
    raise SystemExit("Herramientas de desarrollo detectadas en runtime.")
print("Runtime Python: sin herramientas de desarrollo.")
