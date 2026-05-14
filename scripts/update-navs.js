const fs = require('fs');
const { execSync, exec } = require('child_process')
const { parseArgs } = require('node:util');

const utils = require('./utils');
const { isoDateToAMFI, getMonthRanges, parseAMFIData, filterFund } = utils;


const AMFI_RAW_DATA_DIR = './amfi-data-raw'
const AMFI_PARSED_DATA_DIR = './data/amfi-data-parsed'
const NAVS_DATA_DIR = './data/navs'

async function downloadNAVs(fromDateStr, toDateStr, dryRun = false) {
  console.log('')
  console.log('DOWNLOADING...')

  const ranges = getMonthRanges(fromDateStr, toDateStr)
  console.log('ranges:', ranges)

  console.time('Downloaded in')
  fs.mkdirSync(AMFI_RAW_DATA_DIR, { recursive: true })
  ranges.map(([fromDate, toDate]) => {
    console.log('RANGE:', [fromDate, toDate])

    const fileName = `nav_history_${fromDate}_${toDate}.txt`
    const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt=${isoDateToAMFI(fromDate)}&todt=${isoDateToAMFI(toDate)}`
    console.log(`Downloading NAVs from ${fromDate} to ${toDate}: ${url}`)
    // if (!dryRun) execSync(`curl -o ${AMFI_RAW_DATA_DIR}/${fileName} "${url}"`, { stdio: 'inherit' })
    execSync(`curl -o ${AMFI_RAW_DATA_DIR}/${fileName} "${url}"`, { stdio: 'inherit' })
    console.log('')
    console.log('')
  })
  console.log('')
  console.timeEnd('Downloaded in')
  console.log('=====')
  console.log('')
}



function parseNAVs(fromDateStr, toDateStr, dryRun = false) {
  console.log('')
  console.log('PARSING...')

  const ranges = getMonthRanges(fromDateStr, toDateStr)
  console.log('ranges:', ranges)

  console.time('Parsed in')
  fs.mkdirSync(AMFI_PARSED_DATA_DIR, { recursive: true })
  for (let i = 0, len = ranges.length; i < len; i++) {
    const [fromDate, toDate] = ranges[i]
    console.log('RANGE:', [fromDate, toDate])

    const fileName = `nav_history_${fromDate}_${toDate}.txt`
    console.time('  PARSE '+fileName)
    console.log(i+1, '/', len, 'Parsing file:', fileName)
    let rawAMFIData = fs.readFileSync(`${AMFI_RAW_DATA_DIR}/${fileName}`, 'utf-8');
    let parsedData = parseAMFIData(rawAMFIData);
    if (!parsedData) {
      console.log('  !! Failed to parse file')
      // throw new Error('Failed to parse file')
      return
    }
    if (!dryRun) {
      fs.writeFileSync(`${AMFI_PARSED_DATA_DIR}/nav_history_${fromDate}_${toDate}.json`, JSON.stringify(parsedData))
    }
    console.timeEnd('  PARSE '+fileName)
    console.log('')
  }
  console.log('')
  console.timeEnd('Parsed in')
  console.log('=====')
  console.log('')
}



function processNAVs(fromDateStr, toDateStr, dryRun = false) {
  console.log('')
  console.log('PROCESSING NAVS...')

  const ranges = getMonthRanges(fromDateStr, toDateStr)
  console.log('ranges:', ranges)

  fs.mkdirSync(NAVS_DATA_DIR, { recursive: true })

  const fundsMap = {}

  console.time('Processed NAVs in')
  for (let i = 0, len = ranges.length; i < len; i++) {
    const [fromDate, toDate] = ranges[i]
    console.log('RANGE:', [fromDate, toDate])

    const parsedFile = `nav_history_${fromDate}_${toDate}.json`
    console.time(`  Processed file in`)
    console.log(i+1, '/', len, 'Processing NAV File:', parsedFile);

    let parsedData = JSON.parse(fs.readFileSync(`${AMFI_PARSED_DATA_DIR}/${parsedFile}`, 'utf-8'));
    const fundsOfInterest = parsedData.funds.filter(filterFund)
    console.log('  Funds:', fundsOfInterest.length, '/', parsedData.funds?.length)

    fundsOfInterest.forEach((fund, i) => {
      if (!fundsMap[fund.info.amfiCode]) {
        fundsMap[fund.info.amfiCode] = {
          info: {
            ...fund.info,
            navCount: 0,
            navStartDate: '',
            navEndDate: '',
          },
          navs: {},
        }
      }
      Object.entries(fund.navs).forEach(([date, nav]) => {
        fundsMap[fund.info.amfiCode].navs[date] = nav
      })
      // if (process.stdout.isTTY) process.stdout.write(`\r  Processed ${i+1} / ${fundsOfInterest.length}`);
    })
    console.timeEnd(`  Processed file in`)
    console.log('-----')
    console.log('')
  }
  console.timeEnd('Processed NAVs in')

  console.time('Wrote NAVs in')
  Object.entries(fundsMap).forEach(([amfiCode, newFundData], i) => {
    const fundNAVFile = `${NAVS_DATA_DIR}/${amfiCode}.json`
    let fundData
    if (!fs.existsSync(fundNAVFile)) {
      fundData = { info: newFundData.info, navs: {} }
    } else {
      // fundData = require(`../${fundNAVFile}`)
      fundData = JSON.parse(fs.readFileSync(fundNAVFile, 'utf-8'))
    }
    fundData.navs = { ...fundData.navs, ...newFundData.navs }
    fundData.navs = Object.fromEntries(Object.entries(fundData.navs).sort(([a], [b]) => b.localeCompare(a)))
    fundData.info.navCount = Object.keys(fundData.navs).length
    const dates = Object.keys(fundData.navs)
    fundData.info.navStartDate = dates[dates.length - 1]
    fundData.info.navEndDate = dates[0]
    if (!dryRun) {
      fs.writeFileSync(fundNAVFile, JSON.stringify(fundData))
    }
    if (process.stdout.isTTY) process.stdout.write(`\r  Updated ${i + 1} / ${Object.keys(fundsMap).length}`);
  })
  console.log('')
  console.timeEnd('Wrote NAVs in')
  console.log('=====')
  console.log('')
}


function updateStats() {
  console.log('Updating fund status')
  const files = fs.readdirSync(AMFI_PARSED_DATA_DIR).filter(f => f.endsWith('.json'))
  const fundsMap = {}
  for (let i = 0, len = files.length; i < len; i++) {
    const file = files[i]
    const data = JSON.parse(fs.readFileSync(`${AMFI_PARSED_DATA_DIR}/${file}`, 'utf-8'))
    console.log('Parsing file:', file, '=>', data.funds.length, 'funds')
    data.funds.forEach(fund => {
      if (!fundsMap[fund.info.amfiCode]) {
        fundsMap[fund.info.amfiCode] = fund
      }
    })
  }

  // all funds
  const allFunds = Object.values(fundsMap).map((fund, i) => {
    // if (process.stdout.isTTY) process.stdout.write(`\r${i+1} / ${Object.keys(fundsMap).length}`)
    if (i % 1000 === 0) console.log(`Read ${i} / ${Object.keys(fundsMap).length}`)

    if (fs.existsSync(`${NAVS_DATA_DIR}/${fund.info.amfiCode}.json`)) {
      const fundData = JSON.parse(fs.readFileSync(`${NAVS_DATA_DIR}/${fund.info.amfiCode}.json`, 'utf-8'))
      return { info: fundData.info }
    }
    return {
      info: {
        ...fund.info,
        // navCount: null,
        // navStartDate: null,
        // navEndDate: null,
      }
    }
  })
  let categoriesRaw = Array.from(new Set(allFunds.map(f => f.info.categoryRaw))).sort()
  let categories = Array.from(new Set(allFunds.map(f => f.info.category))).sort()
  let amcs = Array.from(new Set(allFunds.map(f => f.info.amc))).sort()
  fs.writeFileSync('./data/funds-all.json', JSON.stringify({
    fundsCount: allFunds.length,
    amcs,
    categories,
    categoriesRaw,
    funds: allFunds,
  }));


  // filtered funds
  const filteredFunds = allFunds.filter(filterFund)
  const filteredFundsCategoriesRaw = Array.from(new Set(filteredFunds.map(f => f.info.categoryRaw))).sort()
  const filteredFundsCategories = Array.from(new Set(filteredFunds.map(f => f.info.category))).sort()
  const filteredFundsAmcs = Array.from(new Set(filteredFunds.map(f => f.info.amc))).sort()
  fs.writeFileSync('./data/funds-filtered.json', JSON.stringify({
    fundsCount: filteredFunds.length,
    amcs: filteredFundsAmcs,
    categories: filteredFundsCategories,
    categoriesRaw: filteredFundsCategoriesRaw,
    funds: filteredFunds,
  }));
}



function parseArguments(args = process.argv.slice(2)) {
  function kebabToCamel(str) {
    return str.replace(/-+(\w)/g, (_, char) => char.toUpperCase());
  }
  const parsedArgs = parseArgs({
    args, allowPositionals: true, strict: false, tokens: false,
  });
  const { positionals = [] } = parsedArgs;
  const command = positionals.shift();
  const options = Object.fromEntries(Object.entries(parsedArgs.values).map(([key, val]) => [kebabToCamel(key), val]));
  return {
    args, parsedArgs, command, options, positionals,
  };
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
    case 'download': {
      await downloadNAVs(fromDate, toDate, dryRun)
      break;
    }
    case 'parse': {
      parseNAVs(fromDate, toDate, dryRun)
      break;
    }
    case 'process': {
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
