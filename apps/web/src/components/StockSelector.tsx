interface StockSelectorProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
}

export const starterStocks = [
  { symbol: "005930", name: "삼성전자", aliases: ["삼성전자", "삼전", "삼성"] },
  { symbol: "000660", name: "SK하이닉스", aliases: ["sk하이닉스", "하이닉스", "에스케이하이닉스"] },
  { symbol: "035420", name: "NAVER", aliases: ["naver", "네이버"] },
  { symbol: "122630", name: "KODEX 레버리지", aliases: ["kodex레버리지", "코덱스레버리지", "코덱스"] },
  { symbol: "041190", name: "우리기술투자", aliases: ["우리기술투자", "우리기술", "우기투"] },
  { symbol: "AAPL", name: "Apple", aliases: ["apple", "애플"] },
  { symbol: "MSFT", name: "Microsoft", aliases: ["microsoft", "마이크로소프트"] },
  { symbol: "NVDA", name: "NVIDIA", aliases: ["nvidia", "엔비디아"] },
  { symbol: "TSLA", name: "Tesla", aliases: ["tesla", "테슬라"] },
  { symbol: "MOCK_SURGE", name: "급등주 Mock", aliases: ["급등주", "mock", "목업", "모의급등주"] }
];

export const isSupportedSymbol = (symbol: string): boolean =>
  starterStocks.some((stock) => stock.symbol === symbol);

export const getStockName = (symbol: string): string =>
  starterStocks.find((stock) => stock.symbol === symbol)?.name ?? symbol;

export const findStockByUtterance = (utterance: string): { symbol: string; name: string } | null => {
  const normalized = utterance.toLowerCase().replace(/\s+/g, "");
  const stock = starterStocks.find((candidate) =>
    candidate.aliases.some((alias) => normalized.includes(alias.toLowerCase().replace(/\s+/g, "")))
  );

  return stock ? { symbol: stock.symbol, name: stock.name } : null;
};

export const StockSelector = ({ symbol, onSymbolChange }: StockSelectorProps) => (
  <section className="panel stock-selector" aria-labelledby="stock-selector-title">
    <div className="panel-heading">
      <span className="panel-kicker">Step 01</span>
      <h2 id="stock-selector-title">관심 종목 선택</h2>
    </div>
    <label htmlFor="stock-symbol">실시간으로 들을 종목</label>
    <select id="stock-symbol" value={symbol} onChange={(event) => onSymbolChange(event.target.value)}>
      {starterStocks.map((stock) => (
        <option key={stock.symbol} value={stock.symbol}>
          {stock.name} {stock.symbol}
        </option>
      ))}
    </select>
  </section>
);
