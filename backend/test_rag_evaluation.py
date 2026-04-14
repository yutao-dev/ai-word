#!/usr/bin/env python3
"""
RAG系统评估脚本

功能：
1. 接受用户输入的问题
2. 调用RAG服务获取相关文档
3. 计算评估指标（精确率、召回率、F1分数等）
4. 展示结果和评估指标
"""

import sys
import json
import requests
from typing import List, Dict, Tuple

# RAG API地址
RAG_API_URL = "http://localhost:8000/api/v1/rag/query"

# 测试文档库（用于评估）
test_documents = [
    {"id": 1, "title": "小明的算法比赛学习之路", "content": "小明是一名算法爱好者，他的学习之路充满了挑战和收获..."},
    {"id": 2, "title": "算法是什么", "content": "算法是解决问题的步骤集合，是计算机科学的核心概念..."},
    {"id": 3, "title": "AI的Transformer架构详解", "content": "Transformer架构是现代AI的重要突破，由Google于2017年提出..."},
    {"id": 4, "title": "后端语言", "content": "后端语言包括Java、Python、Go、Rust等多种选择..."},
]

# 手动标注的相关文档映射（用于评估）
# key: 问题, value: 相关文档标题列表
relevant_docs_map = {
    "小明的算法比赛学习之路是怎么样的呀": ["小明的算法比赛学习之路"],
    "算法是什么": ["算法是什么"],
    "Transformer架构的原理": ["AI的Transformer架构详解"],
    "后端语言有哪些": ["后端语言"],
}

def get_rag_response(question: str) -> Dict:
    """调用RAG API获取响应"""
    try:
        response = requests.post(
            RAG_API_URL,
            json={"question": question},
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"调用RAG API失败: {e}")
        return {"answer": "", "context": ""}

def extract_sources_from_context(context: str) -> List[str]:
    """从上下文中提取来源文档标题"""
    sources = []
    if not context:
        return sources
    
    lines = context.split('\n')
    for line in lines:
        if line.startswith('来源: '):
            source = line.replace('来源: ', '').strip()
            if source:
                sources.append(source)
    return sources

def calculate_metrics(question: str, retrieved_sources: List[str]) -> Dict:
    """计算评估指标"""
    # 获取人工标注的相关文档
    relevant_docs = relevant_docs_map.get(question, [])
    
    # 计算真正例（相关且被检索到）
    true_positives = set(relevant_docs) & set(retrieved_sources)
    
    # 计算假正例（不相关但被检索到）
    false_positives = set(retrieved_sources) - set(relevant_docs)
    
    # 计算假负例（相关但未被检索到）
    false_negatives = set(relevant_docs) - set(retrieved_sources)
    
    # 计算指标
    precision = len(true_positives) / (len(true_positives) + len(false_positives)) if (len(true_positives) + len(false_positives)) > 0 else 0
    recall = len(true_positives) / (len(true_positives) + len(false_negatives)) if (len(true_positives) + len(false_negatives)) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "true_positives": list(true_positives),
        "false_positives": list(false_positives),
        "false_negatives": list(false_negatives),
        "retrieved_sources": retrieved_sources,
        "relevant_docs": relevant_docs
    }

def evaluate_rag_system():
    """评估RAG系统"""
    print("=== RAG系统评估工具 ===")
    print("输入问题进行评估，输入'quit'退出")
    print()
    
    while True:
        # 获取用户输入
        question = input("请输入问题: ").strip()
        
        if question.lower() == 'quit':
            print("退出评估工具")
            break
        
        if not question:
            print("问题不能为空，请重新输入")
            continue
        
        print("\n正在处理...")
        
        # 调用RAG API
        response = get_rag_response(question)
        
        # 提取来源
        sources = extract_sources_from_context(response.get("context", ""))
        
        # 计算评估指标
        metrics = calculate_metrics(question, sources)
        
        # 展示结果
        print("\n=== 评估结果 ===")
        print(f"问题: {question}")
        print(f"AI回答: {response.get('answer', '无回答')[:100]}...")
        print(f"\n检索到的来源: {sources}")
        print(f"相关文档: {metrics['relevant_docs']}")
        print(f"\n评估指标:")
        print(f"精确率 (Precision): {metrics['precision']:.4f}")
        print(f"召回率 (Recall): {metrics['recall']:.4f}")
        print(f"F1分数: {metrics['f1']:.4f}")
        print(f"\n真正例: {metrics['true_positives']}")
        print(f"假正例: {metrics['false_positives']}")
        print(f"假负例: {metrics['false_negatives']}")
        print("=" * 50)
        print()

if __name__ == "__main__":
    evaluate_rag_system()
