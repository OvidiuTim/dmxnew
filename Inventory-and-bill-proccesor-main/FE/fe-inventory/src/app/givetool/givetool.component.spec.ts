import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GivetoolComponent } from './givetool.component';

describe('GivetoolComponent', () => {
  let component: GivetoolComponent;
  let fixture: ComponentFixture<GivetoolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GivetoolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GivetoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
