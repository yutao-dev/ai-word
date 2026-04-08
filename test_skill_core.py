#!/usr/bin/env python3
"""测试 Skill 服务核心功能"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 直接导入 Skill 服务的核心模块
from backend.app.services.skill.document_manager import DocumentManager
from backend.app.services.skill.skill_analyzer import SkillAnalyzer
from backend.app.services.skill.cache_manager import CacheManager

# 获取技能文档目录
SKILLS_DIR = os.path.join(os.path.dirname(__file__), 'backend', 'app', 'skills')

def test_document_manager():
    """测试文档管理模块"""
    print("测试文档管理模块...")
    
    document_manager = DocumentManager(SKILLS_DIR)
    
    # 测试获取可用技能
    skill_types = document_manager.get_skill_types()
    print(f"可用技能类型: {skill_types}")
    
    # 测试获取核心文档
    core_doc = document_manager.get_document("core")
    if core_doc:
        print(f"核心文档长度: {len(core_doc)}")
        print(f"核心文档前 100 字符: {core_doc[:100]}...")
    else:
        print("核心文档未找到")
    
    # 测试获取核心文档的精简版
    core_compact = document_manager.get_document("core", "compact")
    if core_compact:
        print(f"核心精简文档长度: {len(core_compact)}")
        print(f"核心精简文档前 100 字符: {core_compact[:100]}...")
    else:
        print("核心精简文档未找到")
    
    # 测试构建提示词
    prompt = document_manager.build_prompt(["core", "document_editing"], 1)
    print(f"构建的提示词长度: {len(prompt)}")
    print(f"构建的提示词前 100 字符: {prompt[:100]}...")
    
    print("文档管理模块测试完成！")

def test_skill_analyzer():
    """测试 Skill 分析模块"""
    print("\n测试 Skill 分析模块...")
    
    analyzer = SkillAnalyzer()
    
    # 测试分析请求
    test_request = "请在文档末尾添加一段关于软件设计模式的介绍"
    selected_skills = analyzer.analyze_request(test_request)
    print(f"分析请求 '{test_request}' 选择的技能: {selected_skills}")
    
    # 测试分析另一个请求
    test_request_2 = "请从文档中提取关键词"
    selected_skills_2 = analyzer.analyze_request(test_request_2)
    print(f"分析请求 '{test_request_2}' 选择的技能: {selected_skills_2}")
    
    # 测试获取置信度
    confidence = analyzer.get_skill_confidence(test_request)
    print(f"置信度: {confidence}")
    
    print("Skill 分析模块测试完成！")

def test_cache_manager():
    """测试缓存管理模块"""
    print("\n测试缓存管理模块...")
    
    cache_manager = CacheManager()
    
    # 测试生成缓存键
    cache_key = cache_manager.get_cache_key(["core", "document_editing"], "test-model")
    print(f"生成的缓存键: {cache_key}")
    
    # 测试缓存状态
    is_valid = cache_manager.is_cache_valid(cache_key)
    print(f"缓存是否有效: {is_valid}")
    
    # 测试更新缓存
    cache_manager.update_cache(cache_key)
    is_valid_after_update = cache_manager.is_cache_valid(cache_key)
    print(f"更新后缓存是否有效: {is_valid_after_update}")
    
    # 测试获取文档类型
    doc_type = cache_manager.get_document_type(["core", "document_editing"], "test-model", 1)
    print(f"首轮文档类型: {doc_type}")
    
    doc_type_2 = cache_manager.get_document_type(["core", "document_editing"], "test-model", 2)
    print(f"后续轮次文档类型: {doc_type_2}")
    
    print("缓存管理模块测试完成！")

if __name__ == "__main__":
    test_document_manager()
    test_skill_analyzer()
    test_cache_manager()
    print("\n所有测试完成！")
