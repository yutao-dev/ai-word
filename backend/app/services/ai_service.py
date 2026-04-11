import logging
from datetime import datetime
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from ..core.config import get_settings
from ..models.document import LLMConfig, TokenUsage
from ..models.ai_schemas import ChatResponse, LLMProvider

# 配置日志文件
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_workflow_prompts.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# 确保 StreamHandler 也能处理 Unicode 字符
for handler in logging.getLogger().handlers:
    if isinstance(handler, logging.StreamHandler):
        handler.terminator = '\n'
prompt_logger = logging.getLogger('ai_workflow_prompts')

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
                            completion_tokens: int, request_type: str = None,
                            cached_tokens: int = 0):
        # 计算缓存命中率
        cache_hit_ratio = 0
        if prompt_tokens > 0:
            cache_hit_ratio = int((cached_tokens / prompt_tokens) * 100)
        
        print(f"[TokenUsage] 记录Token使用情况: 模型={model}, 提供商={provider}, 输入Token={prompt_tokens}, 输出Token={completion_tokens}, 缓存Token={cached_tokens}, 命中率={cache_hit_ratio}%, 请求类型={request_type}")
        
        usage = TokenUsage(
            session_id=self.session_id,
            workflow_id=self.workflow_id,
            model=model,
            provider=provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cached_tokens=cached_tokens,
            cache_hit_ratio=cache_hit_ratio,
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
            # 构建包含系统提示词的消息列表
            anthropic_messages = []
            if system_prompt:
                anthropic_messages.append({"role": "user", "content": system_prompt})
            
            # 转换 OpenAI 格式到 Anthropic 格式
            for msg in messages:
                if msg["role"] == "user":
                    anthropic_messages.append({"role": "user", "content": msg["content"]})
                elif msg["role"] == "assistant":
                    anthropic_messages.append({"role": "assistant", "content": msg["content"]})

            # 记录提示词
            prompt_logger.info(f"[Anthropic API] 工作流ID: {self.workflow_id}, 系统提示词长度: {len(system_prompt) if system_prompt else 0}, 消息数量: {len(messages)}")
            prompt_logger.info(f"[Anthropic API] 系统提示词: {system_prompt[:500]}..." if system_prompt and len(system_prompt) > 500 else f"[Anthropic API] 系统提示词: {system_prompt}")
            for i, msg in enumerate(messages):
                prompt_logger.info(f"[Anthropic API] 消息 {i+1} - 角色: {msg.get('role')}, 内容长度: {len(msg.get('content', ''))}")
                prompt_logger.info(f"[Anthropic API] 消息 {i+1} 内容: {msg.get('content', '')[:500]}..." if len(msg.get('content', '')) > 500 else f"[Anthropic API] 消息 {i+1} 内容: {msg.get('content', '')}")

            response = await client.messages.create(
                model=model_name,
                messages=anthropic_messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            prompt_tokens = response.usage.input_tokens
            completion_tokens = response.usage.output_tokens
            # 提取缓存 Token（Anthropic）
            cached_tokens = 0
            print(f"[Anthropic API] 响应 usage 对象: {dir(response.usage)}")
            if hasattr(response.usage, 'input_tokens_details'):
                print(f"[Anthropic API] input_tokens_details 存在: {dir(response.usage.input_tokens_details)}")
                if hasattr(response.usage.input_tokens_details, 'cache_read_tokens'):
                    cached_tokens = response.usage.input_tokens_details.cache_read_tokens
                    print(f"[Anthropic API] 缓存 Token: {cached_tokens}")
                else:
                    print(f"[Anthropic API] input_tokens_details 中没有 cache_read_tokens 属性")
            else:
                print(f"[Anthropic API] 响应中没有 input_tokens_details 属性")
            self._record_token_usage(model_name, provider, prompt_tokens, completion_tokens, request_type, cached_tokens)
            return ChatResponse(
                content=response.content[0].text,
                model=model_name,
                usage={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens
                }
            )
        else:
            # 构建包含系统提示词的消息列表
            chat_messages = messages
            if system_prompt:
                chat_messages = [{"role": "system", "content": system_prompt}] + messages

            # 记录提示词
            prompt_logger.info(f"[OpenAI API] 工作流ID: {self.workflow_id}, 系统提示词长度: {len(system_prompt) if system_prompt else 0}, 消息数量: {len(messages)}")
            prompt_logger.info(f"[OpenAI API] 系统提示词: {system_prompt[:500]}..." if system_prompt and len(system_prompt) > 500 else f"[OpenAI API] 系统提示词: {system_prompt}")
            for i, msg in enumerate(messages):
                prompt_logger.info(f"[OpenAI API] 消息 {i+1} - 角色: {msg.get('role')}, 内容长度: {len(msg.get('content', ''))}")
                prompt_logger.info(f"[OpenAI API] 消息 {i+1} 内容: {msg.get('content', '')[:500]}..." if len(msg.get('content', '')) > 500 else f"[OpenAI API] 消息 {i+1} 内容: {msg.get('content', '')}")

            response = await client.chat.completions.create(
                model=model_name,
                messages=chat_messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            # 提取缓存 Token（OpenAI）
            cached_tokens = 0
            print(f"[OpenAI API] 响应 usage 对象: {dir(response.usage)}")
            if hasattr(response.usage, 'prompt_tokens_details'):
                print(f"[OpenAI API] prompt_tokens_details 存在: {dir(response.usage.prompt_tokens_details)}")
                if hasattr(response.usage.prompt_tokens_details, 'cached_tokens'):
                    cached_tokens = response.usage.prompt_tokens_details.cached_tokens
                    print(f"[OpenAI API] 缓存 Token: {cached_tokens}")
                else:
                    print(f"[OpenAI API] prompt_tokens_details 中没有 cached_tokens 属性")
            else:
                print(f"[OpenAI API] 响应中没有 prompt_tokens_details 属性")
            self._record_token_usage(model_name, provider, prompt_tokens, completion_tokens, request_type, cached_tokens)
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
            # 构建包含系统提示词的消息列表
            anthropic_messages = []
            if system_prompt:
                anthropic_messages.append({"role": "user", "content": system_prompt})
            
            # 转换 OpenAI 格式到 Anthropic 格式
            for msg in messages:
                if msg["role"] == "user":
                    anthropic_messages.append({"role": "user", "content": msg["content"]})
                elif msg["role"] == "assistant":
                    anthropic_messages.append({"role": "assistant", "content": msg["content"]})

            # 记录提示词
            prompt_logger.info(f"[Anthropic Stream API] 工作流ID: {self.workflow_id}, 系统提示词长度: {len(system_prompt) if system_prompt else 0}, 消息数量: {len(messages)}")
            prompt_logger.info(f"[Anthropic Stream API] 系统提示词: {system_prompt[:500]}..." if system_prompt and len(system_prompt) > 500 else f"[Anthropic Stream API] 系统提示词: {system_prompt}")
            for i, msg in enumerate(messages):
                prompt_logger.info(f"[Anthropic Stream API] 消息 {i+1} - 角色: {msg.get('role')}, 内容长度: {len(msg.get('content', ''))}")
                prompt_logger.info(f"[Anthropic Stream API] 消息 {i+1} 内容: {msg.get('content', '')[:500]}..." if len(msg.get('content', '')) > 500 else f"[Anthropic Stream API] 消息 {i+1} 内容: {msg.get('content', '')}")

            async with client.messages.stream(
                model=model_name,
                messages=anthropic_messages,
                max_tokens=max_tokens,
                temperature=temperature
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "token", "content": text}
                if stream._usage:
                    # 提取缓存 Token（Anthropic 流式）
                    cached_tokens = 0
                    print(f"[Anthropic Stream API] 响应 usage 对象: {dir(stream.usage)}")
                    if hasattr(stream.usage, 'input_tokens_details'):
                        print(f"[Anthropic Stream API] input_tokens_details 存在: {dir(stream.usage.input_tokens_details)}")
                        if hasattr(stream.usage.input_tokens_details, 'cache_read_tokens'):
                            cached_tokens = stream.usage.input_tokens_details.cache_read_tokens
                            print(f"[Anthropic Stream API] 缓存 Token: {cached_tokens}")
                        else:
                            print(f"[Anthropic Stream API] input_tokens_details 中没有 cache_read_tokens 属性")
                    else:
                        print(f"[Anthropic Stream API] 响应中没有 input_tokens_details 属性")
                    self._record_token_usage(
                        model_name, provider,
                        stream.usage.input_tokens,
                        stream.usage.output_tokens,
                        "chat_stream",
                        cached_tokens
                    )
        else:
            # 构建包含系统提示词的消息列表
            chat_messages = messages
            if system_prompt:
                chat_messages = [{"role": "system", "content": system_prompt}] + messages

            # 记录提示词
            prompt_logger.info(f"[OpenAI Stream API] 工作流ID: {self.workflow_id}, 系统提示词长度: {len(system_prompt) if system_prompt else 0}, 消息数量: {len(messages)}")
            prompt_logger.info(f"[OpenAI Stream API] 系统提示词: {system_prompt[:500]}..." if system_prompt and len(system_prompt) > 500 else f"[OpenAI Stream API] 系统提示词: {system_prompt}")
            for i, msg in enumerate(messages):
                prompt_logger.info(f"[OpenAI Stream API] 消息 {i+1} - 角色: {msg.get('role')}, 内容长度: {len(msg.get('content', ''))}")
                prompt_logger.info(f"[OpenAI Stream API] 消息 {i+1} 内容: {msg.get('content', '')[:500]}..." if len(msg.get('content', '')) > 500 else f"[OpenAI Stream API] 消息 {i+1} 内容: {msg.get('content', '')}")

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
                # 提取缓存 Token（OpenAI 流式）
                cached_tokens = 0
                print(f"[OpenAI Stream API] 响应 usage 对象: {dir(last_usage)}")
                if hasattr(last_usage, 'prompt_tokens_details'):
                    print(f"[OpenAI Stream API] prompt_tokens_details 存在: {dir(last_usage.prompt_tokens_details)}")
                    if hasattr(last_usage.prompt_tokens_details, 'cached_tokens'):
                        cached_tokens = last_usage.prompt_tokens_details.cached_tokens
                        print(f"[OpenAI Stream API] 缓存 Token: {cached_tokens}")
                    else:
                        print(f"[OpenAI Stream API] prompt_tokens_details 中没有 cached_tokens 属性")
                else:
                    print(f"[OpenAI Stream API] 响应中没有 prompt_tokens_details 属性")
                self._record_token_usage(
                    model_name, provider,
                    last_usage.prompt_tokens or 0,
                    last_usage.completion_tokens or 0,
                    "chat_stream",
                    cached_tokens
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
