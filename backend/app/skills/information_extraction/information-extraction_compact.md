# 信息提取 Skill (精简版)

## 核心概念

- **摘要生成**：提取文档主要内容，生成摘要
- **关键词提取**：提取文档中的重要关键词
- **实体识别**：识别文档中的实体（人物、组织、地点等）
- **信息分类**：将文档内容分类到不同类别
- **数据提取**：提取特定的数据信息

## 常用函数

- `extractKeyInfo`：提取关键信息（摘要、关键词、实体）
- `getDocumentStats`：获取文档统计信息
- `searchInDocument`：搜索特定内容
- `getSectionByHeading`：根据标题获取章节

## 最佳实践

- **抓住重点**：提取核心观点和主要信息
- **保持连贯**：生成的内容逻辑连贯
- **控制长度**：根据需求控制输出长度
- **忠实原文**：保持与原文内容一致
- **相关性**：提取与主题相关的信息

## 常见场景

1. **生成摘要**：getAllDocument → getDocumentById → extractKeyInfo
2. **提取关键词**：getAllDocument → getDocumentById → extractKeyInfo
3. **识别实体**：getAllDocument → getDocumentById → extractKeyInfo
