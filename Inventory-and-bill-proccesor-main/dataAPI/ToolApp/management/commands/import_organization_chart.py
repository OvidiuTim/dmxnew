from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from ToolApp.models import OrganizationDepartment, OrganizationMember, Users
from ToolApp.organization_import import (
    OrganizationSourceError,
    count_records,
    match_employee,
    organization_records,
    parse_organization_html,
)


class Command(BaseCommand):
    help = "Importă organigrama, relațiile și fotografiile din Organigrama_Novarion_DMX_2.html."

    def add_arguments(self, parser):
        default_path = Path(settings.BASE_DIR).parent.parent / "Organigrama_Novarion_DMX_2.html"
        parser.add_argument("source", nargs="?", default=str(default_path), help="Calea către fișierul HTML.")
        parser.add_argument("--apply", action="store_true", help="Aplică importul; implicit se afișează doar previzualizarea.")
        parser.add_argument(
            "--sync-existing",
            action="store_true",
            help="Reaplică structura HTML și peste nodurile importate anterior. Fără flag, mutările manuale sunt păstrate.",
        )

    def handle(self, *args, **options):
        source = Path(options["source"]).expanduser().resolve()
        if not source.is_file():
            raise CommandError(f"Fișierul nu există: {source}")
        try:
            parsed = parse_organization_html(source.read_text(encoding="utf-8"))
            root = organization_records(parsed)
        except (OSError, UnicodeError, OrganizationSourceError) as exc:
            raise CommandError(f"Organigrama nu a putut fi citită: {exc}") from exc

        flat_departments, flat_members = self._flatten(root)
        counts = count_records(root)
        employees = list(
            Users.objects.filter(person_type=Users.PersonType.EMPLOYEE).order_by("UserName", "UserId")
        )
        existing_members = {
            member.source_key: member
            for member in OrganizationMember.objects.exclude(source_key__isnull=True).select_related("employee")
        }
        claimed = {
            member.employee_id for member in existing_members.values() if member.employee_id
        }
        matches = {}
        unmatched = []
        for item in flat_members:
            existing = existing_members.get(item["source_key"])
            employee = existing.employee if existing and existing.employee_id else match_employee(
                item["name"], item["role"], employees, claimed
            )
            if employee:
                matches[item["source_key"]] = employee
                claimed.add(employee.pk)
            else:
                unmatched.append(item)

        photos_to_employees = sum(
            1 for item in flat_members
            if item.get("photo") and matches.get(item["source_key"])
            and not str(matches[item["source_key"]].photo or "").strip()
        )
        self.stdout.write(self.style.MIGRATE_HEADING("Previzualizare import organigramă"))
        self.stdout.write(f"Sursă: {source}")
        self.stdout.write(f"Departamente: {counts['departments']}")
        self.stdout.write(f"Membri: {counts['members']}")
        self.stdout.write(f"Fotografii în sursă: {counts['photos']}")
        self.stdout.write(self.style.SUCCESS(f"Asocieri sigure cu angajați: {len(matches)}"))
        self.stdout.write(self.style.WARNING(f"Membri rămași neasociați: {len(unmatched)}"))
        self.stdout.write(f"Fotografii care pot completa fișa angajatului: {photos_to_employees}")
        if unmatched:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Neasociați (primele 30):"))
            for item in unmatched[:30]:
                self.stdout.write(f"  - {item['name']} · {item['role'] or 'Fără funcție'}")
            if len(unmatched) > 30:
                self.stdout.write(f"  ... încă {len(unmatched) - 30}")

        if not options["apply"]:
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE("Nu s-a modificat baza de date. Rulează cu --apply pentru import."))
            return

        result = {"departments_created": 0, "members_created": 0, "members_updated": 0, "employee_photos": 0}
        with transaction.atomic():
            self._import_department(
                root,
                parent=None,
                matches=matches,
                sync_existing=bool(options["sync_existing"]),
                result=result,
            )
            for item in flat_members:
                employee = matches.get(item["source_key"])
                if employee and item.get("photo") and not str(employee.photo or "").strip():
                    employee.photo = item["photo"]
                    employee.save(update_fields=("photo",))
                    result["employee_photos"] += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Import finalizat."))
        self.stdout.write(f"Departamente create: {result['departments_created']}")
        self.stdout.write(f"Membri creați: {result['members_created']}")
        self.stdout.write(f"Membri completați/sincronizați: {result['members_updated']}")
        self.stdout.write(f"Fotografii adăugate angajaților fără fotografie: {result['employee_photos']}")
        self.stdout.write(f"Membri vizibili fără asociere: {len(unmatched)}")

    def _import_department(self, spec, parent, matches, sync_existing, result):
        defaults = {
            "name": spec["name"],
            "subtitle": spec["subtitle"],
            "color": spec["color"],
            "parent": parent,
            "sort_order": spec["sort_order"],
        }
        department, created = OrganizationDepartment.objects.get_or_create(
            source_key=spec["source_key"], defaults=defaults
        )
        if created:
            result["departments_created"] += 1
        elif sync_existing:
            for key, value in defaults.items():
                setattr(department, key, value)
            department.save()

        imported_members = []
        for item in spec.get("members") or []:
            member_defaults = {
                "name": item["name"],
                "role": item["role"],
                "department": department,
                "employee": matches.get(item["source_key"]),
                "photo": item["photo"],
                "metadata": item.get("metadata") or {},
                "sort_order": item["sort_order"],
            }
            member, member_created = OrganizationMember.objects.get_or_create(
                source_key=item["source_key"], defaults=member_defaults
            )
            if member_created:
                result["members_created"] += 1
            else:
                changed = False
                employee = matches.get(item["source_key"])
                if employee and not member.employee_id:
                    member.employee = employee
                    changed = True
                if item["photo"] and not member.photo:
                    member.photo = item["photo"]
                    changed = True
                if sync_existing:
                    for key in ("name", "role", "department", "metadata", "sort_order"):
                        value = member_defaults[key]
                        if getattr(member, key) != value:
                            setattr(member, key, value)
                            changed = True
                if changed:
                    member.save()
                    result["members_updated"] += 1
            imported_members.append(member)

        foremen = [member for member in imported_members if (member.metadata or {}).get("foreman")]
        if len(foremen) == 1:
            foreman = foremen[0]
            for member in imported_members:
                if member.pk == foreman.pk or member.reports_to_id:
                    continue
                member.reports_to = foreman
                member.save(update_fields=("reports_to", "updated_at"))

        for child in spec.get("children") or []:
            self._import_department(child, department, matches, sync_existing, result)

    def _flatten(self, root):
        departments = []
        members = []

        def walk(node):
            departments.append(node)
            members.extend(node.get("members") or [])
            for child in node.get("children") or []:
                walk(child)

        walk(root)
        return departments, members
