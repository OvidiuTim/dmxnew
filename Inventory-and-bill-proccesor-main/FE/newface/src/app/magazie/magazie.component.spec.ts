import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MagazieComponent } from './magazie.component';

describe('MagazieComponent', () => {
  let component: MagazieComponent;
  let fixture: ComponentFixture<MagazieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MagazieComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MagazieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
