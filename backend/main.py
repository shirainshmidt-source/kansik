"""
קנסיק - Backend API
"""

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from jose import jwt, JWTError
import bcrypt
import os

from dotenv import load_dotenv
load_dotenv()

from database import init_db, get_db
from models import (
    User, Ticket, Reminder, TicketStatus, TicketScan, TicketResponse, TicketUpdate,
    AppealRequest, AppealResponse, AppealRevisionRequest,
    UserRegister, UserLogin, TokenResponse, UserResponse,
    ReminderSettingsSchema, ReminderCreate, ReminderResponse, TodayReminderItem,
)
import json
from ai_service import scan_ticket_image, draft_appeal, revise_appeal


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="טוקן לא תקין",
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="משתמש לא נמצא",
        )
    return user


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="קנסיק API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def compute_days_until(target_date: date | None) -> int | None:
    if not target_date:
        return None
    return (target_date - date.today()).days


def fix_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if url.lower().startswith("www."):
        return "https://" + url
    if not url.startswith("http"):
        return "https://" + url
    return url


def estimate_appeal_deadline(ticket) -> date | None:
    """
    מחשב דדליין לערעור:
    1. אם יש appeal_deadline מהדוח - משתמשים בו
    2. אם יש תאריך קבלת הדוח - 30 יום ממנו
    3. אם יש דדליין תשלום - חודשיים לפניו (כי בד"כ 90 יום לתשלום, 30 יום לערעור)
    בכל מקרה מורידים 2 ימים כמרווח ביטחון
    """
    if ticket.appeal_deadline:
        return ticket.appeal_deadline

    from dateutil.relativedelta import relativedelta

    if ticket.original_ticket_date:
        d = ticket.original_ticket_date
        if isinstance(d, str):
            try:
                d = datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                d = None
        if d:
            return d + timedelta(days=28)  # 30 ימים פחות 2 ימי ביטחון

    if ticket.payment_deadline:
        return ticket.payment_deadline - relativedelta(months=2) - timedelta(days=2)

    return None


def ticket_to_response(ticket: Ticket) -> TicketResponse:
    POLICE_FORM_URL = "https://govforms.gov.il/mw/forms/reportsApply@police.gov.il"

    # דרישת תשלום = כבר עבר הזמן לערער/להישפט
    is_payment_demand = ticket.document_type == "payment_demand"

    appeal_url = None if is_payment_demand else fix_url(ticket.appeal_url)
    court_url = None if is_payment_demand else fix_url(ticket.court_url)
    appeal_deadline = None if is_payment_demand else estimate_appeal_deadline(ticket)
    court_deadline = None if is_payment_demand else (ticket.court_deadline or appeal_deadline)

    # דוחות משטרה מקוריים מקבלים את הקישור הקבוע
    if ticket.ticket_type == "police" and not is_payment_demand:
        if not appeal_url:
            appeal_url = POLICE_FORM_URL
        if not court_url:
            court_url = POLICE_FORM_URL

    return TicketResponse(
        id=ticket.id,
        ticket_type=ticket.ticket_type,
        municipality=ticket.municipality,
        ticket_number=ticket.ticket_number,
        violation_date=ticket.violation_date,
        vehicle_plate=ticket.vehicle_plate,
        violation_description=ticket.violation_description,
        location=ticket.location,
        amount_original=ticket.amount_original,
        amount_updated=ticket.amount_updated,
        payment_deadline=ticket.payment_deadline,
        document_type=ticket.document_type,
        appeal_deadline=appeal_deadline,
        court_deadline=court_deadline,
        payment_url=fix_url(ticket.payment_url),
        appeal_url=appeal_url,
        court_url=court_url,
        notes=ticket.notes,
        status=ticket.status,
        days_until_payment=compute_days_until(ticket.payment_deadline),
        days_until_appeal=compute_days_until(appeal_deadline),
        appeal_deadline_estimated=not ticket.appeal_deadline and appeal_deadline is not None,
        days_until_court=compute_days_until(court_deadline),
    )


# ──────────────────────────────────────
#  הרשמה והתחברות
# ──────────────────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """הרשמת משתמש חדש"""
    # בדיקה אם האימייל כבר קיים
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="כתובת האימייל כבר רשומה במערכת",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name),
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """התחברות משתמש קיים"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="אימייל או סיסמה שגויים",
        )

    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name),
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """מחזיר את פרטי המשתמש המחובר"""
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name)


# ──────────────────────────────────────
#  סריקת דוח
# ──────────────────────────────────────

@app.post("/api/tickets/scan", response_model=TicketScan)
async def scan_ticket(
    front: UploadFile = File(...),
    back: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
):
    """מקבל תמונות דוח (חזית + אופציונלי גב), סורק עם AI ומחזיר את הפרטים לאישור"""
    images = []

    front_content = await front.read()
    images.append((front_content, front.content_type or "image/jpeg"))

    if back:
        back_content = await back.read()
        images.append((back_content, back.content_type or "image/jpeg"))

    result = scan_ticket_image(images)

    return TicketScan(**result)


@app.post("/api/tickets", response_model=TicketResponse)
async def create_ticket(
    ticket_data: TicketScan,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """שומר דוח חדש (אחרי אישור המשתמש)"""
    ticket = Ticket(
        user_id=current_user.id,
        ticket_type=ticket_data.ticket_type,
        document_type=ticket_data.document_type,
        municipality=ticket_data.municipality,
        ticket_number=ticket_data.ticket_number,
        violation_date=parse_date(ticket_data.violation_date),
        original_ticket_date=parse_date(ticket_data.original_ticket_date),
        vehicle_plate=ticket_data.vehicle_plate,
        violation_description=ticket_data.violation_description,
        location=ticket_data.location,
        amount_original=ticket_data.amount_original,
        amount_updated=ticket_data.amount_updated,
        payment_deadline=parse_date(ticket_data.payment_deadline),
        appeal_deadline=parse_date(ticket_data.appeal_deadline),
        court_deadline=parse_date(ticket_data.court_deadline),
        payment_url=ticket_data.payment_url,
        appeal_url=ticket_data.appeal_url,
        court_url=ticket_data.court_url,
        notes=ticket_data.notes,
        status=TicketStatus.PENDING,
    )

    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return ticket_to_response(ticket)


# ──────────────────────────────────────
#  דשבורד - רשימת דוחות
# ──────────────────────────────────────

@app.get("/api/tickets", response_model=list[TicketResponse])
async def list_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מחזיר את כל הדוחות של המשתמש"""
    result = await db.execute(
        select(Ticket)
        .where(Ticket.user_id == current_user.id)
        .order_by(Ticket.payment_deadline)
    )
    tickets = result.scalars().all()
    return [ticket_to_response(t) for t in tickets]


@app.get("/api/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מחזיר דוח ספציפי"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")
    return ticket_to_response(ticket)


@app.patch("/api/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: int,
    updates: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """עדכון פרטי דוח"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    update_data = updates.model_dump(exclude_unset=True)
    date_fields = ["violation_date", "payment_deadline", "appeal_deadline", "court_deadline"]

    for key, value in update_data.items():
        if key in date_fields:
            setattr(ticket, key, parse_date(value))
        else:
            setattr(ticket, key, value)

    await db.commit()
    await db.refresh(ticket)

    return ticket_to_response(ticket)


@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מוחק דוח"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    await db.delete(ticket)
    await db.commit()
    return {"message": "הדוח נמחק"}


# ──────────────────────────────────────
#  ערעור
# ──────────────────────────────────────

@app.post("/api/tickets/{ticket_id}/appeal", response_model=AppealResponse)
async def create_appeal(
    ticket_id: int,
    request: AppealRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מנסח ערעור על דוח"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    ticket_dict = {
        "סוג דוח": "משטרת ישראל" if ticket.ticket_type == "police" else "עירייה/רשות מקומית",
        "גורם מנפיק": ticket.municipality,
        "מספר דוח": ticket.ticket_number,
        "תאריך עבירה": str(ticket.violation_date) if ticket.violation_date else None,
        "מספר רכב": ticket.vehicle_plate,
        "עבירה": ticket.violation_description,
        "מיקום": ticket.location,
        "סכום": ticket.amount_original,
    }

    appeal_text = draft_appeal(ticket_dict, request.reason, ticket.ticket_type or "municipal")
    return AppealResponse(appeal_text=appeal_text)


@app.post("/api/tickets/{ticket_id}/appeal/revise", response_model=AppealResponse)
async def revise_appeal_endpoint(
    ticket_id: int,
    request: AppealRevisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מתקן ערעור קיים"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    revised_text = revise_appeal(request.appeal_text, request.correction)
    return AppealResponse(appeal_text=revised_text)


# ──────────────────────────────────────
#  הגדרות תזכורות
# ──────────────────────────────────────

DEFAULT_REMINDER_SETTINGS = {"appeal": [7, 3, 1, 0], "payment": [7, 3, 1, 0]}


@app.get("/api/settings/reminders", response_model=ReminderSettingsSchema)
async def get_reminder_settings(current_user: User = Depends(get_current_user)):
    """מחזיר הגדרות תזכורות של המשתמש"""
    if current_user.reminder_settings:
        return ReminderSettingsSchema(**json.loads(current_user.reminder_settings))
    return ReminderSettingsSchema(**DEFAULT_REMINDER_SETTINGS)


@app.put("/api/settings/reminders", response_model=ReminderSettingsSchema)
async def update_reminder_settings(
    settings: ReminderSettingsSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """עדכון הגדרות תזכורות"""
    current_user.reminder_settings = json.dumps(settings.model_dump())
    await db.commit()
    return settings


# ──────────────────────────────────────
#  תזכורות ידניות לדוחות
# ──────────────────────────────────────

@app.get("/api/tickets/{ticket_id}/reminders", response_model=list[ReminderResponse])
async def get_ticket_reminders(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מחזיר תזכורות של דוח ספציפי"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    result = await db.execute(
        select(Reminder)
        .where(Reminder.ticket_id == ticket_id, Reminder.user_id == current_user.id)
        .order_by(Reminder.remind_date)
    )
    return result.scalars().all()


@app.post("/api/tickets/{ticket_id}/reminders", response_model=ReminderResponse)
async def create_ticket_reminder(
    ticket_id: int,
    data: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """הוספת תזכורת ידנית לדוח"""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket or ticket.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="דוח לא נמצא")

    remind_date = parse_date(data.date)
    if not remind_date:
        raise HTTPException(status_code=400, detail="תאריך לא תקין")

    reminder = Reminder(
        user_id=current_user.id,
        ticket_id=ticket_id,
        remind_date=remind_date,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מחיקת תזכורת"""
    reminder = await db.get(Reminder, reminder_id)
    if not reminder or reminder.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="תזכורת לא נמצאה")

    await db.delete(reminder)
    await db.commit()
    return {"message": "התזכורת נמחקה"}


# ──────────────────────────────────────
#  תזכורות להיום
# ──────────────────────────────────────

@app.get("/api/reminders/today", response_model=list[TodayReminderItem])
async def get_today_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """מחזיר את כל התזכורות שצריכות להיות מוצגות היום"""
    today = date.today()
    items = []

    # 1. הגדרות תזכורות אוטומטיות
    if current_user.reminder_settings:
        settings = json.loads(current_user.reminder_settings)
    else:
        settings = DEFAULT_REMINDER_SETTINGS

    appeal_days = settings.get("appeal", [])
    payment_days = settings.get("payment", [])

    # טען את כל הדוחות הפעילים
    result = await db.execute(
        select(Ticket)
        .where(Ticket.user_id == current_user.id)
        .where(Ticket.status.notin_(["paid", "appeal_accepted"]))
    )
    tickets = result.scalars().all()

    for ticket in tickets:
        label = ticket.municipality or f"דוח #{ticket.id}"
        amount = ticket.amount_original or 0
        amount_str = f"₪{int(amount)}"

        # בדיקת תזכורות ערעור
        appeal_deadline = estimate_appeal_deadline(ticket)
        if appeal_deadline:
            days_until = (appeal_deadline - today).days
            if days_until >= 0 and days_until in appeal_days:
                if days_until == 0:
                    msg = f"היום יום אחרון לערער על דוח {label} ({amount_str}). ערעור יכול לבטל את הדוח לגמרי!"
                elif days_until == 1:
                    msg = f"מחר יום אחרון לערער על דוח {label} ({amount_str}). מומלץ לפעול היום."
                elif days_until == 3:
                    msg = f"נשארו 3 ימים לערער על דוח {label} ({amount_str}). אל תפספסי את ההזדמנות לביטול."
                else:
                    msg = f"נשארו {days_until} ימים לערער על דוח {label} ({amount_str}). ערעור יכול לחסוך לך את כל הסכום."
                items.append(TodayReminderItem(
                    ticket_id=ticket.id,
                    ticket_label=label,
                    reminder_type="appeal",
                    days_until=days_until,
                    message=msg,
                ))

        # בדיקת תזכורות תשלום
        if ticket.payment_deadline:
            days_until = (ticket.payment_deadline - today).days
            if days_until >= 0 and days_until in payment_days:
                if days_until == 0:
                    msg = f"היום יום אחרון לשלם את דוח {label} ({amount_str}) לפני תוספת קנס. מחר הסכום יעלה!"
                elif days_until == 1:
                    msg = f"מחר יום אחרון לשלם את דוח {label} ({amount_str}) בלי ריבית. כדאי לטפל היום."
                elif days_until == 3:
                    msg = f"נשארו 3 ימים לשלם את דוח {label} ({amount_str}) לפני שהסכום מתחיל לעלות."
                else:
                    msg = f"נשארו {days_until} ימים לשלם את דוח {label} ({amount_str}) לפני תוספת ריבית."
                items.append(TodayReminderItem(
                    ticket_id=ticket.id,
                    ticket_label=label,
                    reminder_type="payment",
                    days_until=days_until,
                    message=msg,
                ))

    # 2. תזכורות ידניות להיום
    result = await db.execute(
        select(Reminder)
        .where(Reminder.user_id == current_user.id)
        .where(Reminder.remind_date == today)
        .where(Reminder.sent == False)
    )
    manual_reminders = result.scalars().all()

    for reminder in manual_reminders:
        ticket = await db.get(Ticket, reminder.ticket_id)
        label = (ticket.municipality if ticket else None) or f"דוח #{reminder.ticket_id}"
        amount = (ticket.amount_original if ticket else 0) or 0
        amount_str = f"₪{int(amount)}"
        items.append(TodayReminderItem(
            ticket_id=reminder.ticket_id,
            ticket_label=label,
            reminder_type="manual",
            message=f"תזכורת לטפל בדוח {label} ({amount_str}). ככל שממתינים יותר, הסכום גדל.",
        ))
        # סמן כנשלח
        reminder.sent = True

    await db.commit()
    return items
