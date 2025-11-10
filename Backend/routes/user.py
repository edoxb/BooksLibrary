from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter()


@router.get("/user/roles")
async def get_my_roles(current_user: dict = Depends(get_current_user)):
    """Ottiene i ruoli dell'utente corrente"""
    return {
        "username": current_user["username"],
        "roles": current_user.get("roles", [])
    }

