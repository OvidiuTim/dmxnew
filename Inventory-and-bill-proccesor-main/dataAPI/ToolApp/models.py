from django.db import models
# ToolApp/models.py
from django.db import models
from django.utils import timezone
from django.utils.timezone import localdate
# Create your models here


class Tools(models.Model):
    ToolId = models.AutoField(primary_key=True)
    ToolSerie = models.CharField(max_length=100, unique=True, db_index=True)  # ← UNIC + index
    ToolName = models.CharField(max_length=100)

    # (opțional) deconectează câmpurile care dublau istoricul (le poți păstra provizoriu):
    User = models.CharField(max_length=100, blank=True, null=True)            # legacy
    DateOfGiving = models.DateField(blank=True, null=True)                    # legacy

    Detail = models.CharField(max_length=500, null=True, blank=True)
    Pieces = models.IntegerField(null=True, blank=True)  # pentru seturi (ex: trusă cu 5 buc)
    MainLocation = models.CharField(max_length=500, null=True, blank=True)
    Provider = models.CharField(max_length=500, null=True, blank=True)

    # (opțional) tag RFID/NFC
    RfidTag = models.CharField(max_length=128, null=True, blank=True, unique=True)

class Users(models.Model):
    UserId = models.AutoField(primary_key=True)
    UserName = models.CharField(max_length=100)
    UserSerie = models.CharField(max_length=100, unique=True, db_index=True)
    UserPin = models.CharField(max_length=100)
    NameAndSerie = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.UserName} ({self.UserSerie})"

    class Meta:
        indexes = [
            models.Index(fields=['UserPin']),
            models.Index(fields=['UserSerie']),
        ]

    


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
    duration_seconds = models.IntegerField(default=0)
    source = models.CharField(max_length=32, default="nfc")

    # NEW
    worksite = models.CharField(max_length=100, null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-in_time']
        indexes = [
            models.Index(fields=['work_date', 'user_fk']),
            models.Index(fields=['user_fk', 'out_time']),
            models.Index(fields=['worksite', 'work_date']),  # NEW (util pt. filtre)
        ]
