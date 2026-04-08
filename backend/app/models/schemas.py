from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class PositionType(str, Enum):
    LINE = "line"
    HEADING = "heading"
    KEYWORD = "keyword"
    END = "end"
    START = "start"


class ExtractType(str, Enum):
    LINKS = "links"
    IMAGES = "images"
    CODE = "code"
    TABLES = "tables"
    HEADINGS = "headings"


class DocumentBase(BaseModel):
    title: str
    content: str = ""


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    id: str
    title: str
    content: str = ""
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeleteByRangeRequest(BaseModel):
    start: int
    end: int


class DeleteAndSwapRequest(BaseModel):
    delete_start: int
    delete_end: int
    swap_content: str


class InsertEndRequest(BaseModel):
    content: str


class UpdateContentRequest(BaseModel):
    new_content: str


class OperationResponse(BaseModel):
    success: bool
    doc: Optional[DocumentResponse] = None
    original_content: Optional[str] = None
    new_content: Optional[str] = None
    error: Optional[str] = None


class TokenUsageResponse(BaseModel):
    id: str
    session_id: Optional[str] = None
    workflow_id: Optional[str] = None
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    request_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenUsageCreate(BaseModel):
    session_id: Optional[str] = None
    workflow_id: Optional[str] = None
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    request_type: Optional[str] = None


class TokenUsageSummary(BaseModel):
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_requests: int
    by_model: List[dict]
    by_provider: List[dict]


class TokenUsageStats(BaseModel):
    today: TokenUsageSummary
    week: TokenUsageSummary
    month: TokenUsageSummary
    all_time: TokenUsageSummary


class SearchRequest(BaseModel):
    keyword: str
    case_sensitive: bool = False
    use_regex: bool = False
    context_lines: int = 2


class SearchResult(BaseModel):
    line_number: int
    matched_text: str
    context_before: List[str]
    context_after: List[str]
    start_col: int
    end_col: int


class SearchResponse(BaseModel):
    success: bool
    keyword: str
    total_matches: int
    matches: List[SearchResult]
    error: Optional[str] = None


class FindReplaceRequest(BaseModel):
    find_text: str
    replace_text: str
    replace_all: bool = False
    case_sensitive: bool = False


class FindReplaceResponse(BaseModel):
    success: bool
    replacements_made: int
    doc: Optional[DocumentResponse] = None
    original_content: Optional[str] = None
    new_content: Optional[str] = None
    error: Optional[str] = None


class HeadingInfo(BaseModel):
    level: int
    text: str
    line_number: int
    slug: str


class OutlineResponse(BaseModel):
    success: bool
    document_id: str
    title: str
    headings: List[HeadingInfo]
    total_headings: int
    error: Optional[str] = None


class SectionResponse(BaseModel):
    success: bool
    heading: Optional[HeadingInfo] = None
    content: str
    start_line: int
    end_line: int
    error: Optional[str] = None


class InsertAfterHeadingRequest(BaseModel):
    heading_text: str
    content: str
    heading_level: Optional[int] = None


class InsertAtRequest(BaseModel):
    position_type: PositionType
    position_value: str
    content: str


class InsertParagraphRequest(BaseModel):
    content: str
    after_line: Optional[int] = None
    before_line: Optional[int] = None
    add_blank_lines: bool = True


class DocumentStats(BaseModel):
    character_count: int
    character_count_no_spaces: int
    word_count: int
    line_count: int
    paragraph_count: int
    heading_count: int
    image_count: int
    link_count: int
    code_block_count: int
    table_count: int
    reading_time_minutes: float


class StatsResponse(BaseModel):
    success: bool
    document_id: str
    stats: DocumentStats
    error: Optional[str] = None


class ExtractedItem(BaseModel):
    type: str
    content: str
    line_number: int
    metadata: Optional[Dict[str, Any]] = None


class ExtractResponse(BaseModel):
    success: bool
    extract_type: str
    items: List[ExtractedItem]
    total_count: int
    error: Optional[str] = None


class BatchOperation(BaseModel):
    operation: str
    params: Dict[str, Any]


class BatchOperationsRequest(BaseModel):
    operations: List[BatchOperation]
    stop_on_error: bool = False


class BatchOperationResult(BaseModel):
    operation: str
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class BatchOperationsResponse(BaseModel):
    success: bool
    results: List[BatchOperationResult]
    total_operations: int
    successful_operations: int
    failed_operations: int
    final_content: Optional[str] = None
    error: Optional[str] = None


class MoveSectionRequest(BaseModel):
    from_heading: str
    to_position: PositionType
    to_position_value: str
    after_heading: Optional[str] = None


class MoveSectionResponse(BaseModel):
    success: bool
    doc: Optional[DocumentResponse] = None
    original_content: Optional[str] = None
    new_content: Optional[str] = None
    section_content: Optional[str] = None
    error: Optional[str] = None
