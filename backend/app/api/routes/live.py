import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ...db.connection import connect

router = APIRouter()
connected_clients: set[WebSocket] = set()


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        last_total = 0
        last_time = ""
        while True:
            conn = connect()
            row = conn.execute(
                "SELECT COALESCE(SUM(total_tokens),0) as total, "
                "MAX(event_time) as last_time FROM usage"
            ).fetchone()
            conn.close()
            total = row[0] or 0
            current_time = row[1] or ""
            if total != last_total:
                last_total = total
                last_time = current_time
                payload = json.dumps({
                    "type": "metrics",
                    "data": {"total_tokens": total},
                    "timestamp": current_time,
                })
                await websocket.send_text(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(websocket)