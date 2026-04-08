from fastapi import APIRouter
from .documents import router as documents_router
from .document_operations import router as document_operations_router
from .ai import router as ai_router
from .workflow import router as workflow_router
from .token_usage import router as token_usage_router

api_router = APIRouter()
api_router.include_router(documents_router)
api_router.include_router(document_operations_router)
api_router.include_router(ai_router)
api_router.include_router(workflow_router)
api_router.include_router(token_usage_router)
