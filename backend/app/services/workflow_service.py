import json
import os
from typing import List, Dict, Any, Optional
from numpy import swapaxes
from sqlalchemy.orm import Session, attributes
from .ai_service import AIService
from .skill.skill_service import SkillService
from .prompt.prompt_builder import PromptBuilderService
from ..models.document import Document
from ..models.ai_schemas import WorkflowResponse

# 获取技能文档目录
SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'skills')

class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.workflow_id = None
        self.ai_service = AIService(db)
        self.skill_service = SkillService(SKILLS_DIR)
        self.prompt_builder = PromptBuilderService()



    async def execute(
        self,
        user_request: str,
        document_id: str,
        model: Optional[str] = None,
        max_iterations: int = 10,
        context_mode: str = "limited"
    ) -> WorkflowResponse:
        """
        执行文档编辑工作流
        
        该方法通过多轮对话与AI交互，根据用户请求自动执行文档操作。
        每轮迭代中，AI会分析当前状态并决定下一步操作，直到任务完成或达到最大迭代次数。
        
        Args:
            user_request: 用户的自然语言请求
            document_id: 目标文档ID
            model: 使用的AI模型名称，默认为None
            max_iterations: 最大迭代次数，防止无限循环，默认为10次
            
        Returns:
            WorkflowResponse: 包含执行步骤、最终结果等信息的工作流响应对象
            
        Raises:
            ValueError: 当指定文档不存在时抛出
        """
        # 验证目标文档是否存在
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError("Document not found")

        # 生成唯一的工作流ID，用于追踪本次执行会话
        import uuid
        self.workflow_id = str(uuid.uuid4())
        # 创建工作流专用的AI服务实例，用于记录Token使用情况
        workflow_ai_service = AIService(self.db, workflow_id=self.workflow_id)

        # 初始化工作流状态
        steps = []  # 存储每轮的执行步骤信息
        current_content = document.content  # 记录当前文档内容
        # 初始化对话历史，第一条消息是用户的原始请求
        messages = [{"role": "user", "content": user_request}]

        # 获取当前所有未删除的文档列表
        docs = self.db.query(Document).filter(Document.is_deleted == False).all()
        
        # 使用提示词构建服务构建系统提示词
        document_context = self.prompt_builder.build_document_context(docs)
        skill_prompt = self.skill_service.process_request(user_request, model)
        full_system_prompt = self.prompt_builder.build_system_prompt(skill_prompt, document_context)

        # 开始多轮迭代执行
        for iteration in range(max_iterations):

            # 调用AI服务获取决策响应
            response = await workflow_ai_service.chat_with_system(
                system_prompt=full_system_prompt,
                messages=messages,
                model=model
            )
            decision = self.prompt_builder.parse_decision(response.content)
            
            # 获取AI决策的操作指令
            action = decision.get("action")
            
            # 判断当前操作是否为文档修改操作
            has_modification = self.prompt_builder.is_modification_action(action)
            
            # 安全检查：如果AI标记完成但没有执行修改操作，强制继续执行
            decision = self.prompt_builder.validate_completion(decision, has_modification)
            if not decision.get("is_complete", False) and decision.get("is_complete") != decision.get("is_complete"):
                print(f"[execute_stream] AI 标记为完成但没有执行修改操作，忽略并继续")
            
            # 构建当前步骤的信息记录
            step_info = self.prompt_builder.build_step_info(iteration + 1, decision)
            steps.append(step_info)

            # 如果任务已完成，退出循环
            if decision.get("is_complete", False):
                break

            # 将AI的响应添加到对话历史
            messages = self.prompt_builder.add_assistant_message(messages, response.content)
            if action:
                # 执行AI指定的文档操作
                result = self._execute_action(action, document_id)
                # 记录操作结果到当前步骤
                step_info["result"] = result
                # 更新当前文档内容
                current_content = document.content
                
                # 特殊处理：如果执行了创建文档操作，需要将创建好的文档id也传递给AI，用于后续操作
                func_name = action.get("function")
                if func_name == "createDocument":
                    has_modification = True
                
                # 将操作结果和当前文档内容反馈给AI，用于下一轮决策
                feedback_content = self.prompt_builder.build_action_feedback_message(result, current_content)
                messages = self.prompt_builder.add_user_message(messages, feedback_content)
            else:
                        
                # 提示AI根据当前文档内容继续执行操作
                continue_content = self.prompt_builder.build_continue_prompt(current_content)
                messages = self.prompt_builder.add_user_message(messages, continue_content)
            
            # 在当前迭代结束后，最后添加当前迭代的轮数
            messages = self.prompt_builder.add_assistant_message(messages, f"当前迭代轮数: {iteration + 1}， 最大迭代次数: {max_iterations}, 请注意迭代次数。")


        # 提交所有数据库变更
        self.db.commit()

        # 返回工作流执行结果
        return WorkflowResponse(
            success=True,
            message="Workflow executed successfully",
            steps=steps,
            final_content=current_content,
            iterations=len(steps)
        )

    async def execute_stream(
        self,
        user_request: str,
        document_id: str,
        model: Optional[str] = None,
        max_iterations: int = 10,
        context_mode: str = "limited"
    ):
        """流式执行工作流，实时返回步骤"""
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            yield {"type": "error", "message": "Document not found"}
            return

        # 初始化工作流ID
        import uuid
        self.workflow_id = str(uuid.uuid4())
        
        # 初始化对话历史
        messages = [{"role": "user", "content": user_request}]

        # 获取当前所有未删除的文档列表
        docs = self.db.query(Document).filter(Document.is_deleted == False).all()
        
        # 使用提示词构建服务构建系统提示词（循环外构建，保持缓存一致性）
        document_context = self.prompt_builder.build_document_context(docs)
        skill_prompt = self.skill_service.process_request(user_request, model)
        full_system_prompt = self.prompt_builder.build_system_prompt(skill_prompt, document_context)

        # 开始多轮迭代执行
        for iteration in range(max_iterations):
            # 调用AI服务获取决策响应
            response = await self.ai_service.chat_with_system(
                system_prompt=full_system_prompt,
                messages=messages,
                model=model
            )

            decision = self.prompt_builder.parse_decision(response.content)
            
            # 获取AI决策的操作指令
            action = decision.get("action")
            
            # 判断当前操作是否为文档修改操作
            has_modification = self.prompt_builder.is_modification_action(action)
            
            # 安全检查：如果AI标记完成但没有执行修改操作，强制继续执行
            decision = self.prompt_builder.validate_completion(decision, has_modification)
            
            # 构建当前步骤的信息记录
            step_info = self.prompt_builder.build_step_info(iteration + 1, decision)
            yield {"type": "step", "step": step_info, "iteration": iteration + 1}
            
            if action:
                print(f"[execute_stream] 执行 action: {json.dumps(action, ensure_ascii=False)[:300]}")
                result = self._execute_action(action, document_id)
                print(f"[execute_stream] action 执行结果: {result[:200] if len(result) > 200 else result}")
                step_info["result"] = result
                
                # 如果执行了创建文档操作，自动标记任务完成
                func_name = action.get("function")
                if func_name == "createDocument":
                    decision["is_complete"] = True
                    has_modification = True
                
                self.db.expire_all()
                document = self.db.query(Document).filter(Document.id == document_id).first()
                print(f"[execute_stream] 刷新后文档内容长度: {len(document.content) if document else 'N/A'}")
                
                messages = self.prompt_builder.add_assistant_message(messages, response.content)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, f"操作结果: {result}")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                print(f"[execute_stream] 第 {iteration + 1} 轮执行完成")
            else:
                print(f"[execute_stream] AI 没有返回 action，继续等待")
                messages = self.prompt_builder.add_assistant_message(messages, response.content)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, "请继续执行操作。")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
            
            if decision.get("is_complete", False):
                if has_modification:
                    print(f"[execute_stream] 修改操作已执行，现在退出循环")
                else:
                    print(f"[execute_stream] AI 标记为完成且没有修改操作，退出循环")
                break

        self.db.commit()

        current_doc = self.db.query(Document).filter(Document.id == document_id).first()
        yield {
            "type": "complete",
            "result": {
                "success": True,
                "message": "Workflow executed successfully",
                "final_content": current_doc.content if current_doc else "",
                "iterations": iteration + 1,
                "workflow_id": self.workflow_id
            }
        }

    ACTION_DESCRIPTIONS = {
        "getDocumentById": "查询文档",
        "getAllDocument": "获取文档列表",
        "createDocument": "创建文档",
        "updateDocumentContent": "修改文档",
        "insertEnd": "追加内容",
        "insertAt": "插入内容",
        "insertAfterHeading": "在标题后插入",
        "insertParagraph": "插入段落",
        "deleteByRange": "删除内容",
        "deleteAndSwap": "删除并替换",
        "findAndReplace": "查找替换",
        "moveSection": "移动章节",
        "searchInDocument": "搜索文档",
        "getDocumentOutline": "获取大纲",
        "getSectionByHeading": "获取章节",
        "getTokenUsage": "查询Token使用",
        "getDocumentStats": "获取文档统计",
        "extractKeyInfo": "提取关键信息",
        "batchOperations": "批量执行操作"
    }

    def _get_action_description(self, function_name: str, target_title: str = None) -> str:
        desc = self.ACTION_DESCRIPTIONS.get(function_name, function_name)
        if target_title:
            return f"正在{desc}《{target_title}》"
        return f"正在{desc}"

    async def execute_stream_v2(
        self,
        user_request: str,
        document_id: str,
        model: Optional[str] = None,
        max_iterations: int = 10,
        context_mode: str = "limited"
    ):
        """流式执行工作流 v2 - 实时展示思考和操作进度"""
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            yield {"type": "error", "message": "Document not found"}
            return

        # 初始化工作流ID
        import uuid
        self.workflow_id = str(uuid.uuid4())
        workflow_ai_service = AIService(self.db, workflow_id=self.workflow_id)

        # 初始化对话历史
        messages = [{"role": "user", "content": user_request}]
        already_complete = False

        # 获取当前所有未删除的文档列表
        docs = self.db.query(Document).filter(Document.is_deleted == False).all()
        
        # 使用提示词构建服务构建系统提示词（循环外构建，保持缓存一致性）
        print(f"[execute_stream_v2] 正在生成系统提示词...")
        document_context = self.prompt_builder.build_document_context(docs)
        skill_prompt = self.skill_service.process_request(user_request, model)
        full_system_prompt = self.prompt_builder.build_system_prompt(skill_prompt, document_context)
        full_system_prompt = self.prompt_builder.add_max_iterations(full_system_prompt, max_iterations)
        print(f"[execute_stream_v2] 系统提示词长度: {len(full_system_prompt)}")

        # 开始多轮迭代执行
        for iteration in range(max_iterations):
            print(f"[execute_stream_v2] 开始第 {iteration + 1} 轮迭代")

            yield {
                "type": "thinking",
                "content": "正在思考...",
                "iteration": iteration + 1
            }

            response_text = ""
            thinking_streamed = False
            print(f"[execute_stream_v2] 正在调用 AI 服务...")
            async for token in workflow_ai_service.chat_with_system_stream(
                system_prompt=full_system_prompt,
                messages=messages,
                model=model
            ):
                if token.get("type") == "error":
                    print(f"[execute_stream_v2] AI 服务错误: {token.get('content')}")
                    yield token
                    return
                if token.get("type") == "token":
                    response_text += token["content"]
                    if not thinking_streamed:
                        yield {
                            "type": "thinking",
                            "content": "正在思考...",
                            "iteration": iteration + 1
                        }
                        thinking_streamed = True

            print(f"[execute_stream_v2] AI 服务返回结果: {response_text[:300]}...")

            yield {
                "type": "thinking_done",
                "content": response_text,
                "iteration": iteration + 1
            }

            decision = self.prompt_builder.parse_decision(response_text)
            action = decision.get("action")
            has_modification = self.prompt_builder.is_modification_action(action)
            
            # 安全检查：如果AI标记完成但没有执行修改操作，强制继续执行
            decision = self.prompt_builder.validate_completion(decision, has_modification)
            
            print(f"[execute_stream_v2] 分析结果: action={action is not None}, is_complete={decision.get('is_complete', False)}, has_modification={has_modification}")

            if action:
                func_name = action.get("function")
                params = action.get("params", {})
                target_doc_id = params.get("document_id", document_id)
                target_doc = self.db.query(Document).filter(Document.id == target_doc_id).first()
                target_title = target_doc.title if target_doc else target_doc_id

                print(f"[execute_stream_v2] 准备执行操作: {func_name}，目标: {target_title}")

                yield {
                    "type": "action_start",
                    "function": func_name,
                    "target": target_title,
                    "description": self._get_action_description(func_name, target_title),
                    "iteration": iteration + 1
                }

                result = self._execute_action(action, document_id)
                print(f"[execute_stream_v2] 操作执行结果: {result[:200] if len(result) > 200 else result}")

                yield {
                    "type": "action_complete",
                    "function": func_name,
                    "target": target_title,
                    "result": result,
                    "iteration": iteration + 1
                }

                self.db.expire_all()
                document = self.db.query(Document).filter(Document.id == document_id).first()
                print(f"[execute_stream_v2] 刷新后文档内容长度: {len(document.content) if document else 'N/A'}")

                messages = self.prompt_builder.add_assistant_message(messages, response_text)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, f"操作结果: {result}")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                
                # 如果执行了创建文档操作，自动标记任务完成
                if func_name == "createDocument":
                    print(f"[execute_stream_v2] 执行了创建文档操作，自动标记任务完成")
                    decision["is_complete"] = True
                    has_modification = True
            else:
                print(f"[execute_stream_v2] 没有操作，继续执行下一轮")
                messages = self.prompt_builder.add_assistant_message(messages, response_text)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, "请继续执行操作。")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)

            if decision.get("is_complete", False):
                print(f"[execute_stream_v2] 任务标记为完成，has_modification={has_modification}")
                if has_modification:
                    print(f"[execute_stream_v2] 有修改操作，返回完成结果")
                    yield {
                        "type": "complete",
                        "result": {
                            "success": True,
                            "message": "任务已完成",
                            "final_content": document.content if document else "",
                            "iterations": iteration + 1,
                            "workflow_id": self.workflow_id
                        }
                    }
                    already_complete = True
                else:
                    print(f"[execute_stream_v2] 没有修改操作，退出循环")
                break

        if not already_complete:
            print(f"[execute_stream_v2] 已达最大迭代次数，返回完成结果")
            self.db.commit()
            yield {
                "type": "complete",
                "result": {
                    "success": True,
                    "message": "已达最大迭代次数",
                    "final_content": document.content if document else "",
                    "iterations": iteration + 1,
                    "workflow_id": self.workflow_id
                }
            }

    async def execute_stream_v3(
        self,
        user_request: str,
        document_id: str,
        model: Optional[str] = None,
        max_iterations: int = 10,
        context_mode: str = "limited"
    ):
        """流式执行工作流 v3 - 优化提示词结构，精简操作结果"""
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            yield {"type": "error", "message": "Document not found"}
            return

        # 初始化工作流ID
        import uuid
        self.workflow_id = str(uuid.uuid4())
        workflow_ai_service = AIService(self.db, workflow_id=self.workflow_id)

        # 初始化对话历史
        messages = [{"role": "user", "content": user_request}]
        already_complete = False

        # 获取当前所有未删除的文档列表
        docs = self.db.query(Document).filter(Document.is_deleted == False).all()
        
        # 使用提示词构建服务构建系统提示词（循环外构建，保持缓存一致性）
        print(f"[execute_stream_v3] 正在生成系统提示词...")
        document_context = self.prompt_builder.build_document_context(docs)
        skill_prompt = self.skill_service.process_request(user_request, model)
        full_system_prompt = self.prompt_builder.build_system_prompt(skill_prompt, document_context)
        full_system_prompt = self.prompt_builder.add_max_iterations(full_system_prompt, max_iterations)
        print(f"[execute_stream_v3] 系统提示词长度: {len(full_system_prompt)}")

        # 开始多轮迭代执行
        for iteration in range(max_iterations):
            print(f"[execute_stream_v3] 开始第 {iteration + 1} 轮迭代")

            yield {
                "type": "thinking",
                "content": "正在思考...",
                "iteration": iteration + 1
            }

            response_text = ""
            thinking_streamed = False
            print(f"[execute_stream_v3] 正在调用 AI 服务...")
            async for token in workflow_ai_service.chat_with_system_stream(
                system_prompt=full_system_prompt,
                messages=messages,
                model=model
            ):
                if token.get("type") == "error":
                    print(f"[execute_stream_v3] AI 服务错误: {token.get('content')}")
                    yield token
                    return
                if token.get("type") == "token":
                    response_text += token["content"]
                    if not thinking_streamed:
                        yield {
                            "type": "thinking",
                            "content": "正在思考...",
                            "iteration": iteration + 1
                        }
                        thinking_streamed = True

            print(f"[execute_stream_v3] AI 服务返回结果: {response_text[:300]}...")

            yield {
                "type": "thinking_done",
                "content": response_text,
                "iteration": iteration + 1
            }

            decision = self.prompt_builder.parse_decision(response_text)
            action = decision.get("action")
            has_modification = self.prompt_builder.is_modification_action(action)
            
            # 安全检查：如果AI标记完成但没有执行修改操作，强制继续执行
            decision = self.prompt_builder.validate_completion(decision, has_modification)
            
            print(f"[execute_stream_v3] 分析结果: action={action is not None}, is_complete={decision.get('is_complete', False)}, has_modification={has_modification}")

            if action:
                func_name = action.get("function")
                params = action.get("params", {})
                target_doc_id = params.get("document_id", document_id)
                target_doc = self.db.query(Document).filter(Document.id == target_doc_id).first()
                target_title = target_doc.title if target_doc else target_doc_id

                print(f"[execute_stream_v3] 准备执行操作: {func_name}，目标: {target_title}")

                yield {
                    "type": "action_start",
                    "function": func_name,
                    "target": target_title,
                    "description": self._get_action_description(func_name, target_title),
                    "iteration": iteration + 1
                }

                result = self._execute_action(action, document_id)
                print(f"[execute_stream_v3] 操作执行结果: {result[:200] if len(result) > 200 else result}")

                yield {
                    "type": "action_complete",
                    "function": func_name,
                    "target": target_title,
                    "result": result,
                    "iteration": iteration + 1
                }

                self.db.expire_all()
                document = self.db.query(Document).filter(Document.id == document_id).first()
                print(f"[execute_stream_v3] 刷新后文档内容长度: {len(document.content) if document else 'N/A'}")

                # 优化提示词结构：精简操作结果
                optimized_result = result
                if func_name in ['insertEnd', 'insertAt', 'insertAfterHeading', 'insertParagraph']:
                    # 插入操作：只显示调用函数以及省略的操作
                    content_param = params.get('content', '')
                    if content_param:
                        truncated_content = content_param[:20] + ('...' if len(content_param) > 20 else '')
                        optimized_result = f"{func_name}({truncated_content}) 操作成功"
                elif func_name in ['updateDocumentContent', 'findAndReplace']:
                    # 修改操作：精简显示
                    content_param = params.get('content', '') or params.get('replacement', '')
                    if content_param:
                        truncated_content = content_param[:20] + ('...' if len(content_param) > 20 else '')
                        optimized_result = f"{func_name} 操作成功，内容: {truncated_content}"
                # 查询操作保持完整结果

                messages = self.prompt_builder.add_assistant_message(messages, response_text)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, f"操作结果: {optimized_result}")
                # 在消息最后插入当前的迭代轮数/最长的迭代轮数
                messages = self.prompt_builder.add_user_message(messages, f"当前迭代: {iteration + 1}/{max_iterations}，请合理规划后续步骤")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                
                # 如果执行了创建文档操作，自动标记任务完成
                if func_name == "createDocument":
                    print(f"[execute_stream_v3] 执行了创建文档操作，自动标记任务完成")
                    decision["is_complete"] = True
                    has_modification = True
            else:
                print(f"[execute_stream_v3] 没有操作，继续执行下一轮")
                messages = self.prompt_builder.add_assistant_message(messages, response_text)
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)
                messages = self.prompt_builder.add_user_message(messages, "请继续执行操作。")
                # 在消息最后插入当前的迭代轮数/最长的迭代轮数
                messages = self.prompt_builder.add_user_message(messages, f"当前迭代: {iteration + 1}/{max_iterations}，请合理规划后续步骤")
                messages = self.prompt_builder.manage_context_history(messages, context_mode=context_mode)

            if decision.get("is_complete", False):
                print(f"[execute_stream_v3] 任务标记为完成，has_modification={has_modification}")
                if has_modification:
                    print(f"[execute_stream_v3] 有修改操作，返回完成结果")
                    yield {
                        "type": "complete",
                        "result": {
                            "success": True,
                            "message": "任务已完成",
                            "final_content": document.content if document else "",
                            "iterations": iteration + 1,
                            "workflow_id": self.workflow_id
                        }
                    }
                    already_complete = True
                else:
                    print(f"[execute_stream_v3] 没有修改操作，退出循环")
                break

        if not already_complete:
            print(f"[execute_stream_v3] 已达最大迭代次数，返回完成结果")
            self.db.commit()
            yield {
                "type": "complete",
                "result": {
                    "success": True,
                    "message": "已达最大迭代次数",
                    "final_content": document.content if document else "",
                    "iterations": iteration + 1,
                    "workflow_id": self.workflow_id
                }
            }

    def _execute_action(self, action: Dict[str, Any], current_doc_id: str) -> str:
        import re
        function_name = action.get("function")
        params = action.get("params", {})
        
        target_doc_id = params.get("document_id", current_doc_id)
        
        print(f"[_execute_action] 开始执行函数: {function_name}, target_doc_id={target_doc_id}, current_doc_id={current_doc_id}")
        print(f"[_execute_action] 参数: {json.dumps(params, ensure_ascii=False)[:500]}")
        
        if function_name == "createDocument":
            from ..models.document import Document as DocModel
            new_doc = DocModel(
                title=params.get("title", "新文档"),
                content=params.get("content", "")
            )
            self.db.add(new_doc)
            self.db.commit()
            self.db.refresh(new_doc)
            print(f"[createDocument] 已创建新文档: {new_doc.title} (ID: {new_doc.id})")
            print(f"[createDocument] 文档内容长度: {len(new_doc.content) if new_doc.content else 0}")
            return f"已创建新文档: {params.get('title', '新文档')} (ID: {new_doc.id})"

        elif function_name == "getAllDocument":
            docs = self.db.query(Document).filter(Document.is_deleted == False).all()
            doc_list = [{"id": d.id, "title": d.title} for d in docs]
            print(f"[getAllDocument] 找到 {len(docs)} 个文档")
            return f"共有 {len(docs)} 个文档: {json.dumps(doc_list, ensure_ascii=False)}"

        elif function_name == "getTokenUsage":
            from ..models.document import TokenUsage
            stats = self.db.query(TokenUsage).all()
            total_tokens = sum(s.total_tokens for s in stats)
            print(f"[getTokenUsage] 找到 {len(stats)} 条记录，总计 {total_tokens} tokens")
            return f"Token 使用统计: 共 {len(stats)} 次请求, 总计 {total_tokens} tokens"

        document = self.db.query(Document).filter(Document.id == target_doc_id, Document.is_deleted == False).first()
        if not document:
            print(f"[_execute_action] 错误: 未找到文档 ID: {target_doc_id}")
            return f"错误: 未找到文档 ID: {target_doc_id}"
        
        print(f"[_execute_action] 找到文档: {document.title}, 当前内容长度: {len(document.content or '')}")

        lines = document.content.split("\n") if document.content else []

        if function_name == "getDocumentById":
            return f"文档 '{document.title}' (ID: {target_doc_id}) 内容 ({len(lines)} 行):\n{document.content[:1000]}{'...' if len(document.content or '') > 1000 else ''}"

        elif function_name == "searchInDocument":
            keyword = params.get("keyword", "")
            if not keyword:
                return "错误: searchInDocument 需要 keyword 参数"
            case_sensitive = params.get("case_sensitive", False)
            matches = []
            for i, line in enumerate(lines, 1):
                if keyword in line if case_sensitive else keyword.lower() in line.lower():
                    matches.append(f"第{i}行: {line[:100]}")
            return f"在文档 '{document.title}' 中找到 {len(matches)} 处匹配:\n" + "\n".join(matches[:10])

        elif function_name == "findAndReplace":
            find_text = params.get("find_text", "")
            replace_text = params.get("replace_text", "")
            if not find_text:
                return "错误: findAndReplace 需要 find_text 参数"
            replace_all = params.get("replace_all", False)
            if replace_all:
                count = document.content.count(find_text)
                document.content = document.content.replace(find_text, replace_text)
            else:
                document.content = document.content.replace(find_text, replace_text, 1)
                count = 1
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已在文档 '{document.title}' 中替换 {count} 处文本"

        elif function_name == "getDocumentOutline":
            headings = []
            for i, line in enumerate(lines, 1):
                match = re.match(r'^(#{1,6})\s+(.+)$', line)
                if match:
                    level = len(match.group(1))
                    text = match.group(2).strip()
                    headings.append(f"{'  ' * (level - 1)}H{level}: {text} (第{i}行)")
            return f"文档 '{document.title}' 大纲:\n" + "\n".join(headings) if headings else f"文档 '{document.title}' 没有标题"

        elif function_name == "getSectionByHeading":
            heading_text = params.get("heading_text", "")
            if not heading_text:
                return "错误: getSectionByHeading 需要 heading_text 参数"
            start_line = None
            end_line = len(lines)
            heading_level = None
            for i, line in enumerate(lines):
                match = re.match(r'^(#{1,6})\s+(.+)$', line)
                if match:
                    level = len(match.group(1))
                    text = match.group(2).strip()
                    if start_line is None and heading_text.lower() in text.lower():
                        start_line = i
                        heading_level = level
                    elif start_line is not None and level <= heading_level:
                        end_line = i
                        break
            if start_line is not None:
                section = "\n".join(lines[start_line:end_line])
                return f"文档 '{document.title}' 章节内容:\n{section[:500]}{'...' if len(section) > 500 else ''}"
            return f"未在文档 '{document.title}' 中找到标题: {heading_text}"

        elif function_name == "insertEnd":
            content = params.get("content", "")
            if not content:
                return "错误: insertEnd 需要 content 参数"
            document.content = (document.content or "") + "\n" + content
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已在末尾追加内容 ({len(content)} 字符)"

        elif function_name == "insertAt":
            position_type = params.get("position_type", "end")
            position_value = params.get("position_value", "")
            content = params.get("content", "")
            
            if not content:
                return "错误: insertAt 需要 content 参数"
            
            content_lines = content.split("\n")
            
            insert_index = len(lines)
            if position_type == "line":
                try:
                    insert_index = int(position_value) - 1
                    if insert_index < 0 or insert_index > len(lines):
                        return f"错误: 无效的行号 {position_value}，文档共 {len(lines)} 行"
                except ValueError:
                    return f"错误: position_value 必须是数字，当前为 '{position_value}'"
            elif position_type == "start":
                insert_index = 0
            elif position_type == "heading":
                for i, line in enumerate(lines):
                    match = re.match(r'^#{1,6}\s+(.+)$', line)
                    if match and position_value.lower() in match.group(1).lower():
                        insert_index = i + 1
                        break
            elif position_type == "keyword":
                for i, line in enumerate(lines):
                    if position_value in line:
                        insert_index = i + 1
                        break
            
            insert_index = max(0, min(insert_index, len(lines)))
            lines = lines[:insert_index] + content_lines + lines[insert_index:]
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已在位置 {insert_index + 1} 插入内容"

        elif function_name == "insertAfterHeading":
            heading_text = params.get("heading_text", "")
            content = params.get("content", "")
            
            if not content:
                return "错误: insertAfterHeading 需要 content 参数"
            if not heading_text:
                return "错误: insertAfterHeading 需要 heading_text 参数"
            
            content_lines = content.split("\n")
            insert_index = len(lines)
            
            for i, line in enumerate(lines):
                match = re.match(r'^#{1,6}\s+(.+)$', line)
                if match and heading_text.lower() in match.group(1).lower():
                    insert_index = i + 1
                    break
            
            lines = lines[:insert_index] + content_lines + lines[insert_index:]
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已在标题 '{heading_text}' 后插入内容"

        elif function_name == "insertParagraph":
            content = params.get("content", "")
            after_line = params.get("after_line")
            before_line = params.get("before_line")
            
            if not content:
                return "错误: insertParagraph 需要 content 参数"
            
            content_lines = content.split("\n")
            
            if after_line is not None:
                insert_index = after_line
            elif before_line is not None:
                insert_index = before_line - 1
            else:
                insert_index = len(lines)
            
            lines = lines[:insert_index] + content_lines + lines[insert_index:]
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已插入段落"

        elif function_name == "deleteByRange":
            start_line = params.get("start_line")
            end_line = params.get("end_line")
            if start_line is None or end_line is None:
                return "错误: deleteByRange 需要 start_line 和 end_line 参数"
            start = start_line - 1
            end = end_line
            if start < 0 or end > len(lines) or start >= end:
                return f"错误: 无效的行范围 {start_line}-{end_line}，文档共 {len(lines)} 行"
            deleted_lines = lines[start:end]
            del lines[start:end]
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已删除第 {start+1} 到 {end} 行 ({len(deleted_lines)} 行)"

        elif function_name == "deleteAndSwap":
            start_line = params.get("start_line")
            end_line = params.get("end_line")
            new_content = params.get("new_content", "")
            if start_line is None:
                return "错误: deleteAndSwap 需要 start_line 参数"
            start = start_line - 1
            end = end_line if end_line else start + 1
            if start < 0 or end > len(lines) or start >= end:
                return f"错误: 无效的行范围 {start_line}-{end_line}，文档共 {len(lines)} 行"
            new_lines = new_content.split("\n")
            lines[start:end] = new_lines
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已替换第 {start+1} 到 {end} 行"

        elif function_name == "updateDocumentContent":
            new_content = params.get("content")
            print(f"[updateDocumentContent] document_id={target_doc_id}, content_length={len(new_content) if new_content else 'None'}")
            if new_content is None:
                return "错误: updateDocumentContent 需要 content 参数。如果要清空文档，请显式传入空字符串"
            document.content = new_content
            attributes.flag_modified(document, 'content')
            self.db.commit()
            print(f"[updateDocumentContent] 已提交，文档 '{document.title}' 新内容长度: {len(document.content)}")
            return f"已更新整个文档 ({len(new_content)} 字符)"

        elif function_name == "moveSection":
            from_heading = params.get("from_heading", "")
            to_position = params.get("to_position", "end")
            to_position_value = params.get("to_position_value", "")
            
            if not from_heading:
                return "错误: moveSection 需要 from_heading 参数"
            
            start_line = None
            end_line = len(lines)
            heading_level = None
            
            for i, line in enumerate(lines):
                match = re.match(r'^(#{1,6})\s+(.+)$', line)
                if match:
                    level = len(match.group(1))
                    text = match.group(2).strip()
                    if start_line is None and from_heading.lower() in text.lower():
                        start_line = i
                        heading_level = level
                    elif start_line is not None and level <= heading_level:
                        end_line = i
                        break
            
            if start_line is None:
                return f"未找到标题: {from_heading}"
            
            section_lines = lines[start_line:end_line]
            del lines[start_line:end_line]
            
            insert_index = len(lines)
            if to_position == "start":
                insert_index = 0
            elif to_position == "line":
                try:
                    insert_index = int(to_position_value) - 1
                    if insert_index < 0 or insert_index > len(lines):
                        return f"错误: 无效的行号 {to_position_value}"
                except ValueError:
                    return f"错误: to_position_value 必须是数字，当前为 '{to_position_value}'"
            elif to_position == "heading":
                for i, line in enumerate(lines):
                    match = re.match(r'^#{1,6}\s+(.+)$', line)
                    if match and to_position_value.lower() in match.group(1).lower():
                        insert_index = i
                        break
            
            lines = lines[:insert_index] + section_lines + lines[insert_index:]
            document.content = "\n".join(lines)
            attributes.flag_modified(document, 'content')
            self.db.commit()
            return f"已移动章节 '{from_heading}'"

        elif function_name == "getDocumentStats":
            content = document.content or ""
            char_count = len(content)
            word_count = len(re.findall(r'[\u4e00-\u9fff]|[a-zA-Z]+', content))
            line_count = len(lines)
            heading_count = len(re.findall(r'^#{1,6}\s+', content, re.MULTILINE))
            paragraph_count = len([p for p in content.split('\n\n') if p.strip()])
            reading_time = round(word_count / 200, 1) if word_count > 0 else 0
            
            return f"文档统计: {char_count}字符, {word_count}字, {line_count}行, {heading_count}标题, {paragraph_count}段落, 预计阅读{reading_time}分钟"

        elif function_name == "extractKeyInfo":
            extract_type = params.get("extract_type", "links")
            content = document.content or ""
            items = []
            
            if extract_type == "links":
                items = re.findall(r'(?<!!)\[([^\]]*)\]\(([^)]+)\)', content)
                return f"找到 {len(items)} 个链接: {items[:10]}"
            elif extract_type == "images":
                items = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', content)
                return f"找到 {len(items)} 张图片: {items[:10]}"
            elif extract_type == "headings":
                items = re.findall(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE)
                return f"找到 {len(items)} 个标题: {[h[1] for h in items[:10]]}"
            elif extract_type == "code":
                items = re.findall(r'```[\s\S]*?```', content)
                return f"找到 {len(items)} 个代码块"
            elif extract_type == "tables":
                items = re.findall(r'^\|.*\|$', content, re.MULTILINE)
                return f"找到表格行数: {len(items)}"
            
            return f"提取类型: {extract_type}"

        elif function_name == "batchOperations":
            operations = params.get("operations", [])
            results = []
            for op in operations:
                op_result = self._execute_action({"function": op.get("operation"), "params": op.get("params", {})}, current_doc_id)
                results.append(op_result)
            return f"批量执行了 {len(operations)} 个操作: {results}"

        else:
            return f"未知函数: {function_name}"
