import axios from 'axios'
import { isEmpty } from 'lodash'
import mongoose from 'mongoose'
import { USER_STATUS } from './user'
import { Readable } from 'stream'
import OrderID from 'ordersid-generator'
import numeral from 'numeral'
import { UserWishlist } from '../models'

export const getNewInvoiceNumber = () => {
  // return OrderID('long')
  return OrderID('short', process.env.CLIENT_NAME.replace(' ', ''))
}

export function formatToCurrency(number) {
  return numeral(number).format('$0,0.00')
}

export const getRandomWholeNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min)
}

export function fRemainingDays({ endDate, startDate = Date.now() }) {
  const countDownDate = new Date(endDate).getTime()
  const now = new Date(startDate).getTime()
  const timeleft = countDownDate - now
  const days = Math.ceil(timeleft / (1000 * 60 * 60 * 24))

  return days
  // let duration = intervalToDuration({
  //   start: new Date(date),
  //   end: new Date(),
  // })

  // console.log('duration', duration)
  // return formatDuration(duration, {
  //   delimiter: ', ',
  // })
}

export const bufferToStream = (binary) => {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary)
      this.push(null)
    },
  })

  return readableInstanceStream
}

export const removeSeperatorKey = (fileKey) => {
  const seperator = '-seperator-'

  const transformed = fileKey.includes(seperator)
    ? fileKey.slice(fileKey.indexOf(seperator) + seperator.length, fileKey.length)
    : fileKey

  return transformed
}

export const filterNullUndefined = (arr) => {
  const newArray = arr.filter((a) => a !== undefined && a !== null && !isNaN(a))
  return newArray
}

export const getFacebookUserData = async (access_token) => {
  const { data } = await axios.get('https://graph.facebook.com/me', {
    params: {
      fields: ['id', 'email', 'first_name', 'last_name', 'picture'].join(','),
      access_token,
    },
  })
  return data
}
export const getAllProducts = async (baseUrl, limit = 250) => {
  let page = 1
  let allProducts = []

  while (true) {
    const url = `${baseUrl}?limit=${limit}&page=${page}`
    try {
      const response = await axios.get(url)
      const products = response.data.products

      if (!products || products.length === 0) break

      allProducts = allProducts.concat(products)
      if (products.length < limit) break // No more pages
      page++
    } catch (error) {
      console.error(`Error fetching page ${page} from ${baseUrl}:`, error.message)
      break
    }
  }

  return allProducts
}

export const getRandomString = () => {
  const random = Math.random().toString(36)
  return random.slice(2, random.length)
}

export const toObjectId = (id) => {
  return mongoose.Types.ObjectId(id)
}

export const getLoginLinkByEnv = () => {
  return process.env.CLOUD === 'DEV_CLOUD' ? process.env.DOMAIN_FRONT_DEV : process.env.DOMAIN_PROD
}

export const getSanitizeCompanyName = (company, countryCode) => {
  console.log('company, countryCode', company, countryCode)
  return countryCode?.toLowerCase() + '-' + company?.toLowerCase().replace(/[^a-z]/gi, '')
}

export const filterDeletedItem = (arr) => {
  return arr.filter((item) => item.status === USER_STATUS.active)
}
export const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

export const getEndDateByDurationYear = (duration) => {
  const endDate = new Date()
  if (duration !== '1 year') endDate.setFullYear(endDate.getFullYear() + 2)
  else endDate.setFullYear(endDate.getFullYear() + 1)
  return endDate
}

export const sortByLatestDate = (array, key) =>
  array.sort(function (a, b) {
    return new Date(b[key]) - new Date(a[key])
  })

export const extractAssessmentIdFromReportKey = (key) => {
  const arraySplited = key.split('-')
  const keyContainsId = arraySplited.length === 5

  if (keyContainsId) {
    const companyAndId = arraySplited[1]
    const id = companyAndId.slice(companyAndId.indexOf('/') + 1, companyAndId.length)

    return id
  }
}
export const filterReportsByAssessmentIds = (array, ids = []) =>
  array?.filter((item) => {
    const idFromKey = extractAssessmentIdFromReportKey(item?.Key)

    return ids.indexOf(idFromKey) !== -1
  })

export const sortByFirstDate = (array, key) =>
  array.sort(function (a, b) {
    return new Date(a[key]) - new Date(b[key])
  })

export const getShortName = (string) => {
  if (isEmpty(string)) return ''

  let shortName = string.slice(0, 2)
  const splittedName = string.split(' ')

  if (splittedName.length >= 2)
    shortName = splittedName[0].charAt(0) + splittedName[splittedName.length - 1].replace('&\r\n', '').charAt(0)

  return shortName.toUpperCase()
}

const parseSizeValue = (sizeValue) => {
  if (!sizeValue) return null
  if (typeof sizeValue === 'number') return sizeValue

  // Check if sizeValue is a range e.g. "35-38"
  if (sizeValue.includes('-')) {
    const parts = sizeValue.split('-').map((p) => parseFloat(p.trim()))
    if (parts.length === 2 && !parts.some(isNaN)) {
      return parts // return the full range
    }
  }

  // Otherwise, try to parse single float number
  const parsed = parseFloat(sizeValue)
  return isNaN(parsed) ? null : parsed
}

// const getFitTypeAndAlteration = (userValue, sizeValue) => {
//   if (userValue === undefined || sizeValue === undefined) return { fitType: null, alterationRequired: true }

//   const user = Number(userValue)
//   const size = parseSizeValue(sizeValue)

//   if (isNaN(user) || size === null) return { fitType: null, alterationRequired: true }
//   // Handle range
//   if (Array.isArray(size)) {
//     const [min, max] = size
//     if (user >= min && user <= max) {
//       return { fitType: 'fitted', alterationRequired: false }
//     } else if (user < min) {
//       return { fitType: 'loose', alterationRequired: true }
//     } else {
//       return { fitType: 'tight', alterationRequired: true }
//     }
//   }

//   // Handle single size
//   if (user === size) {
//     return { fitType: 'fitted', alterationRequired: false }
//   } else if (user < size) {
//     return { fitType: 'loose', alterationRequired: true }
//   } else {
//     return { fitType: 'tight', alterationRequired: true }
//   }
// }
// ...existing code...

const getFitTypeAndAlteration = (userValue, sizeValue) => {
  if (userValue === undefined || sizeValue === undefined) {
    return { fitType: null, alterationRequired: true, difference: null, direction: null }
  }

  const user = Number(userValue)
  const size = parseSizeValue(sizeValue)

  if (isNaN(user) || size === null) {
    return { fitType: null, alterationRequired: true, difference: null, direction: null }
  }

  let difference = 0
  let direction = null

  // Handle range
  if (Array.isArray(size)) {
    const [min, max] = size
    if (user >= min && user <= max) {
      return { fitType: 'fitted', alterationRequired: false, difference: 0, direction: null }
    } else if (user < min) {
      difference = min - user
      direction = 'increase'
      return { fitType: 'loose', alterationRequired: true, difference, direction }
    } else {
      difference = user - max
      direction = 'decrease'
      return { fitType: 'tight', alterationRequired: true, difference, direction }
    }
  }

  difference = Math.abs(user - size)

  if (user === size) {
    return { fitType: 'fitted', alterationRequired: false, difference: 0, direction: null }
  } else if (user < size) {
    direction = 'increase'
    return { fitType: 'loose', alterationRequired: true, difference, direction }
  } else {
    direction = 'decrease'
    return { fitType: 'tight', alterationRequired: true, difference, direction }
  }
}
export const getMatchingSizes = (
  brand,
  subCategory,
  sizeChart,
  sizeMatchCacheByBrand,
  userBust,
  userWaist,
  userHip,
  userSleeves
) => {
  const isJCrew = brand === 'J_Crew'
  const brandCache = sizeMatchCacheByBrand[brand]
  if (brandCache[subCategory]) return brandCache[subCategory]

  const matches = []

  for (const { name, numericalSize, numericalValue, measurements } of sizeChart) {
    const { bust, waist, hip, sleeves } = measurements || {}

    let fitType = null
    let alterationRequired = true
    const diff = (a, b) => (a && b ? Math.abs(parseFloat(a) - parseFloat(b)) : 0)
    let sizeDifference = 0
    if (['tops', 'outerwear', 'dresses'].includes(subCategory)) {
      // Priority: bust/chest, then waist, then sleeves
      sizeDifference = diff(bust, userBust) + diff(waist, userWaist) + diff(sleeves, userSleeves)
      const bustFit = getFitTypeAndAlteration(userBust, bust)
      const waistFit = getFitTypeAndAlteration(userWaist, waist)
      const sleevesFit = getFitTypeAndAlteration(userSleeves, sleeves)
      const attributeDifferences = {
        bust: bustFit.difference,
        bustDirection: bustFit.direction,
        waist: waistFit.difference,
        waistDirection: waistFit.direction,
        sleeves: sleevesFit.difference,
        sleevesDirection: sleevesFit.direction,
      }

      // Determine overall fitType and alterationRequired
      if (bustFit.fitType === 'fitted') {
        fitType = 'fitted'
        if (waistFit.fitType === 'fitted') {
          if (isJCrew) {
            // Also check sleeves only if it's J_Crew
            if (sleevesFit.fitType === 'fitted') {
              alterationRequired = false
            } else {
              alterationRequired = true
            }
          } else {
            alterationRequired = false
          }
        } else {
          alterationRequired = true
        }
      } else if (bustFit.fitType === 'loose' || waistFit.fitType === 'loose') {
        fitType = 'loose'
        alterationRequired = true
      } else if (bustFit.fitType === 'tight' || waistFit.fitType === 'tight') {
        fitType = 'tight'
        alterationRequired = true
      }

      matches.push({
        name,
        numericalSize,
        numericalValue,
        fitType,
        alterationRequired,
        sizeDifference,
        attributeDifferences,
      })
    } else if (subCategory === 'bottoms') {
      sizeDifference = diff(waist, userWaist) + diff(hip, userHip)
      const waistFit = getFitTypeAndAlteration(userWaist, waist)
      const hipFit = getFitTypeAndAlteration(userHip, hip)
      const attributeDifferences = {
        waist: waistFit.difference,
        waistDirection: waistFit.direction,
        hip: hipFit.difference,
        hipDirection: hipFit.direction,
      }
      console.log('attributeDifferences', attributeDifferences)
      if (waistFit.fitType === 'fitted') {
        if (hipFit.fitType === 'fitted') {
          fitType = 'fitted'
          alterationRequired = false
        } else {
          fitType = 'fitted'
          alterationRequired = true
        }
      } else if (waistFit.fitType === 'loose' || hipFit.fitType === 'loose') {
        fitType = 'loose'
        alterationRequired = true
      } else if (waistFit.fitType === 'tight' || hipFit.fitType === 'tight') {
        fitType = 'tight'
        alterationRequired = true
      }

      matches.push({
        name,
        numericalSize,
        numericalValue,
        fitType,
        alterationRequired,
        sizeDifference,
        attributeDifferences,
      })
    }
  }

  brandCache[subCategory] = matches
  return matches
}

export async function getWishlistProductIdSet(userId) {
  const wishlistEntries = await UserWishlist.find({ userId }).lean()
  const wishlistProductIds = wishlistEntries.map((entry) => entry.productId.toString())
  return new Set(wishlistProductIds)
}
