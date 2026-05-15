# Mutual Fund Data

Downloads, parses, and stores NAV daily from [AMFI](https://www.amfiindia.com/net-asset-value/nav-download).

### Funds List

- All Funds - https://paganwinter.github.io/mf-data/data/funds-all.json
- Open ended Growth Funds - https://paganwinter.github.io/mf-data/data/funds-filtered.json

### Fund NAVs

- https://paganwinter.github.io/mf-data/data/navs/{AMFI-code}.json

---

## TODO

### Index NAVs

- https://www.niftyindices.com/reports/historical-data
- https://www.nseindia.com/all-reports
  - https://www.nseindia.com/reports-indices-historical-vix


### Propsed Structure

```
/funds/funds-all.json
/funds/funds-filtered.json
/funds/nav/{fund-id}.json

/index/{index}.json
```
