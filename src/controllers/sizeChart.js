// Update or create size chart for a specific collection
import { StatusCodes } from 'http-status-codes'
import { Product, SizeChart } from '../models'
import { asyncMiddleware } from '../middlewares'

export const CONTROLLER_SIZECHART = {
  updateSizeChart: asyncMiddleware(async (req, res) => {
    const { collectionName, sizeChart } = req.body
    if (!collectionName || !sizeChart) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'collectionName and sizeChart are required',
      })
    }

    // Upsert the sizeChart for the brand (collectionName) in the new SizeChart collection
    await SizeChart.updateOne({ brand: collectionName }, { $set: { sizeChart } }, { upsert: true })

    return res.status(StatusCodes.OK).json({
      message: 'Size chart updated successfully',
    })
  }),

  removeSizeChartsFromProducts: asyncMiddleware(async (req, res) => {
    const productDoc = await Product.findOne({}).lean()

    if (!productDoc || !productDoc.products) {
      return res.status(404).json({ message: 'No products found to remove sizeCharts' })
    }

    const brands = Object.keys(productDoc.products)
    if (brands.length === 0) {
      return res.status(404).json({ message: 'No brands found in products' })
    }

    // Build unset object for all brands
    const unsetFields = {}
    brands.forEach((brand) => {
      unsetFields[`products.${brand}.sizeChart`] = ''
    })

    await Product.updateOne({ _id: productDoc._id }, { $unset: unsetFields })

    return res.status(200).json({
      message: 'All sizeChart fields removed from products successfully',
    })
  }),

  appendSizeChartSection: asyncMiddleware(async (req, res) => {
    const { collectionName, unit, key, array } = req.body

    if (!collectionName || !unit || !key || !Array.isArray(array)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'collectionName, unit, key, and array are required',
      })
    }

    const chart = await SizeChart.findOne({ brand: collectionName })

    if (!chart) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `No size chart found for brand ${collectionName}`,
      })
    }

    const sizeChart = chart.sizeChart || {}
    const unitData = sizeChart[unit] || {}
    const existingArray = unitData[key] || []

    // Append only unique items
    const updatedArray = [...existingArray]
    array.forEach((item) => {
      if (!updatedArray.some((e) => JSON.stringify(e) === JSON.stringify(item))) {
        updatedArray.push(item)
      }
    })

    // Update the size chart structure
    await SizeChart.updateOne({ brand: collectionName }, { $set: { [`sizeChart.${unit}.${key}`]: updatedArray } })

    return res.status(StatusCodes.OK).json({
      message: `Size chart for ${collectionName} updated under ${unit}.${key}`,
    })
  }),
}
