import { routes } from '../app-routing.module';

describe('Module route mapping', () => {
  it('protejează cele trei rute Unelte cu modulul tools și permisiuni distincte', () => {
    const expected: Record<string, string> = {
      'unelte': '/unelte',
      'unelte/adauga-unealta': '/unelte/adauga-unealta',
      'predare-unealta': '/predare-unealta'
    };
    Object.entries(expected).forEach(([path, permissionRoute]) => {
      const route = routes.find(item => item.path === path);
      expect(route?.data?.['moduleCode']).toBe('tools');
      expect(route?.data?.['permissionRoute']).toBe(permissionRoute);
    });
  });

  it('mapează rutele principale în ordinea stabilă a modulelor', () => {
    const expected = [
      ['pontaj', 'attendance'],
      ['pontaj/echipe', 'teams_schedule'],
      ['magazie', 'warehouse'],
      ['hr/documente', 'human_resources'],
      ['unelte', 'tools']
    ];
    expect(expected.map(([path, code]) => routes.find(item => item.path === path)?.data?.['moduleCode'] === code))
      .toEqual([true, true, true, true, true]);
  });
});
