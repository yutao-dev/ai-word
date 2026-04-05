from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    OLLAMA = "ollama"


class LLMConfigBase(BaseModel):
    name: str
    provider: LLMProvider
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str
    is_default: bool = False


class LLMConfigCreate(LLMConfigBase):
    pass


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    is_default: Optional[bool] = None


class LLMConfigResponse(LLMConfigBase):
    id: str

    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: bool = False


class ChatResponse(BaseModel):
    content: str
    model: str
    usage: Dict[str, int]


class WorkflowStep(BaseModel):
    action: str
    params: Dict[str, Any]
    description: Optional[str] = None


class WorkflowRequest(BaseModel):
    user_request: str
    document_id: str
    model: Optional[str] = None
    max_iterations: int = 10


class WorkflowResponse(BaseModel):
    success: bool
    message: str
    steps: List[Dict[str, Any]]
    final_content: Optional[str] = None
    iterations: int
