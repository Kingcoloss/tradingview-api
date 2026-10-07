import type { StrategyReport } from '@mathieuc/tradingview';

let report!: StrategyReport;
const netProfit: number | undefined = report.performance.all?.netProfit;
const longTrades: number | undefined = report.performance.long?.totalTrades;
const { equity }: { equity?: number[] } = report.history;
const backtestFrom: number | undefined = report.settings?.dateRange?.backtest?.from;
void [netProfit, longTrades, equity, backtestFrom, report.trades[0]?.profit];
