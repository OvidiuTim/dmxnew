from datetime import timedelta, date as _date
from collections import OrderedDict
from dataclasses import dataclass
from html import escape
import os

from django.core.management.base import BaseCommand
from django.utils.timezone import localdate, localtime
from django.conf import settings

from ToolApp.models import Users, AttendanceSession, LeaveDay


DEFAULT_RECIPIENTS = [
    "achizitii2@dmxconstruction.ro",
    "hr@xuxinvestment.ro",
    "ovidiu.pirvu@novarion.ro",
]
CONSECUTIVE_MISSING_DAYS = 3


@dataclass
class OpenCheckoutRow:
    user: object
    sessions: list


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
        Users.objects.filter(
            active=True,
            person_type=Users.PersonType.EMPLOYEE,
            employment_status=Users.EmploymentStatus.ACTIVE,
            attendance_exempt=False,
        )
        .exclude(UserId__in=excluded_ids)
        .order_by("UserName")
    )

    return list(users)


def get_workdays_ending_on(target_day, count=CONSECUTIVE_MISSING_DAYS):
    if target_day.isoweekday() > 6:
        return []
    days = []
    current = target_day
    while len(days) < count:
        if current.isoweekday() <= 6:
            days.append(current)
        current -= timedelta(days=1)
    return list(reversed(days))


def get_consecutive_missing_user_ids(target_day, missing_users, minimum_days=CONSECUTIVE_MISSING_DAYS):
    workdays = get_workdays_ending_on(target_day, minimum_days)
    user_ids = {user.UserId for user in missing_users}
    if len(workdays) < minimum_days or not user_ids:
        return set()

    attended = set(
        AttendanceSession.objects.filter(
            user_fk_id__in=user_ids,
            work_date__in=workdays,
        ).values_list("user_fk_id", "work_date")
    )
    on_leave = set(
        LeaveDay.objects.filter(
            user_fk_id__in=user_ids,
            work_date__in=workdays,
        ).values_list("user_fk_id", "work_date")
    )
    unavailable = attended | on_leave
    return {
        user_id
        for user_id in user_ids
        if all((user_id, workday) not in unavailable for workday in workdays)
    }


def get_open_checkouts_for_day(target_day):
    sessions = (
        AttendanceSession.objects.select_related("user_fk")
        .filter(
            work_date=target_day,
            out_time__isnull=True,
            user_fk__active=True,
            user_fk__person_type=Users.PersonType.EMPLOYEE,
            user_fk__employment_status=Users.EmploymentStatus.ACTIVE,
            user_fk__attendance_exempt=False,
        )
        .order_by("user_fk__UserName", "in_time")
    )
    rows = OrderedDict()
    for session in sessions:
        row = rows.setdefault(
            session.user_fk_id,
            OpenCheckoutRow(user=session.user_fk, sessions=[]),
        )
        row.sessions.append(session)
    return list(rows.values())


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


def group_open_checkouts_by_company(open_checkouts):
    groups = {}
    for row in open_checkouts:
        company = str(getattr(row.user, "Company", "") or "").strip() or "Fără firmă"
        groups.setdefault(company, []).append(row)
    return OrderedDict(
        sorted(
            groups.items(),
            key=lambda item: (item[0] == "Fără firmă", item[0].casefold()),
        )
    )


def build_company_table(company, users, consecutive_missing_user_ids=None):
    consecutive_missing_user_ids = consecutive_missing_user_ids or set()
    rows = []
    for idx, user in enumerate(users, start=1):
        user_name = escape(str(getattr(user, "UserName", "") or ""))
        user_serie = escape(str(getattr(user, "UserSerie", "") or "-"))
        warning = ""
        if getattr(user, "UserId", None) in consecutive_missing_user_ids:
            warning = (
                '<div style="margin-top:6px;color:#d00000;font-size:20px;'
                'font-weight:800;line-height:1.2;">Nu s-a pontat 3 zile la rând</div>'
            )
        rows.append(
            f"""
            <tr>
              <td style="padding:8px;border:1px solid #ddd;">{idx}</td>
              <td style="padding:8px;border:1px solid #ddd;">{user_name}{warning}</td>
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


def build_open_checkout_table(company, rows):
    table_rows = []
    for idx, row in enumerate(rows, start=1):
        user_name = escape(str(getattr(row.user, "UserName", "") or ""))
        user_serie = escape(str(getattr(row.user, "UserSerie", "") or "-"))
        checkins = ", ".join(localtime(session.in_time).strftime("%H:%M") for session in row.sessions)
        worksites = sorted({str(session.worksite or "").strip() for session in row.sessions if session.worksite})
        worksite = escape(", ".join(worksites) or "-")
        table_rows.append(
            f"""
            <tr>
              <td style="padding:8px;border:1px solid #ddd;">{idx}</td>
              <td style="padding:8px;border:1px solid #ddd;">{user_name}</td>
              <td style="padding:8px;border:1px solid #ddd;">{user_serie}</td>
              <td style="padding:8px;border:1px solid #ddd;color:#b42318;font-weight:700;">{checkins}</td>
              <td style="padding:8px;border:1px solid #ddd;">{worksite}</td>
            </tr>
            """
        )
    return f"""
      <section style="margin-top:20px;">
        <h3 style="margin:0 0 10px;">{escape(company)} — fără check-out: {len(rows)}</h3>
        <table style="border-collapse:collapse;min-width:700px;">
          <thead><tr>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">#</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Nume</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Serie</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Check-in</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Locație</th>
          </tr></thead>
          <tbody>{''.join(table_rows)}</tbody>
        </table>
      </section>
    """


def build_html(target_day, missing_users, consecutive_missing_user_ids=None, open_checkouts=None):
    count = len(missing_users)
    consecutive_missing_user_ids = consecutive_missing_user_ids or set()
    open_checkouts = open_checkouts or []

    if count == 0:
        companies_html = "<p>Toți angajații au fost pontați sau au leave înregistrat.</p>"
    else:
        companies_html = "".join(
            build_company_table(company, users, consecutive_missing_user_ids)
            for company, users in group_users_by_company(missing_users).items()
        )

    if open_checkouts:
        open_checkouts_html = "".join(
            build_open_checkout_table(company, rows)
            for company, rows in group_open_checkouts_by_company(open_checkouts).items()
        )
    else:
        open_checkouts_html = "<p>Niciun angajat cu check-in rămas fără check-out.</p>"

    return f"""
    <html>
      <body style="font-family:Arial,Helvetica,sans-serif;">
        <h2>Raport pontaj lipsă - {target_day.isoformat()}</h2>
        <p>
          Angajați fără pontaj și fără leave înregistrat pentru ziua de
          <strong>{target_day.isoformat()}</strong>: <strong>{count}</strong>
        </p>

        {companies_html}

        <h2 style="margin-top:34px;color:#b42318;">Check-in fără check-out — {len(open_checkouts)}</h2>
        {open_checkouts_html}

        <p style="margin-top:20px;color:#666;">
          Generat automat din sistemul de pontaj.
        </p>
      </body>
    </html>
    """


def build_text(target_day, missing_users, consecutive_missing_user_ids=None, open_checkouts=None):
    consecutive_missing_user_ids = consecutive_missing_user_ids or set()
    open_checkouts = open_checkouts or []

    lines = [
        f"Raport pontaj lipsă - {target_day.isoformat()}",
        "",
        f"Angajați fără pontaj și fără leave înregistrat: {len(missing_users)}",
        "",
    ]
    if not missing_users:
        lines.extend(["Toți angajații au fost pontați sau au leave înregistrat.", ""])
    else:
        for company, users in group_users_by_company(missing_users).items():
            lines.append(f"{company} — lipsă: {len(users)}")
            for idx, user in enumerate(users, start=1):
                warning = (
                    " | ATENȚIE: Nu s-a pontat 3 zile la rând"
                    if getattr(user, "UserId", None) in consecutive_missing_user_ids else ""
                )
                lines.append(
                    f"{idx}. {getattr(user, 'UserName', '')} | "
                    f"Serie: {getattr(user, 'UserSerie', '') or '-'}{warning}"
                )
            lines.append("")

    lines.extend([f"CHECK-IN FĂRĂ CHECK-OUT: {len(open_checkouts)}", ""])
    if not open_checkouts:
        lines.append("Niciun angajat cu check-in rămas fără check-out.")
    else:
        for company, rows in group_open_checkouts_by_company(open_checkouts).items():
            lines.append(f"{company} — fără check-out: {len(rows)}")
            for idx, row in enumerate(rows, start=1):
                checkins = ", ".join(localtime(session.in_time).strftime("%H:%M") for session in row.sessions)
                lines.append(
                    f"{idx}. {getattr(row.user, 'UserName', '')} | "
                    f"Serie: {getattr(row.user, 'UserSerie', '') or '-'} | Check-in: {checkins}"
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
        if target_day.isoweekday() == 7:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Raport omis pentru {target_day.isoformat()}: duminica nu este zi lucrătoare."
                )
            )
            return

        missing_users = get_missing_users_for_day(target_day)
        consecutive_missing_user_ids = get_consecutive_missing_user_ids(target_day, missing_users)
        open_checkouts = get_open_checkouts_for_day(target_day)

        recipients = DEFAULT_RECIPIENTS
        if options.get("only"):
            recipients = [options["only"]]

        subject = (
            f"Raport pontaj lipsă - {target_day.isoformat()} "
            f"({len(missing_users)} lipsă, {len(open_checkouts)} fără check-out)"
        )
        html_content = build_html(
            target_day,
            missing_users,
            consecutive_missing_user_ids,
            open_checkouts,
        )
        text_content = build_text(
            target_day,
            missing_users,
            consecutive_missing_user_ids,
            open_checkouts,
        )

        self.stdout.write(self.style.WARNING(f"Zi raport: {target_day.isoformat()}"))
        self.stdout.write(self.style.WARNING(f"Destinatari: {', '.join(recipients)}"))
        self.stdout.write(self.style.WARNING(f"Total lipsă: {len(missing_users)}"))
        self.stdout.write(self.style.WARNING(f"Fără check-out: {len(open_checkouts)}"))

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
