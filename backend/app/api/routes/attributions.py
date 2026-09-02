from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_attributions():
    conn = connect()
    rows = conn.execute(
        """
        SELECT project, category,
               ROUND(SUM(estimated_tokens),1) as estimated_tokens,
               COUNT(*) as reference_count
        FROM attributions GROUP BY project, category
        ORDER BY estimated_tokens DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}