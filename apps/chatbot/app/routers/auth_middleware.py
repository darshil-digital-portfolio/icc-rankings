"""FastAPI dependency that validates the shared service-to-service PSK."""

import secrets

from fastapi import Header, HTTPException

from app.config import settings


async def verify_service_token(
    x_service_token: str | None = Header(None, alias="X-Service-Token"),
) -> None:
    """Raise 401 if the caller doesn't supply a valid X-Service-Token header.

    Raises 503 when SERVICE_API_TOKEN is not configured (deploy-time mistake).
    """
    if not settings.service_api_token:
        raise HTTPException(
            status_code=503,
            detail="Service authentication is not configured",
        )
    if not x_service_token:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Service-Token header",
        )
    if not secrets.compare_digest(x_service_token, settings.service_api_token):
        raise HTTPException(
            status_code=401,
            detail="Invalid service token",
        )
