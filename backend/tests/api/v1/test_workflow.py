def test_workflow_execute(client):
    """测试工作流执行接口"""
    # 创建测试文档
    create_response = client.post(
        "/api/v1/documents/",
        json={"title": "测试文档", "content": "# 原始内容\n这是测试文档的原始内容"}
    )
    doc_id = create_response.json()["id"]
    
    # 创建测试 LLM 配置
    client.post(
        "/api/v1/ai/configs",
        json={
            "name": "测试配置",
            "provider": "openai",
            "api_key": "test-api-key",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o",
            "is_default": True
        }
    )
    
    # 测试工作流执行（会失败，因为 API Key 是假的，但结构应该正确）
    response = client.post(
        "/api/v1/workflow/execute",
        json={
            "user_request": "请在文档末尾添加一段关于 AI 的内容",
            "document_id": doc_id,
            "model": "gpt-4o",
            "max_iterations": 5
        }
    )
    
    # 由于 API Key 无效，应该返回 500 错误
    assert response.status_code == 500


def test_workflow_execute_with_invalid_document(client):
    """测试使用无效文档 ID 执行工作流"""
    # 创建测试 LLM 配置
    client.post(
        "/api/v1/ai/configs",
        json={
            "name": "测试配置",
            "provider": "openai",
            "api_key": "test-api-key",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o",
            "is_default": True
        }
    )
    
    # 使用无效的文档 ID
    response = client.post(
        "/api/v1/workflow/execute",
        json={
            "user_request": "请修改文档",
            "document_id": "invalid-document-id",
            "model": "gpt-4o",
            "max_iterations": 5
        }
    )
    
    # 应该返回 500 错误（因为找不到文档）
    assert response.status_code == 500
