from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ...db.database import get_db
from ...models.document import Document
from ...models.schemas import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse

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
