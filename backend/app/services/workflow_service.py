import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from .ai_service import AIService
from ..models.document import Document
from ..models.ai_schemas import WorkflowResponse

SYSTEM_PROMPT = """你是一个专业的文档编辑助手。你可以通过调用函数来编辑文档。

可用的函数：
1. getDocumentById - 获取文档内容
   参数: document_id (文档ID)
   
2. insertEnd - 在文档末尾追加内容
   参数: content (要追加的内容)
   
3. deleteByRange - 删除指定行范围
   参数: start_line, end_line (行号从1开始)
   
4. deleteAndSwap - 删除指定行并替换为新内容
   参数: start_line, end_line, new_content
   
5. updateDocumentContent - 更新整个文档内容
   参数: content (新的文档内容)

请根据用户需求，规划并执行操作步骤。每次回复请使用JSON格式：
{
    "thinking": "你的思考过程",
    "plan": ["步骤1", "步骤2", ...],
    "action": {
        "function": "函数名",
        "params": {参数}
    },
    "is_complete": false,
    "summary": "当前步骤说明"
}

如果任务完成，设置 is_complete 为 true。"""


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService(db)

    async def execute(
        self,
        user_request: str,
        document_id: str,
        model: Optional[str] = None,
        max_iterations: int = 10
    ) -> WorkflowResponse:
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return WorkflowResponse(
                success=False,
                message="Document not found",
                steps=[],
                iterations=0
            )

        steps = []
        current_content = document.content
        messages = [{"role": "user", "content": user_request}]

        for iteration in range(max_iterations):
            response = await self.ai_service.chat_with_system(
                system_prompt=SYSTEM_PROMPT,
                messages=messages,
                model=model
            )

            try:
                decision = json.loads(response.content)
            except json.JSONDecodeError:
                decision = {
                    "thinking": response.content,
                    "action": None,
                    "is_complete": True,
                    "summary": "AI response was not valid JSON"
                }

            step_info = {
                "iteration": iteration + 1,
                "thinking": decision.get("thinking", ""),
                "plan": decision.get("plan", []),
                "action": decision.get("action"),
                "summary": decision.get("summary", "")
            }
            steps.append(step_info)

            if decision.get("is_complete", False):
                break

            action = decision.get("action")
            if action:
                result = self._execute_action(action, document, current_content)
                step_info["result"] = result
                current_content = document.content
                
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                messages.append({
                    "role": "user",
                    "content": f"操作结果: {result}\n当前文档内容:\n{current_content[:1000]}..."
                })

        self.db.commit()

        return WorkflowResponse(
            success=True,
            message="Workflow executed successfully",
            steps=steps,
            final_content=current_content,
            iterations=len(steps)
        )

    def _execute_action(self, action: Dict[str, Any], document: Document, current_content: str) -> str:
        function_name = action.get("function")
        params = action.get("params", {})

        lines = document.content.split("\n") if document.content else []

        if function_name == "getDocumentById":
            return f"文档内容 ({len(lines)} 行): {document.content[:500]}..."

        elif function_name == "insertEnd":
            content = params.get("content", "")
            document.content = (document.content or "") + "\n" + content
            return f"已在末尾追加内容"

        elif function_name == "deleteByRange":
            start = params.get("start_line", 1) - 1
            end = params.get("end_line", len(lines))
            del lines[start:end]
            document.content = "\n".join(lines)
            return f"已删除第 {start+1} 到 {end} 行"

        elif function_name == "deleteAndSwap":
            start = params.get("start_line", 1) - 1
            end = params.get("end_line", start + 1)
            new_content = params.get("new_content", "")
            lines[start:end] = [new_content]
            document.content = "\n".join(lines)
            return f"已替换第 {start+1} 到 {end} 行"

        elif function_name == "updateDocumentContent":
            document.content = params.get("content", "")
            return "已更新整个文档"

        else:
            return f"未知函数: {function_name}"
