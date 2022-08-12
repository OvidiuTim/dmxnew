import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowProviderComponent } from './show-provider.component';

describe('ShowProviderComponent', () => {
  let component: ShowProviderComponent;
  let fixture: ComponentFixture<ShowProviderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowProviderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowProviderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
