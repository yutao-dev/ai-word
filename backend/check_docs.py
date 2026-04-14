from app.db.database import SessionLocal
from app.models.document import Document

# 创建数据库会话
db = SessionLocal()

# 查询所有未删除的文档
docs = db.query(Document).filter(Document.is_deleted == False).all()

# 打印文档数量和内容
print(f'Found {len(docs)} documents')
for doc in docs:
    content_length = len(doc.content) if doc.content else 0
    print(f'Title: {doc.title}, Content length: {content_length}')
    # 打印前100个字符的内容预览
    if doc.content:
        preview = doc.content[:100] + '...' if len(doc.content) > 100 else doc.content
        print(f'Preview: {preview}')
    print()

# 关闭数据库会话
db.close()
