from rest_framework import serializers
from toolDMX.models import Consumables, Materials, MijloaceFixes, Shed, Tools, Histories, Unfunctional, Users, WorkField, CofrajMetalics, CofrajtTipDokas, Popis, SchelaUsoaras, SchelaFatadas, SchelaFatadaModularas, Combustibils, HistorieScheles

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = ('UserId',
                  'UserName',
                  'UserSerie',
                  'UserPin',
                  'NameAndSerie')

class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tools
        fields = ('ToolId',
                  'ToolSerie',
                  'ToolName',
                  'User',
                  'DateOfGiving',
                  'Detail',
                  'Pieces',
                  'MainLocation',
                  'Provider'
                  )

class HistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Histories
        fields = ('HistoryId',
                  'User',
                  'Tool',
                  'DateOfGiving',
                  'ToolSerie',
                  'GiveRecive',
                  'Pieces'
                  )

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materials
        fields = ('MaterialId',
                  
                  'MaterialName',
                  'Quantity',
                  'Amount',
                  'MaterialLocation',
                  
                  'Provider',
                  'DateOfGiving',
                  'OneUnity',
                  
                  'UnityOfMesurment',
                  'TypeOfUnityOfMesurment'
                  )

class ConsumableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consumables
        fields = ('ConsumeId',
                  'User',
                  'Material',
                  'MaterialSerie',
                  'DateOfGiving',
                  'MaterialAmount',
                  'GiveRecive',
                  )


class ShedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shed
        fields = ('ShedId',
                  'ToolSerie',
                  'ToolName',
                  'User',
                  'DateOfGiving',
                  'Pin',
                  'Status',
                  'Pieces',
                  'Provider',
                  'Components',
                  'Detail',
                  )      

class WorkFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkField
        fields = ('WorkFieldId',
                  'ToolSerie',
                  'ToolName',
                  'User',
                  'DateOfGiving',
                  'Pin',
                  'Status',
                  'Pieces',
                  'Provider',
                  'Components',
                  'Detail',
                  )                                  

class UnfunctionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unfunctional
        fields = ('UnfunctionalId',
                  'ToolSerie',
                  'ToolName',
                  'Detail',
                  'Service',
                  'Status',
                  'Pieces',
                  'Provider',
                  'Components',
                  )  

class CofrajMetalicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CofrajMetalics
        fields = ('CofrajMetalicId',
                  'CofrajMetalicName',
                  'CofrajMetalicCantitate',
                  'Location'
                  )

class CofrajtTipDokaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CofrajtTipDokas
        fields = ('CofrajtTipDokaId',
                  'CofrajtTipDokaName',
                  'CofrajtTipDokaCantitate',
                  'Location'
                  )

class PopiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Popis
        fields = ('PopiDokaId',
                  'PopiName',
                  'PopiCantitate',
                  'Location'
                  )

class SchelaUsoaraSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaUsoaras
        fields = ('SchelaUsoaraId',
                  'SchelaUsoaraName',
                  'SchelaUsoaraCantitate',
                  'Location'
                  )

class SchelaFatadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaFatadas
        fields = ('SchelaFatadaId',
                  'SchelaFatadaName',
                  'SchelaFatadaCantitate',
                  'Location'
                  )


class SchelaFatadaModularaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchelaFatadaModularas
        fields = ('SchelaFatadaModularaId',
                  'SchelaFatadaModularaName',
                  'SchelaFatadaModularaCantitate',
                  'Location'
                  )

            
class CombustibilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Combustibils
        fields = ('CombustibilId',
                  'CombustibilName',
                  'CombustibilCantitate',
                  )


class HistorieScheleSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorieScheles
        fields = ('HistoriesScheleId',
                  'SchelaName',
                  'UserName',
                  'CombustibilCantitate',
                  'DateSchela',
                  'Directie',
                  )


class MijloaceFixeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MijloaceFixes
        fields = ('MijloaceFixeId',
                  'MijloaceFixeName',
                  'MijloaceFixeCantitate',
                  'Location'
                  )