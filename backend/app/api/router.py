from fastapi import APIRouter
from .routes import usage, projects, tools, skills, sessions, events, clients
from .routes import attributions, mcp, plugins, settings, reports

api_router = APIRouter()

api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(attributions.router, prefix="/attributions", tags=["attributions"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(plugins.router, prefix="/plugins", tags=["plugins"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])