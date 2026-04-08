# 文档编辑 Skill (精简版)

## 核心概念

- **内容添加**：在文档特定位置添加新内容
- **内容修改**：修改现有内容
- **内容删除**：删除不需要的内容
- **结构调整**：调整文档章节顺序
- **格式优化**：优化文档格式和排版

## 常用函数

- `insertEnd`：在文档末尾添加内容
- `insertAt`：在指定位置插入内容
- `insertAfterHeading`：在指定标题后插入内容
- `findAndReplace`：查找并替换文本
- `updateDocumentContent`：更新文档内容
- `moveSection`：移动章节
- `getDocumentOutline`：获取文档大纲
- `getSectionByHeading`：根据标题获取章节

## 最佳实践

- **明确位置**：使用精确的位置参数
- **内容质量**：确保添加的内容与文档风格一致
- **最小修改**：尽量只修改必要的部分
- **逻辑顺序**：调整结构时保持逻辑连贯

## 常见场景

1. **添加内容**：getAllDocument → getDocumentById → insertEnd
2. **修改内容**：getAllDocument → getDocumentById → getSectionByHeading → findAndReplace
3. **调整结构**：getAllDocument → getDocumentById → getDocumentOutline → moveSection
