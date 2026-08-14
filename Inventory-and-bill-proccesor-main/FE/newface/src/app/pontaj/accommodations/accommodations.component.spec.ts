import { of } from 'rxjs';
import { AccommodationsComponent } from './accommodations.component';

describe('AccommodationsComponent', () => {
  it('încarcă lista și repartizează imediat angajatul prin dropdown', () => {
    const api: any = {
      getAccommodations: jasmine.createSpy().and.returnValue(of({
        accommodations: [{ id: 4, name: 'Cazare Nord', address: '', notes: '', active: true, employee_count: 0, total_places: 10, number_of_rooms: 0, available_places: 10, rooms: [] }],
        employees: [{ id: 9, name: 'Ion Pop', serie: '9', trade: 'Dulgher', company: 'RNX', accommodation_id: null, accommodation_room_id: null, accommodation_room_name: '', housing_location: '' }],
      })),
      assignAccommodation: jasmine.createSpy().and.returnValue(of({
        employee: { id: 9, accommodation_id: 4, accommodation_room_id: null, accommodation_room_name: '', housing_location: 'Cazare Nord' },
      })),
    };
    const component = new AccommodationsComponent(api);
    component.ngOnInit();

    component.onAccommodationChange(component.employees[0], 4);

    expect(api.assignAccommodation).toHaveBeenCalledWith(9, 4, null);
    expect(component.employees[0].housing_location).toBe('Cazare Nord');
    expect(component.accommodations[0].employee_count).toBe(1);
  });
});
