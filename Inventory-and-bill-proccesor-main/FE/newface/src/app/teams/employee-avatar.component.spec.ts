import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeAvatarComponent } from './employee-avatar.component';

describe('EmployeeAvatarComponent', () => {
  let fixture: ComponentFixture<EmployeeAvatarComponent>;
  let component: EmployeeAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommonModule], declarations: [EmployeeAvatarComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeAvatarComponent);
    component = fixture.componentInstance;
  });

  it('afișează fotografia disponibilă', () => {
    const photo = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    component.employee = { id: 1, name: 'Ana Pop', serie: '1', company: '', trade: '', active: true, photo };
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(photo);
    expect(getComputedStyle(image).objectFit).toBe('cover');
  });

  it('revine la inițială când fotografia nu se încarcă', () => {
    component.employee = { id: 1, name: 'Ștefan Pop', serie: '1', company: '', trade: '', active: true, photo: '/invalid.jpg' };
    component.onImageError();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('Ș');
    const avatar = fixture.nativeElement.querySelector('.employee-avatar') as HTMLElement;
    expect(getComputedStyle(avatar).alignItems).toBe('center');
    expect(getComputedStyle(avatar).justifyContent).toBe('center');
  });
});
