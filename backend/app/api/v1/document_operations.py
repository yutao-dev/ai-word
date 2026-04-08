import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ...db.database import get_db
from ...models.document import Document
from ...models.schemas import (
    DocumentResponse,
    SearchRequest, SearchResponse, SearchResult,
    FindReplaceRequest, FindReplaceResponse,
    OutlineResponse, HeadingInfo,
    SectionResponse,
    InsertAfterHeadingRequest, OperationResponse,
    InsertAtRequest, InsertParagraphRequest,
    StatsResponse, DocumentStats,
    ExtractResponse, ExtractedItem, ExtractType,
    BatchOperationsRequest, BatchOperationsResponse, BatchOperationResult,
    MoveSectionRequest, MoveSectionResponse,
    PositionType
)

router = APIRouter(prefix="/documents", tags=["document-operations"])


def get_document_or_404(db: Session, document_id: str) -> Document:
    document = db.query(Document).filter(
        Document.id == document_id, 
        Document.is_deleted == False
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def parse_headings(content: str) -> List[HeadingInfo]:
    headings = []
    lines = content.split('\n') if content else []
    
    for i, line in enumerate(lines, 1):
        match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if match:
            level = len(match.group(1))
            text = match.group(2).strip()
            slug = re.sub(r'[^\w\u4e00-\u9fff-]', '-', text.lower())
            slug = re.sub(r'-+', '-', slug).strip('-')
            headings.append(HeadingInfo(
                level=level,
                text=text,
                line_number=i,
                slug=slug
            ))
    
    return headings


@router.post("/{document_id}/search", response_model=SearchResponse)
def search_in_document(document_id: str, request: SearchRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    if not document.content:
        return SearchResponse(
            success=True,
            keyword=request.keyword,
            total_matches=0,
            matches=[]
        )
    
    lines = document.content.split('\n')
    matches = []
    
    try:
        if request.use_regex:
            pattern = re.compile(request.keyword, 0 if request.case_sensitive else re.IGNORECASE)
        else:
            flags = 0 if request.case_sensitive else re.IGNORECASE
            pattern = re.compile(re.escape(request.keyword), flags)
    except re.error as e:
        return SearchResponse(
            success=False,
            keyword=request.keyword,
            total_matches=0,
            matches=[],
            error=f"Invalid regex pattern: {str(e)}"
        )
    
    for i, line in enumerate(lines, 1):
        for match in pattern.finditer(line):
            context_before = lines[max(0, i - 1 - request.context_lines):i - 1]
            context_after = lines[i:min(len(lines), i + request.context_lines)]
            
            matches.append(SearchResult(
                line_number=i,
                matched_text=match.group(),
                context_before=context_before,
                context_after=context_after,
                start_col=match.start(),
                end_col=match.end()
            ))
    
    return SearchResponse(
        success=True,
        keyword=request.keyword,
        total_matches=len(matches),
        matches=matches
    )


@router.post("/{document_id}/find-replace", response_model=FindReplaceResponse)
def find_and_replace(document_id: str, request: FindReplaceRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    if not document.content:
        return FindReplaceResponse(
            success=True,
            replacements_made=0
        )
    
    original_content = document.content
    
    if request.case_sensitive:
        flags = 0
    else:
        flags = re.IGNORECASE
    
    if request.replace_all:
        pattern = re.compile(re.escape(request.find_text), flags)
        new_content, count = pattern.subn(request.replace_text, original_content)
    else:
        pattern = re.compile(re.escape(request.find_text), flags)
        new_content, count = pattern.subn(request.replace_text, original_content, count=1)
    
    if count > 0:
        document.content = new_content
        db.commit()
        db.refresh(document)
    
    return FindReplaceResponse(
        success=True,
        replacements_made=count,
        doc=DocumentResponse.model_validate(document) if count > 0 else None,
        original_content=original_content if count > 0 else None,
        new_content=new_content if count > 0 else None
    )


@router.get("/{document_id}/outline", response_model=OutlineResponse)
def get_document_outline(document_id: str, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    headings = parse_headings(document.content or "")
    
    return OutlineResponse(
        success=True,
        document_id=document_id,
        title=document.title,
        headings=headings,
        total_headings=len(headings)
    )


@router.get("/{document_id}/section/{heading_text:path}", response_model=SectionResponse)
def get_section_by_heading(document_id: str, heading_text: str, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    if not document.content:
        return SectionResponse(
            success=False,
            content="",
            start_line=0,
            end_line=0,
            error="Document is empty"
        )
    
    headings = parse_headings(document.content)
    lines = document.content.split('\n')
    
    target_heading = None
    for h in headings:
        if h.text == heading_text or heading_text.lower() in h.text.lower():
            target_heading = h
            break
    
    if not target_heading:
        return SectionResponse(
            success=False,
            content="",
            start_line=0,
            end_line=0,
            error=f"Heading '{heading_text}' not found"
        )
    
    start_line = target_heading.line_number
    end_line = len(lines)
    
    for h in headings:
        if h.line_number > start_line and h.level <= target_heading.level:
            end_line = h.line_number - 1
            break
    
    section_lines = lines[start_line - 1:end_line]
    section_content = '\n'.join(section_lines)
    
    return SectionResponse(
        success=True,
        heading=target_heading,
        content=section_content,
        start_line=start_line,
        end_line=end_line
    )


@router.post("/{document_id}/insert-after-heading", response_model=OperationResponse)
def insert_after_heading(document_id: str, request: InsertAfterHeadingRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    if not document.content:
        return OperationResponse(success=False, error="Document is empty")
    
    headings = parse_headings(document.content)
    lines = document.content.split('\n')
    
    target_heading = None
    for h in headings:
        if request.heading_text.lower() in h.text.lower():
            if request.heading_level is None or h.level == request.heading_level:
                target_heading = h
                break
    
    if not target_heading:
        return OperationResponse(success=False, error=f"Heading '{request.heading_text}' not found")
    
    original_content = document.content
    
    end_line = len(lines)
    for h in headings:
        if h.line_number > target_heading.line_number and h.level <= target_heading.level:
            end_line = h.line_number - 1
            break
    
    insert_index = end_line
    new_lines = lines[:insert_index] + request.content.split('\n') + lines[insert_index:]
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


@router.post("/{document_id}/insert-at", response_model=OperationResponse)
def insert_at(document_id: str, request: InsertAtRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    original_content = document.content or ""
    lines = original_content.split('\n') if original_content else []
    
    insert_index = None
    
    if request.position_type == PositionType.LINE:
        line_num = int(request.position_value)
        if line_num < 1 or line_num > len(lines) + 1:
            return OperationResponse(success=False, error=f"Invalid line number: {line_num}")
        insert_index = line_num - 1
    
    elif request.position_type == PositionType.START:
        insert_index = 0
    
    elif request.position_type == PositionType.END:
        insert_index = len(lines)
    
    elif request.position_type == PositionType.HEADING:
        headings = parse_headings(original_content)
        target = None
        for h in headings:
            if request.position_value.lower() in h.text.lower():
                target = h
                break
        if not target:
            return OperationResponse(success=False, error=f"Heading '{request.position_value}' not found")
        
        end_line = len(lines)
        for h in headings:
            if h.line_number > target.line_number and h.level <= target.level:
                end_line = h.line_number - 1
                break
        insert_index = end_line
    
    elif request.position_type == PositionType.KEYWORD:
        found = False
        for i, line in enumerate(lines):
            if request.position_value in line:
                insert_index = i + 1
                found = True
                break
        if not found:
            return OperationResponse(success=False, error=f"Keyword '{request.position_value}' not found")
    
    else:
        return OperationResponse(success=False, error=f"Invalid position type: {request.position_type}")
    
    content_lines = request.content.split('\n')
    new_lines = lines[:insert_index] + content_lines + lines[insert_index:]
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


@router.post("/{document_id}/insert-paragraph", response_model=OperationResponse)
def insert_paragraph(document_id: str, request: InsertParagraphRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    original_content = document.content or ""
    lines = original_content.split('\n') if original_content else []
    
    if request.after_line is not None:
        insert_index = request.after_line
    elif request.before_line is not None:
        insert_index = request.before_line - 1
    else:
        insert_index = len(lines)
    
    content_lines = request.content.split('\n')
    
    if request.add_blank_lines:
        if insert_index > 0 and lines and insert_index <= len(lines):
            content_lines = [''] + content_lines
        if insert_index < len(lines):
            content_lines = content_lines + ['']
    
    new_lines = lines[:insert_index] + content_lines + lines[insert_index:]
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


@router.get("/{document_id}/stats", response_model=StatsResponse)
def get_document_stats(document_id: str, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    content = document.content or ""
    
    lines = content.split('\n') if content else []
    
    character_count = len(content)
    character_count_no_spaces = len(content.replace(' ', '').replace('\n', '').replace('\t', ''))
    
    words = re.findall(r'[\u4e00-\u9fff]|[a-zA-Z]+', content)
    word_count = len(words)
    
    paragraphs = [p for p in content.split('\n\n') if p.strip()]
    paragraph_count = len(paragraphs)
    
    headings = parse_headings(content)
    heading_count = len(headings)
    
    image_count = len(re.findall(r'!\[.*?\]\(.*?\)', content))
    link_count = len(re.findall(r'(?<!!)\[.*?\]\(.*?\)', content))
    code_block_count = len(re.findall(r'```', content)) // 2
    table_count = len(re.findall(r'^\|.*\|$', content, re.MULTILINE))
    
    reading_time_minutes = word_count / 200 if word_count > 0 else 0
    
    stats = DocumentStats(
        character_count=character_count,
        character_count_no_spaces=character_count_no_spaces,
        word_count=word_count,
        line_count=len(lines),
        paragraph_count=paragraph_count,
        heading_count=heading_count,
        image_count=image_count,
        link_count=link_count,
        code_block_count=code_block_count,
        table_count=table_count,
        reading_time_minutes=round(reading_time_minutes, 1)
    )
    
    return StatsResponse(
        success=True,
        document_id=document_id,
        stats=stats
    )


@router.get("/{document_id}/extract/{extract_type}", response_model=ExtractResponse)
def extract_key_info(document_id: str, extract_type: ExtractType, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    content = document.content or ""
    lines = content.split('\n') if content else []
    items = []
    
    if extract_type == ExtractType.LINKS:
        for i, line in enumerate(lines, 1):
            for match in re.finditer(r'(?<!!)\[([^\]]*)\]\(([^)]+)\)', line):
                items.append(ExtractedItem(
                    type="link",
                    content=match.group(0),
                    line_number=i,
                    metadata={"text": match.group(1), "url": match.group(2)}
                ))
    
    elif extract_type == ExtractType.IMAGES:
        for i, line in enumerate(lines, 1):
            for match in re.finditer(r'!\[([^\]]*)\]\(([^)]+)\)', line):
                items.append(ExtractedItem(
                    type="image",
                    content=match.group(0),
                    line_number=i,
                    metadata={"alt": match.group(1), "url": match.group(2)}
                ))
    
    elif extract_type == ExtractType.CODE:
        in_code_block = False
        code_start = 0
        current_code = []
        lang = ""
        
        for i, line in enumerate(lines, 1):
            if line.strip().startswith('```'):
                if not in_code_block:
                    in_code_block = True
                    code_start = i
                    lang = line.strip()[3:].strip()
                    current_code = []
                else:
                    items.append(ExtractedItem(
                        type="code_block",
                        content='\n'.join(current_code),
                        line_number=code_start,
                        metadata={"language": lang, "end_line": i}
                    ))
                    in_code_block = False
            elif in_code_block:
                current_code.append(line)
    
    elif extract_type == ExtractType.TABLES:
        in_table = False
        table_start = 0
        table_lines = []
        
        for i, line in enumerate(lines, 1):
            if '|' in line and line.strip().startswith('|'):
                if not in_table:
                    in_table = True
                    table_start = i
                    table_lines = [line]
                else:
                    table_lines.append(line)
            else:
                if in_table:
                    items.append(ExtractedItem(
                        type="table",
                        content='\n'.join(table_lines),
                        line_number=table_start,
                        metadata={"rows": len(table_lines) - 2 if len(table_lines) > 2 else 0}
                    ))
                    in_table = False
        
        if in_table:
            items.append(ExtractedItem(
                type="table",
                content='\n'.join(table_lines),
                line_number=table_start,
                metadata={"rows": len(table_lines) - 2 if len(table_lines) > 2 else 0}
            ))
    
    elif extract_type == ExtractType.HEADINGS:
        headings = parse_headings(content)
        for h in headings:
            items.append(ExtractedItem(
                type="heading",
                content=f"{'#' * h.level} {h.text}",
                line_number=h.line_number,
                metadata={"level": h.level, "slug": h.slug}
            ))
    
    return ExtractResponse(
        success=True,
        extract_type=extract_type.value,
        items=items,
        total_count=len(items)
    )


@router.post("/{document_id}/batch", response_model=BatchOperationsResponse)
def batch_operations(document_id: str, request: BatchOperationsRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    results = []
    successful = 0
    failed = 0
    
    for op in request.operations:
        try:
            result = execute_single_operation(document, op.operation, op.params, db)
            results.append(BatchOperationResult(
                operation=op.operation,
                success=True,
                result=result
            ))
            successful += 1
        except Exception as e:
            results.append(BatchOperationResult(
                operation=op.operation,
                success=False,
                error=str(e)
            ))
            failed += 1
            
            if request.stop_on_error:
                break
    
    db.refresh(document)
    
    return BatchOperationsResponse(
        success=failed == 0,
        results=results,
        total_operations=len(request.operations),
        successful_operations=successful,
        failed_operations=failed,
        final_content=document.content
    )


def execute_single_operation(document: Document, operation: str, params: dict, db: Session) -> dict:
    if operation == "insert_end":
        content = params.get("content", "")
        if document.content:
            document.content = document.content + '\n' + content
        else:
            document.content = content
        db.commit()
        return {"message": "Content appended"}
    
    elif operation == "insert_at_line":
        line = params.get("line", 1)
        content = params.get("content", "")
        lines = document.content.split('\n') if document.content else []
        lines.insert(line - 1, content)
        document.content = '\n'.join(lines)
        db.commit()
        return {"message": f"Content inserted at line {line}"}
    
    elif operation == "delete_lines":
        start = params.get("start", 1)
        end = params.get("end", start)
        lines = document.content.split('\n') if document.content else []
        del lines[start - 1:end]
        document.content = '\n'.join(lines)
        db.commit()
        return {"message": f"Lines {start}-{end} deleted"}
    
    elif operation == "replace_line":
        line = params.get("line", 1)
        content = params.get("content", "")
        lines = document.content.split('\n') if document.content else []
        if 1 <= line <= len(lines):
            lines[line - 1] = content
            document.content = '\n'.join(lines)
            db.commit()
        return {"message": f"Line {line} replaced"}
    
    elif operation == "find_replace":
        find_text = params.get("find_text", "")
        replace_text = params.get("replace_text", "")
        replace_all = params.get("replace_all", True)
        
        if replace_all:
            count = document.content.count(find_text)
            document.content = document.content.replace(find_text, replace_text)
        else:
            document.content = document.content.replace(find_text, replace_text, 1)
            count = 1
        db.commit()
        return {"message": f"{count} replacements made"}
    
    else:
        raise ValueError(f"Unknown operation: {operation}")


@router.post("/{document_id}/move-section", response_model=MoveSectionResponse)
def move_section(document_id: str, request: MoveSectionRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    
    if not document.content:
        return MoveSectionResponse(success=False, error="Document is empty")
    
    original_content = document.content
    headings = parse_headings(document.content)
    lines = document.content.split('\n')
    
    source_heading = None
    for h in headings:
        if request.from_heading.lower() in h.text.lower():
            source_heading = h
            break
    
    if not source_heading:
        return MoveSectionResponse(success=False, error=f"Source heading '{request.from_heading}' not found")
    
    start_line = source_heading.line_number
    end_line = len(lines)
    
    for h in headings:
        if h.line_number > start_line and h.level <= source_heading.level:
            end_line = h.line_number - 1
            break
    
    section_lines = lines[start_line - 1:end_line]
    section_content = '\n'.join(section_lines)
    
    del lines[start_line - 1:end_line]
    
    insert_index = len(lines)
    
    if request.to_position == PositionType.HEADING:
        target_heading = None
        for h in headings:
            if request.to_position_value.lower() in h.text.lower() and h.line_number != source_heading.line_number:
                target_heading = h
                break
        
        if target_heading:
            if target_heading.line_number > start_line:
                insert_index = target_heading.line_number - len(section_lines) - 1
            else:
                insert_index = target_heading.line_number - 1
            
            for h in headings:
                if h.line_number > target_heading.line_number and h.level <= target_heading.level:
                    insert_index = h.line_number - len(section_lines) - 1
                    break
    
    elif request.to_position == PositionType.LINE:
        target_line = int(request.to_position_value)
        if target_line > start_line:
            insert_index = target_line - len(section_lines) - 1
        else:
            insert_index = target_line - 1
    
    elif request.to_position == PositionType.END:
        insert_index = len(lines)
    
    elif request.to_position == PositionType.START:
        insert_index = 0
    
    insert_index = max(0, min(insert_index, len(lines)))
    
    lines = lines[:insert_index] + section_lines + lines[insert_index:]
    new_content = '\n'.join(lines)
    
    document.content = new_content
    db.commit()
    db.refresh(document)
    
    return MoveSectionResponse(
        success=True,
        doc=DocumentResponse.model_validate(document),
        original_content=original_content,
        new_content=new_content,
        section_content=section_content
    )
