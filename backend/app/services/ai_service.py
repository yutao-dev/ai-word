from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from ..core.config import get_settings
from ..models.document import LLMConfig, TokenUsage
from ..models.ai_schemas import ChatResponse, LLMProvider

settings = get_settings()


class AIService:
    def __init__(self, db: Session, session_id: str = None, workflow_id: str = None):
        self.db = db
        self.settings = settings
        self.session_id = session_id
        self.workflow_id = workflow_id

    def _get_default_config(self) -> Optional[LLMConfig]:
        return self.db.query(LLMConfig).filter(LLMConfig.is_default == True).first()

    def _get_client(self, config: Optional[LLMConfig] = None):
        if config is None:
            config = self._get_default_config()
        
        if config is None:
            if settings.OPENAI_API_KEY:
                return AsyncOpenAI(api_key=settings.OPENAI_API_KEY), "openai"
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

    def _record_token_usage(self, model: str, provider: str, prompt_tokens: int, 
                            completion_tokens: int, request_type: str = None):
        usage = TokenUsage(
            session_id=self.session_id,
            workflow_id=self.workflow_id,
            model=model,
            provider=provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            request_type=request_type
        )
        self.db.add(usage)
        self.db.commit()

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        request_type: str = None,
        system_prompt: Optional[str] = None
    ) -> ChatResponse:
        config = self._get_default_config()
        client, provider = self._get_client(config)

        if not client:
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
            anthropic_messages = []
            if system_prompt:
                anthropic_messages.append({
                    "role": "user",
                    "content": system_prompt
                })
            anthropic_messages.extend(messages)

            response = await client.messages.create(
                model=model_name,
                messages=anthropic_messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            prompt_tokens = response.usage.input_tokens
            completion_tokens = response.usage.output_tokens
            self._record_token_usage(model_name, provider, prompt_tokens, completion_tokens, request_type)
            return ChatResponse(
                content=response.content[0].text,
                model=model_name,
                usage={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens
                }
            )
        else:
            chat_messages = messages
            if system_prompt:
                chat_messages = [{"role": "system", "content": system_prompt}] + messages

            response = await client.chat.completions.create(
                model=model_name,
                messages=chat_messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            self._record_token_usage(model_name, provider, prompt_tokens, completion_tokens, request_type)
            return ChatResponse(
                content=response.choices[0].message.content,
                model=model_name,
                usage={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens
                }
            )

    async def chat_with_system(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        request_type: str = None
    ) -> ChatResponse:
        return await self.chat(messages, model, temperature, max_tokens, request_type, system_prompt=system_prompt)

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None
    ):
        config = self._get_default_config()
        client, provider = self._get_client(config)

        if not client:
            yield {"type": "error", "content": "请先配置 LLM API Key 才能使用 AI 功能"}
            return

        model_name = model or (config.model if config else settings.DEFAULT_MODEL)

        if provider == "anthropic":
            anthropic_messages = []
            if system_prompt:
                anthropic_messages.append({
                    "role": "user",
                    "content": system_prompt
                })
            anthropic_messages.extend(messages)

            async with client.messages.stream(
                model=model_name,
                messages=anthropic_messages,
                max_tokens=max_tokens,
                temperature=temperature
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "token", "content": text}
                if stream._usage:
                    self._record_token_usage(
                        model_name, provider,
                        stream.usage.input_tokens,
                        stream.usage.output_tokens,
                        "chat_stream"
                    )
        else:
            chat_messages = messages
            if system_prompt:
                chat_messages = [{"role": "system", "content": system_prompt}] + messages

            stream = await client.chat.completions.create(
                model=model_name,
                messages=chat_messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True
            )
            last_usage = None
            async for chunk in stream:
                if hasattr(chunk, 'usage') and chunk.usage:
                    last_usage = chunk.usage
                content = chunk.choices[0].delta.content
                if content:
                    yield {"type": "token", "content": content}
            if last_usage:
                self._record_token_usage(
                    model_name, provider,
                    last_usage.prompt_tokens or 0,
                    last_usage.completion_tokens or 0,
                    "chat_stream"
                )

    async def chat_with_system_stream(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        async for token in self.chat_stream(messages, model, temperature, max_tokens, system_prompt=system_prompt):
            yield token
