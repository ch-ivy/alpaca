export interface GetBarParam {
  symbol: string;
  timeframe: string;
  limit?: string;
  start?: string;
  end?: string;
  currency?: string;
  asof?: string;
  page_token?: string;
  feed?: string;
  adjustment?: string;
}

export const expectedDataFormat = {
  bars: [
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
    {
      t: '2022-04-11T08:00:00Z',
      o: 168.99,
      h: 169.81,
      l: 168.99,
      c: 169,
      v: 7170,
      n: 206,
      vw: 169.233976,
    },
  ],
  symbol: 'AAPL',
  next_page_token: 'QUFQTHxNfDIwMjItMDQtMTFUMDg6MDA6MDAuMDAwMDAwMDAwWg==',
};
