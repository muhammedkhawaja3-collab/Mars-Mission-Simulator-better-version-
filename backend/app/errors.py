"""Uniform error envelope: every error is ``{"error": {"code", "message", "details"}}``.

The RequestValidationError handler never echoes the offending input back.
That is what turned NaN/Infinity bodies into HTTP 500s before (AUDIT B1):
the default 422 body contains ``input: nan``, which is not valid JSON.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("mars_api")

_CODES = {
    400: "bad_request",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
}


def _safe_loc(loc: Iterable) -> list[str | int]:
    return [p if isinstance(p, int) and not isinstance(p, bool) else str(p) for p in loc]


def error_response(
    status: int,
    code: str,
    message: str,
    details: Iterable[Mapping] = (),
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Build the error envelope. ``details`` items carry only loc, msg and type."""
    body = {
        "error": {
            "code": code,
            "message": message,
            "details": [
                {
                    "loc": _safe_loc(d.get("loc", ())),
                    "msg": str(d.get("msg", "")),
                    "type": str(d.get("type", "")),
                }
                for d in details
            ],
        }
    }
    return JSONResponse(body, status_code=status, headers=dict(headers or {}))


async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(422, "validation_error", "Request failed validation.", exc.errors())


async def _http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _CODES.get(exc.status_code, "http_error")
    try:
        default = HTTPStatus(exc.status_code).phrase
    except ValueError:
        default = "HTTP error"
    message = exc.detail if isinstance(exc.detail, str) else default
    return error_response(exc.status_code, code, message, headers=exc.headers)


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled error",
        extra={"path": request.url.path, "request_id": request.headers.get("x-request-id")},
    )
    return error_response(500, "internal_error", "Internal server error.")


def install_error_handlers(app: FastAPI) -> None:
    """Register the handlers that produce the uniform envelope."""
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(StarletteHTTPException, _http_handler)
    app.add_exception_handler(Exception, _unhandled_handler)
