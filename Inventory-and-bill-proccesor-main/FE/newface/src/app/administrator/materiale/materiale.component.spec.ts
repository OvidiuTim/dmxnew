import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialeComponent } from './materiale.component';

describe('MaterialeComponent', () => {
  let component: MaterialeComponent;
  let fixture: ComponentFixture<MaterialeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MaterialeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
