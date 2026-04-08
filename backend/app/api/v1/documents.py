from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ...db.database import get_db
from ...models.document import Document
from ...models.schemas import (
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse,
    DeleteByRangeRequest, DeleteAndSwapRequest, InsertEndRequest, 
    UpdateContentRequest, OperationResponse
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/", response_model=List[DocumentListResponse])
def get_all_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).filter(Document.is_deleted == False).all()
    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/", response_model=DocumentResponse)
def create_document(doc: DocumentCreate, db: Session = Depends(get_db)):
    document = Document(title=doc.title, content=doc.content)
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(document_id: str, doc: DocumentUpdate, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.title is not None:
        document.title = doc.title
    if doc.content is not None:
        document.content = doc.content
    
    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.is_deleted = True
    db.commit()
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/delete-by-range", response_model=OperationResponse)
def delete_by_range(document_id: str, request: DeleteByRangeRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        return OperationResponse(success=False, error="文档不存在")
    
    if request.start < 1 or request.end < request.start:
        return OperationResponse(success=False, error="无效的行号范围")
    
    lines = document.content.split('\n') if document.content else []
    
    if request.start > len(lines) or request.end > len(lines):
        return OperationResponse(success=False, error="行号超出文档范围")
    
    original_content = document.content
    new_lines = lines[:request.start - 1] + lines[request.end:]
    new_content = '\n'.join(new_lines)
    
    document.content = new_content
    db.commit()
    db.refresh(document)
    
    return OperationResponse(
        success=True,
        doc=DocumentResponse.model_validate(document),
        original_content=original_content,
        new_content=new_content
    )


@router.post("/{document_id}/delete-and-swap", response_model=OperationResponse)
def delete_and_swap(document_id: str, request: DeleteAndSwapRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        return OperationResponse(success=False, error="文档不存在")
    
    if request.delete_start < 1 or request.delete_end < request.delete_start:
        return OperationResponse(success=False, error="无效的行号范围")
    
    lines = document.content.split('\n') if document.content else []
    
    if request.delete_start > len(lines) or request.delete_end > len(lines):
        return OperationResponse(success=False, error="行号超出文档范围")
    
    original_content = document.content
    swap_lines = request.swap_content.split('\n') if request.swap_content else []
    new_lines = lines[:request.delete_start - 1] + swap_lines + lines[request.delete_end:]
    new_content = '\n'.join(new_lines)
    
    document.content = new_content
    db.commit()
    db.refresh(document)
    
    return OperationResponse(
        success=True,
        doc=DocumentResponse.model_validate(document),
        original_content=original_content,
        new_content=new_content
    )


@router.post("/{document_id}/insert-end", response_model=OperationResponse)
def insert_end(document_id: str, request: InsertEndRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        return OperationResponse(success=False, error="文档不存在")
    
    original_content = document.content or ""
    content_to_add = request.content or ""
    
    if not original_content:
        new_content = content_to_add
    elif original_content.endswith('\n'):
        new_content = original_content + content_to_add
    else:
        new_content = original_content + '\n' + content_to_add
    
    document.content = new_content
    db.commit()
    db.refresh(document)
    
    return OperationResponse(
        success=True,
        doc=DocumentResponse.model_validate(document),
        original_content=original_content,
        new_content=new_content
    )


@router.post("/{document_id}/update-content", response_model=OperationResponse)
def update_content(document_id: str, request: UpdateContentRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id, Document.is_deleted == False).first()
    if not document:
        return OperationResponse(success=False, error="文档不存在")
    
    original_content = document.content
    document.content = request.new_content
    db.commit()
    db.refresh(document)
    
    return OperationResponse(
        success=True,
        doc=DocumentResponse.model_validate(document),
        original_content=original_content,
        new_content=request.new_content
    )
