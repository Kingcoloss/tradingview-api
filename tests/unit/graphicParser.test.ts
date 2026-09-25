import { describe, it, expect } from '../utils';
import graphicParse from '../../src/chart/graphicParser';

describe('graphicParser', () => {
  it('maps every graphic family and translator', () => {
    const raw = {
      dwglabels: {
        L1: {
          id: 1,
          x: 0,
          y: 10,
          yl: 'ab',
          t: 'hi',
          st: 'flg',
          ci: 11,
          tci: 12,
          sz: 'sm',
          ta: 'r',
          tt: 'tip',
        },
      },
      dwglines: {
        L2: {
          id: 2, x1: 0, y1: 20, x2: 1, y2: 21, ex: 'b', st: 'ar', ci: 13, w: 2,
        },
      },
      dwgboxes: {
        B1: {
          id: 3,
          x1: 0,
          y1: 30,
          x2: 1,
          y2: 31,
          c: 14,
          bc: 15,
          ex: 'l',
          st: 'dot',
          w: 3,
          t: 'box',
          ts: 'sm',
          tc: 16,
          tva: 'top',
          tha: 'left',
          tw: 'auto',
        },
      },
      dwgtables: {
        T1: {
          id: 4,
          pos: 'top_left',
          rows: 1,
          cols: 1,
          bgc: 17,
          frmc: 18,
          frmw: 4,
          brdc: 19,
          brdw: 5,
        },
      },
      dwgtablecells: {
        C1: {
          tid: 4,
          row: 0,
          col: 0,
          id: 5,
          t: 'cell',
          w: 6,
          h: 7,
          tc: 20,
          tha: 'center',
          tva: 'bottom',
          ts: 'tiny',
          bgc: 21,
        },
      },
      horizlines: {
        H1: {
          id: 6, level: 40, startIndex: 0, endIndex: 1, extendRight: true, extendLeft: false,
        },
      },
      polygons: {
        P1: { id: 7, points: [{ index: 1, level: 50 }] },
      },
      hhists: {
        HH1: {
          id: 8, priceLow: 60, priceHigh: 61, firstBarTime: 0, lastBarTime: 1, rate: [1, 2],
        },
      },
    };

    const out = graphicParse(raw, [1234, 5678]);

    expect(out.labels[0]).toEqual({
      id: 1,
      x: 1234,
      y: 10,
      yLoc: 'abovebar',
      text: 'hi',
      style: 'flag',
      color: 11,
      textColor: 12,
      size: 'sm',
      textAlign: 'r',
      toolTip: 'tip',
    });
    expect(out.lines[0]).toEqual({
      id: 2,
      x1: 1234,
      y1: 20,
      x2: 5678,
      y2: 21,
      extend: 'both',
      style: 'arrow_right',
      color: 13,
      width: 2,
    });
    expect(out.boxes[0]).toEqual({
      id: 3,
      x1: 1234,
      y1: 30,
      x2: 5678,
      y2: 31,
      color: 14,
      bgColor: 15,
      extend: 'left',
      style: 'dotted',
      width: 3,
      text: 'box',
      textSize: 'sm',
      textColor: 16,
      textVAlign: 'top',
      textHAlign: 'left',
      textWrap: 'auto',
    });
    expect(out.tables[0]).toMatchObject({
      id: 4,
      position: 'top_left',
      rows: 1,
      columns: 1,
      bgColor: 17,
      frameColor: 18,
      frameWidth: 4,
      borderColor: 19,
      borderWidth: 5,
    });
    expect(out.tables[0].cells()).toEqual([[{
      id: 5,
      text: 'cell',
      width: 6,
      height: 7,
      textColor: 20,
      textHAlign: 'center',
      textVAlign: 'bottom',
      textSize: 'tiny',
      bgColor: 21,
    }]]);
    expect(out.horizLines[0]).toEqual({
      id: 6,
      level: 40,
      startIndex: 1234,
      endIndex: 5678,
      extendRight: true,
      extendLeft: false,
    });
    expect(out.polygons[0]).toEqual({ id: 7, points: [{ index: 5678, level: 50 }] });
    expect(out.horizHists[0]).toEqual({
      id: 8,
      priceLow: 60,
      priceHigh: 61,
      firstBarTime: 1234,
      lastBarTime: 5678,
      rate: [1, 2],
    });
    expect(out.raw()).toBe(raw);
  });

  it('maps every translator code and preserves unknown codes', () => {
    const yLoc = { pr: 'price', ab: 'abovebar', bl: 'belowbar' };
    const labelStyle = {
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
    };
    const extend = {
      r: 'right', l: 'left', b: 'both', n: 'none',
    };
    const lineStyle = {
      sol: 'solid',
      dot: 'dotted',
      dsh: 'dashed',
      al: 'arrow_left',
      ar: 'arrow_right',
      ab: 'arrow_both',
    };
    const boxStyle = { sol: 'solid', dot: 'dotted', dsh: 'dashed' };

    const raw = {
      dwglabels: Object.fromEntries(Object.entries(labelStyle).map(([code], id) => [code, {
        id, x: 0, y: 1, yl: Object.keys(yLoc)[id % 3], st: code,
      }])),
      dwglines: Object.fromEntries(Object.entries(lineStyle).map(([code], id) => [code, {
        id, x1: 0, y1: 1, x2: 0, y2: 2, ex: Object.keys(extend)[id % 4], st: code,
      }])),
      dwgboxes: Object.fromEntries(Object.entries(boxStyle).map(([code], id) => [code, {
        id, x1: 0, y1: 1, x2: 0, y2: 2, ex: Object.keys(extend)[id % 4], st: code,
      }])),
    };
    raw.dwglabels.unknown = {
      id: 99, x: 0, y: 1, yl: 'custom-y', st: 'custom-style',
    };

    const out = graphicParse(raw, [1234]);
    expect(out.labels.slice(0, -1).map(({ yLoc: value }) => value))
      .toEqual(Object.values(yLoc).concat(Object.values(yLoc), Object.values(yLoc),
        Object.values(yLoc), Object.values(yLoc), Object.values(yLoc), ['price', 'abovebar']));
    expect(out.labels.slice(0, -1).map(({ style }) => style)).toEqual(Object.values(labelStyle));
    expect(out.labels.at(-1)).toMatchObject({ yLoc: 'custom-y', style: 'custom-style' });
    expect(out.lines.map(({ extend: value }) => value))
      .toEqual(['right', 'left', 'both', 'none', 'right', 'left']);
    expect(out.lines.map(({ style }) => style)).toEqual(Object.values(lineStyle));
    expect(out.boxes.map(({ style }) => style)).toEqual(Object.values(boxStyle));
  });

  it('returns empty graphic lists by default', () => {
    const out = graphicParse();
    expect([
      out.labels, out.lines, out.boxes, out.tables,
      out.horizLines, out.polygons, out.horizHists,
    ]).toEqual([[], [], [], [], [], [], []]);
  });
});
