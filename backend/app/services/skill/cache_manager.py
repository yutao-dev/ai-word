from typing import Dict, Optional
import time

class CacheManager:
    """缓存管理模块"""
    
    def __init__(self):
        # 本地缓存，用于跟踪缓存状态
        self.cache_status = {}
        # 缓存有效期（秒）
        self.cache_ttl = 300  # 5分钟
    
    def get_cache_key(self, skill_types: list, model_name: str) -> str:
        """
        生成缓存键
        
        Args:
            skill_types: Skill 类型列表
            model_name: 模型名称
            
        Returns:
            缓存键
        """
        sorted_skills = sorted(skill_types)
        skills_str = "_".join(sorted_skills)
        return f"{skills_str}_{model_name}"
    
    def is_cache_valid(self, cache_key: str) -> bool:
        """
        检查缓存是否有效
        
        Args:
            cache_key: 缓存键
            
        Returns:
            缓存是否有效
        """
        if cache_key not in self.cache_status:
            return False
        
        timestamp = self.cache_status[cache_key]
        return time.time() - timestamp < self.cache_ttl
    
    def update_cache(self, cache_key: str):
        """
        更新缓存状态
        
        Args:
            cache_key: 缓存键
        """
        self.cache_status[cache_key] = time.time()
    
    def invalidate_cache(self, cache_key: str):
        """
        使缓存失效
        
        Args:
            cache_key: 缓存键
        """
        if cache_key in self.cache_status:
            del self.cache_status[cache_key]
    
    def get_document_type(self, skill_types: list, model_name: str, iteration: int) -> str:
        """
        根据缓存状态确定文档类型
        
        Args:
            skill_types: Skill 类型列表
            model_name: 模型名称
            iteration: 迭代次数
            
        Returns:
            文档类型 (full 或 compact)
        """
        if iteration == 1:
            # 首轮始终使用完整文档
            cache_key = self.get_cache_key(skill_types, model_name)
            self.update_cache(cache_key)
            return "full"
        
        # 后续轮次检查缓存是否有效
        cache_key = self.get_cache_key(skill_types, model_name)
        if self.is_cache_valid(cache_key):
            return "compact"
        else:
            # 缓存失效，使用完整文档并更新缓存
            self.update_cache(cache_key)
            return "full"
