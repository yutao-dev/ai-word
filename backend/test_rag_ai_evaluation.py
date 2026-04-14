#!/usr/bin/env python3
"""
RAG系统AI评估脚本

功能：
1. 直接调用项目中的RAG服务
2. 接受用户输入的问题
3. 调用AI服务评估RAG的表现
4. 展示评估结果
"""

import asyncio
from app.db.database import SessionLocal
from app.services.rag_service import RAGService
from app.services.ai_service import AIService
from typing import List, Dict, Tuple

# 评估提示词
EVALUATION_PROMPT = """
你是一位专业的RAG（检索增强生成）系统评估专家。请根据以下信息评估RAG系统的表现：

1. 用户问题：{question}
2. RAG系统检索到的文档：
{context}

请从以下几个维度进行评估：

1. 相关性（Relevance）：检索到的文档与用户问题的相关程度如何？
   - 0-2分：完全不相关
   - 3-5分：部分相关
   - 6-8分：大部分相关
   - 9-10分：高度相关

2. 完整性（Completeness）：检索到的文档是否包含回答用户问题所需的完整信息？
   - 0-2分：信息严重不足
   - 3-5分：信息部分完整
   - 6-8分：信息基本完整
   - 9-10分：信息非常完整

3. 准确性（Accuracy）：检索到的文档内容是否准确无误？
   - 0-2分：存在严重错误
   - 3-5分：存在一些错误
   - 6-8分：基本准确
   - 9-10分：非常准确

4. 多样性（Diversity）：检索到的文档是否涵盖了不同角度的信息？
   - 0-2分：信息单一
   - 3-5分：信息有一定多样性
   - 6-8分：信息多样性良好
   - 9-10分：信息多样性丰富

5. 总体评分（Overall）：基于以上四个维度，给出RAG系统的总体评分
   - 0-2分：表现极差
   - 3-5分：表现一般
   - 6-8分：表现良好
   - 9-10分：表现优秀

请提供详细的评估理由，并以JSON格式输出评估结果，包含以下字段：
- relevance: 相关性评分
- completeness: 完整性评分
- accuracy: 准确性评分
- diversity: 多样性评分
- overall: 总体评分
- reasoning: 评估理由
"""

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
    # 去重
    return list(set(sources))

async def evaluate_rag_with_ai():
    """使用AI评估RAG系统"""
    print("=== RAG系统AI评估工具 ===")
    print("输入问题进行评估，输入'quit'退出")
    print()
    
    # 初始化数据库会话、RAG服务和AI服务
    db = SessionLocal()
    rag = RAGService(db)
    ai_service = AIService(db)
    
    # 打印文档chunks信息
    print(f"系统中共有 {len(rag.document_chunks)} 个文档chunks")
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
        
        try:
            # 调用RAG服务
            results = rag.query(question, top_k=10)
            print(f"\n相似度计算结果 (Top 5):")
            for i, result in enumerate(results[:5]):
                print(f"Rank {i+1}: Document={result['document_title']}, Similarity={result['similarity']:.4f}")
            
            # 获取相关上下文
            context = rag.get_relevant_context(question)
            
            # 提取来源
            sources = extract_sources_from_context(context)
            print(f"\n检索到的来源: {sources}")
            
            # 准备AI评估提示词
            evaluation_prompt = EVALUATION_PROMPT.format(
                question=question,
                context=context
            )
            
            # 调用AI服务进行评估
            print("\n正在调用AI进行评估...")
            response = await ai_service.chat(
                messages=[{"role": "user", "content": evaluation_prompt}],
                system_prompt="你是一位专业的RAG系统评估专家，擅长分析检索结果的质量。",
                temperature=0.2,
                max_tokens=1000
            )
            
            # 解析评估结果
            print("\n=== AI评估结果 ===")
            print(f"问题: {question}")
            print(f"\nAI评估: {response.content}")
            print("=" * 50)
            print()
            
        except Exception as e:
            print(f"处理失败: {e}")
            print("=" * 50)
            print()
    
    # 关闭数据库会话
    db.close()

if __name__ == "__main__":
    asyncio.run(evaluate_rag_with_ai())
