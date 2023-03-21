declare module 'nfc-pcsc' {
    export class Reader {
      constructor();
      on(event: string, listener: (card: Card) => void): void;
      close(): Promise<void>;
    }
  
    export class Card {
      constructor(reader: Reader, atr: Buffer);
      connect(cb: () => void): void;
      transmit(data: Buffer): Promise<Buffer>;
      disconnect(cb: () => void): void;
    }
  }
  