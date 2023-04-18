# nfc_poller.py
import requests
import time
import nfc
import ndef


API_ENDPOINT = "http://localhost:8000/api/nfc-read/"

def read_nfc_tag():
    clf = nfc.ContactlessFrontend('usb')
    target = clf.sense(nfc.clf.RemoteTarget('106A'))
    
    if target is None:
        return None

    tag = nfc.tag.activate(clf, target)
    ndef_data = list(tag.ndef.records)

    text_record = None
    for record in ndef_data:
        if isinstance(record, ndef.TextRecord):
            text_record = record
            break

    return text_record.text if text_record else None

def main():
    while True:
        text = read_nfc_tag()
        if text:
            requests.get(API_ENDPOINT, params={"text": text})
        time.sleep(1)

if __name__ == "__main__":
    main()