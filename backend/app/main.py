"""FastAPI application factory for the Mars Mission Simulator API.

Run locally from ``backend/``::

    .venv/bin/uvicorn main:app --reload        # or: uvicorn app.main:app

On Vercel, ``api/index.py`` imports ``app`` from here.

CORS: production is same-origin (the SPA and ``/api`` share a domain), so no
CORS headers are sent there. Locally the Vite dev server origins are allowed.
``CORS_ORIGINS`` (comma-separated) overrides both.
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from collections.abc import Sequence

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .errors import error_response, install_error_handlers
from .routes import APP_VERSION, router

logger = logging.getLogger("mars_api")

#: Vite dev server origins allowed when not running on Vercel.
DEV_ORIGINS: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")

#: Largest accepted request body. A mission request is ~200 bytes.
MAX_BODY_BYTES = 16 * 1024

_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def default_cors_origins() -> list[str]:
    """CORS origins for this environment (see module docstring)."""
    override = os.environ.get("CORS_ORIGINS")
    if override is not None:
        return [o.strip() for o in override.split(",") if o.strip()]
    if os.environ.get("VERCEL"):
        return []
    return list(DEV_ORIGINS)


def create_app(cors_origins: Sequence[str] | None = None) -> FastAPI:
    """Build the app. ``cors_origins=None`` uses :func:`default_cors_origins`."""
    on_vercel = bool(os.environ.get("VERCEL"))
    app = FastAPI(
        title="Mars Mission Simulator API",
        version=APP_VERSION,
        description=(
            "Python mirror of the JS physics engine. `POST /api/mission` returns the same "
            "JSON as the browser engine's `simulateMission` (schemaVersion 3)."
        ),
        openapi_url="/api/openapi.json",
        # Swagger UI loads its assets from a CDN, which the production CSP blocks.
        docs_url=None if on_vercel else "/api/docs",
        redoc_url=None,
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id", "")
        if not _REQUEST_ID.match(rid):
            rid = uuid.uuid4().hex
        length = request.headers.get("content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            response = error_response(
                413, "payload_too_large", f"Request body exceeds {MAX_BODY_BYTES} bytes."
            )
        else:
            start = time.perf_counter()
            response = await call_next(request)
            logger.info(
                "%s %s %s %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - start) * 1000,
                extra={"request_id": rid},
            )
        response.headers["X-Request-ID"] = rid
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        return response

    origins = list(default_cors_origins() if cors_origins is None else cors_origins)
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type", "X-Request-ID"],
            expose_headers=["X-Request-ID"],
            max_age=600,
        )

    app.include_router(router)
    return app


app = create_app()
