#!/usr/bin/env bash
set -euo pipefail
# Never source a secret file or enable shell tracing.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python "$script_dir/verify_prod_env.py" "$@"
