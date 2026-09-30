import asyncio
import json
import logging
from typing import Set

logger = logging.getLogger("events")

class EventManager:
    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self.subscribers.discard(q)

    async def broadcast(self, event_type: str, data: dict):
        if not self.subscribers:
            return
        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        dead_queues = []
        for q in self.subscribers:
            try:
                q.put_nowait(payload)
            except Exception:
                dead_queues.append(q)
        for q in dead_queues:
            self.unsubscribe(q)

event_manager = EventManager()
