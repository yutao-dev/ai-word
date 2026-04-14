from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from ..models.document import Document
import re

class RAGService:
    def __init__(self, db: Session):
        self.db = db
        self.document_chunks = []
        import logging
        logger = logging.getLogger(__name__)
        logger.info("RAG: Initializing RAG service...")
        self._initialize_index()
        logger.info(f"RAG: Initialized with {len(self.document_chunks)} document chunks")

    def _initialize_index(self):
        """初始化文档 chunks"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            documents = self.db.query(Document).filter(Document.is_deleted == False).all()
            logger.info(f"RAG: Found {len(documents)} documents")
            
            self.document_chunks = []
            
            for doc in documents:
                if doc.content:
                    logger.info(f"RAG: Processing document: {doc.title}, content length: {len(doc.content)}")
                    # 分割文档为 chunks
                    chunks = self._split_document(doc.content, doc.id, doc.title)
                    logger.info(f"RAG: Created {len(chunks)} chunks for document: {doc.title}")
                    self.document_chunks.extend(chunks)
            
            logger.info(f"RAG: Total document chunks: {len(self.document_chunks)}")
            
            # 打印前几个 chunks 的信息，以便调试
            for i, chunk in enumerate(self.document_chunks[:5]):
                logger.info(f"RAG: Chunk {i+1} - Document: {chunk['document_title']}, Content preview: {chunk['content'][:100]}...")
        except Exception as e:
            logger.error(f"RAG: Error initializing index: {str(e)}")

    def _split_document(self, content: str, doc_id: str, doc_title: str, chunk_size: int = 500, overlap: int = 100) -> List[Dict]:
        """分割文档为 chunks"""
        chunks = []
        
        # 对于中文文本，按字符分割
        # 对于英文文本，按单词分割
        import re
        # 提取中文汉字和英文单词
        tokens = re.findall(r'[\u4e00-\u9fa5]+|\b\w+\b', content)
        
        for i in range(0, len(tokens), chunk_size - overlap):
            chunk_tokens = tokens[i:i + chunk_size]
            if chunk_tokens:
                chunk_content = ' '.join(chunk_tokens)
                chunks.append({
                    'content': chunk_content,
                    'document_id': doc_id,
                    'document_title': doc_title,
                    'start_index': i
                })
        
        return chunks

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """简单的文本相似度计算"""
        import logging
        logger = logging.getLogger(__name__)
        
        # 提取关键词（支持中文）
        def get_keywords(text):
            # 对于中文，使用字符级别的分割
            # 同时保留英文单词
            import re
            # 提取中文汉字
            chinese_chars = re.findall(r'[\u4e00-\u9fa5]', text)
            # 提取英文单词
            english_words = re.findall(r'\b\w+\b', text.lower())
            # 合并所有关键词
            return set(chinese_chars + english_words)
        
        keywords1 = get_keywords(text1)
        keywords2 = get_keywords(text2)
        
        logger.info(f"RAG: Keywords1: {keywords1}")
        logger.info(f"RAG: Keywords2: {keywords2}")
        
        # 计算交集
        intersection = keywords1.intersection(keywords2)
        # 计算并集
        union = keywords1.union(keywords2)
        
        logger.info(f"RAG: Intersection: {intersection}")
        logger.info(f"RAG: Union: {union}")
        
        # 返回 Jaccard 相似度
        similarity = len(intersection) / len(union) if union else 0
        logger.info(f"RAG: Similarity: {similarity}")
        
        return similarity

    def query(self, question: str, top_k: int = 3) -> List[Dict]:
        """查询相关文档 chunks"""
        if not self.document_chunks:
            return []
        
        # 计算相似度
        results = []
        for chunk in self.document_chunks:
            # 计算内容相似度
            content_similarity = self._calculate_similarity(question, chunk['content'])
            # 计算标题相似度
            title_similarity = self._calculate_similarity(question, chunk['document_title'])
            # 综合相似度，标题权重更高，确保标题相关的文档能够通过筛选
            similarity = content_similarity * 0.1 + title_similarity * 0.9
            results.append({
                'content': chunk['content'],
                'document_id': chunk['document_id'],
                'document_title': chunk['document_title'],
                'similarity': similarity,
                'content_similarity': content_similarity,
                'title_similarity': title_similarity
            })
        
        # 按相似度排序并返回前 top_k 个
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]

    def refresh_index(self):
        """刷新文档 chunks"""
        self._initialize_index()
    
    def test_documents(self):
        """测试文档数据"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            documents = self.db.query(Document).filter(Document.is_deleted == False).all()
            logger.info(f"RAG: Test - Found {len(documents)} documents")
            
            for doc in documents:
                logger.info(f"RAG: Test - Document: {doc.title}, content length: {len(doc.content) if doc.content else 0}")
            
            return len(documents)
        except Exception as e:
            logger.error(f"RAG: Test - Error: {str(e)}")
            return 0

    def get_relevant_context(self, question: str, max_context_length: int = 5000) -> str:
        """获取相关上下文"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"RAG: Getting context for question: {question}")
        logger.info(f"RAG: Number of document chunks: {len(self.document_chunks)}")
        
        # 确保文档 chunks 已初始化
        if not self.document_chunks:
            logger.warning("RAG: No document chunks available, refreshing index...")
            self._initialize_index()
        
        # 查询更多的文档 chunks
        results = self.query(question, top_k=10)
        
        logger.info(f"RAG: Number of relevant results: {len(results)}")
        for i, result in enumerate(results):
            logger.info(f"RAG: Result {i+1} - Similarity: {result['similarity']}, Document: {result['document_title']}, Content Similarity: {result['content_similarity']}, Title Similarity: {result['title_similarity']}")
        
        # 过滤掉相似度低于0.3的结果
        filtered_results = [result for result in results if result['similarity'] >= 0.3]
        logger.info(f"RAG: Number of filtered results (similarity >= 0.3): {len(filtered_results)}")
        
        # 按相似度和文档标题排序，确保上下文的顺序正确
        # 首先按相似度降序排序，然后按文档标题和start_index排序
        sorted_results = sorted(filtered_results, key=lambda x: (-x['similarity'], x['document_title'], x.get('start_index', 0)))
        
        context = []
        total_length = 0
        
        for result in sorted_results:
            chunk_content = result['content']
            context_entry = f"来源: {result['document_title']}\n{chunk_content}\n"
            
            if total_length + len(context_entry) <= max_context_length:
                context.append(context_entry)
                total_length += len(context_entry)
            else:
                break
        
        context_str = '\n'.join(context)
        logger.info(f"RAG: Generated context length: {len(context_str)}")
        
        # 如果没有获取到上下文，尝试使用所有文档的内容
        if not context_str:
            logger.warning("RAG: No relevant context found, using all document content...")
            all_content = []
            for chunk in self.document_chunks[:10]:  # 只使用前10个chunks
                all_content.append(f"来源: {chunk['document_title']}\n{chunk['content']}\n")
            context_str = '\n'.join(all_content)
            logger.info(f"RAG: Fallback context length: {len(context_str)}")
        
        return context_str
