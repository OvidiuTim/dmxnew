import { InventoryCatalogComponent } from './inventory-catalog.component';

describe('InventoryCatalogComponent', () => {
  let component: InventoryCatalogComponent;

  beforeEach(() => {
    component = new InventoryCatalogComponent({} as any, {} as any, {} as any);
    component.isSsm = false;
    component.tools = [
      {
        ToolId: 1,
        ToolName: 'Scula X',
        Pieces: 2,
        IsSSM: false,
        Status: 'in_lucru',
        AssignedUserName: 'Ion Echipa',
        AssignedTeamId: 7,
        AssignedTeamName: 'Echipa Y',
      },
      {
        ToolId: 2,
        ToolName: 'Polizor',
        Pieces: 3,
        IsSSM: false,
        Status: 'functionala',
      },
      {
        ToolId: 3,
        ToolName: 'Bormașină',
        Pieces: 1,
        IsSSM: false,
        Status: 'nefunctionala',
      },
    ];
  });

  it('uses only the standardized statuses in counters and labels', () => {
    expect(component.warehousePieces).toBe(3);
    expect(component.attentionCount).toBe(1);
    expect(component.statusLabel(component.tools[1])).toBe('Funcțional');
    expect(component.statusLabel(component.tools[2])).toBe('Nefuncțional');
  });

  it('groups assigned tools by the employee active team', () => {
    expect(component.teamToolGroups.length).toBe(1);
    expect(component.teamToolGroups[0].name).toBe('Echipa Y');
    expect(component.teamToolGroups[0].pieces).toBe(2);
    expect(component.teamToolGroups[0].tools[0].ToolName).toBe('Scula X');
  });

  it('shows every employee in the SSM matrix, including employees without equipment', () => {
    component.isSsm = true;
    component.employees = [
      { UserId: 10, UserName: 'Angajat Complet', trade: 'Fierar' },
      { UserId: 11, UserName: 'Angajat Fără Echipament', trade: 'Dulgher' },
    ];
    component.tools = ['Cască', 'Bocanci', 'Vestă', 'Ham', 'Mănuși'].map((name, index) => ({
      ToolId: index + 20,
      ToolName: name,
      Pieces: 1,
      IsSSM: true,
      Status: 'in_lucru',
      AssignedUserId: 10,
      AssignedUserName: 'Angajat Complet',
    }));

    expect(component.ssmRows.length).toBe(2);
    expect(component.ssmRows[0].complete).toBeTrue();
    expect(component.ssmRows[1].complete).toBeFalse();
    expect(component.ssmRows[1].equipment.helmet.present).toBeFalse();
  });

  it('marks an assigned SSM item as expired and exposes the warning filter', () => {
    component.isSsm = true;
    component.employees = [{ UserId: 12, UserName: 'Angajat Expirat' }];
    component.tools = [{
      ToolId: 30,
      ToolName: 'Cască protecție',
      Pieces: 1,
      IsSSM: true,
      Status: 'in_lucru',
      AssignedUserId: 12,
      ExpiryDate: '2000-01-01',
    }];

    expect(component.ssmRows[0].equipment.helmet.expired).toBeTrue();
    expect(component.ssmRows[0].expiredLabels).toEqual(['Cască']);
    component.ssmStatusFilter = 'expired';
    expect(component.filteredSsmRows.length).toBe(1);
  });
});
