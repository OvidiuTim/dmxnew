import { TestBed } from '@angular/core/testing';

import { NfcReaderService } from './nfc-reader.service';

describe('NfcReaderService', () => {
  let service: NfcReaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NfcReaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
