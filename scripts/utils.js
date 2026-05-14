const MONTHS_MAP = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function amfiDateToISO(dateStr) {
  const [dd, mmm, yyyy] = dateStr.split('-')
  return `${yyyy}-${`${(MONTHS_MAP.indexOf(mmm) + 1)}`.padStart(2, '0')}-${dd}`
}

function isoDateToAMFI(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-')
  return `${dd}-${MONTHS_MAP[parseInt(mm, 10) - 1]}-${yyyy}`
}

function getMonthRanges(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) throw new Error(`Start date (${startDate}) must be before end date (${endDate})`);

  let current = new Date(`${startDate.split('-').slice(0, 2).join('-')}-01`);
  const ranges = []
  while (current <= end) {
    const isStartMonth = current.getFullYear() === start.getFullYear() && current.getMonth() === start.getMonth()
    const isEndMonth = current.getFullYear() === end.getFullYear() && current.getMonth() === end.getMonth()

    const currentMonthStr = current.toISOString().split('-').slice(0, 2).join('-')
    const firstDayOfMonth = isStartMonth ? start.getDate() : 1;
    const lastDayOfMonth = isEndMonth ? end.getDate() : new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const monthStart = `${currentMonthStr}-${`${firstDayOfMonth}`.padStart(2, '0')}`
    const monthEnd = `${currentMonthStr}-${`${lastDayOfMonth}`.padStart(2, '0')}`
    ranges.push([monthStart, monthEnd])

    current.setMonth(current.getMonth() + 1)
  }
  return ranges
}


function parseCategory(amfiCat) {
  let [, type, categoryFull] = amfiCat.match(/(.+?)\s+\(\s+(.+)\s+\)/)
  let [scheme, category] = categoryFull.split(' - ')
  return {
    raw: amfiCat,
    type,
    categoryFull,
    scheme,
    category: category || scheme,
  }
}
function parseAMFIData(data) {
  let lines = data.split(/\r?\n/)
  if (!lines[0].startsWith('Scheme Code;')) return null

  const FUND_LINE_REGEX = /^\d+;/

  const fundsMap = {}
  let categoriesMap = {}
  let rawCategories = {}

  // below are set as and when those lines are encountered and used by subsequent funds
  let currentAMC
  let currentRawCategory
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i]

    // ignore empty lines
    if (line.match(/^\s*$/)) continue

    // SAMPLE lines
    // Open Ended Schemes ( Equity Scheme - Multi Cap Fund ) # <=== Category
    //
    //
    // Aditya Birla Sun Life Mutual Fund # <=== AMC
    // 148921;Aditya Birla Sun Life Multi-Cap Fund-Direct Growth;INF209KB1Y49;;20.99;;;04-May-2026 # <=== Fund NAV
    // 148921;Aditya Birla Sun Life Multi-Cap Fund-Direct Growth;INF209KB1Y49;;21.;;;05-May-2026 # <=== Fund NAV

    if (lines[i + 1] === '' && lines[i + 2] === '' && FUND_LINE_REGEX.test(lines[i + 4])) {
      // Category name
      currentRawCategory = line
      categoriesMap[currentRawCategory] = parseCategory(currentRawCategory)
    } else if (!FUND_LINE_REGEX.test(lines[i]) && FUND_LINE_REGEX.test(lines[i + 1])) {
      // AMC name
      currentAMC = line
    } else if (FUND_LINE_REGEX.test(line)) {
      // Fund data
      let [amfiCode, schemeName, isinGrowth, isinDivReinvestment, nav, repurchasePrice, salePrice, date] = line.split(';')

      date = amfiDateToISO(date)
      nav = +nav

      const { type, categoryFull, scheme, category } = categoriesMap[currentRawCategory]

      // TODO
      // growth vs dividend
      // regular vs direct
      // let growth = !!name.match(/growth/i)

      if (!fundsMap[amfiCode]) {
        let fund = {
          info: {
            amc: currentAMC,
            amfiCode,
            schemeName,
            categoryRaw: currentRawCategory,
            type,
            categoryFull,
            scheme,
            category,
            isinGrowth: isinGrowth !== '-' ? isinGrowth : null,
            isinDivReinvestment: isinDivReinvestment !== '-' ? isinDivReinvestment : null,
          },
          navs: {},
          // navs: [],
        }
        fundsMap[amfiCode] = fund;
      }
      fundsMap[amfiCode].navs[date] = nav;
    } else {
      // console.log('unknown line')
    }
  }

  const funds = Object.values(fundsMap).sort((a, b) => a.info.schemeName.localeCompare(b.info.schemeName))
  return {
    funds,
    categories: Array.from(new Set(funds.map(f => f.info.category))),
    amcs: Array.from(new Set(funds.map(f => f.info.amc))),
    types: Array.from(new Set(funds.map(f => f.info.type))),
    schemes: Array.from(new Set(funds.map(f => f.info.scheme))),
    categoriesMap,
  }
}


function filterFund(fund) {
  if (!fund.info.categoryRaw.match(/Open Ended/i)) return false
  if (fund.info.schemeName.match(/(IDCW|Income Distribution Cum Capital Withdrawal|Dividend)/i)) return false
  if (fund.info.schemeName.match(/(regular plan)/i)) return false
  return true
  // if (!fund.isinGrowth || !fund.isinDivReinvestment) return false
}

module.exports = {
  isoDateToAMFI,
  getMonthRanges,
  parseAMFIData,
  filterFund,
}
