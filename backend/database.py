"""
קנסיק - חיבור לבסיס נתונים
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from models import Base

DATABASE_URL = "sqlite+aiosqlite:///./kansik.db"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        # יוצר טבלאות חדשות אם לא קיימות, בלי למחוק ישנות
        await conn.run_sync(Base.metadata.create_all)
    # בדיקה שכל הטבלאות תקינות
    try:
        async with async_session() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1 FROM users LIMIT 1"))
            await session.execute(text("SELECT 1 FROM tickets LIMIT 1"))
            await session.execute(text("SELECT 1 FROM reminders LIMIT 1"))
    except Exception:
        # אם טבלה חסרה או שבורה - יוצר הכל מחדש
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
