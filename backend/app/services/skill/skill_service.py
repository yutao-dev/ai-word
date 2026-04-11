from typing import List, Dict, Optional
from .document_manager import DocumentManager
from .skill_analyzer import SkillAnalyzer

class SkillService:
    """Skill 服务主模块"""
    
    def __init__(self, skills_dir: str):
        self.document_manager = DocumentManager(skills_dir)
        self.skill_analyzer = SkillAnalyzer()
    
    def process_request(self, user_request: str, model_name: str, iteration: int = 1) -> str:
        """
        处理用户请求，生成系统提示词
        
        Args:
            user_request: 用户请求
            model_name: 模型名称
            iteration: 迭代次数
            
        Returns:
            系统提示词
        """
        # 分析用户请求，选择 Skill
        selected_skills = self.skill_analyzer.analyze_request(user_request)
        
        # 构建系统提示词
        system_prompt = self.document_manager.build_prompt(selected_skills, iteration)
        
        return system_prompt
    
    def get_skill_analysis(self, user_request: str) -> Dict:
        """
        获取 Skill 分析结果
        
        Args:
            user_request: 用户请求
            
        Returns:
            分析结果
        """
        selected_skills = self.skill_analyzer.analyze_request(user_request)
        confidence = self.skill_analyzer.get_skill_confidence(user_request)
        
        return {
            "selected_skills": selected_skills,
            "confidence": confidence
        }
    
    def get_available_skills(self) -> List[str]:
        """
        获取所有可用的 Skill
        
        Returns:
            Skill 列表
        """
        return self.document_manager.get_skill_types()
