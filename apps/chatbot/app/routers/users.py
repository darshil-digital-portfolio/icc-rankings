"""FastAPI router for user profile and preferences endpoints.

All routes require a valid X-Service-Token header — they are only intended to
be called from the Next.js server (never directly from the browser).
"""

from fastapi import APIRouter, Depends, Header, HTTPException

from app.db.users import get_or_create_user, get_user, update_preferences
from app.models import UpdatePreferencesRequest, UserPreferences, UserProfile
from app.routers.auth_middleware import verify_service_token

router = APIRouter(prefix="/api/users", tags=["users"])


def _doc_to_profile(doc: dict) -> UserProfile:  # type: ignore[type-arg]
    prefs = doc.get("preferences") or {}
    return UserProfile(
        google_sub=doc["google_sub"],
        email=doc.get("email", ""),
        name=doc.get("name", ""),
        picture=doc.get("picture", ""),
        preferences=UserPreferences(
            theme=prefs.get("theme"),
            event_filters=prefs.get("event_filters") or [],
        ),
        is_admin=doc.get("is_admin", False),
    )


@router.get(
    "/me",
    response_model=UserProfile,
    dependencies=[Depends(verify_service_token)],
)
async def get_or_create_me(
    x_user_sub: str | None = Header(None, alias="X-User-Sub"),
    x_user_email: str | None = Header(None, alias="X-User-Email"),
    x_user_name: str | None = Header(None, alias="X-User-Name"),
    x_user_picture: str | None = Header(None, alias="X-User-Picture"),
) -> UserProfile:
    """Upsert user on sign-in and return their full profile."""
    if not x_user_sub:
        raise HTTPException(status_code=400, detail="X-User-Sub header is required")
    doc = await get_or_create_user(
        google_sub=x_user_sub,
        email=x_user_email or "",
        name=x_user_name or "",
        picture=x_user_picture or "",
    )
    return _doc_to_profile(doc)


@router.patch(
    "/preferences",
    response_model=UserProfile,
    dependencies=[Depends(verify_service_token)],
)
async def patch_preferences(
    body: UpdatePreferencesRequest,
    x_user_sub: str | None = Header(None, alias="X-User-Sub"),
) -> UserProfile:
    """Partially update the authenticated user's preferences."""
    if not x_user_sub:
        raise HTTPException(status_code=400, detail="X-User-Sub header is required")
    doc = await update_preferences(
        google_sub=x_user_sub,
        theme=body.theme,
        event_filters=body.event_filters,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _doc_to_profile(doc)


@router.get(
    "/admin-check",
    dependencies=[Depends(verify_service_token)],
)
async def admin_check(
    x_user_sub: str | None = Header(None, alias="X-User-Sub"),
) -> dict:  # type: ignore[type-arg]
    """Return whether the given user has admin privileges."""
    if not x_user_sub:
        raise HTTPException(status_code=400, detail="X-User-Sub header is required")
    doc = await get_user(x_user_sub)
    return {"is_admin": doc.get("is_admin", False) if doc else False}
