from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from ...db.database import get_db
from ...services.rag_service import RAGService
from ...services.ai_service import AIService

router = APIRouter(prefix="/rag", tags=["rag"])

from pydantic import BaseModel

class RAGQueryRequest(BaseModel):
    question: str
    model: Optional[str] = None
    history: Optional[list] = []

@router.post("/query")
async def rag_query(
    request: RAGQueryRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    使用 RAG 技术回答基于文档的问题
    """
    # 初始化 RAG 服务
    rag_service = RAGService(db)
    
    # 获取相关上下文
    context = rag_service.get_relevant_context(request.question)
    
    # 构建历史消息
    history_messages = []
    if request.history:
        for msg in request.history:
            if msg['role'] == 'user':
                history_messages.append({"role": "user", "content": msg['content']})
            elif msg['role'] == 'assistant':
                history_messages.append({"role": "assistant", "content": msg['content']})
    
    # 构建当前提示词
    current_prompt = f"基于以下上下文回答问题:\n\n{context}\n\n问题: {request.question}\n\n回答:"
    history_messages.append({"role": "user", "content": current_prompt})
    
    # 调用 AI 服务生成回答
    ai_service = AIService(db)
    response = await ai_service.chat(
        messages=history_messages,
        model=request.model,
        request_type="rag_query"
    )
    
    return {
        "question": request.question,
        "answer": response.content,
        "context": context,
        "model": response.model
    }

@router.post("/refresh-index")
def refresh_rag_index(db: Session = Depends(get_db)) -> Dict[str, str]:
    """
    刷新 RAG 向量索引
    """
    rag_service = RAGService(db)
    rag_service.refresh_index()
    return {"message": "RAG index refreshed successfully"}

@router.get("/test-documents")
def test_documents(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    测试文档数据是否被正确加载
    """
    rag_service = RAGService(db)
    count = rag_service.test_documents()
    return {"message": f"Test completed, found {count} documents"}
