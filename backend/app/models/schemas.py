from pydantic import BaseModel
from typing import Optional, Any


class SummaryResponse(BaseModel):
    total_tokens: int = 0
    total_requests: int = 0
    total_projects: int = 0
    total_sessions: int = 0
    top_model: str = ""
    top_client: str = ""
    avg_tokens_per_request: float = 0


class ProjectSummary(BaseModel):
    project: str
    total_tokens: int = 0
    requests: int = 0
    sessions: int = 0
    clients: list[str] = []
    models: list[str] = []
    last_activity: Optional[str] = None


class ToolStats(BaseModel):
    tool_name: str
    call_count: int = 0
    unique_sessions: int = 0
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None


class SkillStats(BaseModel):
    skill_name: str
    trigger_type: Optional[str] = None
    plugin_name: Optional[str] = None
    call_count: int = 0
    last_activated: Optional[str] = None


class PaginatedResponse(BaseModel):
    data: list[Any]
    meta: dict = {"total": 0, "page": 1, "page_size": 100}