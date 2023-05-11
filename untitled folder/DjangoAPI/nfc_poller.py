# nfc_poller.py
import requests
import time
import nfc
import ndef


API_ENDPOINT = "http://localhost:8000/api/nfc-read/"

def read_nfc_tag():
    clf = nfc.ContactlessFrontend('usb')
    # Create a generic target object for NFC Type A and Type B cards
    target_a = nfc.clf.RemoteTarget('106A')
    target_b = nfc.clf.RemoteTarget('106B')

    while True:
        # Poll for a tag with a 1-second timeout
        target = clf.sense(target_a, target_b, iterations=5, interval=0.2)
        if target:
            tag = nfc.tag.activate(clf, target)
            if tag.ndef and tag.ndef.records:
                ndef_data = list(tag.ndef.records)
                text = str(ndef_data[0])
                clf.close()
                return text
            else:
                print("NDEF data not found on the tag.")
                clf.close()
                return None
        time.sleep(1)

def main():
    while True:
        text = read_nfc_tag()
        if text:
            requests.get(API_ENDPOINT, params={"text": text})
        time.sleep(1)

if __name__ == "__main__":
    main()