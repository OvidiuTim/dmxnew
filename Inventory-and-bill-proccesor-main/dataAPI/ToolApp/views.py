from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from django.http.response import JsonResponse

from ToolApp.models import Shed, Unfunctional, Users,Tools,Histories, Materials, Consumables, WorkField, CofrajMetalics, CofrajtTipDokas, Popis, SchelaUsoaras, SchelaFatadas, SchelaFatadaModularas, Combustibils, HistorieScheles, MijloaceFixes
from ToolApp.serializers import ConsumableSerializer, ShedSerializer, UnfunctionalSerializer, UserSerializer,ToolSerializer,HistorySerializer, MaterialSerializer, WorkFieldSerializer, CofrajMetalicSerializer, CofrajtTipDokaSerializer, PopiSerializer, SchelaUsoaraSerializer, SchelaFatadaSerializer, SchelaFatadaModularaSerializer, CombustibilSerializer, HistorieScheleSerializer, MijloaceFixeSerializer
import nfc


    
# Create your views here.
#api angajati
@csrf_exempt
def userApi(request,id=0):
    if request.method=='GET':
        users = Users.objects.all()
        users_serializer = UserSerializer(users, many=True)
        return JsonResponse(users_serializer.data, safe=False)

    elif request.method=='POST':
        user_data=JSONParser().parse(request)
        user_serializer = UserSerializer(data=user_data)
        if user_serializer.is_valid():
            user_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        user_data = JSONParser().parse(request)
        user=Users.objects.get(UserId=user_data['UserId'])
        user_serializer=UserSerializer(user,data=user_data)
        if user_serializer.is_valid():
            user_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        user=Users.objects.get(UserId=id)
        user.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

#api unelte
@csrf_exempt
def toolApi(request,id=0):
    if request.method=='GET':
        tools = Tools.objects.all()
        tools_serializer = ToolSerializer(tools, many=True)
        return JsonResponse(tools_serializer.data, safe=False)

    elif request.method=='POST':
        tool_data=JSONParser().parse(request)
        tool_serializer = ToolSerializer(data=tool_data)
        if tool_serializer.is_valid():
            tool_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        tool_data = JSONParser().parse(request)
        tool=Tools.objects.get(ToolId=tool_data['ToolId'])
        tool_serializer=ToolSerializer(tool,data=tool_data)
        if tool_serializer.is_valid():
            tool_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        tool=Tools.objects.get(ToolId=id)
        tool.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

#api istoric
@csrf_exempt
def historyApi(request,id=0):
    if request.method=='GET':
        histories = Histories.objects.all()
        histories_serializer = HistorySerializer(histories, many=True)
        return JsonResponse(histories_serializer.data, safe=False)

    elif request.method=='POST':
        history_data=JSONParser().parse(request)
        history_serializer = HistorySerializer(data=history_data)
        if history_serializer.is_valid():
            history_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        history_data = JSONParser().parse(request)
        history=Histories.objects.get(HistoryId=history_data['HistoryId'])
        history_serializer=HistorySerializer(history,data=history_data)
        if history_serializer.is_valid():
            history_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        history=Histories.objects.get(HistoryId=id)
        history.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

#api materiale
@csrf_exempt
def materialApi(request,id=0):
    if request.method=='GET':
        materials = Materials.objects.all()
        materials_serializer = MaterialSerializer(materials, many=True)
        return JsonResponse(materials_serializer.data, safe=False)

    elif request.method=='POST':
        material_data=JSONParser().parse(request)
        material_serializer = MaterialSerializer(data=material_data)
        if material_serializer.is_valid():
            material_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        material_data = JSONParser().parse(request)
        material=Materials.objects.get(MaterialId=material_data['MaterialId'])
        material_serializer=MaterialSerializer(material,data=material_data)
        if material_serializer.is_valid():
            material_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        material=Materials.objects.get(MaterialId=id)
        material.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api consumabile
@csrf_exempt
def consumableApi(request,id=0):
    if request.method=='GET':
        consumables = Consumables.objects.all()
        consumables_serializer = ConsumableSerializer(consumables, many=True)
        return JsonResponse(consumables_serializer.data, safe=False)

    elif request.method=='POST':
        consumable_data=JSONParser().parse(request)
        consumable_serializer = ConsumableSerializer(data=consumable_data)
        if consumable_serializer.is_valid():
            consumable_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        consumable_data = JSONParser().parse(request)
        consumable=Consumables.objects.get(ConsumeId=consumable_data['ConsumeId'])
        consumable_serializer=ConsumableSerializer(consumable,data=consumable_data)
        if consumable_serializer.is_valid():
            consumable_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)



    elif request.method=='DELETE':
        consumable=Consumables.objects.get(ConsumeId=id)
        consumable.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api shed
@csrf_exempt
def shedApi(request,id=0):
    if request.method=='GET':
        shed = Shed.objects.all()
        shed_serializer = ShedSerializer(shed, many=True)
        return JsonResponse(shed_serializer.data, safe=False)

    elif request.method=='POST':
        shed_data=JSONParser().parse(request)
        shed_serializer = ShedSerializer(data=shed_data)
        if shed_serializer.is_valid():
            shed_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        shed_data = JSONParser().parse(request)
        shed=Shed.objects.get(ShedId=shed_data['ShedId'])
        shed_serializer=ShedSerializer(shed,data=shed_data)
        if shed_serializer.is_valid():
            shed_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)


    elif request.method=='DELETE':
        shed=Shed.objects.get(ShedId=id)
        shed.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api workfield SANTIER
@csrf_exempt
def workfieldApi(request,id=0):
    if request.method=='GET':
        workfield = WorkField.objects.all()
        workfield_serializer = WorkFieldSerializer(workfield, many=True)
        return JsonResponse(workfield_serializer.data, safe=False)

    elif request.method=='POST':
        workfield_data=JSONParser().parse(request)
        workfield_serializer = WorkFieldSerializer(data=workfield_data)
        if workfield_serializer.is_valid():
            workfield_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        workfield_data = JSONParser().parse(request)
        workfield=WorkField.objects.get(WorkFieldId=workfield_data['WorkFieldId'])
        workfield_serializer=WorkFieldSerializer(workfield,data=workfield_data)
        if workfield_serializer.is_valid():
            workfield_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        workfield=WorkField.objects.get(WorkFieldId=id)
        workfield.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

#api NEFUNCTIONALA 
@csrf_exempt
def unfunctionalApi(request,id=0):
    if request.method=='GET':
        unfunctional = Unfunctional.objects.all()
        unfunctional_serializer = UnfunctionalSerializer(unfunctional, many=True)
        return JsonResponse(unfunctional_serializer.data, safe=False)

    elif request.method=='POST':
        unfunctional_data=JSONParser().parse(request)
        unfunctional_serializer = UnfunctionalSerializer(data=unfunctional_data)
        if unfunctional_serializer.is_valid():
            unfunctional_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        unfunctional_data = JSONParser().parse(request)
        unfunctional=Unfunctional.objects.get(UnfunctionalId=unfunctional_data['UnfunctionalId'])
        unfunctional_serializer=UnfunctionalSerializer(unfunctional,data=unfunctional_data)
        if unfunctional_serializer.is_valid():
            unfunctional_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        unfunctional=Unfunctional.objects.get(UnfunctionalId=id)
        unfunctional.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

#api cofraj metalic 
@csrf_exempt
def cofrajmetalicApi(request,id=0):
    if request.method=='GET':
        cofrajmetalic = CofrajMetalics.objects.all()
        cofrajmetalic_serializer = CofrajMetalicSerializer(cofrajmetalic, many=True)
        return JsonResponse(cofrajmetalic_serializer.data, safe=False)

    elif request.method=='POST':
        cofrajmetalic_data=JSONParser().parse(request)
        cofrajmetalic_serializer = CofrajMetalicSerializer(data=cofrajmetalic_data)
        if cofrajmetalic_serializer.is_valid():
            cofrajmetalic_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        cofrajmetalic_data = JSONParser().parse(request)
        cofrajmetalic=CofrajMetalics.objects.get(CofrajMetalicId=cofrajmetalic_data['CofrajMetalicId'])
        cofrajmetalic_serializer=CofrajMetalicSerializer(cofrajmetalic,data=cofrajmetalic_data)
        if cofrajmetalic_serializer.is_valid():
            cofrajmetalic_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        cofrajmetalic=CofrajMetalics.objects.get(CofrajMetalicId=id)
        cofrajmetalic.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

    
#api cofraj tip doka 
@csrf_exempt
def cofrajtipdokaApi(request,id=0):
    if request.method=='GET':
        cofrajtipdoka = CofrajtTipDokas.objects.all()
        cofrajtipdoka_serializer = CofrajtTipDokaSerializer(cofrajtipdoka, many=True)
        return JsonResponse(cofrajtipdoka_serializer.data, safe=False)

    elif request.method=='POST':
        cofrajtipdoka_data=JSONParser().parse(request)
        cofrajtipdoka_serializer = CofrajtTipDokaSerializer(data=cofrajtipdoka_data)
        if cofrajtipdoka_serializer.is_valid():
            cofrajtipdoka_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        cofrajtipdoka_data = JSONParser().parse(request)
        cofrajtipdoka=CofrajtTipDokas.objects.get(CofrajtTipDokaId=cofrajtipdoka_data['CofrajtTipDokaId'])
        cofrajtipdoka_serializer=CofrajtTipDokaSerializer(cofrajtipdoka,data=cofrajtipdoka_data)
        if cofrajtipdoka_serializer.is_valid():
            cofrajtipdoka_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        cofrajtipdoka=CofrajtTipDokas.objects.get(CofrajtTipDokaId=id)
        cofrajtipdoka.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api Popi
@csrf_exempt
def popiApi(request,id=0):
    if request.method=='GET':
        popi = Popis.objects.all()
        popi_serializer = PopiSerializer(popi, many=True)
        return JsonResponse(popi_serializer.data, safe=False)

    elif request.method=='POST':
        popi_data=JSONParser().parse(request)
        popi_serializer = PopiSerializer(data=popi_data)
        if popi_serializer.is_valid():
            popi_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        popi_data = JSONParser().parse(request)
        popi=Popis.objects.get(PopiDokaId=popi_data['PopiDokaId'])
        popi_serializer=PopiSerializer(popi,data=popi_data)
        if popi_serializer.is_valid():
            popi_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        popi=Popis.objects.get(PopiDokaId=id)
        popi.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api schela usoara
@csrf_exempt
def schelausoaraApi(request,id=0):
    if request.method=='GET':
        schelausoara = SchelaUsoaras.objects.all()
        schelausoara_serializer = SchelaUsoaraSerializer(schelausoara, many=True)
        return JsonResponse(schelausoara_serializer.data, safe=False)

    elif request.method=='POST':
        schelausoara_data=JSONParser().parse(request)
        schelausoara_serializer = SchelaUsoaraSerializer(data=schelausoara_data)
        if schelausoara_serializer.is_valid():
            schelausoara_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        schelausoara_data = JSONParser().parse(request)
        schelausoara=SchelaUsoaras.objects.get(SchelaUsoaraId=schelausoara_data['SchelaUsoaraId'])
        schelausoara_serializer=SchelaUsoaraSerializer(schelausoara,data=schelausoara_data)
        if schelausoara_serializer.is_valid():
            schelausoara_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        schelausoara=SchelaUsoaras.objects.get(SchelaUsoaraId=id)
        schelausoara.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)




#api Schela Fatada 
@csrf_exempt
def schelafatadaApi(request,id=0):
    if request.method=='GET':
        schelafatada = SchelaFatadas.objects.all()
        schelafatada_serializer = SchelaFatadaSerializer(schelafatada, many=True)
        return JsonResponse(schelafatada_serializer.data, safe=False)

    elif request.method=='POST':
        schelafatada_data=JSONParser().parse(request)
        schelafatada_serializer = SchelaFatadaSerializer(data=schelafatada_data)
        if schelafatada_serializer.is_valid():
            schelafatada_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        schelafatada_data = JSONParser().parse(request)
        schelafatada=SchelaFatadas.objects.get(SchelaFatadaId=schelafatada_data['SchelaFatadaId'])
        schelafatada_serializer=SchelaFatadaSerializer(schelafatada,data=schelafatada_data)
        if schelafatada_serializer.is_valid():
            schelafatada_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        schelafatada=SchelaFatadas.objects.get(SchelaFatadaId=id)
        schelafatada.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)



#api Schela Fatada modulara
@csrf_exempt
def schelafatadamodularaApi(request,id=0):
    if request.method=='GET':
        schelafatadamodulara = SchelaFatadaModularas.objects.all()
        schelafatadamodulara_serializer = SchelaFatadaModularaSerializer(schelafatadamodulara, many=True)
        return JsonResponse(schelafatadamodulara_serializer.data, safe=False)

    elif request.method=='POST':
        schelafatadamodulara_data=JSONParser().parse(request)
        schelafatadamodulara_serializer = SchelaFatadaModularaSerializer(data=schelafatadamodulara_data)
        if schelafatadamodulara_serializer.is_valid():
            schelafatadamodulara_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        schelafatadamodulara_data = JSONParser().parse(request)
        schelafatadamodulara=SchelaFatadaModularas.objects.get(SchelaFatadaModularaId=schelafatadamodulara_data['SchelaFatadaModularaId'])
        schelafatadamodulara_serializer=SchelaFatadaModularaSerializer(schelafatadamodulara,data=schelafatadamodulara_data)
        if schelafatadamodulara_serializer.is_valid():
            schelafatadamodulara_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        schelafatadamodulara=SchelaFatadaModularas.objects.get(SchelaFatadaModularaId=id)
        schelafatadamodulara.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)



#api combustibil
@csrf_exempt
def combustibilApi(request,id=0):
    if request.method=='GET':
        combustibil = Combustibils.objects.all()
        combustibil_serializer = CombustibilSerializer(combustibil, many=True)
        return JsonResponse(combustibil_serializer.data, safe=False)

    elif request.method=='POST':
        combustibil_data=JSONParser().parse(request)
        combustibil_serializer = CombustibilSerializer(data=combustibil_data)
        if combustibil_serializer.is_valid():
            combustibil_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        combustibil_data = JSONParser().parse(request)
        combustibil=Combustibils.objects.get(CombustibilId=combustibil_data['CombustibilId'])
        combustibil_serializer=CombustibilSerializer(combustibil,data=combustibil_data)
        if combustibil_serializer.is_valid():
            combustibil_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        combustibil=Combustibils.objects.get(CombustibilId=id)
        combustibil.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api istoric schela
@csrf_exempt
def istoricschelaApi(request,id=0):
    if request.method=='GET':
        istoricschele = HistorieScheles.objects.all()
        istoricschele_serializer = HistorieScheleSerializer(istoricschele, many=True)
        return JsonResponse(istoricschele_serializer.data, safe=False)

    elif request.method=='POST':
        istoricschele_data=JSONParser().parse(request)
        istoricschele_serializer = HistorieScheleSerializer(data=istoricschele_data)
        if istoricschele_serializer.is_valid():
            istoricschele_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        istoricschele_data = JSONParser().parse(request)
        istoricschele=HistorieScheles.objects.get(HistoriesScheleId=istoricschele_data['HistoriesScheleId'])
        istoricschele_serializer=HistorieScheleSerializer(istoricschele,data=istoricschele_data)
        if istoricschele_serializer.is_valid():
            istoricschele_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        istoricschele=HistorieScheles.objects.get(HistoriesScheleId=id)
        istoricschele.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)


#api mijloace fixe
@csrf_exempt
def mijloacefixeApi(request,id=0):
    if request.method=='GET':
        mijloacefixe = MijloaceFixes.objects.all()
        mijloacefixe_serializer = MijloaceFixeSerializer(mijloacefixe, many=True)
        return JsonResponse(mijloacefixe_serializer.data, safe=False)

    elif request.method=='POST':
        mijloacefixe_data=JSONParser().parse(request)
        mijloacefixe_serializer = MijloaceFixeSerializer(data=mijloacefixe_data)
        if mijloacefixe_serializer.is_valid():
            mijloacefixe_serializer.save()
            return JsonResponse("Added Successfully!!" , safe=False)
        return JsonResponse("Failed to Add.",safe=False)
    
    elif request.method=='PUT':
        mijloacefixe_data = JSONParser().parse(request)
        mijloacefixe=MijloaceFixes.objects.get(MijloaceFixeId=mijloacefixe_data['MijloaceFixeId'])
        mijloacefixe_serializer=MijloaceFixeSerializer(mijloacefixe,data=mijloacefixe_data)
        if mijloacefixe_serializer.is_valid():
            mijloacefixe_serializer.save()
            return JsonResponse("Updated Successfully!!", safe=False)
        return JsonResponse("Failed to Update.", safe=False)

    elif request.method=='DELETE':
        mijloacefixe=MijloaceFixes.objects.get(MijloaceFixeId=id)
        mijloacefixe.delete()
        return JsonResponse("Deleted Succeffully!!", safe=False)

        #test nfc reader
def nfc_tag_view(request):
    with nfc.ContactlessFrontend('usb') as clf:
        target = clf.sense(nfc.clf.RemoteTarget('iso14443a'))
        tag = nfc.tag.activate(clf, target)
        text_record = tag.ndef.records[0].text
    return JsonResponse({'text_record': text_record})

def check_nfc_reader(request):
    readers = nfc.list_devices()
    has_reader = len(readers) > 0

    return JsonResponse({'has_nfc_reader': has_reader})

    import nfc
from django.http import JsonResponse

def check_nfc_reader(request):
    try:
        with nfc.ContactlessFrontend('usb') as clf:
            has_reader = True
    except IOError:
        has_reader = False

    return JsonResponse({'has_nfc_reader': has_reader})
