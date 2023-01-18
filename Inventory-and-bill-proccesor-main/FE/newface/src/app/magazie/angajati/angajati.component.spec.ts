import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AngajatiComponent } from './angajati.component';

describe('AngajatiComponent', () => {
  let component: AngajatiComponent;
  let fixture: ComponentFixture<AngajatiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AngajatiComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AngajatiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
