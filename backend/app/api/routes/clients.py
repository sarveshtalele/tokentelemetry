from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_clients():
    conn = connect()
    rows = conn.execute(
        """
        SELECT client,
               COUNT(DISTINCT project) as projects,
               COUNT(DISTINCT session_id) as sessions,
               COALESCE(SUM(total_tokens),0) as total_tokens,
               COUNT(*) as requests
        FROM usage
        WHERE client IS NOT NULL AND client != ''
        GROUP BY client ORDER BY total_tokens DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}