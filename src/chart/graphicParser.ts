export type ExtendValue = 'right' | 'left' | 'both' | 'none';
export type yLocValue = 'price' | 'abovebar' | 'belowbar';
export type LabelStyleValue = 'none' | 'xcross' | 'cross' | 'triangleup'
  | 'triangledown' | 'flag' | 'circle' | 'arrowup' | 'arrowdown'
  | 'label_up' | 'label_down' | 'label_left' | 'label_right'
  | 'label_lower_left' | 'label_lower_right' | 'label_upper_left'
  | 'label_upper_right' | 'label_center' | 'square' | 'diamond';
export type LineStyleValue = 'solid' | 'dotted' | 'dashed'
  | 'arrow_left' | 'arrow_right' | 'arrow_both';
export type BoxStyleValue = 'solid' | 'dotted' | 'dashed';
export type SizeValue = 'auto' | 'huge' | 'large' | 'normal' | 'small' | 'tiny';
export type VAlignValue = 'top' | 'center' | 'bottom';
export type HAlignValue = 'left' | 'center' | 'right';
export type TextWrapValue = 'none' | 'auto';
export type TablePositionValue = 'top_left' | 'top_center' | 'top_right'
  | 'middle_left' | 'middle_center' | 'middle_right'
  | 'bottom_left' | 'bottom_center' | 'bottom_right';

export interface GraphicLabel {
  id: number;
  x: number;
  y: number;
  yLoc: yLocValue;
  text: string;
  style: LabelStyleValue;
  color: number;
  textColor: number;
  size: SizeValue;
  textAlign: HAlignValue;
  toolTip: string;
}

export interface GraphicLine {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  extend: ExtendValue;
  style: LineStyleValue;
  color: number;
  width: number;
}

export interface GraphicBox {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  bgColor: number;
  extend: ExtendValue;
  style: BoxStyleValue;
  width: number;
  text: string;
  textSize: SizeValue;
  textColor: number;
  textVAlign: VAlignValue;
  textHAlign: HAlignValue;
  textWrap: TextWrapValue;
}

export interface TableCell {
  id: number;
  text: string;
  width: number;
  height: number;
  textColor: number;
  textHAlign: HAlignValue;
  textVAlign: VAlignValue;
  textSize: SizeValue;
  bgColor: number;
}

export interface GraphicTable {
  id: number;
  position: TablePositionValue;
  rows: number;
  columns: number;
  bgColor: number;
  frameColor: number;
  frameWidth: number;
  borderColor: number;
  borderWidth: number;
  cells: () => TableCell[][];
}

export interface GraphicHorizline {
  id: number;
  level: number;
  startIndex: number;
  endIndex: number;
  extendRight: boolean;
  extendLeft: boolean;
}

export interface GraphicPoint {
  index: number;
  level: number;
}

export interface GraphicPolygon {
  id: number;
  points: GraphicPoint[];
}

export interface GraphicHorizHist {
  id: number;
  priceLow: number;
  priceHigh: number;
  firstBarTime: number;
  lastBarTime: number;
  rate: number[];
}

export interface GraphicData {
  labels: GraphicLabel[];
  lines: GraphicLine[];
  boxes: GraphicBox[];
  tables: GraphicTable[];
  polygons: GraphicPolygon[];
  horizHists: GraphicHorizHist[];
  horizLines: GraphicHorizline[];
  raw: () => Record<string, unknown>;
}

const TRANSLATOR = {
  extend: {
    r: 'right',
    l: 'left',
    b: 'both',
    n: 'none',
  } as Record<string, ExtendValue>,
  yLoc: {
    pr: 'price',
    ab: 'abovebar',
    bl: 'belowbar',
  } as Record<string, yLocValue>,
  labelStyle: {
    n: 'none',
    xcr: 'xcross',
    cr: 'cross',
    tup: 'triangleup',
    tdn: 'triangledown',
    flg: 'flag',
    cir: 'circle',
    aup: 'arrowup',
    adn: 'arrowdown',
    lup: 'label_up',
    ldn: 'label_down',
    llf: 'label_left',
    lrg: 'label_right',
    llwlf: 'label_lower_left',
    llwrg: 'label_lower_right',
    luplf: 'label_upper_left',
    luprg: 'label_upper_right',
    lcn: 'label_center',
    sq: 'square',
    dia: 'diamond',
  } as Record<string, LabelStyleValue>,
  lineStyle: {
    sol: 'solid',
    dot: 'dotted',
    dsh: 'dashed',
    al: 'arrow_left',
    ar: 'arrow_right',
    ab: 'arrow_both',
  } as Record<string, LineStyleValue>,
  boxStyle: {
    sol: 'solid',
    dot: 'dotted',
    dsh: 'dashed',
  } as Record<string, BoxStyleValue>,
};

type RawDrawing = Record<string, any>;

function drawingValues(rawGraphic: Record<string, unknown>, key: string): RawDrawing[] {
  return Object.values((rawGraphic[key] ?? {}) as Record<string, RawDrawing>);
}

export default function graphicParse(
  rawGraphic: Record<string, unknown> = {},
  indexes: number[] = [],
): GraphicData {
  return {
    labels: drawingValues(rawGraphic, 'dwglabels').map((label) => ({
      id: label.id,
      x: indexes[label.x],
      y: label.y,
      yLoc: TRANSLATOR.yLoc[label.yl] ?? label.yl,
      text: label.t,
      style: TRANSLATOR.labelStyle[label.st] ?? label.st,
      color: label.ci,
      textColor: label.tci,
      size: label.sz,
      textAlign: label.ta,
      toolTip: label.tt,
    })),

    lines: drawingValues(rawGraphic, 'dwglines').map((line) => ({
      id: line.id,
      x1: indexes[line.x1],
      y1: line.y1,
      x2: indexes[line.x2],
      y2: line.y2,
      extend: TRANSLATOR.extend[line.ex] ?? line.ex,
      style: TRANSLATOR.lineStyle[line.st] ?? line.st,
      color: line.ci,
      width: line.w,
    })),

    boxes: drawingValues(rawGraphic, 'dwgboxes').map((box) => ({
      id: box.id,
      x1: indexes[box.x1],
      y1: box.y1,
      x2: indexes[box.x2],
      y2: box.y2,
      color: box.c,
      bgColor: box.bc,
      extend: TRANSLATOR.extend[box.ex] ?? box.ex,
      style: TRANSLATOR.boxStyle[box.st] ?? box.st,
      width: box.w,
      text: box.t,
      textSize: box.ts,
      textColor: box.tc,
      textVAlign: box.tva,
      textHAlign: box.tha,
      textWrap: box.tw,
    })),

    tables: drawingValues(rawGraphic, 'dwgtables').map((table) => ({
      id: table.id,
      position: table.pos,
      rows: table.rows,
      columns: table.cols,
      bgColor: table.bgc,
      frameColor: table.frmc,
      frameWidth: table.frmw,
      borderColor: table.brdc,
      borderWidth: table.brdw,
      cells: () => {
        const matrix: TableCell[][] = [];
        drawingValues(rawGraphic, 'dwgtablecells').forEach((cell) => {
          if (cell.tid !== table.id) return;
          if (!matrix[cell.row]) matrix[cell.row] = [];
          matrix[cell.row][cell.col] = {
            id: cell.id,
            text: cell.t,
            width: cell.w,
            height: cell.h,
            textColor: cell.tc,
            textHAlign: cell.tha,
            textVAlign: cell.tva,
            textSize: cell.ts,
            bgColor: cell.bgc,
          };
        });
        return matrix;
      },
    })),

    horizLines: drawingValues(rawGraphic, 'horizlines').map((line) => ({
      ...line,
      startIndex: indexes[line.startIndex],
      endIndex: indexes[line.endIndex],
    })) as GraphicHorizline[],

    polygons: drawingValues(rawGraphic, 'polygons').map((polygon) => ({
      ...polygon,
      points: polygon.points.map((point: RawDrawing) => ({
        ...point,
        index: indexes[point.index],
      })),
    })) as GraphicPolygon[],

    horizHists: drawingValues(rawGraphic, 'hhists').map((histogram) => ({
      ...histogram,
      firstBarTime: indexes[histogram.firstBarTime],
      lastBarTime: indexes[histogram.lastBarTime],
    })) as GraphicHorizHist[],

    raw: () => rawGraphic,
  };
}
