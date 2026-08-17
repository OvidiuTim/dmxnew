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

  it('calculează totalul disponibil numai din cazările active', () => {
    const component = new AccommodationsComponent({} as any);
    component.accommodations = [
      { id: 1, name: 'Nord', address: '', notes: '', active: true, employee_count: 3, total_places: 10, number_of_rooms: 0, available_places: 7, rooms: [] },
      { id: 2, name: 'Sud', address: '', notes: '', active: true, employee_count: 2, total_places: 4, number_of_rooms: 0, available_places: 2, rooms: [] },
      { id: 3, name: 'Închisă', address: '', notes: '', active: false, employee_count: 1, total_places: 20, number_of_rooms: 0, available_places: 19, rooms: [] },
    ];

    expect(component.totalConfiguredPlaces).toBe(14);
    expect(component.totalAvailablePlaces).toBe(9);
    expect(component.availablePlaces(component.accommodations[0])).toBe(7);
  });
});
