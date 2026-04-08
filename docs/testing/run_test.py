#!/usr/bin/env python3
"""直接运行测试脚本"""
import sys
sys.path.insert(0, r"d:\Program Project\ai-word\docs\testing")

from token_workflow_test import TokenWorkflowTester

prompt = '请帮我完成以下任务：1. 在文档末尾添加一段关于"软件设计模式"的介绍 2. 在"概述"标题下添加一段背景说明'

tester = TokenWorkflowTester(
    base_url="http://localhost:8000/api/v1",
    model="deepseek-ai/DeepSeek-V3",
    max_iterations=10
)

print("开始测试...")
summary = tester.run_test(prompt, runs=5, cleanup=True, batch_count=1)
print("\n测试完成!")
print(f"结果: {summary}")