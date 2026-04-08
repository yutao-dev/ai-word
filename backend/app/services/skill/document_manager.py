import os
from typing import Dict, List, Optional

class DocumentManager:
    """文档管理模块"""
    
    def __init__(self, skills_dir: str):
        self.skills_dir = skills_dir
    
    def get_document(self, skill_type: str, document_type: str = "full") -> Optional[str]:
        """
        获取指定 Skill 的文档
        
        Args:
            skill_type: Skill 类型
            document_type: 文档类型 (full 或 compact)
            
        Returns:
            文档内容，如果不存在返回 None
        """
        filename = self._get_filename(skill_type, document_type)
        filepath = os.path.join(self.skills_dir, skill_type, filename)
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        return None
    
    def get_skill_types(self) -> List[str]:
        """
        获取所有可用的 Skill 类型
        
        Returns:
            Skill 类型列表
        """
        skill_types = []
        if os.path.exists(self.skills_dir):
            for item in os.listdir(self.skills_dir):
                item_path = os.path.join(self.skills_dir, item)
                if os.path.isdir(item_path):
                    skill_types.append(item)
        return skill_types
    
    def has_compact_document(self, skill_type: str) -> bool:
        """
        检查是否存在精简版文档
        
        Args:
            skill_type: Skill 类型
            
        Returns:
            是否存在精简版文档
        """
        filename = self._get_filename(skill_type, "compact")
        filepath = os.path.join(self.skills_dir, skill_type, filename)
        return os.path.exists(filepath)
    
    def _get_filename(self, skill_type: str, document_type: str) -> str:
        """
        获取文档文件名
        
        Args:
            skill_type: Skill 类型
            document_type: 文档类型
            
        Returns:
            文件名
        """
        base_name = skill_type.replace('_', '-')
        if document_type == "compact":
            return f"{base_name}_compact.md"
        return f"{base_name}.md"
    
    def build_prompt(self, skill_types: List[str], iteration: int = 1) -> str:
        """
        构建系统提示词
        
        Args:
            skill_types: Skill 类型列表
            iteration: 迭代次数
            
        Returns:
            系统提示词
        """
        documents = []
        
        for skill_type in skill_types:
            document_type = "full" if iteration == 1 else "compact"
            
            # 优先使用指定类型的文档
            content = self.get_document(skill_type, document_type)
            
            # 如果精简版不存在，使用完整版
            if content is None and document_type == "compact":
                content = self.get_document(skill_type, "full")
            
            if content:
                documents.append(content)
        
        return "\n\n".join(documents)
