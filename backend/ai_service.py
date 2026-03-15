"""
קנסיק - שירותי AI (סריקת דוח + ניסוח ערעור)
"""

import anthropic
import base64
import json


client = anthropic.Anthropic()
MODEL = "claude-sonnet-4-6"


def scan_ticket_image(images: list[tuple[bytes, str]]) -> dict:
    """סורק תמונות דוח (חזית + אופציונלי גב) ומחזיר את הפרטים כ-dict"""
    content = []
    for i, (image_bytes, media_type) in enumerate(images):
        image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
        label = "חזית הדוח" if i == 0 else "גב הדוח"
        content.append({"type": "text", "text": f"--- {label} ---"})
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_data,
            },
        })

    content.append({
        "type": "text",
        "text": """אתה מערכת OCR לדוחות חניה וקנסות בישראל.
נתח את התמונות (חזית הדוח, ואם יש - גם גב הדוח) והחזר JSON בלבד (בלי markdown, בלי הסברים) עם השדות הבאים.
שלב מידע משני הצדדים - לעיתים קישורים ותאריכים מופיעים בגב הדוח.

{
  "ticket_type": "police אם זה דוח של משטרת ישראל, או municipal אם זה דוח של רשות מקומית/עירייה (חניה)",
  "document_type": "original אם זה הדוח המקורי, או payment_demand אם זו דרישת תשלום/הודעת חוב (כולל תוספת פיגורים)",
  "municipality": "שם העירייה / הרשות (למשל: משטרת ישראל, עיריית תל אביב)",
  "ticket_number": "מספר הדוח",
  "violation_date": "תאריך ביצוע העבירה (YYYY-MM-DD)",
  "original_ticket_date": "תאריך הוצאת הדוח המקורי (YYYY-MM-DD) - חשוב! ממנו נספרים 30 יום לערעור/הישפטות",
  "vehicle_plate": "מספר רכב",
  "violation_description": "תיאור העבירה",
  "location": "מיקום העבירה",
  "amount_original": "סכום מקורי בש״ח (מספר בלבד)",
  "amount_updated": "סכום עדכני כולל פיגורים בש״ח (מספר בלבד, אם מופיע)",
  "payment_deadline": "תאריך אחרון לתשלום מופחת (YYYY-MM-DD)",
  "appeal_deadline": "תאריך אחרון לערעור (YYYY-MM-DD)",
  "court_deadline": "תאריך אחרון להישפטות (YYYY-MM-DD)",
  "payment_url": "הקישור המלא והמדויק לתשלום כפי שמופיע בדוח, כולל נתיב ספציפי (לא רק דומיין ראשי)",
  "appeal_url": "הקישור המלא והמדויק לערעור כפי שמופיע בדוח, כולל נתיב ספציפי",
  "court_url": "הקישור המלא והמדויק לבקשה להישפטות כפי שמופיע בדוח, כולל נתיב ספציפי",
  "notes": "הערות נוספות"
}

חשוב לגבי קישורים:
- העתק את הכתובת המלאה והמדויקה כפי שמופיעה בדוח
- אם כתוב למשל "ניתן לשלם באתר www.example.co.il/pay" - רשום את הכתובת המלאה
- אם יש כתובת כללית ולידה גם כתובת ספציפית - העדף את הספציפית
- אם לא מופיע קישור, רשום null

אם שדה לא מופיע בדוח, רשום null.
החזר רק JSON תקין, בלי שום טקסט נוסף.""",
    })

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )

    result_text = response.content[0].text
    if result_text.startswith("```"):
        result_text = result_text.split("\n", 1)[1]
        result_text = result_text.rsplit("```", 1)[0]

    return json.loads(result_text)


def draft_appeal(ticket: dict, user_reason: str, appeal_type: str = "objection") -> str:
    """מנסח השגה/ערר מקצועי על סמך פרטי הדוח וסיבת המשתמש"""
    ticket_summary = "\n".join(
        f"{k}: {v}" for k, v in ticket.items() if v is not None
    )

    if appeal_type == "objection":
        type_instructions = """סוג המסמך: השגה (בקשה ראשונית לביטול/הפחתת הדוח)
- פנה לגורם שנתן את הדוח:
  * דוח משטרה → מרכז פניות נהגים ארצי
  * דוח רשות מקומית → מחלקת החניה/תעבורה של הרשות
  * דוח רשות שדות התעופה → רשות שדות התעופה
- ניתן להגיש השגה בתוך 30 יום ממסירת הדוח (90 יום אם העבירה לא בוצעה ע"י בעל הרכב)"""
    else:
        type_instructions = """סוג המסמך: ערר לבית הדין לתעבורה
- פנה לבית הדין לתעבורה
- ניתן להגיש ערר בתוך 90 יום ממסירת הדוח, או 30 יום מדחיית ההשגה
- ערר מוגש באמצעות אתר בתי הדין של משרד המשפטים
- הערר נדון על סמך מסמכים בכתב (בד"כ ללא דיון בנוכחות)"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": f"""אתה עורך דין המתמחה בהשגות וערעורים על דוחות תעבורה וחניה בישראל.
נסח מסמך רשמי, מקצועי ומשכנע.

{type_instructions}

פרטי הדוח:
{ticket_summary}

הסיבה של המשתמש (בקצרה):
"{user_reason}"

הנחיות:
- כתוב בעברית תקנית ורשמית
- השתמש בנימוקים משפטיים ועובדתיים
- הוסף בקשה לביטול הדוח או הפחתת הסכום
- היה מנומס אך נחוש
- אל תמציא עובדות שהמשתמש לא ציין
- אורך: 150-300 מילים
- החזר רק את טקסט המסמך, בלי הסברים נוספים""",
            }
        ],
    )

    return response.content[0].text


def revise_appeal(appeal_text: str, correction: str) -> str:
    """מתקן ערעור קיים לפי בקשת המשתמש"""
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": f"""הנה ערעור על דוח חניה שניסחת:

{appeal_text}

המשתמש מבקש את התיקון הבא:
"{correction}"

נסח מחדש את הערעור עם התיקון המבוקש.
החזר רק את הטקסט המתוקן, בלי הסברים.""",
            }
        ],
    )

    return response.content[0].text
