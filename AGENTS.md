# Development Workflow

- Manage Python dependencies using [`uv`](https://github.com/astral-sh/uv).
- After changing code or dependencies, run:
  ```bash
  uv sync
  uv run -m unittest discover -s tests
  ```
- Commit `pyproject.toml` and `uv.lock` when dependencies change. Do not commit the `.venv/` directory.

