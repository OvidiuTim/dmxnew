declare module 'nfc-pcsc' {
    interface Card {
      atr: Buffer;
      protocol: string;
      reader: {
        name: string;
        state: string;
      };
      uid: string;
    }
  
    class Reader {
      constructor();
      start(options?: any): void;
      close(): void;
      connect(options: any): Promise<void>;
      disconnect(): Promise<void>;
      transceive(data: Buffer): Promise<Buffer>;
      read(block: number, length: number): Promise<Buffer>;
      write(block: number, data: Buffer): Promise<void>;
      on(event: 'reader', callback: (reader: Reader) => void): void;
      on(event: 'card', callback: (card: Card) => void): void;
      on(event: 'error', callback: (error: Error) => void): void;
      on(event: 'end', callback: () => void): void;
    }
  }
  