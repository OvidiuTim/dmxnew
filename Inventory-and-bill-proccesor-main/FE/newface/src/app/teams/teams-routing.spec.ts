import { routes } from '../app-routing.module';
import { TeamsWorkspaceComponent } from './teams-workspace.component';

describe('Rutele echipelor', () => {
  it('configurează toate paginile de echipe fără placeholder', () => {
    const expected: Record<string, string> = {
      'pontaj/echipe': 'permanent',
      'pontaj/echipa-mea': 'mine',
      'pontaj/notificari': 'notifications',
      'pontaj/echipe-azi': 'today',
      'pontaj/personal': 'available',
    };
    Object.entries(expected).forEach(([path, mode]) => {
      const route = routes.find(item => item.path === path);
      expect(route?.component).toBe(TeamsWorkspaceComponent);
      expect(route?.data?.['teamMode']).toBe(mode);
      expect(route?.data?.['moduleCode']).toBe('teams_schedule');
    });
  });
});
