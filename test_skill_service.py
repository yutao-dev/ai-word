#!/usr/bin/env python3
"""测试 Skill 服务"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app.services.skill.skill_service import SkillService

# 获取技能文档目录
SKILLS_DIR = os.path.join(os.path.dirname(__file__), 'backend', 'app', 'skills')

def test_skill_service():
    """测试 Skill 服务"""
    print("测试 Skill 服务...")
    
    # 初始化 Skill 服务
    skill_service = SkillService(SKILLS_DIR)
    
    # 测试获取可用技能
    available_skills = skill_service.get_available_skills()
    print(f"可用技能: {available_skills}")
    
    # 测试分析请求
    test_request = "请在文档末尾添加一段关于软件设计模式的介绍"
    analysis = skill_service.get_skill_analysis(test_request)
    print(f"请求分析结果: {analysis}")
    
    # 测试生成系统提示词（首轮）
    system_prompt_1 = skill_service.process_request(test_request, "test-model", 1)
    print(f"首轮系统提示词长度: {len(system_prompt_1)}")
    print(f"首轮系统提示词前 200 字符: {system_prompt_1[:200]}...")
    
    # 测试生成系统提示词（后续轮次）
    system_prompt_2 = skill_service.process_request(test_request, "test-model", 2)
    print(f"后续轮次系统提示词长度: {len(system_prompt_2)}")
    print(f"后续轮次系统提示词前 200 字符: {system_prompt_2[:200]}...")
    
    print("\n测试完成！")

if __name__ == "__main__":
    test_skill_service()
