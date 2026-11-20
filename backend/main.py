"""Compatibility entry point so ``uvicorn main:app`` still works from ``backend/``.

The application lives in ``app/main.py``.
"""

from app.main import app, create_app

__all__ = ["app", "create_app"]
