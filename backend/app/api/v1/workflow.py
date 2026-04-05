from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...models.ai_schemas import WorkflowRequest, WorkflowResponse
from ...services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflow", tags=["workflow"])


@router.post("/execute", response_model=WorkflowResponse)
async def execute_workflow(request: WorkflowRequest, db: Session = Depends(get_db)):
    workflow_service = WorkflowService(db)
    try:
        result = await workflow_service.execute(
            user_request=request.user_request,
            document_id=request.document_id,
            model=request.model,
            max_iterations=request.max_iterations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
