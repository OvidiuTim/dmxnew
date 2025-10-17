# Inventory-and-bill-processor (Django backend)

Backend-ul e în `dataAPI/`. Există și `FE/` pentru frontend (opțional). **Nu folosi** `myenv/` din repo; creează-ți un mediu virtual curat (`.venv`).

## Cerințe
- Python 3.11 sau 3.12 recomandat (merge și 3.13, dar unele pachete pot întârzia compatibilitatea)
- pip actualizat

## Setup rapid — Windows (PowerShell)
```powershell
# 1) Intră în directorul proiectului (înlocuiește cu calea ta)
cd D:\Github\dmxnew\Inventory-and-bill-proccesor-main

# 2) Creează un mediu virtual NOU (NU folosi myenv/)
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3) Instalează dependențele backend-ului
python -m pip install --upgrade pip
pip install -r dataAPI\requirements.txt

# 4) Migrații & rulare
cd dataAPI
python manage.py migrate
python manage.py createsuperuser   # opțional
python manage.py runserver
# Deschide http://127.0.0.1:8000/
