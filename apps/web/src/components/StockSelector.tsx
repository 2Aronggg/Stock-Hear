interface StockSelectorProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
}

export const starterStocks = [
  { symbol: "005930", name: "삼성전자", aliases: ["삼성전자", "삼전", "삼성"] },
  { symbol: "000660", name: "SK하이닉스", aliases: ["sk하이닉스", "하이닉스", "에스케이하이닉스"] },
  { symbol: "373220", name: "LG에너지솔루션", aliases: ["lg에너지솔루션", "엘지에너지솔루션", "엔솔"] },
  { symbol: "207940", name: "삼성바이오로직스", aliases: ["삼성바이오로직스", "삼바", "삼성바이오"] },
  { symbol: "005380", name: "현대차", aliases: ["현대차", "현대자동차"] },
  { symbol: "000270", name: "기아", aliases: ["기아", "kia"] },
  { symbol: "068270", name: "셀트리온", aliases: ["셀트리온"] },
  { symbol: "105560", name: "KB금융", aliases: ["kb금융", "케이비금융"] },
  { symbol: "035420", name: "NAVER", aliases: ["naver", "네이버"] },
  { symbol: "035720", name: "카카오", aliases: ["카카오", "kakao"] },
  { symbol: "005490", name: "POSCO홀딩스", aliases: ["posco홀딩스", "포스코홀딩스", "포스코"] },
  { symbol: "051910", name: "LG화학", aliases: ["lg화학", "엘지화학"] },
  { symbol: "006400", name: "삼성SDI", aliases: ["삼성sdi", "삼성에스디아이"] },
  { symbol: "012330", name: "현대모비스", aliases: ["현대모비스"] },
  { symbol: "055550", name: "신한지주", aliases: ["신한지주", "신한금융"] },
  { symbol: "086790", name: "하나금융지주", aliases: ["하나금융지주", "하나금융"] },
  { symbol: "028260", name: "삼성물산", aliases: ["삼성물산"] },
  { symbol: "096770", name: "SK이노베이션", aliases: ["sk이노베이션", "에스케이이노베이션"] },
  { symbol: "066570", name: "LG전자", aliases: ["lg전자", "엘지전자"] },
  { symbol: "323410", name: "카카오뱅크", aliases: ["카카오뱅크", "카뱅"] },
  { symbol: "034020", name: "두산에너빌리티", aliases: ["두산에너빌리티", "두산중공업"] },
  { symbol: "003670", name: "포스코퓨처엠", aliases: ["포스코퓨처엠", "포스코케미칼"] },
  { symbol: "009150", name: "삼성전기", aliases: ["삼성전기"] },
  { symbol: "017670", name: "SK텔레콤", aliases: ["sk텔레콤", "에스케이텔레콤"] },
  { symbol: "030200", name: "KT", aliases: ["kt", "케이티"] },
  { symbol: "259960", name: "크래프톤", aliases: ["크래프톤", "krafton"] },
  { symbol: "352820", name: "하이브", aliases: ["하이브", "hybe"] },
  { symbol: "042660", name: "한화오션", aliases: ["한화오션", "대우조선해양"] },
  { symbol: "010140", name: "삼성중공업", aliases: ["삼성중공업"] },
  { symbol: "011200", name: "HMM", aliases: ["hmm", "에이치엠엠"] },
  { symbol: "122630", name: "KODEX 레버리지", aliases: ["kodex레버리지", "코덱스레버리지", "코덱스"] },
  { symbol: "041190", name: "우리기술투자", aliases: ["우리기술투자", "우리기술", "우기투"] },
  { symbol: "AAPL", name: "Apple", aliases: ["apple", "애플"] },
  { symbol: "MSFT", name: "Microsoft", aliases: ["microsoft", "마이크로소프트"] },
  { symbol: "NVDA", name: "NVIDIA", aliases: ["nvidia", "엔비디아"] },
  { symbol: "TSLA", name: "Tesla", aliases: ["tesla", "테슬라"] },
  { symbol: "GOOGL", name: "Alphabet", aliases: ["alphabet", "google", "구글", "알파벳"] },
  { symbol: "AMZN", name: "Amazon", aliases: ["amazon", "아마존"] },
  { symbol: "META", name: "Meta", aliases: ["meta", "메타", "페이스북"] },
  { symbol: "NFLX", name: "Netflix", aliases: ["netflix", "넷플릭스"] },
  { symbol: "AMD", name: "AMD", aliases: ["amd", "에이엠디"] },
  { symbol: "INTC", name: "Intel", aliases: ["intel", "인텔"] },
  { symbol: "AVGO", name: "Broadcom", aliases: ["broadcom", "브로드컴"] },
  { symbol: "QCOM", name: "Qualcomm", aliases: ["qualcomm", "퀄컴"] },
  { symbol: "ADBE", name: "Adobe", aliases: ["adobe", "어도비"] },
  { symbol: "COST", name: "Costco", aliases: ["costco", "코스트코"] },
  { symbol: "PEP", name: "PepsiCo", aliases: ["pepsico", "pepsi", "펩시"] },
  { symbol: "SBUX", name: "Starbucks", aliases: ["starbucks", "스타벅스"] },
  { symbol: "CSCO", name: "Cisco", aliases: ["cisco", "시스코"] },
  { symbol: "TXN", name: "Texas Instruments", aliases: ["texas instruments", "텍사스인스트루먼트"] },
  { symbol: "PYPL", name: "PayPal", aliases: ["paypal", "페이팔"] },
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
