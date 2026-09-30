import asyncio
import json
import logging
from typing import Dict, Optional

logger = logging.getLogger("events")

class EventManager:
    def __init__(self):
        # Maps queue -> team_id (int) or None for global
        self.subscribers: Dict[asyncio.Queue, Optional[int]] = {}

    def subscribe(self, team_id: Optional[int] = None) -> asyncio.Queue:
        q = asyncio.Queue()
        self.subscribers[q] = team_id
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.subscribers:
            del self.subscribers[q]

    async def broadcast(self, event_type: str, data: dict, team_id: Optional[int] = None):
        """
        Broadcast an event. If team_id is provided, only subscribers
        belonging to that team_id will receive it.
        """
        if not self.subscribers:
            return
        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        dead_queues = []
        for q, sub_team_id in list(self.subscribers.items()):
            if team_id is not None and sub_team_id is not None and sub_team_id != team_id:
                # Strictly isolate events: do not deliver other team's events
                continue
            try:
                q.put_nowait(payload)
            except Exception:
                dead_queues.append(q)
        for q in dead_queues:
            self.unsubscribe(q)

event_manager = EventManager()
