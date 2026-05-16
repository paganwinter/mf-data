const fs = require('fs');
const { execSync, exec } = require('child_process')

const utils = require('./utils');
const { parseArguments, isoDateToAMFI, getMonthRanges, parseAMFIData, filterFund } = utils;


const AMFI_RAW_DATA_DIR = './amfi-data-raw'
const AMFI_PARSED_DATA_DIR = './data/amfi-data-parsed'
const NAVS_DATA_DIR = './data/navs-test'


async function downloadAndParse(fromDateStr, toDateStr, dryRun = false) {
  const monthRanges = getMonthRanges(fromDateStr, toDateStr)
  console.log('monthRanges:', monthRanges)

  monthRanges.forEach(([monthStart, monthEnd], i) => {
    const monthStr = monthStart.split('-').slice(0, 2).join('-')
    const rawFileName = `nav_history_${monthStr}.txt`
    const parsedFileName = `nav_history_${monthStr}.json`
    console.log(i + 1, '/', monthRanges.length, `Month: ${monthStr} [${monthStart} - ${monthEnd}]`)


    // DOWNLOAD
    // all (open ended and close ended)
    // const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=${isoDateToAMFI(monthStart)}&todt=${isoDateToAMFI(monthEnd)}`
    // open ended only
    const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt=${isoDateToAMFI(monthStart)}&todt=${isoDateToAMFI(monthEnd)}`
    console.log(`  Downloading: ${url}`)
    execSync(`curl -o ${AMFI_RAW_DATA_DIR}/${rawFileName} "${url}"`, { stdio: 'inherit' })
    console.log('')


    // PARSE
    console.log(`  Parsing: ${rawFileName} => ${parsedFileName}`)
    let rawAMFIData = fs.readFileSync(`${AMFI_RAW_DATA_DIR}/${rawFileName}`, 'utf-8');
    let parsedData = parseAMFIData(rawAMFIData);
    if (!parsedData?.funds?.length) {
      console.log(parsedData)
      console.log('  !! Failed to parse file', rawFileName)
      // throw new Error('Failed to parse file')
      return
    }
    if (!dryRun) {
      fs.writeFileSync(`${AMFI_PARSED_DATA_DIR}/${parsedFileName}`, JSON.stringify({
        month: monthStr,
        fundsCount: parsedData.funds.length,
        funds: parsedData.funds,
      }))
    }

    console.log('')
    console.log('-----')
    console.log('')
  })
}

// async function downloadNAVs(fromDateStr, toDateStr, dryRun = false) {
//   console.log('')
//   console.log('DOWNLOADING...')

//   const ranges = getMonthRanges(fromDateStr, toDateStr)
//   console.log('ranges:', ranges)

//   console.time('Downloaded in')
//   fs.mkdirSync(AMFI_RAW_DATA_DIR, { recursive: true })
//   ranges.map(([monthStart, monthEnd]) => {
//     console.log('RANGE:', [monthStart, monthEnd])

//     const monthStr = monthStart.split('-').slice(0, 2).join('-')
//     // const rawFileName = `nav_history_${monthStart}_${monthEnd}.txt`
//     const rawFileName = `nav_history_${monthStr}.txt`

//     // all (open ended and close ended)
//     // const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=${isoDateToAMFI(monthStart)}&todt=${isoDateToAMFI(monthEnd)}`
//     // open ended only
//     const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt=${isoDateToAMFI(monthStart)}&todt=${isoDateToAMFI(monthEnd)}`
//     console.log(`Downloading NAVs from ${monthStart} to ${monthEnd}: ${url}`)
//     execSync(`curl -o ${AMFI_RAW_DATA_DIR}/${rawFileName} "${url}"`, { stdio: 'inherit' })
//     console.log('')
//     console.log('')
//   })
//   console.log('')
//   console.timeEnd('Downloaded in')
//   console.log('=====')
//   console.log('')
// }
// function parseNAVs(fromDateStr, toDateStr, dryRun = false) {
//   console.log('')
//   console.log('PARSING...')

//   const ranges = getMonthRanges(fromDateStr, toDateStr)
//   console.log('ranges:', ranges)

//   console.time('Parsed in')
//   fs.mkdirSync(AMFI_PARSED_DATA_DIR, { recursive: true })
//   for (let i = 0, len = ranges.length; i < len; i++) {
//     const [monthStart, monthEnd] = ranges[i]
//     console.log('RANGE:', [monthStart, monthEnd])

//     const monthStr = monthStart.split('-').slice(0, 2).join('-')
//     // const rawFileName = `nav_history_${monthStart}_${monthEnd}.txt`
//     const rawFileName = `nav_history_${monthStr}.txt`
//     const parsedFileName = `nav_history_${monthStr}.json`

//     console.log(i + 1, '/', len, 'Parsing file:', rawFileName)
//     console.time('  Parsed file in')

//     let rawAMFIData = fs.readFileSync(`${AMFI_RAW_DATA_DIR}/${rawFileName}`, 'utf-8');
//     let parsedData = parseAMFIData(rawAMFIData);
//     if (!parsedData?.funds?.length) {
//       console.log(parsedData)
//       console.log('  !! Failed to parse file', rawFileName)
//       // throw new Error('Failed to parse file')
//       return
//     }
//     if (!dryRun) {
//       fs.writeFileSync(`${AMFI_PARSED_DATA_DIR}/${parsedFileName}`, JSON.stringify({
//         month: monthStr,
//         fundsCount: parsedData.funds.length,
//         funds: parsedData.funds,
//       }))
//     }

//     console.timeEnd('  Parsed file in')
//     console.log('')
//   }
//   console.log('')
//   console.timeEnd('Parsed in')

//   console.log('=====')
//   console.log('')
// }



function getNavStatsBasic(navsMap) {
  // sort from latest to oldest
  const navsSorted = Object.entries(navsMap).map(([date, nav]) => ({ date, nav })).sort((a, b) => b.date.localeCompare(a.date))
  const navCount = navsSorted.length
  const navOldestDate = navsSorted[navsSorted.length - 1].date
  const navLatestDate = navsSorted[0].date
  const navOldest = navsSorted[navsSorted.length - 1].nav
  const navLatest = navsSorted[0].nav
  return { navsSorted, navCount, navOldestDate, navLatestDate, navOldest, navLatest }
}


function processNAVs(fromDateStr, toDateStr, dryRun = false) {
  console.log('')
  console.log('PROCESSING NAVS...')

  const ranges = getMonthRanges(fromDateStr, toDateStr)
  console.log('ranges:', ranges)

  fs.mkdirSync(NAVS_DATA_DIR, { recursive: true })

  console.time('Processed NAVs in')


  const fundsMap = {}

  console.time('Processed NAV files in')
  for (let i = 0, len = ranges.length; i < len; i++) {
    const [monthStart, monthEnd] = ranges[i]
    console.log('RANGE:', [monthStart, monthEnd])

    const monthStr = monthStart.split('-').slice(0, 2).join('-')
    const parsedFileName = `nav_history_${monthStr}.json`

    console.log(i + 1, '/', len, 'Processing NAV File:', parsedFileName);
    console.time(`  Processed file in`)

    let parsedData = JSON.parse(fs.readFileSync(`${AMFI_PARSED_DATA_DIR}/${parsedFileName}`, 'utf-8'));
    const fundsOfInterest = parsedData.funds.filter(fund => (filterFund(fund.info)))
    console.log('  Funds:', fundsOfInterest.length, '/', parsedData.funds?.length)

    fundsOfInterest.forEach((fund, i) => {
      const fundInfo = fund.info
      if (!fundsMap[fundInfo.schemeCode]) {
        fundsMap[fundInfo.schemeCode] = {
          info: {
            ...fundInfo,
            navCount: 0,
            navOldestDate: '',
            navLatestDate: '',
            navOldest: 0,
            navLatest: 0,
          },
          navs: {},
        }
      }
      fundsMap[fundInfo.schemeCode].navs = { ...fundsMap[fundInfo.schemeCode].navs, ...fund.navs }
      // if (process.stdout.isTTY) process.stdout.write(`\r  Processed ${i+1} / ${fundsOfInterest.length}`);
    })

    console.timeEnd(`  Processed file in`)
    console.log('-----')
    console.log('')
  }
  console.timeEnd('Processed NAV files in')
  console.log('Funds: ', Object.keys(fundsMap).length)



  console.log('Updating fund NAV files')
  console.time('  Updated fund NAV files in')
  Object.entries(fundsMap).forEach(([schemeCode, fund], i) => {
    const fundFile = `${NAVS_DATA_DIR}/${schemeCode}.json`

    let fundData
    if (!fs.existsSync(fundFile)) {
      fundData = { ...fund }
    } else {
      // fundData = require(`../${fundFile}`)
      fundData = JSON.parse(fs.readFileSync(fundFile, 'utf-8'))
      fundData.navs = { ...fundData.navs, ...fund.navs }
    }

    const { navsSorted, navCount, navOldestDate, navLatestDate, navOldest, navLatest } = getNavStatsBasic(fundData.navs)

    fundData.navs = Object.fromEntries(navsSorted.map(({ date, nav }) => [date, nav]))
    fundData.info = {
      ...fundData.info,
      navCount,
      navOldestDate,
      navLatestDate,
      navOldest,
      navLatest,
    }
    if (!dryRun) {
      fs.writeFileSync(fundFile, JSON.stringify(fundData))
    }
    if (process.stdout.isTTY) process.stdout.write(`\r  Updated ${i + 1} / ${Object.keys(fundsMap).length}`);
  })
  console.log('')
  console.timeEnd('  Updated fund NAV files in')

  console.timeEnd('Processed NAVs in')

  console.log('=====')
  console.log('')
}





function updateStats() {
  console.log('Updating fund stats')
  const historyFiles = fs.readdirSync(AMFI_PARSED_DATA_DIR).filter(f => f.endsWith('.json'))
  console.log('NAV History files:', historyFiles.length)

  console.time('Loaded funds info in')
  let fundsMap = {}
  for (let i = 0, len = historyFiles.length; i < len; i++) {
    const file = historyFiles[i]
    const data = JSON.parse(fs.readFileSync(`${AMFI_PARSED_DATA_DIR}/${file}`, 'utf-8'))
    console.log(i + 1, '/', historyFiles.length, `loaded ${file}`, data.funds.length, 'funds')

    data.funds.forEach(fund => {
      const fundInfo = fund.info
      const { schemeCode } = fundInfo
      const { navCount, navOldestDate, navLatestDate, navOldest, navLatest } = getNavStatsBasic(fund.navs)
      if (!fundsMap[schemeCode]) {
        fundsMap[schemeCode] = {
          ...fundInfo,
          navCount,
          navOldestDate,
          navLatestDate,
          navOldest,
          navLatest,
        }
      } else {
        // fundsMap[schemeCode].navs = { ...fundsMap[schemeCode].navs, ...fund.navs }
        const existingFundInfo = fundsMap[schemeCode]
        fundsMap[schemeCode] = {
          ...existingFundInfo,
          navCount: existingFundInfo.navCount + navCount,
          navOldestDate: (new Date(navOldestDate) < new Date(existingFundInfo.navOldestDate)) ? navOldestDate : existingFundInfo.navOldestDate,
          navLatestDate: (new Date(navLatestDate) > new Date(existingFundInfo.navLatestDate)) ? navLatestDate : existingFundInfo.navLatestDate,
          navOldest: (navOldest < existingFundInfo.navOldest) ? navOldest : existingFundInfo.navOldest,
          navLatest: (navLatest > existingFundInfo.navLatest) ? navLatest : existingFundInfo.navLatest,
        }
      }
    })
  }
  // for loop
  // console.log(fundsMap)
  console.timeEnd('Loaded funds info in')


  console.log('Updating funds list')
  console.time('Updated funds list in')
  const allFunds = Object.values(fundsMap)
  fs.writeFileSync('./data/funds-all.json', JSON.stringify({
    fundsCount: allFunds.length,
    amcs: Array.from(new Set(allFunds.map(f => f.amc))).sort(),
    categories: Array.from(new Set(allFunds.map(f => f.category))).sort(),
    categoriesRaw: Array.from(new Set(allFunds.map(f => f.categoryRaw))).sort(),
    funds: allFunds,
  }));
  let allFundsCsv = Object.keys(allFunds[0]).join(',') + '\n'
  allFundsCsv += allFunds.map(fund => { return Object.values(fund).map(i => `"${i}"`).join(',') }).join('\n')
  fs.writeFileSync('./data/funds-all.csv', allFundsCsv)


  // filtered funds
  const filteredFunds = allFunds.filter(fund => filterFund(fund))
  fs.writeFileSync('./data/funds-filtered.json', JSON.stringify({
    fundsCount: filteredFunds.length,
    amcs: Array.from(new Set(filteredFunds.map(f => f.amc))).sort(),
    categories: Array.from(new Set(filteredFunds.map(f => f.category))).sort(),
    categoriesRaw: Array.from(new Set(filteredFunds.map(f => f.categoryRaw))).sort(),
    funds: filteredFunds,
  }));
  let filteredFundsCsv = Object.keys(filteredFunds[0]).join(',') + '\n'
  filteredFundsCsv += filteredFunds.map(fund => { return Object.values(fund).map(i => `"${i}"`).join(',') }).join('\n')
  fs.writeFileSync('./data/funds-filtered.csv', filteredFundsCsv)
  console.timeEnd('Updated funds list in')
}





async function main() {
  // USAGE:
  // for current month
  // node scripts/update-navs.js process
  // node scripts/update-navs.js parse
  // node scripts/update-navs.js process

  // for custom range
  // node scripts/update-navs.js process --from-date=2024-01-01 --to-date=2024-12-31
  // node scripts/update-navs.js parse --from-date=2024-01-01 --to-date=2024-12-31
  // node scripts/update-navs.js process --from-date=2024-01-01 --to-date=2024-12-31

  let { command, options: { fromDate, toDate, dryRun } } = parseArguments()

  // if start and end not specified, use start and end of current month
  if (!fromDate) {
    // 1st of current month
    fromDate = new Date().toISOString().split('-').slice(0, 2).join('-') + '-01'
  }
  if (!toDate) {
    // last day of current month
    toDate = new Date()
    const lastDay = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate();
    toDate = toDate.toISOString().split('-').slice(0, 2).join('-') + '-' + `${lastDay}`.padStart(2, '0')
  }
  if (new Date(fromDate) > new Date(toDate)) throw new Error(`'from' date (${fromDate}) must be before 'to' date (${toDate})`);
  dryRun = dryRun === true || dryRun === 'true'

  console.log({command, fromDate, toDate, dryRun})
  console.log('')


  switch(command) {
    case 'download-parse': {
      await downloadAndParse(fromDate, toDate, dryRun)
      break;
    }
    // case 'download': {
    //   await downloadNAVs(fromDate, toDate, dryRun)
    //   break;
    // }
    // case 'parse': {
    //   parseNAVs(fromDate, toDate, dryRun)
    //   break;
    // }
    case 'process': {
      processNAVs(fromDate, toDate, dryRun);
      break;
    }
    case 'stats': {
      updateStats();
      break;
    }
    case 'update': {
      await downloadNAVs(fromDate, toDate, dryRun)
      parseNAVs(fromDate, toDate, dryRun)
      // processNAVsV1(fromDate, toDate, dryRun)
      processNAVs(fromDate, toDate, dryRun);
      break;
    }
    default: {
      console.log(`Invalid command ${command}. Use one of: download, parse, process, update`)
      process.exit(1)
    }
  }
}

if (require.main === module) {
  main()
} else {
  // export functions for testing
}
