from django.db import models

# Create your models here.
class Users(models.Model):
    UserId = models.AutoField(primary_key=True)
    UserName = models.CharField(max_length=100)
    UserSerie = models.CharField(max_length=100)
    UserPin = models.CharField(max_length=100)
    NameAndSerie= models.CharField(max_length=100, null=True)


class Tools(models.Model):
    ToolId = models.AutoField(primary_key=True)
    ToolSerie= models.CharField(max_length=100)
    ToolName = models.CharField(max_length=100)
    User = models.CharField(max_length=100)
    DateOfGiving = models.DateField()
    Detail = models.CharField(max_length=500, null=True)
    Pieces = models.IntegerField(null=True)
    MainLocation = models.CharField(max_length=500, null=True)
    Provider = models.CharField(max_length=500, null=True)
    


class Histories(models.Model):
    HistoryId = models.AutoField(primary_key=True)
    User = models.CharField(max_length=100)
    Tool = models.CharField(max_length=100)
    DateOfGiving = models.DateField()
    ToolSerie= models.CharField(max_length=100, null=True)
    GiveRecive = models.CharField(max_length=100, null=True)
    Pieces = models.FloatField(null=True)
    


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

    
