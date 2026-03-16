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
        # בדיקה שכל הטבלאות והעמודות קיימות
        try:
            from sqlalchemy import text, inspect

            def check_schema(connection):
                inspector = inspect(connection)
                tables = inspector.get_table_names()
                # בדוק שכל הטבלאות קיימות
                if not all(t in tables for t in ["users", "tickets", "reminders"]):
                    return False
                # בדוק שעמודת reminder_settings קיימת ב-users
                user_cols = [c["name"] for c in inspector.get_columns("users")]
                if "reminder_settings" not in user_cols:
                    return False
                return True

            schema_ok = await conn.run_sync(check_schema)
        except Exception:
            schema_ok = False

        if not schema_ok:
            await conn.run_sync(Base.metadata.drop_all)

        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
