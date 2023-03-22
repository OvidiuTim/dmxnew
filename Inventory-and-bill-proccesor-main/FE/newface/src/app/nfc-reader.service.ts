import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import pcsc from 'pcsclite';
import Ndef from 'ndef';

@Injectable({
  providedIn: 'root',
})
export class NfcReaderService {
  private pcsc: any;
  public tagText = new BehaviorSubject<string>('');

  constructor() {
    this.pcsc = pcsc();
    this.pcsc.on('reader', (reader: any) => {
      reader.on('status', (status: any) => {
        this.processStatus(reader, status);
      });

      reader.on('end', () => {
        console.log('Reader disconnected');
      });
    });

    this.pcsc.on('error', (err: any) => {
      console.error('PCSC error:', err.message);
    });
  }

  private processStatus(reader: any, status: any) {
    const changes = this.pcsc.SCARD_STATE_EMPTY ^ status.state;
    if (changes) {
      if (status.state & this.pcsc.SCARD_STATE_PRESENT) {
        reader.connect({ share_mode: this.pcsc.SCARD_SHARE_SHARED }, (err: any, protocol: any) => {
          if (err) {
            console.error('Error connecting to NFC tag:', err);
          } else {
            // Read the NFC tag
            const command = Buffer.from([0xFF, 0xB0, 0x00, 0x04, 0x10]); // Update command based on your NFC tag type
            reader.transmit(command, 40, protocol, (err: any, data: any) => {
              if (err) {
                console.error('Error reading NFC tag:', err);
              } else {
                // Parse the NDEF message
                const bytes = data.slice(0, data.length - 2);
                const ndefMessage = Ndef.decodeMessage(Array.from(bytes));
                const textRecord = ndefMessage.find((record: any) => record.tnf === Ndef.TNF_WELL_KNOWN && record.type === Ndef.RTD_TEXT);
                if (textRecord) {
                  const text = Ndef.text.decodePayload(textRecord.payload);
                  this.tagText.next(text);
                } else {
                  console.error('Text record not found');
                }
              }
              reader.disconnect(this.pcsc.SCARD_LEAVE_CARD, () => {});
            });
          }
        });
      }
    }
  }
}
