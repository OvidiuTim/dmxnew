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
});
