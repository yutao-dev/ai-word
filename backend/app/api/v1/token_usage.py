from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
from ...db.database import get_db
from ...models.document import TokenUsage
from ...models.schemas import (
    TokenUsageResponse, TokenUsageCreate, TokenUsageStats, TokenUsageSummary
)

router = APIRouter(prefix="/token-usage", tags=["token-usage"])


def calculate_summary(db: Session, start_date: datetime) -> TokenUsageSummary:
    records = db.query(TokenUsage).filter(TokenUsage.created_at >= start_date).all()
    
    if not records:
        return TokenUsageSummary(
            total_prompt_tokens=0,
            total_completion_tokens=0,
            total_tokens=0,
            total_cached_tokens=0,
            avg_cache_hit_ratio=0,
            total_requests=0,
            by_model=[],
            by_provider=[]
        )
    
    total_prompt = sum(r.prompt_tokens for r in records)
    total_completion = sum(r.completion_tokens for r in records)
    total = sum(r.total_tokens for r in records)
    # 处理 cached_tokens 列不存在的情况
    total_cached = 0
    try:
        total_cached = sum(getattr(r, 'cached_tokens', 0) for r in records)
    except:
        pass
    
    # 计算平均缓存命中率
    avg_cache_hit = 0
    if total_prompt > 0 and total_cached > 0:
        avg_cache_hit = int((total_cached / total_prompt) * 100)
    
    model_stats = {}
    provider_stats = {}
    
    for r in records:
        if r.model not in model_stats:
            model_stats[r.model] = {"model": r.model, "total_tokens": 0, "cached_tokens": 0, "count": 0}
        model_stats[r.model]["total_tokens"] += r.total_tokens
        # 处理 cached_tokens 列不存在的情况
        try:
            model_stats[r.model]["cached_tokens"] += getattr(r, 'cached_tokens', 0)
        except:
            pass
        model_stats[r.model]["count"] += 1
        
        if r.provider not in provider_stats:
            provider_stats[r.provider] = {"provider": r.provider, "total_tokens": 0, "cached_tokens": 0, "count": 0}
        provider_stats[r.provider]["total_tokens"] += r.total_tokens
        # 处理 cached_tokens 列不存在的情况
        try:
            provider_stats[r.provider]["cached_tokens"] += getattr(r, 'cached_tokens', 0)
        except:
            pass
        provider_stats[r.provider]["count"] += 1
    
    return TokenUsageSummary(
        total_prompt_tokens=total_prompt,
        total_completion_tokens=total_completion,
        total_tokens=total,
        total_cached_tokens=total_cached,
        avg_cache_hit_ratio=avg_cache_hit,
        total_requests=len(records),
        by_model=list(model_stats.values()),
        by_provider=list(provider_stats.values())
    )


@router.get("/stats", response_model=TokenUsageStats)
def get_token_stats(db: Session = Depends(get_db)):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    return TokenUsageStats(
        today=calculate_summary(db, today_start),
        week=calculate_summary(db, week_start),
        month=calculate_summary(db, month_start),
        all_time=calculate_summary(db, datetime.min)
    )


@router.get("/", response_model=List[TokenUsageResponse])
def get_token_usage_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    workflow_id: str = Query(None),
    session_id: str = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(TokenUsage)
    
    if workflow_id:
        query = query.filter(TokenUsage.workflow_id == workflow_id)
    if session_id:
        query = query.filter(TokenUsage.session_id == session_id)
    
    records = query.order_by(TokenUsage.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.post("/", response_model=TokenUsageResponse)
def create_token_usage(usage: TokenUsageCreate, db: Session = Depends(get_db)):
    record = TokenUsage(**usage.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/workflow/{workflow_id}", response_model=List[TokenUsageResponse])
def get_workflow_token_usage(workflow_id: str, db: Session = Depends(get_db)):
    records = db.query(TokenUsage).filter(
        TokenUsage.workflow_id == workflow_id
    ).order_by(TokenUsage.created_at.asc()).all()
    return records


@router.get("/workflow-stats/recent")
def get_recent_workflow_stats(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    subquery = db.query(
        TokenUsage.workflow_id,
        func.min(TokenUsage.created_at).label('first_request')
    ).group_by(TokenUsage.workflow_id).subquery()

    workflow_summaries = db.query(
        TokenUsage.workflow_id,
        func.sum(TokenUsage.total_tokens).label('total_tokens'),
        func.sum(TokenUsage.prompt_tokens).label('prompt_tokens'),
        func.sum(TokenUsage.completion_tokens).label('completion_tokens'),
        func.sum(TokenUsage.cached_tokens).label('cached_tokens'),
        func.avg(TokenUsage.cache_hit_ratio).label('cache_hit_ratio'),
        func.count(TokenUsage.id).label('request_count'),
        func.min(TokenUsage.created_at).label('first_request'),
        func.max(TokenUsage.created_at).label('last_request'),
        func.min(TokenUsage.model).label('model')
    ).group_by(
        TokenUsage.workflow_id
    ).order_by(
        func.min(TokenUsage.created_at).desc()
    ).limit(limit).all()

    results = []
    for ws in workflow_summaries:
        if ws.workflow_id is None:
            continue
        results.append({
            "workflow_id": ws.workflow_id,
            "total_tokens": ws.total_tokens or 0,
            "prompt_tokens": ws.prompt_tokens or 0,
            "completion_tokens": ws.completion_tokens or 0,
            "cached_tokens": ws.cached_tokens or 0,
            "cache_hit_ratio": int(ws.cache_hit_ratio or 0),
            "request_count": ws.request_count or 0,
            "first_request": ws.first_request.isoformat() if ws.first_request else None,
            "last_request": ws.last_request.isoformat() if ws.last_request else None,
            "model": ws.model
        })

    return results


@router.delete("/")
def clear_token_usage(db: Session = Depends(get_db)):
    db.query(TokenUsage).delete()
    db.commit()
    return {"message": "Token usage history cleared"}
