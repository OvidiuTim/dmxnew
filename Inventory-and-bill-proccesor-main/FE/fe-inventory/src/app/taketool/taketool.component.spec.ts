import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaketoolComponent } from './taketool.component';

describe('TaketoolComponent', () => {
  let component: TaketoolComponent;
  let fixture: ComponentFixture<TaketoolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TaketoolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaketoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
