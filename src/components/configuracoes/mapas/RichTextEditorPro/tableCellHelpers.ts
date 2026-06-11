// Helpers de divisão / mesclagem direcional de células — extraídos de
// RichTextEditorPro.tsx (Sprint 1 — slicing estrutural). Lógica TipTap
// preservada literalmente.
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TableMap, CellSelection } from "@tiptap/pm/tables";

// Localiza a célula que contém a posição informada na tabela mais próxima.
export function findCellAt(state: any, pos: number) {
  const $pos = state.doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      return {
        cellNode: node as PMNode,
        cellPos: $pos.before(d),
        cellDepth: d,
      };
    }
  }
  return null;
}

export function findTableAround(state: any, pos: number) {
  const $pos = state.doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "table") {
      return {
        tableNode: node as PMNode,
        tablePos: $pos.before(d),
      };
    }
  }
  return null;
}

/** Retorna a posição (row, col) da célula no TableMap (ou null). */
export function getCellRowCol(map: TableMap, cellPosRelativeToTable: number): { row: number; col: number } | null {
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      if (map.map[r * map.width + c] === cellPosRelativeToTable) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/** Mescla a célula atual com a vizinha imediatamente à direita (ou abaixo). */
export function mergeCellDirection(editor: Editor, direction: "right" | "down"): boolean {
  const { state } = editor;
  const { selection } = state;
  const cellInfo = findCellAt(state, selection.from);
  const tableInfo = findTableAround(state, selection.from);
  if (!cellInfo || !tableInfo) return false;

  const map = TableMap.get(tableInfo.tableNode);
  const cellPosInTable = cellInfo.cellPos - tableInfo.tablePos - 1;
  const rc = getCellRowCol(map, cellPosInTable);
  if (!rc) return false;

  const colspan = (cellInfo.cellNode.attrs.colspan ?? 1) as number;
  const rowspan = (cellInfo.cellNode.attrs.rowspan ?? 1) as number;

  let targetRow = rc.row;
  let targetCol = rc.col;
  if (direction === "right") targetCol = rc.col + colspan;
  else targetRow = rc.row + rowspan;

  if (targetCol >= map.width || targetRow >= map.height) return false;

  const neighborPosInTable = map.map[targetRow * map.width + targetCol];
  if (neighborPosInTable === cellPosInTable) return false; // já é a mesma célula (mesclada)

  const cellAStart = cellInfo.cellPos + 1;
  const cellBStart = tableInfo.tablePos + 1 + neighborPosInTable + 1;

  const $a = state.doc.resolve(cellAStart);
  const $b = state.doc.resolve(cellBStart);
  try {
    const sel = CellSelection.create(state.doc, $a.before(), $b.before());
    const tr = state.tr.setSelection(sel);
    editor.view.dispatch(tr);
    return editor.chain().focus().mergeCells().run();
  } catch {
    return false;
  }
}

/**
 * Divide a célula atual horizontalmente (em duas colunas) ou verticalmente (em duas linhas).
 * - Se a célula tem colspan/rowspan > 1, usa o splitCell nativo.
 * - Caso contrário (célula 1x1), insere uma nova coluna/linha e aumenta colspan/rowspan
 *   das outras células da coluna/linha para preservar a estrutura.
 */
export function splitCellDirection(editor: Editor, direction: "horizontal" | "vertical"): boolean {
  const { state } = editor;
  const { selection } = state;
  const cellInfo = findCellAt(state, selection.from);
  const tableInfo = findTableAround(state, selection.from);
  if (!cellInfo || !tableInfo) return false;

  const colspan = (cellInfo.cellNode.attrs.colspan ?? 1) as number;
  const rowspan = (cellInfo.cellNode.attrs.rowspan ?? 1) as number;

  // Caso a célula esteja mesclada, splitCell nativo já resolve.
  if ((direction === "horizontal" && colspan > 1) || (direction === "vertical" && rowspan > 1)) {
    return editor.chain().focus().splitCell().run();
  }

  const map = TableMap.get(tableInfo.tableNode);
  const cellPosInTable = cellInfo.cellPos - tableInfo.tablePos - 1;
  const rc = getCellRowCol(map, cellPosInTable);
  if (!rc) return false;

  if (direction === "horizontal") {
    const targetCol = rc.col + 1;
    let chain: any = editor.chain().focus();
    chain = chain.command(({ tr, state: s }: any) => {
      const tNode = s.doc.nodeAt(tableInfo.tablePos);
      if (!tNode) return false;
      const m = TableMap.get(tNode);
      const seen = new Set<number>();
      for (let r = 0; r < m.height; r++) {
        if (r === rc.row) continue;
        const cellHere = m.map[r * m.width + targetCol - 1];
        if (seen.has(cellHere)) continue;
        seen.add(cellHere);
        const absPos = tableInfo.tablePos + 1 + cellHere;
        const node = s.doc.nodeAt(absPos);
        if (!node) continue;
        tr.setNodeMarkup(absPos, undefined, {
          ...node.attrs,
          colspan: (node.attrs.colspan ?? 1) + 1,
        });
      }
      return true;
    });
    chain.addColumnAfter().run();
    return true;
  } else {
    const targetRow = rc.row + 1;
    let chain: any = editor.chain().focus();
    chain = chain.command(({ tr, state: s }: any) => {
      const tNode = s.doc.nodeAt(tableInfo.tablePos);
      if (!tNode) return false;
      const m = TableMap.get(tNode);
      const seen = new Set<number>();
      for (let c = 0; c < m.width; c++) {
        if (c === rc.col) continue;
        const cellHere = m.map[(targetRow - 1) * m.width + c];
        if (seen.has(cellHere)) continue;
        seen.add(cellHere);
        const absPos = tableInfo.tablePos + 1 + cellHere;
        const node = s.doc.nodeAt(absPos);
        if (!node) continue;
        tr.setNodeMarkup(absPos, undefined, {
          ...node.attrs,
          rowspan: (node.attrs.rowspan ?? 1) + 1,
        });
      }
      return true;
    });
    chain.addRowAfter().run();
    return true;
  }
}
