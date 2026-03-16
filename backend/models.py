"""
קנסיק - מודלים של בסיס הנתונים
"""

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel
from typing import Optional

Base = declarative_base()


class TicketStatus(str, Enum):
    PENDING = "pending"           # ממתין לטיפול
    URGENT = "urgent"             # דחוף - קרוב לתאריך
    PAID = "paid"                 # שולם
    APPEALED = "appealed"         # הוגש ערעור
    APPEAL_ACCEPTED = "appeal_accepted"  # ערעור התקבל
    APPEAL_REJECTED = "appeal_rejected"  # ערעור נדחה
    OVERDUE = "overdue"           # עבר התאריך


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    reminder_settings = Column(String, nullable=True)  # JSON: {"appeal": [7,3,1,0], "payment": [7,3,1,0]}
    created_at = Column(DateTime, default=datetime.utcnow)

    tickets = relationship("Ticket", back_populates="user")
    reminders = relationship("Reminder", back_populates="user")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_type = Column(String, nullable=True)  # "police" or "municipal"
    document_type = Column(String, nullable=True)  # "original" or "payment_demand"
    municipality = Column(String, nullable=True)
    ticket_number = Column(String, nullable=True)
    violation_date = Column(Date, nullable=True)
    original_ticket_date = Column(Date, nullable=True)
    vehicle_plate = Column(String, nullable=True)
    violation_description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    amount_original = Column(Float, nullable=True)
    amount_updated = Column(Float, nullable=True)
    payment_deadline = Column(Date, nullable=True)
    appeal_deadline = Column(Date, nullable=True)
    court_deadline = Column(Date, nullable=True)
    payment_url = Column(String, nullable=True)
    appeal_url = Column(String, nullable=True)
    court_url = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default=TicketStatus.PENDING)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tickets")
    reminders = relationship("Reminder", back_populates="ticket", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    remind_date = Column(Date, nullable=False)
    sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reminders")
    ticket = relationship("Ticket", back_populates="reminders")


# Pydantic schemas

class UserRegister(BaseModel):
    email: str
    password: str
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TicketScan(BaseModel):
    ticket_type: str | None = None
    document_type: str | None = None
    municipality: str | None = None
    ticket_number: str | None = None
    original_ticket_date: str | None = None
    violation_date: str | None = None
    vehicle_plate: str | None = None
    violation_description: str | None = None
    location: str | None = None
    amount_original: float | None = None
    amount_updated: float | None = None
    payment_deadline: str | None = None
    appeal_deadline: str | None = None
    court_deadline: str | None = None
    payment_url: str | None = None
    appeal_url: str | None = None
    court_url: str | None = None
    notes: str | None = None


class TicketResponse(BaseModel):
    id: int
    ticket_type: str | None = None
    document_type: str | None = None
    municipality: str | None = None
    ticket_number: str | None = None
    original_ticket_date: str | None = None
    violation_date: date | None = None
    vehicle_plate: str | None = None
    violation_description: str | None = None
    location: str | None = None
    amount_original: float | None = None
    amount_updated: float | None = None
    payment_deadline: date | None = None
    appeal_deadline: date | None = None
    court_deadline: date | None = None
    payment_url: str | None = None
    appeal_url: str | None = None
    court_url: str | None = None
    notes: str | None = None
    status: str
    days_until_payment: int | None = None
    days_until_appeal: int | None = None
    appeal_deadline_estimated: bool = False
    days_until_court: int | None = None

    class Config:
        from_attributes = True


class TicketUpdate(BaseModel):
    ticket_type: str | None = None
    document_type: str | None = None
    municipality: str | None = None
    ticket_number: str | None = None
    original_ticket_date: str | None = None
    violation_date: str | None = None
    vehicle_plate: str | None = None
    violation_description: str | None = None
    location: str | None = None
    amount_original: float | None = None
    amount_updated: float | None = None
    payment_deadline: str | None = None
    appeal_deadline: str | None = None
    court_deadline: str | None = None
    payment_url: str | None = None
    appeal_url: str | None = None
    court_url: str | None = None
    notes: str | None = None
    status: str | None = None


class AppealRequest(BaseModel):
    reason: str


class AppealResponse(BaseModel):
    appeal_text: str


class AppealRevisionRequest(BaseModel):
    appeal_text: str
    correction: str


# Reminder schemas

class ReminderSettingsSchema(BaseModel):
    appeal: list[int] = [7, 3, 1, 0]
    payment: list[int] = [7, 3, 1, 0]


class ReminderCreate(BaseModel):
    date: str  # YYYY-MM-DD


class ReminderResponse(BaseModel):
    id: int
    ticket_id: int
    remind_date: date
    sent: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TodayReminderItem(BaseModel):
    ticket_id: int
    ticket_label: str
    reminder_type: str  # "appeal", "payment", "manual"
    days_until: Optional[int] = None
    message: str
