import { Component, OnInit } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

type RawHistory = {
  // câmpuri posibile din serializer (nou + legacy)
  direction?: 'OUT' | 'IN' | string;
  quantity?: number;
  note?: string;
  timestamp?: string; // ISO
  DateOfGiving?: string; // fallback legacy

  User?: string;  // legacy
  Tool?: string;  // legacy
  ToolSerie?: string; // legacy
  GiveRecive?: string; // legacy

  user?: { UserId: number; UserName: string; UserSerie: string }; // nested read-only (nou)
  tool?: { ToolId: number; ToolName: string; ToolSerie: string }; // nested read-only (nou)
};

type ViewHistory = {
  displayUser: string;
  displayTool: string;
  displayAction: 'a preluat' | 'a predat';
  isOut: boolean;
  quantity: number;
  timestamp: Date;
  raw: RawHistory;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  // listă completă (normalizată & sortată desc)
  histToolList: ViewHistory[] = [];

  // paginare
  pageSize = 20;
  currentPage = 1;

  constructor(private service: SharedService) {}

  ngOnInit(): void {
    this.refreshHisList();
  }

  refreshHisList() {
    this.service.getHisList().subscribe((data: RawHistory[]) => {
      const normalized = data.map((it) => this.normalizeHistory(it));
      // sort desc după timestamp
      normalized.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      this.histToolList = normalized;
      // dacă eram pe o pagină mai „mare” decât noul număr de pagini, ajustează
      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages || 1;
      }
    });
  }

  // ------- helpers pentru normalizare -------
  private normalizeHistory(it: RawHistory): ViewHistory {
    // 1) direcție
    const dir = this.resolveDirection(it);
    const isOut = dir === 'OUT';
    const displayAction: 'a preluat' | 'a predat' = isOut ? 'a preluat' : 'a predat';

    // 2) user / tool
    const displayUser = this.pickUserName(it);
    const displayTool = this.pickToolName(it);

    // 3) timestamp (preferă noul "timestamp", altfel pica pe "DateOfGiving")
    const ts = it.timestamp || it.DateOfGiving || new Date().toISOString();
    const timestamp = new Date(ts);

    // 4) cantitate
    const quantity = (typeof it.quantity === 'number' && !isNaN(it.quantity)) ? it.quantity : 1;

    return { displayUser, displayTool, displayAction, isOut, quantity, timestamp, raw: it };
  }

  private resolveDirection(it: RawHistory): 'OUT' | 'IN' {
    // nou: direction
    if (it.direction) {
      const d = String(it.direction).toUpperCase();
      if (d.startsWith('OUT')) return 'OUT';
      if (d.startsWith('IN')) return 'IN';
    }
    // legacy: GiveRecive (română veche)
    const gr = (it.GiveRecive || '').toLowerCase();
    if (gr.includes('luat') || gr.includes('predare') || gr.includes('iesire')) return 'OUT';
    if (gr.includes('adus') || gr.includes('predat') || gr.includes('intrare')) return 'IN';
    // fallback
    return 'OUT';
  }

  private pickUserName(it: RawHistory): string {
    return it.user?.UserName || it.User || 'Utilizator necunoscut';
  }

  private pickToolName(it: RawHistory): string {
    return it.tool?.ToolName || it.Tool || it.ToolSerie || 'Unealtă necunoscută';
  }

  // ------- paginare -------
  get totalPages(): number {
    return Math.ceil(this.histToolList.length / this.pageSize);
  }

  get pagedHistory(): ViewHistory[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.histToolList.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }
}
