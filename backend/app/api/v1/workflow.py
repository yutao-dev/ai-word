from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...models.ai_schemas import WorkflowRequest, WorkflowResponse
from ...services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflow", tags=["workflow"])


async def workflow_stream_generator(
    workflow_service: WorkflowService,
    user_request: str,
    document_id: str,
    model: str,
    max_iterations: int
):
    # 先发送初始状态
    yield f"data: {json.dumps({'type': 'init', 'message': '工作流开始执行'})}\n\n"
    
    # 执行工作流并流式返回结果
    try:
        async for data in workflow_service.execute_stream(
            user_request=user_request,
            document_id=document_id,
            model=model,
            max_iterations=max_iterations
        ):
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.1)  # 模拟流式效果
    except Exception as e:
        error_data = {
            "type": "error",
            "message": str(e)
        }
        yield f"data: {json.dumps(error_data)}\n\n"


from fastapi import Query

@router.get("/execute")
async def execute_workflow(
    user_request: str = Query(..., description="用户请求"),
    document_id: str = Query(..., description="文档ID"),
    model: str = Query(..., description="模型名称"),
    max_iterations: int = Query(10, description="最大迭代次数"),
    db: Session = Depends(get_db)
):
    workflow_service = WorkflowService(db)
    
    return StreamingResponse(
        workflow_stream_generator(
            workflow_service=workflow_service,
            user_request=user_request,
            document_id=document_id,
            model=model,
            max_iterations=max_iterations
        ),
        media_type="text/event-stream"
    )


async def workflow_stream_generator_v2(
    workflow_service: WorkflowService,
    user_request: str,
    document_id: str,
    model: str,
    max_iterations: int
):
    async for data in workflow_service.execute_stream_v2(
        user_request=user_request,
        document_id=document_id,
        model=model,
        max_iterations=max_iterations
    ):
        yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.05)


@router.get("/execute-v2")
async def execute_workflow_v2(
    user_request: str = Query(..., description="用户请求"),
    document_id: str = Query(..., description="文档ID"),
    model: str = Query(..., description="模型名称"),
    max_iterations: int = Query(10, description="最大迭代次数"),
    db: Session = Depends(get_db)
):
    workflow_service = WorkflowService(db)

    return StreamingResponse(
        workflow_stream_generator_v2(
            workflow_service=workflow_service,
            user_request=user_request,
            document_id=document_id,
            model=model,
            max_iterations=max_iterations
        ),
        media_type="text/event-stream"
    )
