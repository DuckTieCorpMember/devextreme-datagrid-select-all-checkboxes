import type dxDataGrid from 'devextreme/ui/data_grid';
import type { DxDataGridTypes } from 'devextreme-vue/data-grid';
import type { LoadOptions } from 'devextreme/data';
import { isItemsArray } from 'devextreme/common/data/custom-store';
import type { IGroupRowReadyParameter } from '@/types';

export default class GroupSelectionHelper {
  groupedColumns: DxDataGridTypes.Column[];
  grid: dxDataGrid;
  getSelectedKeysPromise: Promise<any[]> | null;
  selectedKeys: any[] = [];
  groupChildKeys: Record<string, any> = {};

  constructor(grid: dxDataGrid) {
    this.grid = grid;
    this.groupedColumns = this.collectGroupedColumns(grid);
    this.getSelectedKeysPromise = this.getSelectedKeys(grid);
    this.getSelectedKeysPromise.then((keys: any[]) => {
      this.selectedKeys = keys;
    }).catch(() => {});
    const defaultCustomizeCallback: Function | undefined = grid.option('customizeColumns');
    grid.option('customizeColumns', (columns: DxDataGridTypes.Column[]) => {
      columns.forEach((column: DxDataGridTypes.Column) => {
        column.groupCellTemplate = 'groupCellTemplate';
      });
      if (defaultCustomizeCallback) { defaultCustomizeCallback(columns); }
    });
    const defaultSelectionHandler: Function | undefined = grid.option('onSelectionChanged');
    grid.option('onSelectionChanged', (e: DxDataGridTypes.SelectionChangedEvent) => {
      this.selectionChanged(e);
      if (defaultSelectionHandler) { defaultSelectionHandler(e); }
    });
    const defaultOptionChangedHandler: Function | undefined = grid.option('onOptionChanged');
    grid.option('onOptionChanged', (e: DxDataGridTypes.OptionChangedEvent) => {
      if (e.fullName.includes('groupIndex')) {
        this.groupedColumns = this.collectGroupedColumns(grid);
      }
      if (defaultOptionChangedHandler) { defaultOptionChangedHandler(e); }
    });
  }

  groupRowInit(arg: IGroupRowReadyParameter): Promise<any> {
    const checkBoxId = this.calcCheckBoxId(this.grid, arg.key);

    const promise = new Promise<any>((resolve) => {
      if (!this.groupChildKeys[checkBoxId]) {
        const filter: any[] = [];
        arg.key.forEach((key, i) => {
          filter.push([this.groupedColumns[i].dataField, '=', key]);
        });
        const loadOptions: LoadOptions = {
          filter,
        };
        const store = this.grid.getDataSource().store();
        store.load(loadOptions).then((data) => {
          if (isItemsArray(data)) {
            this.groupChildKeys[checkBoxId] = data.map((d) => this.grid.keyOf(d));
            this.getSelectedKeys(this.grid).then((selectedKeys) => {
              const checkedState: boolean | undefined = this.areKeysSelected(
                this.groupChildKeys[checkBoxId], selectedKeys
              );
              arg.setCheckedState(checkedState);
            }).catch(() => {});
            resolve(this.groupChildKeys[checkBoxId]);
          }
        }).catch(() => {});
      } else {
        this.getSelectedKeys(this.grid).then((selectedKeys) => {
          const checkedState: boolean | undefined = this.areKeysSelected(
            this.groupChildKeys[checkBoxId], selectedKeys
          );
          arg.setCheckedState(checkedState);
        }).catch(() => {});
        resolve(this.groupChildKeys[checkBoxId]);
      }
    });
    return promise;
  }

  selectionChanged(e: DxDataGridTypes.SelectionChangedEvent): void {
    const groupRows: DxDataGridTypes.Row[] = e.component.getVisibleRows().filter((r) => r.rowType === 'group');
    this.getSelectedKeysPromise = null;
    if (e.component.option('selection.deferred')) {
      const selectionFilter = e.component.option('selectionFilter');
      if (selectionFilter && selectionFilter.length >= 0) {
        this.repaintGroupRowTree(e.component, groupRows);
      } else {
        e.component.repaintRows(groupRows.map((g) => g.rowIndex));
      }
    } else if (e.selectedRowKeys.length >= e.component.totalCount()
      || e.currentDeselectedRowKeys.length >= e.component.totalCount()) {
      e.component.repaintRows(groupRows.map((g) => g.rowIndex));
    } else {
      this.repaintGroupRowTree(e.component, groupRows);
    }
  }

  getSelectedKeys(grid: dxDataGrid): Promise<any[]> {
    if (grid.option('selection.deferred')) {
      if (!this.getSelectedKeysPromise) {
        this.getSelectedKeysPromise = grid.getSelectedRowKeys();
      }
      return this.getSelectedKeysPromise;
    }
    return new Promise((resolve) => resolve(grid.getSelectedRowKeys()));
  }

  repaintGroupRowTree(grid: dxDataGrid, groupRows: DxDataGridTypes.Row[]): void {
    const topGroupRow: DxDataGridTypes.Row | null = groupRows.filter(
      (r) => r.isExpanded
    ).reduce((acc: DxDataGridTypes.Row | null, curr) =>
      (!acc || acc.key.length > curr.key.length ? curr : acc), null);
    if (topGroupRow) {
      const affectedGroupRows = groupRows.filter((g) => g.key[0] == topGroupRow.key[0]);
      grid.repaintRows(affectedGroupRows.map((g) => g.rowIndex));
    }
  }

  areKeysSelected(keysToCheck: any[], selectedKeys: any[]): boolean | undefined {
    if (selectedKeys.length == 0) { return false; }
    const intersectionCount = keysToCheck.filter((k) => selectedKeys.includes(k)).length;
    if (intersectionCount === 0) { return false; }
    if (intersectionCount === keysToCheck.length) { return true; }
    return undefined;
  }

  getChildRowKeys(grid: dxDataGrid, groupRowKey: string[]): any[] {
    return this.groupChildKeys[this.calcCheckBoxId(grid, groupRowKey)];
  }

  calcCheckBoxId(grid: dxDataGrid, groupRowKey: string[]): string {
    const gridId: string = grid.element().id;
    if(!groupRowKey) {
      return `${gridId}groupCheckBox`;
    }else{
      return groupRowKey && `${gridId}groupCheckBox${groupRowKey.join('')}`;
    }
  }

  collectGroupedColumns(grid: dxDataGrid): DxDataGridTypes.Column[] {
    const allColumns: DxDataGridTypes.Column[] = grid.getVisibleColumns();
    return allColumns.filter(
      (c: DxDataGridTypes.Column) => c.groupIndex != undefined && c.groupIndex >= 0)
      .sort((a, b) => {
        if (!a.groupIndex || !b.groupIndex) return 0;
        return a.groupIndex > b.groupIndex ? 1 : -1;
      });
  }
}
