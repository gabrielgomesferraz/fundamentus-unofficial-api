const { getPage, endpoints } = require('../utils')
const camelCase = require('camelcase')

const regex = {
  tag: /<span class="(txt|oscil)">(.)+<\/span>/,
  nested: /(>((-)?[0-9]+,?([0-9])+?)%)/,
  link: /<a .+>.+<\/a>/,
  number: /(^-?[0-9]+(,[0-9]+)?%?$)|(([0-9]+\.)+[0-9])/
}

function formatKey (key) {
  let formattedKey = key.normalize('NFD')
    .replace(/[\u0300-\u036f\\.\\$\\(\\)]/g, '')
    .replace(/ /g, '_')
    .replace(/_?\/_?( )*/g, '_por_')
    .toLowerCase()

  if (formattedKey.match(/[0-9]{4}/)) {
    formattedKey = 'ANO_' + formattedKey
  }
  if (formattedKey.charAt(0).match(/[0-9]/)) {
    formattedKey = 'ULTIMOS_' + formattedKey
  }
  return camelCase(formattedKey)
}

function formatValue (value) {
  if (!value.match(regex.number)) return value

  if (value.includes('%')) {
    const number = parseFloat(value.replace(/,/g, '.'))
    return parseFloat((number / 100.0).toPrecision(6))
  } else if (value.includes(',')) {
    return parseFloat(value.replace(/,/g, '.'))
  } else {
    return parseInt(value.replace(/\./g, ''))
  }
}

function formatData (data) {
  const matches = regex.tag.exec(data.replace(/\n/g, ''))
  if (!matches) return '-'

  const result = matches[0].toString().replace('<span class="txt">', '').replace('</span>', '').trim()

  const link = regex.link.exec(result)
  if (link) {
    return result.replace(/<a .+">/, '').replace('</a>', '')
  }

  if (result.includes('oscil')) {
    const value = regex.nested.exec(result)
    return value[0].toString().substring(1)
  }

  return result
}

async function scrapShare (share) {
  const dom = await getPage(endpoints.details, share)
  const { document } = dom.window
  const labels = Array.from(document.querySelectorAll('td.label'))
  const data = Array.from(document.querySelectorAll('td.data'))

  if (labels.length === 0) {
    throw new Error('Fundamentus returned an error for share: ' + share)
  }

  return labels.map((label, index) => ({
    label: label.innerHTML,
    value: data[index].innerHTML
  }))
}

function parseTableData (table) {
  const result = {}

  const data = table.map(({ label, value }) => {
    const formattedLabel = formatData(label)
    const data = formatValue(formatData(value))
    return {
      name: label,
      label: formattedLabel,
      data: data !== '-' ? data : null
    }
  })

  data.map(({ label, data }, index) => {
    if (label !== '-') {
      const resultLabel = Object.keys(result).includes(formatKey(label)) ? label + '_ultimos_3_meses' : label
      result[formatKey(resultLabel)] = data
    }
  })

  const orderedResult = {}
  Object.keys(result).sort().forEach(key => {
    orderedResult[key] = result[key]
  })
  return orderedResult
}

async function getIndicators (share) {
  const table = await scrapShare(share)
  const data = parseTableData(table)
  return data
}

module.exports = { getIndicators }
