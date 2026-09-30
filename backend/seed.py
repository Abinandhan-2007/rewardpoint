import asyncio
from database import SessionLocal, init_db
import models
from fetcher import gradio_fetcher, process_member_snapshot

async def seed_sample_data():
    init_db()
    db = SessionLocal()
    try:
        # Check if sample student already exists
        existing = db.query(models.Member).filter(models.Member.roll_no == "7376231CS101").first()
        if not existing:
            print("Adding sample team member 7376231CS101 (AAMINA A)...")
            member = models.Member(
                roll_no="7376231CS101",
                name="AAMINA A",
                is_active=True
            )
            db.add(member)
            db.commit()
            db.refresh(member)
            
            print("Fetching live data from Gradio space for initial snapshot...")
            fetched = await gradio_fetcher.fetch_member_data(member.roll_no)
            snapshot = await process_member_snapshot(db, member, fetched)
            print(f"Initial snapshot saved! Balance points: {snapshot.balance_points}, Marks: {snapshot.total_marks}")
        else:
            print("Sample student already exists in database.")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(seed_sample_data())
