"""
קנסיק - ניסוח ערעור על דוח חניה
המשתמש כותב בקצרה מה קרה → AI מנסח ערעור מקצועי
"""

import anthropic
import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()


def draft_appeal(ticket: dict, user_reason: str) -> str:
    """מקבל פרטי דוח וסיבה קצרה, מחזיר ערעור מנוסח"""
    client = anthropic.Anthropic()

    ticket_summary = f"""
עירייה: {ticket.get('municipality', 'לא ידוע')}
מספר דוח: {ticket.get('ticket_number', 'לא ידוע')}
תאריך: {ticket.get('date_issued', 'לא ידוע')}
מספר רכב: {ticket.get('vehicle_plate', 'לא ידוע')}
עבירה: {ticket.get('violation_description', 'לא ידוע')}
מיקום: {ticket.get('location', 'לא ידוע')}
סכום: {ticket.get('amount_original', 'לא ידוע')} ש"ח
""".strip()

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": f"""אתה עורך דין המתמחה בערעורים על דוחות חניה בישראל.
נסח ערעור רשמי, מקצועי ומשכנע על דוח החניה הבא.

פרטי הדוח:
{ticket_summary}

הסיבה של המשתמש (בקצרה):
"{user_reason}"

הנחיות:
- כתוב ערעור רשמי בעברית תקנית
- פנה לוועדת הערעורים / למחלקת החניה של העירייה
- השתמש בנימוקים משפטיים ועובדתיים
- הוסף בקשה לביטול הדוח או הפחתת הסכום
- היה מנומס אך נחוש
- אל תמציא עובדות שהמשתמש לא ציין
- אורך: 150-300 מילים
- החזר רק את טקסט הערעור, בלי הסברים נוספים""",
            }
        ],
    )

    return response.content[0].text


def interactive_mode(ticket_path: str):
    """מצב אינטראקטיבי - טוען דוח, מבקש סיבה, מנסח ערעור, מאפשר תיקונים"""

    # טוען את פרטי הדוח
    with open(ticket_path, "r", encoding="utf-8") as f:
        ticket = json.load(f)

    print("\n" + "=" * 50)
    print("  ✍️  ניסוח ערעור על דוח")
    print("=" * 50)
    print(f"  דוח מס': {ticket.get('ticket_number', 'לא ידוע')}")
    print(f"  עירייה: {ticket.get('municipality', 'לא ידוע')}")
    print(f"  עבירה: {ticket.get('violation_description', 'לא ידוע')}")
    print("=" * 50)

    # שלב 1: המשתמש כותב בקצרה
    print("\nספר בקצרה למה מגיע לך לערער (משפט או שניים):")
    print("דוגמה: 'לא היה שלט חניה באזור' או 'שילמתי בפרקומט אבל הוא לא עבד'")
    print()
    user_reason = input("הסיבה שלך: ").strip()

    if not user_reason:
        print("לא הוזנה סיבה. יציאה.")
        return

    # שלב 2: AI מנסח ערעור
    print("\nמנסח ערעור...")
    appeal_text = draft_appeal(ticket, user_reason)

    # שלב 3: מציג למשתמש
    while True:
        print("\n" + "-" * 50)
        print("  📝 טיוטת הערעור:")
        print("-" * 50)
        print(appeal_text)
        print("-" * 50)

        print("\nמה תרצה לעשות?")
        print("  1. אישור ושמירה")
        print("  2. בקש תיקון")
        print("  3. התחל מחדש")
        print("  4. ביטול")

        choice = input("\nבחירה (1-4): ").strip()

        if choice == "1":
            # שומר את הערעור
            output_path = os.path.splitext(ticket_path)[0].replace("_data", "") + "_appeal.txt"
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(appeal_text)
            print(f"\nהערעור נשמר ב: {output_path}")
            print("עכשיו אפשר להעתיק ולשלוח דרך אתר העירייה.")
            break

        elif choice == "2":
            correction = input("מה לתקן? ").strip()
            if correction:
                print("\nמתקן...")
                client = anthropic.Anthropic()
                response = client.messages.create(
                    model="claude-sonnet-4-6",
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
                appeal_text = response.content[0].text

        elif choice == "3":
            print("\nספר שוב בקצרה למה מגיע לך לערער:")
            user_reason = input("הסיבה שלך: ").strip()
            if user_reason:
                print("\nמנסח מחדש...")
                appeal_text = draft_appeal(ticket, user_reason)

        elif choice == "4":
            print("בוטל.")
            break


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("שימוש: python draft_appeal.py <נתיב-לקובץ-JSON-של-דוח>")
        print("דוגמה: python draft_appeal.py ticket_data.json")
        print("\nרמז: קודם הרץ scan_ticket.py כדי ליצור את קובץ ה-JSON")
        sys.exit(1)

    ticket_path = sys.argv[1]

    if not os.path.exists(ticket_path):
        print(f"שגיאה: הקובץ '{ticket_path}' לא נמצא")
        sys.exit(1)

    interactive_mode(ticket_path)
