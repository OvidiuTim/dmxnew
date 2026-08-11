import { routes } from '../app-routing.module';

describe('Module route mapping', () => {
  it('permite intrarea în cele trei interfețe Unelte prin modulul tools', () => {
    const expected: Record<string, string> = {
      'unelte': '/unelte',
      'unelte/adauga-unealta': '/unelte/adauga-unealta',
      'predare-unealta': '/predare-unealta'
    };
    Object.entries(expected).forEach(([path, permissionRoute]) => {
      const route = routes.find(item => item.path === path);
      expect(route?.data?.['moduleCode']).toBe('tools');
      expect(route?.data?.['permissionRoute']).toBe(permissionRoute);
      expect(route?.data?.['requiresGranular']).toBeFalsy();
    });
  });

  it('mapează rutele principale în ordinea stabilă a modulelor', () => {
    const expected = [
      ['dashboard', 'attendance'],
      ['pontaj/echipe', 'teams_schedule'],
      ['magazie', 'warehouse'],
      ['hr/documente', 'human_resources'],
      ['unelte', 'tools']
    ];
    expect(expected.map(([path, code]) => routes.find(item => item.path === path)?.data?.['moduleCode'] === code))
      .toEqual([true, true, true, true, true]);
  });
});
