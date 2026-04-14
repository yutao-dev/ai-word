from app.db.database import SessionLocal
from app.services.rag_service import RAGService

# 初始化数据库会话
db = SessionLocal()

# 创建RAG服务实例
rag = RAGService(db)

# 打印文档chunks信息
print('Number of document chunks:', len(rag.document_chunks))
print('\nFirst 10 chunks:')
for i, chunk in enumerate(rag.document_chunks[:10]):
    print(f'Chunk {i+1}: Document={chunk["document_title"]}, Content preview={chunk["content"][:100]}...')

# 测试相似度计算
question = "后端语言都有什么呢？"
print('\nTesting similarity calculation for question:', question)

# 计算每个chunk与问题的相似度
results = rag.query(question, top_k=10)
print('\nTop 10 similar chunks:')
for i, result in enumerate(results):
    print(f'Rank {i+1}: Document={result["document_title"]}, Similarity={result["similarity"]:.4f}, Content Similarity={result["content_similarity"]:.4f}, Title Similarity={result["title_similarity"]:.4f}')

# 获取相关上下文
context = rag.get_relevant_context(question)
print('\nGenerated context:')
print(context)

# 关闭数据库会话
db.close()