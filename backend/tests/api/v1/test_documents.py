def test_create_document(client):
    """测试创建文档"""
    response = client.post(
        "/api/v1/documents/",
        json={"title": "测试文档", "content": "测试内容"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "测试文档"
    assert data["content"] == "测试内容"
    assert "id" in data


def test_get_documents(client):
    """测试获取文档列表"""
    # 创建测试文档
    client.post(
        "/api/v1/documents/",
        json={"title": "测试文档 1", "content": "内容 1"}
    )
    client.post(
        "/api/v1/documents/",
        json={"title": "测试文档 2", "content": "内容 2"}
    )
    
    response = client.get("/api/v1/documents/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # 检查两个文档都存在
    assert any(doc["title"] == "测试文档 1" for doc in data)
    assert any(doc["title"] == "测试文档 2" for doc in data)


def test_get_document(client):
    """测试获取单个文档"""
    # 创建测试文档
    create_response = client.post(
        "/api/v1/documents/",
        json={"title": "测试文档", "content": "测试内容"}
    )
    doc_id = create_response.json()["id"]
    
    response = client.get(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == doc_id
    assert data["title"] == "测试文档"
    assert data["content"] == "测试内容"


def test_update_document(client):
    """测试更新文档"""
    # 创建测试文档
    create_response = client.post(
        "/api/v1/documents/",
        json={"title": "测试文档", "content": "测试内容"}
    )
    doc_id = create_response.json()["id"]
    
    # 更新文档
    response = client.put(
        f"/api/v1/documents/{doc_id}",
        json={"title": "更新后的文档", "content": "更新后的内容"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == doc_id
    assert data["title"] == "更新后的文档"
    assert data["content"] == "更新后的内容"


def test_delete_document(client):
    """测试删除文档"""
    # 创建测试文档
    create_response = client.post(
        "/api/v1/documents/",
        json={"title": "测试文档", "content": "测试内容"}
    )
    doc_id = create_response.json()["id"]
    
    # 删除文档
    response = client.delete(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Document deleted successfully"
    
    # 验证文档已删除
    response = client.get(f"/api/v1/documents/{doc_id}")
    assert response.status_code == 404


def test_get_nonexistent_document(client):
    """测试获取不存在的文档"""
    response = client.get("/api/v1/documents/non-existent-id")
    assert response.status_code == 404
