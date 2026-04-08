from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer
from sqlalchemy.sql import func
from ..db.database import Base
import uuid
from datetime import datetime


def generate_uuid():
    return str(uuid.uuid4())


def get_local_now():
    return datetime.now()


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=get_local_now)
    updated_at = Column(DateTime, onupdate=get_local_now)
    is_deleted = Column(Boolean, default=False)


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)
    api_key = Column(String(255), nullable=True)
    base_url = Column(String(255), nullable=True)
    model = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_local_now)


class TokenUsage(Base):
    __tablename__ = "token_usage"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), nullable=True)
    workflow_id = Column(String(36), nullable=True)
    model = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    request_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=get_local_now)
