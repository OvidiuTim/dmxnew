import { Component } from '@angular/core';

@Component({
  selector: 'app-shelfs',
  templateUrl: './shelfs.component.html',
  styleUrls: ['./shelfs.component.css']
})
export class ShelfsComponent {
  openShelves: boolean[] = [];

ngOnInit() {
  this.openShelves = this.shelves.map(() => false); // All closed by default
}

toggleShelf(i: number) {
  this.openShelves[i] = !this.openShelves[i];
}

  shelves = [
    { boxes: ['Etaj 1', 'Etaj 2', 'Etaj 3'] },
    { boxes: ['Etaj 4', 'Etaj 5'] },
    { boxes: ['Etaj 6', 'Etaj 7', 'Etaj 8', 'Etaj 9'] },
    { boxes: ['Etaj 10'] },
    { boxes: ['Etaj 11', 'Etaj 12', 'Etaj 13'] },
    { boxes: ['Etaj 14', 'Etaj 15'] }
  ];
}
