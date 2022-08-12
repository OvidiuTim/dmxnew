import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchelausoaraComponent } from './schelausoara.component';

describe('SchelausoaraComponent', () => {
  let component: SchelausoaraComponent;
  let fixture: ComponentFixture<SchelausoaraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchelausoaraComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchelausoaraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
