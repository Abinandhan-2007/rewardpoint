import asyncio
import logging
from config import POLL_INTERVAL_MINUTES
from fetcher import sync_all_members

logger = logging.getLogger("scheduler")

class BackgroundScheduler:
    def __init__(self, interval_minutes: int = POLL_INTERVAL_MINUTES):
        self.interval_seconds = interval_minutes * 60
        self._task: asyncio.Task = None
        self._is_running = False
        self._trigger_event = asyncio.Event()

    async def _run_loop(self):
        logger.info(f"Background scheduler started (interval: {POLL_INTERVAL_MINUTES} mins / {self.interval_seconds}s)")
        
        # Initial wait before starting first auto-poll to allow app startup
        await asyncio.sleep(2)
        
        while self._is_running:
            try:
                logger.info("Executing scheduled sync...")
                await sync_all_members()
            except Exception as e:
                logger.error(f"Error in scheduler execution loop: {e}", exc_info=True)

            # Wait for next interval or until manual trigger event is set
            try:
                # Wait for interval OR manual refresh event
                await asyncio.wait_for(self._trigger_event.wait(), timeout=self.interval_seconds)
                self._trigger_event.clear()
                logger.info("Manual refresh triggered!")
            except asyncio.TimeoutError:
                # Interval elapsed normally
                pass

    def start(self):
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._run_loop())

    def stop(self):
        self._is_running = False
        if self._task:
            self._task.cancel()

    def trigger_immediate_sync(self):
        """Trigger an immediate sync run without waiting for timer"""
        self._trigger_event.set()

scheduler = BackgroundScheduler(POLL_INTERVAL_MINUTES)
