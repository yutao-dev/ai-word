from typing import List, Dict
import re

class SkillAnalyzer:
    """Skill 分析与选择模块"""
    
    def __init__(self):
        # 技能关键词映射
        self.skill_keywords = {
            "document_editing": [
                "编辑", "修改", "添加", "删除", "插入", "替换", "格式", 
                "文档", "内容", "段落", "标题", "章节"
            ],
            "information_extraction": [
                "提取", "分析", "总结", "摘要", "信息", "数据", 
                "关键", "要点", "统计"
            ]
        }
    
    def analyze_request(self, user_request: str) -> List[str]:
        """
        分析用户请求，选择合适的 Skill
        
        Args:
            user_request: 用户请求
            
        Returns:
            选择的 Skill 类型列表
        """
        selected_skills = ["core"]  # 始终包含核心 Skill
        
        # 分析用户请求
        request_lower = user_request.lower()
        
        # 检查每个 Skill 的关键词
        for skill_type, keywords in self.skill_keywords.items():
            for keyword in keywords:
                if keyword in request_lower:
                    selected_skills.append(skill_type)
                    break
        
        # 去重
        return list(set(selected_skills))
    
    def get_skill_confidence(self, user_request: str) -> Dict[str, float]:
        """
        计算每个 Skill 的匹配置信度
        
        Args:
            user_request: 用户请求
            
        Returns:
            Skill 类型到置信度的映射
        """
        confidence = {"core": 1.0}  # 核心 Skill 始终为 1.0
        
        request_lower = user_request.lower()
        
        for skill_type, keywords in self.skill_keywords.items():
            matches = 0
            total = len(keywords)
            
            for keyword in keywords:
                if keyword in request_lower:
                    matches += 1
            
            if total > 0:
                confidence[skill_type] = matches / total
        
        return confidence
