from datetime import timedelta, date as _date
from collections import OrderedDict
from html import escape
import os

from django.core.management.base import BaseCommand
from django.utils.timezone import localdate
from django.conf import settings

from ToolApp.models import Users, AttendanceSession, LeaveDay


DEFAULT_RECIPIENTS = [
    "achizitii2@dmxconstruction.ro",
    "hr@xuxinvestment.ro",
    "ovidiu.pirvu@novarion.ro",
]


def get_target_day(date_str=None):
    if date_str:
        return _date.fromisoformat(date_str)
    return localdate() - timedelta(days=1)


def get_missing_users_for_day(target_day):
    present_user_ids = set(
        AttendanceSession.objects
        .filter(work_date=target_day)
        .values_list("user_fk_id", flat=True)
        .distinct()
    )

    leave_user_ids = set(
        LeaveDay.objects
        .filter(work_date=target_day)
        .values_list("user_fk_id", flat=True)
        .distinct()
    )

    excluded_ids = present_user_ids | leave_user_ids

    users = (
        Users.objects
        .exclude(UserId__in=excluded_ids)
        .order_by("UserName")
    )

    return list(users)


def group_users_by_company(missing_users):
    """Grupeaza angajatii dupa firma, cu firmele in ordine alfabetica."""
    groups = {}
    for user in missing_users:
        company = str(getattr(user, "Company", "") or "").strip() or "Fără firmă"
        groups.setdefault(company, []).append(user)

    return OrderedDict(
        sorted(
            groups.items(),
            key=lambda item: (item[0] == "Fără firmă", item[0].casefold()),
        )
    )


def build_company_table(company, users):
    rows = []
    for idx, user in enumerate(users, start=1):
        user_name = escape(str(getattr(user, "UserName", "") or ""))
        user_serie = escape(str(getattr(user, "UserSerie", "") or "-"))
        rows.append(
            f"""
            <tr>
              <td style="padding:8px;border:1px solid #ddd;">{idx}</td>
              <td style="padding:8px;border:1px solid #ddd;">{user_name}</td>
              <td style="padding:8px;border:1px solid #ddd;">{user_serie}</td>
            </tr>
            """
        )

    company_name = escape(company)
    return f"""
      <section style="margin-top:24px;">
        <h3 style="margin:0 0 10px;">{company_name} — lipsă: {len(users)}</h3>
        <table style="border-collapse:collapse;min-width:700px;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">#</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Nume</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Serie</th>
            </tr>
          </thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
      </section>
    """


def build_html(target_day, missing_users):
    count = len(missing_users)

    if count == 0:
        companies_html = "<p>Toți angajații au fost pontați sau au leave înregistrat.</p>"
    else:
        companies_html = "".join(
            build_company_table(company, users)
            for company, users in group_users_by_company(missing_users).items()
        )

    return f"""
    <html>
      <body style="font-family:Arial,Helvetica,sans-serif;">
        <h2>Raport pontaj lipsă - {target_day.isoformat()}</h2>
        <p>
          Angajați fără pontaj și fără leave înregistrat pentru ziua de
          <strong>{target_day.isoformat()}</strong>: <strong>{count}</strong>
        </p>

        {companies_html}

        <p style="margin-top:20px;color:#666;">
          Generat automat din sistemul de pontaj.
        </p>
      </body>
    </html>
    """


def build_text(target_day, missing_users):
    if not missing_users:
        return (
            f"Raport pontaj lipsă - {target_day.isoformat()}\n\n"
            f"Toți angajații au fost pontați sau au leave înregistrat."
        )

    lines = [
        f"Raport pontaj lipsă - {target_day.isoformat()}",
        "",
        f"Angajați fără pontaj și fără leave înregistrat: {len(missing_users)}",
        "",
    ]
    for company, users in group_users_by_company(missing_users).items():
        lines.append(f"{company} — lipsă: {len(users)}")
        for idx, user in enumerate(users, start=1):
            lines.append(
                f"{idx}. {getattr(user, 'UserName', '')} | "
                f"Serie: {getattr(user, 'UserSerie', '') or '-'}"
            )
        lines.append("")
    return "\n".join(lines)


def send_email(subject, html_content, text_content, recipients):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    api_key = (
        os.environ.get("SENDGRID_API_KEY")
        or getattr(settings, "SENDGRID_API_KEY", "")
    )
    from_email = (
        os.environ.get("DEFAULT_FROM_EMAIL")
        or getattr(settings, "DEFAULT_FROM_EMAIL", "")
        or "no-reply@dmxconstruction.ro"
    )

    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY lipsește din environment/settings.")

    if not from_email:
        raise RuntimeError("DEFAULT_FROM_EMAIL lipsește din environment/settings.")

    message = Mail(
        from_email=from_email,
        to_emails=recipients,
        subject=subject,
        plain_text_content=text_content,
        html_content=html_content,
    )

    sg = SendGridAPIClient(api_key)
    return sg.send(message)


class Command(BaseCommand):
    help = "Trimite raport zilnic cu angajații care nu s-au pontat în ziua precedentă."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="Ziua pentru raport, format YYYY-MM-DD. Implicit: ieri.",
        )
        parser.add_argument(
            "--only",
            type=str,
            help="Trimite doar la această adresă de email.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Nu trimite email, doar afișează rezultatul în consolă.",
        )

    def handle(self, *args, **options):
        target_day = get_target_day(options.get("date"))
        missing_users = get_missing_users_for_day(target_day)

        recipients = DEFAULT_RECIPIENTS
        if options.get("only"):
            recipients = [options["only"]]

        subject = f"Raport pontaj lipsă - {target_day.isoformat()} ({len(missing_users)} angajați)"
        html_content = build_html(target_day, missing_users)
        text_content = build_text(target_day, missing_users)

        self.stdout.write(self.style.WARNING(f"Zi raport: {target_day.isoformat()}"))
        self.stdout.write(self.style.WARNING(f"Destinatari: {', '.join(recipients)}"))
        self.stdout.write(self.style.WARNING(f"Total lipsă: {len(missing_users)}"))

        for user in missing_users:
            self.stdout.write(f"- {getattr(user, 'UserName', '')}")

        if options.get("dry_run"):
            self.stdout.write(self.style.SUCCESS("Dry run OK. Nu s-a trimis niciun email."))
            return

        response = send_email(subject, html_content, text_content, recipients)
        self.stdout.write(
            self.style.SUCCESS(
                f"Email trimis cu succes. Status: {getattr(response, 'status_code', 'unknown')}"
            )
        )
