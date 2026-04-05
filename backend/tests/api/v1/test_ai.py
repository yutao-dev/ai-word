def test_create_llm_config(client):
    """测试创建 LLM 配置"""
    response = client.post(
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
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试配置"
    assert data["provider"] == "openai"
    assert data["model"] == "gpt-4o"
    assert data["is_default"] is True
    assert "id" in data


def test_get_llm_configs(client):
    """测试获取 LLM 配置列表"""
    # 创建测试配置
    client.post(
        "/api/v1/ai/configs",
        json={
            "name": "配置 1",
            "provider": "openai",
            "api_key": "key1",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o",
            "is_default": True
        }
    )
    client.post(
        "/api/v1/ai/configs",
        json={
            "name": "配置 2",
            "provider": "anthropic",
            "api_key": "key2",
            "base_url": "https://api.anthropic.com",
            "model": "claude-3-opus-20240229",
            "is_default": False
        }
    )
    
    response = client.get("/api/v1/ai/configs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # 检查两个配置都存在
    assert any(config["name"] == "配置 1" for config in data)
    assert any(config["name"] == "配置 2" for config in data)


def test_update_llm_config(client):
    """测试更新 LLM 配置"""
    # 创建测试配置
    create_response = client.post(
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
    config_id = create_response.json()["id"]
    
    # 更新配置
    response = client.put(
        f"/api/v1/ai/configs/{config_id}",
        json={
            "name": "更新后的配置",
            "api_key": "updated-api-key",
            "model": "gpt-4-turbo"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == config_id
    assert data["name"] == "更新后的配置"
    assert data["api_key"] == "updated-api-key"
    assert data["model"] == "gpt-4-turbo"


def test_delete_llm_config(client):
    """测试删除 LLM 配置"""
    # 创建测试配置
    create_response = client.post(
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
    config_id = create_response.json()["id"]
    
    # 删除配置
    response = client.delete(f"/api/v1/ai/configs/{config_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Config deleted successfully"
    
    # 验证配置已删除
    response = client.get("/api/v1/ai/configs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_chat_endpoint(client):
    """测试 AI 对话接口（需要实际 API Key，这里只测试基本结构）"""
    # 创建测试配置
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
    
    # 测试对话请求（会失败，因为 API Key 是假的，但结构应该正确）
    response = client.post(
        "/api/v1/ai/chat",
        json={
            "messages": [
                {"role": "user", "content": "你好，这是测试消息"}
            ],
            "model": "gpt-4o",
            "temperature": 0.7
        }
    )
    # 由于 API Key 无效，应该返回 500 错误
    assert response.status_code == 500
