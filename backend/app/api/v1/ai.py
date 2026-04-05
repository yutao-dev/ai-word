from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ...db.database import get_db
from ...models.document import LLMConfig
from ...models.ai_schemas import LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse, ChatRequest, ChatResponse
from ...services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/configs", response_model=List[LLMConfigResponse])
def get_llm_configs(db: Session = Depends(get_db)):
    configs = db.query(LLMConfig).all()
    return configs


@router.post("/configs", response_model=LLMConfigResponse)
def create_llm_config(config: LLMConfigCreate, db: Session = Depends(get_db)):
    if config.is_default:
        db.query(LLMConfig).update({LLMConfig.is_default: False})
    
    llm_config = LLMConfig(**config.model_dump())
    db.add(llm_config)
    db.commit()
    db.refresh(llm_config)
    return llm_config


@router.put("/configs/{config_id}", response_model=LLMConfigResponse)
def update_llm_config(config_id: str, config: LLMConfigUpdate, db: Session = Depends(get_db)):
    llm_config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not llm_config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    if config.is_default:
        db.query(LLMConfig).update({LLMConfig.is_default: False})
    
    for key, value in config.model_dump(exclude_unset=True).items():
        setattr(llm_config, key, value)
    
    db.commit()
    db.refresh(llm_config)
    return llm_config


@router.delete("/configs/{config_id}")
def delete_llm_config(config_id: str, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    db.delete(config)
    db.commit()
    return {"message": "Config deleted successfully"}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    ai_service = AIService(db)
    try:
        response = await ai_service.chat(
            messages=[msg.model_dump() for msg in request.messages],
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
