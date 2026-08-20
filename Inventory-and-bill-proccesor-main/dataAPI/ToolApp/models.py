import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.db import models
# ToolApp/models.py
from django.db import models
from django.utils import timezone
from django.utils.timezone import localdate
# Create your models here


def generate_tool_batch_id():
    return f"TOOLBATCH-{uuid.uuid4().hex[:12].upper()}"


class Tools(models.Model):
    class ToolStatus(models.TextChoices):
        FUNCTIONALA = "functionala", "Funcțional"
        NEFUNCTIONALA = "nefunctionala", "Nefuncțional"
        IN_LUCRU = "in_lucru", "În lucru"

    ToolId = models.AutoField(primary_key=True)
    ToolSerie = models.CharField(max_length=100, unique=True, db_index=True, null=True, blank=True)  # ← UNIC + index
    ToolName = models.CharField(max_length=100)
    BatchId = models.CharField(max_length=64, db_index=True, blank=True, default=generate_tool_batch_id)

    # (opțional) deconectează câmpurile care dublau istoricul (le poți păstra provizoriu):
    User = models.CharField(max_length=100, blank=True, null=True)            # legacy
    DateOfGiving = models.DateField(blank=True, null=True)                    # legacy
    ExpiryDate = models.DateField(blank=True, null=True, db_index=True)

    Detail = models.CharField(max_length=500, null=True, blank=True)
    Pieces = models.IntegerField(null=True, blank=True)  # pentru seturi (ex: trusă cu 5 buc)
    MainLocation = models.CharField(max_length=500, null=True, blank=True)
    Provider = models.CharField(max_length=500, null=True, blank=True)

    # Date structurate păstrate din inventarele importate.
    SourceInventoryNumber = models.IntegerField(null=True, blank=True, db_index=True)
    Category = models.CharField(max_length=200, null=True, blank=True, db_index=True)
    Brand = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    Model = models.CharField(max_length=100, null=True, blank=True)
    SerialNumber = models.CharField(max_length=200, null=True, blank=True, db_index=True)
    SourceStatus = models.CharField(max_length=100, null=True, blank=True)
    RequiresVerification = models.BooleanField(default=False, db_index=True)
    SourcePhoto = models.CharField(max_length=255, null=True, blank=True)

    # (opțional) tag RFID/NFC
    RfidTag = models.CharField(max_length=128, null=True, blank=True, unique=True)

    # Modelul nou folosit de /unelte si de fisa angajatului.
    AssignedTo = models.ForeignKey(
        'Users',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tools',
    )
    IsSSM = models.BooleanField(default=False)
    Status = models.CharField(
        max_length=32,
        choices=ToolStatus.choices,
        default=ToolStatus.FUNCTIONALA,
        db_index=True,
    )
    IsReturned = models.BooleanField(default=False)
    IsLost = models.BooleanField(default=False)
    DateReturned = models.DateField(blank=True, null=True)
    DateLost = models.DateField(blank=True, null=True)


class Accommodation(models.Model):
    name = models.CharField(max_length=160, unique=True)
    address = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    total_places = models.PositiveIntegerField(default=0)
    number_of_rooms = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class AccommodationRoom(models.Model):
    accommodation = models.ForeignKey(
        Accommodation,
        on_delete=models.CASCADE,
        related_name="rooms",
    )
    position = models.PositiveIntegerField()
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ("position", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("accommodation", "position"),
                name="unique_accommodation_room_position",
            ),
        ]

    def __str__(self):
        return f"{self.accommodation.name} · {self.name}"


class Users(models.Model):
    class PersonType(models.TextChoices):
        EMPLOYEE = "employee", "Angajat"
        COLLABORATOR = "collaborator", "Colaborator"

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "active", "Activ"
        DISMISSED = "dismissed", "Demis"

    UserId = models.AutoField(primary_key=True)
    UserName = models.CharField(max_length=100)
    UserSerie = models.CharField(max_length=100, unique=True, db_index=True)
    UserPin = models.CharField(max_length=100, blank=True, default="")
    pin_hash = models.CharField(max_length=256, blank=True, default="")
    pin_lookup = models.CharField(max_length=64, blank=True, default="", db_index=True)
    uid = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    NameAndSerie = models.CharField(max_length=100, null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, default=0)  # lei/oră
    total_salary_ron = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_advance_ron = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_remainder_ron = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    meal_vouchers_ron = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    person_type = models.CharField(
        max_length=16,
        choices=PersonType.choices,
        default=PersonType.EMPLOYEE,
        db_index=True,
    )
    employment_status = models.CharField(
        max_length=16,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        db_index=True,
    )
    dismissed_at = models.DateField(null=True, blank=True, db_index=True)
    Company = models.CharField(max_length=100, null=True, blank=True)
    equipment_size = models.CharField(max_length=100, null=True, blank=True)
    received_equipment = models.BooleanField(null=True, blank=True)
    phone_number = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(blank=True, default="")
    photo = models.TextField(null=True, blank=True)
    trade = models.CharField(max_length=100, null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    prior_paid_leave_days = models.PositiveIntegerField(default=0)
    prior_paid_leave_year = models.PositiveSmallIntegerField(null=True, blank=True)
    leave_remaining_override_days = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    leave_remaining_override_year = models.PositiveSmallIntegerField(null=True, blank=True)
    leave_remaining_override_used_days = models.PositiveIntegerField(default=0)
    leave_remaining_override_accrued_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    housing_location = models.CharField(max_length=255, blank=True, default="")
    accommodation = models.ForeignKey(
        Accommodation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    accommodation_room = models.ForeignKey(
        AccommodationRoom,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    attendance_exempt = models.BooleanField(default=False, db_index=True)
    active = models.BooleanField(default=True, db_index=True)
    def __str__(self):
        return f"{self.UserName} ({self.UserSerie})"

    def set_pin(self, raw_pin):
        raw_pin = str(raw_pin or "").strip()
        self.UserPin = raw_pin
        self.pin_hash = ""
        self.pin_lookup = ""

    def check_pin(self, raw_pin):
        raw_pin = str(raw_pin or "").strip()
        if not raw_pin:
            return False
        return bool(self.UserPin) and self.UserPin == raw_pin

    class Meta:
        indexes = [
            models.Index(fields=['pin_hash']),
            models.Index(fields=['pin_lookup']),
            models.Index(fields=['UserSerie']),
        ]


class EmployeeDocumentType(models.Model):
    class Category(models.TextChoices):
        PERSONAL = "personal", "Documente personale"
        EMPLOYMENT = "employment", "Documente de angajare"

    name = models.CharField(max_length=160)
    category = models.CharField(max_length=16, choices=Category.choices, db_index=True)
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("category", "name")
        constraints = [
            models.UniqueConstraint(fields=("category", "name"), name="unique_employee_document_type"),
        ]

    def __str__(self):
        return f"{self.get_category_display()}: {self.name}"


class EmployeeDocument(models.Model):
    employee = models.ForeignKey(Users, on_delete=models.CASCADE, related_name="documents")
    document_type = models.ForeignKey(
        EmployeeDocumentType,
        on_delete=models.PROTECT,
        related_name="documents",
    )
    file = models.FileField(upload_to="employee_documents/%Y/%m/")
    original_file_name = models.CharField(max_length=255, blank=True, default="")
    has_expiry = models.BooleanField(default=False)
    expiry_date = models.DateField(null=True, blank=True)
    expiry_notification_sent_for = models.DateField(null=True, blank=True)
    expiry_notification_sent_at = models.DateTimeField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("document_type__category", "document_type__name", "-uploaded_at")

    def clean(self):
        super().clean()
        if self.has_expiry and not self.expiry_date:
            raise ValidationError({"expiry_date": "Data expirării este obligatorie."})
        if not self.has_expiry:
            self.expiry_date = None

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.expiry_notification_sent_for and self.expiry_notification_sent_for != self.expiry_date:
            self.expiry_notification_sent_for = None
            self.expiry_notification_sent_at = None
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee}: {self.document_type.name}"


def build_pin_lookup(raw_pin):
    return str(raw_pin or "").strip()


class AppUser(models.Model):
    AppUserId = models.AutoField(primary_key=True)
    employee = models.OneToOneField(
        Users,
        on_delete=models.CASCADE,
        related_name="app_user",
    )
    username = models.CharField(max_length=100, unique=True, db_index=True)
    pin_hash = models.CharField(max_length=256)
    is_active = models.BooleanField(default=True, db_index=True)
    login_redirect_path = models.CharField(max_length=160, default="/pontaj")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_pin(self, raw_pin):
        self.pin_hash = make_password(str(raw_pin or "").strip())

    def check_pin(self, raw_pin):
        return check_password(str(raw_pin or "").strip(), self.pin_hash)

    def __str__(self):
        return f"{self.username} -> {self.employee}"


class AppPagePermission(models.Model):
    PermissionId = models.AutoField(primary_key=True)
    app_user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="page_permissions",
    )
    route = models.CharField(max_length=120, db_index=True)
    can_access = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("app_user", "route")
        indexes = [
            models.Index(
                fields=["route", "can_access"],
                name="ToolApp_app_route_c_0ba3c1_idx",
            ),
        ]

    def __str__(self):
        return f"{self.app_user.username}: {self.route} = {self.can_access}"


class AppModuleAccess(models.Model):
    class ModuleCode(models.TextChoices):
        ATTENDANCE = "attendance", "Pontaj"
        TEAMS_SCHEDULE = "teams_schedule", "Echipe și program"
        WAREHOUSE = "warehouse", "Magazie"
        TOOLS = "tools", "Unelte"

    AccessId = models.AutoField(primary_key=True)
    app_user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="module_accesses",
    )
    module_code = models.CharField(max_length=32, choices=ModuleCode.choices, db_index=True)
    can_access = models.BooleanField(default=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("app_user", "module_code")
        indexes = [
            models.Index(fields=("module_code", "can_access"), name="app_module_access_idx"),
        ]

    def __str__(self):
        return f"{self.app_user.username}: {self.module_code} = {self.can_access}"




from django.utils import timezone

class Histories(models.Model):
    class Movement(models.TextChoices):
        OUT = "OUT", "Predare (ieșire)"
        IN  = "IN",  "Returnare (intrare)"
        ADJ = "ADJ", "Ajustare"

    HistoryId = models.AutoField(primary_key=True)

    # NOI — legături solide
    user_fk  = models.ForeignKey('Users', on_delete=models.PROTECT, null=True, blank=True, related_name='tool_movements')
    tool_fk  = models.ForeignKey('Tools', on_delete=models.PROTECT, null=True, blank=True, related_name='movements')

    # NOI — cine a operat înregistrarea (magazionerul / șeful de șantier)
    issued_by = models.ForeignKey('Users', on_delete=models.PROTECT, null=True, blank=True, related_name='issued_tool_movements')

    # NOI — moment exact
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    # NOI — tip mișcare controlat
    direction = models.CharField(max_length=8, choices=Movement.choices, default=Movement.OUT)

    # NOI — cantitate pentru seturi / consumabile; pentru unelte individuale = 1
    quantity = models.IntegerField(default=1)

    # Legacy (le păstrăm deocamdată pentru compatibilitate, dar nu le mai folosim în cod nou)
    User = models.CharField(max_length=100, null=True, blank=True)
    Tool = models.CharField(max_length=100, null=True, blank=True)
    DateOfGiving = models.DateField(null=True, blank=True)
    ToolSerie = models.CharField(max_length=100, null=True, blank=True)
    GiveRecive = models.CharField(max_length=100, null=True, blank=True)  # ← va fi înlocuit de `direction`
    Pieces = models.FloatField(null=True, blank=True)

    note = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']  # cele mai noi primele
        indexes = [
            models.Index(fields=['timestamp']),
        ]



class Materials(models.Model):
    MaterialId = models.AutoField(primary_key=True)
    MaterialName = models.CharField(max_length=100)
    Quantity = models.FloatField()
    Amount = models.FloatField()
    MaterialLocation = models.CharField(max_length=100)
    Provider = models.CharField(max_length=500, null=True)
    DateOfGiving = models.DateField(null=True)
    OneUnity  = models.FloatField(null=True)
    UnityOfMesurment = models.CharField(max_length=500, null=True)
    TypeOfUnityOfMesurment = models.CharField(max_length=500, null=True)



class Consumables(models.Model):
    ConsumeId = models.AutoField(primary_key=True)
    User = models.CharField(max_length=100)
    Material = models.CharField(max_length=100)
    MaterialSerie= models.CharField(max_length=100)
    DateOfGiving = models.DateField()
    MaterialAmount = models.FloatField(null=True)
    GiveRecive = models.CharField(max_length=100, null=True)


class Shed(models.Model):
    ShedId = models.AutoField(primary_key=True)
    ToolSerie= models.CharField(max_length=100)
    ToolName = models.CharField(max_length=100)
    User = models.CharField(max_length=100)
    DateOfGiving = models.DateField()
    Pin  = models.CharField(max_length=100)
    Status = models.CharField(max_length=100)
    Pieces = models.IntegerField()
    Provider = models.CharField(max_length=500, null=True)
    Components= models.CharField(max_length=500, null=True)
    Detail = models.CharField(max_length=500, null=True)

class WorkField(models.Model):
    WorkFieldId = models.AutoField(primary_key=True)
    ToolSerie= models.CharField(max_length=100)
    ToolName = models.CharField(max_length=100)
    User = models.CharField(max_length=100)
    DateOfGiving = models.DateField()
    Pin  = models.CharField(max_length=100)
    Status = models.CharField(max_length=100)
    Pieces = models.IntegerField()
    Provider = models.CharField(max_length=500, null=True)
    Components= models.CharField(max_length=500, null=True)
    Detail = models.CharField(max_length=500, null=True)

class Unfunctional(models.Model):
    UnfunctionalId = models.AutoField(primary_key=True)
    ToolSerie= models.CharField(max_length=100)
    ToolName = models.CharField(max_length=100)
    Detail = models.CharField(max_length=500)
    Status = models.CharField(max_length=100)
    Service = models.CharField(max_length=500)
    Pieces = models.IntegerField()
    Provider = models.CharField(max_length=500, null=True)
    Components= models.CharField(max_length=500, null=True)


class CofrajMetalics(models.Model):
    CofrajMetalicId = models.AutoField(primary_key=True)
    CofrajMetalicName = models.CharField(max_length=100)
    CofrajMetalicCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True)    


class CofrajtTipDokas(models.Model):
    CofrajtTipDokaId = models.AutoField(primary_key=True)
    CofrajtTipDokaName = models.CharField(max_length=100)
    CofrajtTipDokaCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True) 

class Popis(models.Model):
    PopiDokaId = models.AutoField(primary_key=True)
    PopiName = models.CharField(max_length=100)
    PopiCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True) 

class SchelaUsoaras(models.Model):
    SchelaUsoaraId = models.AutoField(primary_key=True)
    SchelaUsoaraName = models.CharField(max_length=100)
    SchelaUsoaraCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True) 
    
class SchelaFatadas(models.Model):
    SchelaFatadaId = models.AutoField(primary_key=True)
    SchelaFatadaName = models.CharField(max_length=100)
    SchelaFatadaCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True) 

class SchelaFatadaModularas(models.Model):
    SchelaFatadaModularaId = models.AutoField(primary_key=True)
    SchelaFatadaModularaName = models.CharField(max_length=100)
    SchelaFatadaModularaCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500, null=True) 

class MijloaceFixes(models.Model):
    MijloaceFixeId = models.AutoField(primary_key=True)
    MijloaceFixeName = models.CharField(max_length=100)
    MijloaceFixeCantitate= models.CharField(max_length=100)
    Location= models.CharField(max_length=500) 

class Combustibils(models.Model):
    CombustibilId = models.AutoField(primary_key=True)
    CombustibilName = models.CharField(max_length=100)
    CombustibilCantitate= models.CharField(max_length=100)
    

class HistorieScheles(models.Model):
    HistoriesScheleId = models.AutoField(primary_key=True)
    SchelaName = models.CharField(max_length=100)
    UserName = models.CharField(max_length=100)
    CombustibilCantitate= models.CharField(max_length=100)
    DateSchela = models.DateField()
    Directie = models.CharField(max_length=500, null=True)

    
from django.utils import timezone

class PresenceEvent(models.Model):
    class Kind(models.TextChoices):
        ENTER = "ENTER", "Intrare"
        EXIT  = "EXIT",  "Ieșire"

    id = models.AutoField(primary_key=True)
    user_fk = models.ForeignKey('Users', on_delete=models.PROTECT, related_name='presence_events')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    kind = models.CharField(max_length=8, choices=Kind.choices)

    # NEW
    worksite = models.CharField(max_length=100, null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        
        
        


# --- ADD: in AttendanceSession ---
class AttendanceSession(models.Model):
    id = models.AutoField(primary_key=True)
    user_fk = models.ForeignKey('Users', on_delete=models.PROTECT, related_name='attendance_sessions')
    work_date = models.DateField(default=localdate, db_index=True)
    in_time   = models.DateTimeField(default=timezone.now, db_index=True)
    out_time  = models.DateTimeField(null=True, blank=True, db_index=True)
    in_gps_latitude = models.FloatField(null=True, blank=True)
    in_gps_longitude = models.FloatField(null=True, blank=True)
    in_gps_accuracy_m = models.FloatField(null=True, blank=True)
    out_gps_latitude = models.FloatField(null=True, blank=True)
    out_gps_longitude = models.FloatField(null=True, blank=True)
    out_gps_accuracy_m = models.FloatField(null=True, blank=True)
    duration_seconds = models.IntegerField(default=0)
    source = models.CharField(max_length=32, default="nfc")
    worksite = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    manual_client_ip = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    manual_device_key = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    data_processing_consent = models.BooleanField(default=False)
    data_processing_consent_at = models.DateTimeField(null=True, blank=True)
    # Fotografii WebP/JPEG reduse și confirmate explicit pentru fiecare acțiune manuală.
    checkin_photo = models.TextField(blank=True, default="")
    checkout_photo = models.TextField(blank=True, default="")

    class Meta:
        ordering = ['-in_time']
        indexes = [
            models.Index(fields=['work_date', 'user_fk']),
            models.Index(fields=['user_fk', 'out_time']),
            models.Index(fields=['worksite', 'work_date']),  # NEW (util pt. filtre)
        ]



# --- nou: snapshot zilnic de plată
from decimal import Decimal

class DailyPay(models.Model):
    id = models.AutoField(primary_key=True)
    user_fk = models.ForeignKey('Users', on_delete=models.PROTECT, related_name='daily_pays')
    work_date = models.DateField(db_index=True)
    total_seconds = models.IntegerField(default=0)  # totalul închiderilor din zi (secunde)
    hourly_rate_snapshot = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    day_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))  # lei

    class Meta:
        unique_together = [('user_fk', 'work_date')]
        indexes = [
            models.Index(fields=['user_fk', 'work_date']),
        ]

    def __str__(self):
        return f"{self.work_date} - {self.user_fk} = {self.day_pay} lei"
    

# --- ABSENCE / LIPSĂ ZI DE LUCRU ---
# ToolApp/models.py
from decimal import Decimal

class LeaveDay(models.Model):
    class Reason(models.TextChoices):
        CO  = "CO",  "Concediu de odihnă"
        CM  = "CM",  "Concediu medical"
        UNPAID = "UNPAID", "Concediu fără plată"
        UNEXCUSED = "UNEXCUSED", "Absență nemotivată"
        INDIA = "INDIA", "Plecat în India"
        ALT = "ALT", "Alt motiv"

    id = models.AutoField(primary_key=True)
    user_fk = models.ForeignKey('Users', on_delete=models.PROTECT, related_name='leaves')
    work_date = models.DateField(db_index=True)
    reason = models.CharField(max_length=16, choices=Reason.choices)
    hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('8.00'))      # ex. 8.00 ore
    multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00')) # ex. 0.75 pt. CM
    hourly_rate_snapshot = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    pay_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    note = models.CharField(max_length=255, null=True, blank=True)
    source_leave_request = models.ForeignKey(
        'LeaveRequest',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attendance_leave_days',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('user_fk', 'work_date')]
        indexes = [models.Index(fields=['user_fk', 'work_date'])]

    def __str__(self):
        return f"{self.work_date} - {self.user_fk} - {self.get_reason_display()} {self.hours}h x{self.multiplier}"


class PinAttemptLog(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.CharField(max_length=64, blank=True, default="", db_index=True)
    device_key = models.CharField(max_length=128, blank=True, default="", db_index=True)
    uid = models.CharField(max_length=128, blank=True, default="")
    worksite = models.CharField(max_length=100, blank=True, default="")
    success = models.BooleanField(default=False)
    blocked = models.BooleanField(default=False)
    reason = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ip_address", "device_key", "created_at"]),
            models.Index(fields=["success", "blocked", "created_at"]),
        ]


class EmployeeSalaryProfile(models.Model):
    employee = models.OneToOneField(
        Users,
        on_delete=models.CASCADE,
        related_name="salary_profile",
    )
    net_salary_eur = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_salary_ron = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    salary_advance_ron = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    food_money_enabled = models.BooleanField(default=False)
    food_money_ron = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def __str__(self):
        return f"Profil salarial - {self.employee}"


class LeaveRequest(models.Model):
    class LeaveType(models.TextChoices):
        PAID_LEAVE = "paid_leave", "Concediu de odihnă"
        UNPAID_LEAVE = "unpaid_leave", "Concediu fără plată"

    class Status(models.TextChoices):
        PENDING = "pending", "În așteptare"
        APPROVED = "approved", "Aprobată"
        REJECTED = "rejected", "Respinsă"

    employee = models.ForeignKey(Users, on_delete=models.CASCADE, related_name="leave_requests")
    team = models.ForeignKey(
        "EmployeeTeam",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_requests",
    )
    assigned_leader = models.ForeignKey(
        Users,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leave_requests",
    )
    leave_type = models.CharField(max_length=32, choices=LeaveType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    seen_at = models.DateTimeField(null=True, blank=True)
    reviewed_by_app_user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leave_requests",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_employee_leave_requests",
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("employee", "start_date", "end_date"))]

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "Data finală nu poate fi înaintea datei de început."})
        if self.employee_id and self.start_date and self.end_date:
            overlap = LeaveRequest.objects.filter(
                employee_id=self.employee_id,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
            ).exclude(status=self.Status.REJECTED)
            if self.pk:
                overlap = overlap.exclude(pk=self.pk)
            if overlap.exists():
                raise ValidationError("Cererea de concediu se suprapune cu o cerere existentă.")
        if (
            self.employee_id
            and self.status == self.Status.APPROVED
            and self.employee.employment_status == Users.EmploymentStatus.DISMISSED
        ):
            raise ValidationError("Nu se poate aproba concediu pentru un angajat demis.")

    def save(self, *args, **kwargs):
        self.full_clean()
        result = super().save(*args, **kwargs)
        if self.status == self.Status.APPROVED:
            reason_map = {
                self.LeaveType.PAID_LEAVE: LeaveDay.Reason.CO,
                self.LeaveType.UNPAID_LEAVE: LeaveDay.Reason.UNPAID,
            }
            current = self.start_date
            hourly_rate = self.employee.hourly_rate or Decimal("0.00")
            while current <= self.end_date:
                if current.isoweekday() <= 6:
                    LeaveDay.objects.update_or_create(
                        user_fk=self.employee,
                        work_date=current,
                        defaults={
                            "reason": reason_map[self.leave_type],
                            "hours": Decimal("8.00"),
                            "multiplier": Decimal("1.00"),
                            "hourly_rate_snapshot": hourly_rate,
                            "pay_amount": hourly_rate * Decimal("8.00"),
                            "note": self.reason[:255],
                            "source_leave_request": self,
                        },
                    )
                current += timedelta(days=1)
        else:
            self.attendance_leave_days.all().delete()
        return result

    def __str__(self):
        return f"{self.employee} {self.start_date} - {self.end_date} ({self.status})"


class EmployeeTeam(models.Model):
    name = models.CharField(max_length=160)
    leader = models.ForeignKey(Users, on_delete=models.PROTECT, related_name="led_employee_teams")
    supervisor = models.ForeignKey(
        Users,
        on_delete=models.PROTECT,
        related_name="supervised_employee_teams",
        null=True,
        blank=True,
    )
    default_worksite = models.CharField(max_length=160, blank=True, default="")
    active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("leader",),
                condition=models.Q(active=True),
                name="unique_active_employee_team_leader",
            ),
        ]

    def clean(self):
        super().clean()
        if self.active and self.leader_id:
            if not self.leader.active:
                raise ValidationError({"leader": "Șeful de echipă este inactiv."})
            duplicate = EmployeeTeam.objects.filter(active=True, leader_id=self.leader_id)
            if self.pk:
                duplicate = duplicate.exclude(pk=self.pk)
            if duplicate.exists():
                raise ValidationError({"leader": "Angajatul conduce deja o echipă activă."})
        if self.active and self.supervisor_id and not self.supervisor.active:
            raise ValidationError({"supervisor": "Supervisorul este inactiv."})

    @property
    def effective_supervisor(self):
        return self.supervisor or self.leader

    def __str__(self):
        return self.name


class EmployeeTeamMember(models.Model):
    team = models.ForeignKey(EmployeeTeam, on_delete=models.CASCADE, related_name="memberships")
    employee = models.ForeignKey(Users, on_delete=models.CASCADE, related_name="team_memberships")
    active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("employee__UserName",)
        constraints = [
            models.UniqueConstraint(fields=("team", "employee"), name="unique_employee_team_member"),
            models.UniqueConstraint(
                fields=("employee",),
                condition=models.Q(active=True),
                name="unique_active_employee_team_membership",
            ),
        ]

    def __str__(self):
        return f"{self.team}: {self.employee}"


class TemporaryWorkerRequest(models.Model):
    class RequestType(models.TextChoices):
        TEMPORARY = "temporary", "Temporară"
        PERMANENT = "permanent", "Permanentă"

    class Status(models.TextChoices):
        PENDING = "pending", "În așteptare"
        APPROVED = "approved", "Aprobată"
        REJECTED = "rejected", "Respinsă"
        CANCELLED = "cancelled", "Anulată"
        EXPIRED = "expired", "Expirată"

    requester_team = models.ForeignKey(
        EmployeeTeam,
        on_delete=models.CASCADE,
        related_name="temporary_requests_sent",
    )
    source_team = models.ForeignKey(
        EmployeeTeam,
        on_delete=models.CASCADE,
        related_name="temporary_requests_received",
    )
    employee = models.ForeignKey(
        Users,
        on_delete=models.PROTECT,
        related_name="temporary_team_requests",
    )
    request_type = models.CharField(
        max_length=16,
        choices=RequestType.choices,
        default=RequestType.TEMPORARY,
        db_index=True,
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    reason = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    requested_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temporary_worker_requests_created",
    )
    resolved_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temporary_worker_requests_resolved",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    seen_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("employee", "start_date", "end_date"), name="team_tmp_emp_dates_idx"),
            models.Index(fields=("status", "start_date", "end_date"), name="team_tmp_status_dates_idx"),
        ]

    def clean(self):
        super().clean()
        errors = {}
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "Data finală nu poate fi înaintea datei de început."
        if self.requester_team_id and self.source_team_id and self.requester_team_id == self.source_team_id:
            errors["requester_team"] = "Echipa solicitantă trebuie să fie diferită de echipa sursă."
        if self.employee_id and not self.employee.active:
            errors["employee"] = "Angajatul este inactiv."
        if self.requester_team_id and not self.requester_team.active:
            errors["requester_team"] = "Echipa solicitantă este inactivă."
        if self.source_team_id and not self.source_team.active:
            errors["source_team"] = "Echipa sursă este inactivă."
        if self.employee_id and self.source_team_id:
            belongs_to_source = EmployeeTeamMember.objects.filter(
                team_id=self.source_team_id,
                employee_id=self.employee_id,
                active=True,
            ).exists()
            if not belongs_to_source:
                errors["employee"] = "Angajatul nu aparține activ echipei sursă."
        if (
            self.employee_id
            and self.start_date
            and self.end_date
            and self.request_type == self.RequestType.TEMPORARY
            and self.status in (self.Status.PENDING, self.Status.APPROVED)
        ):
            leave_exists = LeaveDay.objects.filter(
                user_fk_id=self.employee_id,
                work_date__range=(self.start_date, self.end_date),
            ).exists()
            if leave_exists:
                errors["employee"] = "Angajatul are concediu sau indisponibilitate în intervalul ales."
            overlap = TemporaryWorkerRequest.objects.filter(
                employee_id=self.employee_id,
                request_type=self.RequestType.TEMPORARY,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
                status__in=(self.Status.PENDING, self.Status.APPROVED),
            )
            if self.pk:
                overlap = overlap.exclude(pk=self.pk)
            if overlap.exists():
                errors["employee"] = "Angajatul are deja o solicitare suprapusă."
        if (
            self.employee_id
            and self.request_type == self.RequestType.PERMANENT
            and self.status == self.Status.PENDING
        ):
            duplicate = TemporaryWorkerRequest.objects.filter(
                employee_id=self.employee_id,
                request_type=self.RequestType.PERMANENT,
                status=self.Status.PENDING,
            )
            if self.pk:
                duplicate = duplicate.exclude(pk=self.pk)
            if duplicate.exists():
                errors["employee"] = "Angajatul are deja o solicitare permanentă în așteptare."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} → {self.requester_team} ({self.start_date}–{self.end_date})"
