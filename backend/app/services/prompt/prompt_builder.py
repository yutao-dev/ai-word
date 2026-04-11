from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json


@dataclass
class SystemPromptConfig:
    """系统提示词配置"""
    skill_prompt: str
    document_context: str


@dataclass
class ChatMessage:
    """聊天消息"""
    role: str
    content: str


class PromptBuilderService:
    """
    专业的提示词构建服务
    
    负责：
    1. 系统提示词的封装构建
    2. 聊天提示词的封装构建
    3. 上下文消息的管理
    4. AI 决策的解析
    """
    
    # 会修改文档内容的函数集合
    MODIFICATION_FUNCTIONS = {
        'updateDocumentContent', 'insertEnd', 'insertAt', 'insertAfterHeading',
        'insertParagraph', 'deleteByRange', 'deleteAndSwap', 'findAndReplace',
        'moveSection', 'createDocument'
    }
    
    def __init__(self):
        self.separator = "\n\n"
    
    def add_max_iterations(self, prompt: str, max_iterations: int) -> str:
        """
        添加最大迭代次数到提示词
        
        Args:
            prompt: 系统提示词
            max_iterations: 最大迭代次数
            
        Returns:
            包含最大迭代次数的提示词
        """
        return f"{prompt}\n\n注意：此工作流允许的最大迭代次数为: {max_iterations}"

    def build_system_prompt(
        self,
        skill_prompt: str,
        document_context: str
    ) -> str:
        """
        构建完整的系统提示词
        
        Args:
            skill_prompt: Skill 相关的系统提示词
            document_context: 文档上下文信息
            
        Returns:
            完整的系统提示词
        """
        components = [
            skill_prompt,
            document_context
        ]
        return self.separator.join(components)
    
    def build_document_context(self, documents: List[Any]) -> str:
        """
        构建文档上下文消息
        
        Args:
            documents: 文档列表
            
        Returns:
            格式化的文档上下文字符串
        """
        if not documents:
            return "## 📁 当前文档上下文\n\n暂无文档。"
        
        doc_list = "\n".join([
            f"  - ID: {doc.id} | 标题: {doc.title}"
            for doc in documents
        ])
        
        return f"""## 📁 当前文档上下文

所有文档列表:
{doc_list}

⚠️ 操作文档时，请确保传入正确的 document_id 参数！"""
    
    def build_chat_messages(
        self,
        user_request: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> List[Dict[str, str]]:
        """
        构建聊天消息列表
        
        Args:
            user_request: 用户当前请求
            history: 历史对话记录
            
        Returns:
            完整的聊天消息列表
        """
        messages = []
        
        if history:
            messages.extend(history)
        
        messages.append({
            "role": "user",
            "content": user_request
        })
        
        return messages
    
    def build_action_feedback_message(
        self,
        action_result: str,
        current_content: str,
        max_content_length: int = 1000
    ) -> str:
        """
        构建操作反馈消息
        
        Args:
            action_result: 操作执行结果
            current_content: 当前文档内容
            max_content_length: 内容最大长度
            
        Returns:
            反馈消息字符串
        """
        truncated_content = current_content[:max_content_length]
        if len(current_content) > max_content_length:
            truncated_content += "..."
        
        return f"操作结果: {action_result}\n当前文档内容:\n{truncated_content}"
    
    def build_continue_prompt(
        self,
        current_content: str,
        max_content_length: int = 1000
    ) -> str:
        """
        构建继续执行的提示
        
        Args:
            current_content: 当前文档内容
            max_content_length: 内容最大长度
            
        Returns:
            继续执行提示字符串
        """
        truncated_content = current_content[:max_content_length]
        if len(current_content) > max_content_length:
            truncated_content += "..."
        
        return f"当前文档内容:\n{truncated_content}\n\n请根据文档内容和我的需求，继续执行操作。"
    
    def parse_decision(self, content: str) -> Dict[str, Any]:
        """
        解析 AI 返回的决策 JSON
        
        Args:
            content: AI 返回的原始内容
            
        Returns:
            解析后的决策字典
        """
        try:
            json_text = content.strip()
            
            # 处理 Markdown 代码块格式
            if json_text.startswith('```json'):
                json_text = json_text[7:]
            elif json_text.startswith('```'):
                json_text = json_text[3:]
            
            if json_text.endswith('```'):
                json_text = json_text[:-3]
            
            json_text = json_text.strip()
            
            decision = json.loads(json_text)
            return decision
        except json.JSONDecodeError:
            return {
                "thinking": content,
                "action": None,
                "is_complete": False,
                "summary": "AI response was not valid JSON"
            }
    
    def is_modification_action(self, action: Optional[Dict[str, Any]]) -> bool:
        """
        判断是否为文档修改操作
        
        Args:
            action: AI 决策的操作
            
        Returns:
            是否为修改操作
        """
        return action and action.get('function') in self.MODIFICATION_FUNCTIONS
    
    def validate_completion(
        self,
        decision: Dict[str, Any],
        has_modification: bool
    ) -> Dict[str, Any]:
        """
        验证任务完成状态，防止 AI 在获取文档后就错误地认为任务已完成
        
        Args:
            decision: AI 决策
            has_modification: 是否有修改操作
            
        Returns:
            验证后的决策
        """
        if decision.get("is_complete", False) and not has_modification:
            decision["is_complete"] = False
        return decision
    
    def build_step_info(
        self,
        iteration: int,
        decision: Dict[str, Any],
        result: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        构建步骤信息
        
        Args:
            iteration: 当前迭代次数
            decision: AI 决策
            result: 操作结果（可选）
            
        Returns:
            步骤信息字典
        """
        step_info = {
            "iteration": iteration,
            "thinking": decision.get("thinking", ""),
            "plan": decision.get("plan", []),
            "action": decision.get("action"),
            "summary": decision.get("summary", ""),
            "is_complete": decision.get("is_complete", False)
        }
        
        if result is not None:
            step_info["result"] = result
            
        return step_info
    
    def manage_context_history(
        self,
        messages: List[Dict[str, str]],
        max_history: int = 3,
        context_mode: str = "limited"
    ) -> List[Dict[str, str]]:
        """
        管理上下文历史，限制历史对话长度
        
        Args:
            messages: 消息列表
            max_history: 最大保留的历史轮数
            context_mode: 上下文管理模式 ("limited" 或 "unlimited")
            
        Returns:
            处理后的消息列表
        """
        # 无上下文限制模式
        if context_mode == "unlimited":
            return messages
        
        max_messages = max_history * 2
        if len(messages) > max_messages:
            return messages[-max_messages:]
        return messages
    
    def add_assistant_message(
        self,
        messages: List[Dict[str, str]],
        content: str
    ) -> List[Dict[str, str]]:
        """
        添加助手消息到对话历史
        
        Args:
            messages: 现有消息列表
            content: 助手消息内容
            
        Returns:
            更新后的消息列表
        """
        messages.append({
            "role": "assistant",
            "content": content
        })
        return messages
    
    def add_user_message(
        self,
        messages: List[Dict[str, str]],
        content: str
    ) -> List[Dict[str, str]]:
        """
        添加用户消息到对话历史
        
        Args:
            messages: 现有消息列表
            content: 用户消息内容
            
        Returns:
            更新后的消息列表
        """
        messages.append({
            "role": "user",
            "content": content
        })
        return messages
