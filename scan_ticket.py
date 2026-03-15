"""
קנסיק - סריקת דוח חניה מתמונה
מזהה את כל הפרטים מתמונת דוח באמצעות Claude AI
"""

import anthropic
import base64
import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()


def encode_image(image_path: str) -> tuple[str, str]:
    """קורא תמונה ומחזיר base64 + media type"""
    ext = os.path.splitext(image_path)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    media_type = media_types.get(ext, "image/jpeg")

    with open(image_path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")

    return data, media_type


def scan_ticket(image_path: str) -> dict:
    """סורק תמונת דוח ומחזיר את כל הפרטים כ-JSON"""
    client = anthropic.Anthropic()
    image_data, media_type = encode_image(image_path)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": """אתה מערכת OCR לדוחות חניה וקנסות בישראל.
נתח את התמונה והחזר JSON בלבד (בלי markdown, בלי הסברים) עם השדות הבאים:

{
  "municipality": "שם העירייה / הרשות",
  "ticket_number": "מספר הדוח",
  "violation_date": "תאריך ביצוע העבירה (YYYY-MM-DD)",
  "vehicle_plate": "מספר רכב",
  "violation_description": "תיאור העבירה",
  "location": "מיקום העבירה",
  "amount_original": "סכום מקורי בש״ח (מספר בלבד)",
  "amount_updated": "סכום עדכני כולל פיגורים בש״ח (מספר בלבד, אם מופיע)",
  "payment_deadline": "תאריך אחרון לתשלום מופחת (YYYY-MM-DD)",
  "appeal_deadline": "תאריך אחרון לערעור (YYYY-MM-DD)",
  "court_deadline": "תאריך אחרון להישפטות (YYYY-MM-DD)",
  "payment_url": "קישור לתשלום (אם מופיע)",
  "appeal_url": "קישור לערעור (אם מופיע)",
  "notes": "הערות נוספות"
}

אם שדה לא מופיע בדוח, רשום null.
החזר רק JSON תקין, בלי שום טקסט נוסף.""",
                    },
                ],
            }
        ],
    )

    result_text = response.content[0].text

    # נקה את הטקסט מ-markdown אם צריך
    if result_text.startswith("```"):
        result_text = result_text.split("\n", 1)[1]
        result_text = result_text.rsplit("```", 1)[0]

    return json.loads(result_text)


def print_ticket_summary(ticket: dict):
    """מדפיס סיכום דוח בצורה קריאה"""
    print("\n" + "=" * 50)
    print("  📋 פרטי הדוח שזוהו")
    print("=" * 50)

    labels = {
        "municipality": "עירייה",
        "ticket_number": "מספר דוח",
        "violation_date": "תאריך עבירה",
        "vehicle_plate": "מספר רכב",
        "violation_description": "עבירה",
        "location": "מיקום",
        "amount_original": "סכום מקורי",
        "amount_updated": "סכום עדכני",
        "payment_deadline": "תשלום עד",
        "appeal_deadline": "ערעור עד",
        "court_deadline": "הישפטות עד",
        "payment_url": "קישור תשלום",
        "appeal_url": "קישור ערעור",
        "notes": "הערות",
    }

    for key, label in labels.items():
        value = ticket.get(key)
        if value is not None:
            if key in ("amount_original", "amount_updated"):
                print(f"  {label}: ₪{value}")
            else:
                print(f"  {label}: {value}")

    print("=" * 50)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("שימוש: python scan_ticket.py <נתיב-לתמונת-דוח>")
        print("דוגמה: python scan_ticket.py ticket.jpg")
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        print(f"שגיאה: הקובץ '{image_path}' לא נמצא")
        sys.exit(1)

    print(f"סורק את הדוח: {image_path}...")
    ticket = scan_ticket(image_path)
    print_ticket_summary(ticket)

    # שומר גם כ-JSON
    output_path = os.path.splitext(image_path)[0] + "_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(ticket, f, ensure_ascii=False, indent=2)
    print(f"\nהנתונים נשמרו ב: {output_path}")
