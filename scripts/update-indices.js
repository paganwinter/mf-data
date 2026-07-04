const fs = require('fs');
const { execSync, exec } = require('child_process');

const utils = require('./utils');
// const { getMonthRanges, filterFund } = utils;
const { parseArguments, isoDateToAMFI, amfiDateToISO, writeToSummary } = utils;


let dispatcher = undefined
if (process.env.USE_PROXY === 'true') {
  const undici = require('undici')
  fetch = undici.fetch
  dispatcher = new undici.ProxyAgent('http://localhost:3128')
}

// const NIFTY_INDICES_URL = 'https://www.niftyindices.com/Backpage.aspx';
const NIFTY_INDICES_URL = 'https://www.niftyindices.com/Backpage';
const INDICES_DIR = 'data/indices';
const INDICES_FILE = 'data/indices.json';

function normaliseIndexName(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').trim().toUpperCase()
}

async function updateIndicesList() {
  let indices = []
  // const subTypes = [
  //   'Broad Market Indices',
  //   'Sectoral Indices',
  //   'Strategy Indices',
  //   'Thematic Indices',
  // ]
  const subTypesRes = await fetch(`${NIFTY_INDICES_URL}/gethistoricaltypeSubindexdata`, {
    dispatcher,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cinfo: { indextype: 'Equity', indexgroup: ' Total returns Index Values ' } }),
  }).then(r => r.json())
  const subTypes = subTypesRes.d.map(i => i.indextype);
  console.log(subTypes)

  await Promise.all(subTypes.map(async (subType) => {
    console.log('Getting indices for sub type:', subType)
    const body = JSON.stringify({ cinfo: { indextype: subType, indexgroup: ' Total returns Index Values ' } })
    const subIndexTypeIndicesRes = await fetch(`${NIFTY_INDICES_URL}/gethistoricaltypeindexdata`, {
      dispatcher,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }).then(r => r.json());
    const subIndexTypeIndices = subIndexTypeIndicesRes.d.map(i => i.indextype);
    console.log(subType, subIndexTypeIndices)
    subIndexTypeIndices.forEach(indName => {
      indices.push({
        name: indName,
        subType,
        id: normaliseIndexName(indName)
      })
    })
  }))
  console.log(indices)
  fs.writeFileSync(INDICES_FILE, JSON.stringify(indices, null, 2));
}



async function updateIndices(fromDateStr, toDateStr, dryRun = false) {
  console.log(fromDateStr, toDateStr, dryRun)
  writeToSummary(`## Updating Indices for ${fromDateStr} - ${toDateStr}\n`);

  let indices = JSON.parse(fs.readFileSync(INDICES_FILE, 'utf-8'));
  // console.log(indices)

  fs.mkdirSync(INDICES_DIR, { recursive: true })

  const fromYear = +fromDateStr.substring(0, 4)
  const toYear = +toDateStr.substring(0, 4)
  console.log(fromYear, toYear)
  const yearRange = []
  for (let i = fromYear; i <= toYear; i++) {
    yearRange.push(i)
  }
  console.log(yearRange)
  console.log('')

  let indexCount = 1
  // const indicesToUpdate = indices.slice(0, 10)
  const indicesToUpdate = indices


  async function updateIndex(index, i) {
    // console.log('Index: ', index.name)

    let tris = {}
    await Promise.all(yearRange.map(async (year, j) => {
      await new Promise(resolve => setTimeout(resolve, j * 100))

      const body = {
        "cinfo": `{'name':'${index.name.toUpperCase()}','startDate':'${isoDateToAMFI(`${year}-01-01`)}','endDate':'${isoDateToAMFI(`${year}-12-31`)}','indexName':'${index.name.toUpperCase()}'}`
      }
      const url = `${NIFTY_INDICES_URL}/getTotalReturnIndexString`
      console.log(index.name, year, url, body)
      let triRes = await fetch(url, {
        dispatcher,
        method: 'POST',
        headers: { 'content-type': 'application/json'},
        body: JSON.stringify(body)
      })
      triRes = await triRes.text();

      try {
        // const dataArray = JSON.parse(JSON.parse(triRes).d);
        const dataArray = JSON.parse(triRes);
        const yearlyTris = dataArray.reduce((acc, item) => {
          acc[amfiDateToISO(item.Date, ' ')] = {
            tri: +item.TotalReturnsIndex,
            ntrValue: item.NTR_Value === '-' ? undefined : +item.NTR_Value,
          };
          return acc;
        }, {})
        console.log('  ', index.name, 'fetched for year:', year, Object.keys(yearlyTris).length);
        tris = { ...tris, ...yearlyTris };
      } catch (err) {
        console.log(err);
        // console.log(triRes);
        console.log('Error parsing data for', index.name, year)
        console.log('-----')
        writeToSummary(`- Error parsing data for ${index.name} (${year})\n`);
      }
    }))

    let indexData
    const indexFile = `${INDICES_DIR}/${normaliseIndexName(index.name)}.json`
    if (!fs.existsSync(indexFile)) {
      indexData = {
        name: index.name,
        subType: index.subType,
        tris: { ...tris },
      }
    } else {
      indexData = JSON.parse(fs.readFileSync(indexFile, 'utf-8'))
      indexData.tris = { ...indexData.tris, ...tris }
    }

    // sort by date
    indexData.tris = Object.fromEntries(Object.entries(indexData.tris).sort(([aDate], [bDate]) => bDate.localeCompare(aDate)))
    if (!dryRun) {
      // fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2))
      fs.writeFileSync(indexFile, JSON.stringify(indexData))
      console.log(indexCount++, '/', indicesToUpdate.length, index.name, 'Updated')
      console.log('-----')
      console.log('')
    }
  }


  await Promise.all(indicesToUpdate.map(async (index, i) => {
    await new Promise(resolve => setTimeout(resolve, i * 10))
    await updateIndex(index, i);
  }))
  // for (let i = 0; i < indicesToUpdate.length; i++) {
  //   await updateIndex(indicesToUpdate[i], i);
  // }
}


async function main() {
  // USAGE:
  // for current month
  // node scripts/update-indices.js

  // for custom range
  // node scripts/update-indices.js --from-date=2024-01-01 --to-date=2024-12-31

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

  // await updateIndices(fromDate, toDate, dryRun)
  switch(command) {
    case 'update-indices': {
      await updateIndices(fromDate, toDate, dryRun)
      break;
    }
    case 'update-indices-list': {
      await updateIndicesList()
      break;
    }
    default: {
      console.log(`Invalid command ${command}. Use one of: update-indices`)
      process.exit(1)
    }
  }
}


if (require.main === module) {
  main();
} else {
  // export functions for testing
}
