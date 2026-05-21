# Mutual Fund Data

Downloads, parses, and stores NAV daily from [AMFI](https://www.amfiindia.com/net-asset-value/nav-download).

### Funds List

- All Funds - https://paganwinter.github.io/mf-data/data/funds-all.json
- Open ended Growth Funds - https://paganwinter.github.io/mf-data/data/funds-filtered.json

### Fund NAVs

- https://paganwinter.github.io/mf-data/data/navs/{AMFI-code}.json

---

## TODO

### Index Info

- https://www.nseindia.com/resources/historical-reports-capital-market-daily-monthly-archives
  - TRI: https://www.niftyindices.com/reports/historical-data
  - INDEX: https://www.nseindia.com/reports-indices-historical-index-data
    - https://www.nseindia.com/api/equity-masterOR
    - https://www.nseindia.com/api/historicalOR/indicesHistory?indexType=NIFTY%2050&from=01-06-2025&to=15-05-2026
- https://www.nseindia.com/all-reports
- https://www.nseindia.com/reports-indices-historical-vix

### Fund Info

- https://groww.in/v1/api/data/mf/web/v4/scheme/search/mirae-asset-large-midcap-fund-direct-growth
- https://groww.in/v1/api/data/mf/web/v5/scheme/search/mirae-asset-large-midcap-fund-direct-growth
- https://groww.in/v1/api/data/mf/web/v1/scheme/portfolio/${schemeCode}/stats
  - https://groww.in/v1/api/data/mf/web/v1/scheme/portfolio/118834/stats


### Propsed Structure

```
/funds/funds-all.json
/funds/funds-filtered.json
/funds/nav/{fund-id}.json

/index/{index}.json
```
