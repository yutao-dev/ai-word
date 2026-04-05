from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from ..core.config import get_settings
from ..models.document import LLMConfig
from ..models.ai_schemas import ChatResponse, LLMProvider

settings = get_settings()


class AIService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = settings

    def _get_default_config(self) -> Optional[LLMConfig]:
        return self.db.query(LLMConfig).filter(LLMConfig.is_default == True).first()

    def _get_client(self, config: Optional[LLMConfig] = None):
        if config is None:
            config = self._get_default_config()
        
        if config is None:
            if settings.OPENAI_API_KEY:
                return AsyncOpenAI(api_key=settings.OPENAI_API_KEY), "openai"
            # 返回 None 而不是抛出错误，让上层处理
            return None, "openai"

        provider = config.provider
        if provider == LLMProvider.OPENAI:
            client = AsyncOpenAI(
                api_key=config.api_key or settings.OPENAI_API_KEY,
                base_url=config.base_url
            )
            return client, "openai"
        elif provider == LLMProvider.ANTHROPIC:
            client = AsyncAnthropic(
                api_key=config.api_key or settings.ANTHROPIC_API_KEY
            )
            return client, "anthropic"
        elif provider == LLMProvider.AZURE:
            client = AsyncOpenAI(
                api_key=config.api_key or settings.AZURE_OPENAI_API_KEY,
                base_url=settings.AZURE_OPENAI_ENDPOINT,
                default_headers={"api-key": config.api_key or settings.AZURE_OPENAI_API_KEY}
            )
            return client, "azure"
        elif provider == LLMProvider.OLLAMA:
            client = AsyncOpenAI(
                api_key="ollama",
                base_url=config.base_url or "http://localhost:11434/v1"
            )
            return client, "ollama"
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> ChatResponse:
        config = self._get_default_config()
        client, provider = self._get_client(config)
        
        if not client:
            # 没有配置 API Key，返回一个默认响应
            return ChatResponse(
                content="请先配置 LLM API Key 才能使用 AI 功能",
                model="default",
                usage={
                    "prompt_tokens": 0,
                    "completion_tokens": 0
                }
            )
        
        model_name = model or (config.model if config else settings.DEFAULT_MODEL)
        
        if provider == "anthropic":
            response = await client.messages.create(
                model=model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return ChatResponse(
                content=response.content[0].text,
                model=model_name,
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens
                }
            )
        else:
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return ChatResponse(
                content=response.choices[0].message.content,
                model=model_name,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens
                }
            )

    async def chat_with_system(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> ChatResponse:
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        return await self.chat(full_messages, model, temperature, max_tokens)
