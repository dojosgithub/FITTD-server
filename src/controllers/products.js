// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { Product } from '../models'
import { asyncMiddleware } from '../middlewares'

dotenv.config()

export const CONTROLLER_PRODUCT = {
  // Get all wishlist items for user
  getProducts: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded

    const items = await Product.find()

    return res.status(StatusCodes.OK).json({ data: items })
  }),
  //   getByCategory: asyncMiddleware(async (req, res) => {
  //     const { category } = req.query

  //     if (!category) {
  //       return res.status(400).json({ message: "Query param 'category' is required" })
  //     }

  //     // Support multiple categories
  //     const categoriesRequested = category.split(',').map((cat) => cat.trim().toLowerCase())

  //     const existingProducts = await Product.findOne()

  //     if (!existingProducts) {
  //       return res.status(404).json({ message: 'No products found' })
  //     }

  //     const result = {}

  //     for (const [brand, categories] of existingProducts.products.entries()) {
  //       result[brand] = {} // Initialize brand object

  //       for (const cat of categoriesRequested) {
  //         // Return empty array if the category doesn't exist
  //         result[brand][cat] = categories[cat] || []
  //       }
  //     }

  //     return res.status(StatusCodes.OK).json({ data: result })
  //   }),
  //   getByBrand: asyncMiddleware(async (req, res) => {
  //     const { brand } = req.query

  //     const products = await Product.findOne()

  //     if (!products || !products.products.has(brand)) {
  //       return res.status(404).json({ message: `Brand '${brand}' not found` })
  //     }

  //     return res.status(StatusCodes.OK).json({
  //       brand: brand,
  //       data: products.products.get(brand),
  //     })
  //   }),
  //   getByBrandAndCategory: asyncMiddleware(async (req, res) => {
  //     let { brand, category } = req.query

  //     // Validate query params
  //     if (!brand && !category) {
  //       return res.status(400).json({ message: "Query param 'brand' or 'category' is required" })
  //     }

  //     // Split comma-separated lists, trim whitespace
  //     const brands = brand?.split(',').map((b) => b.trim()) || []
  //     const categories = category?.split(',').map((c) => c.trim()) || []

  //     // Fetch the single document that holds all product data
  //     const allProductsDoc = await Product.findOne()
  //     if (!allProductsDoc) {
  //       return res.status(404).json({ message: 'No products found' })
  //     }

  //     const productsMap = allProductsDoc.products // Mongoose Map

  //     const result = {}

  //     // If no brands provided, include *all* brands
  //     const brandsToIterate = brands.length ? brands : Array.from(productsMap.keys())

  //     for (const b of brandsToIterate) {
  //       // Initialize brand entry
  //       result[b] = {}

  //       // If this brand doesn’t exist in DB, still include it with empty categories
  //       const brandData = productsMap.has(b) ? productsMap.get(b) : {}

  //       // If no categories provided, include *all* categories under this brand
  //       const categoriesToIterate = categories.length ? categories : Object.keys(brandData)

  //       for (const cat of categoriesToIterate) {
  //         // Grab category array or default to []
  //         result[b][cat] = Array.isArray(brandData[cat]) ? brandData[cat] : []
  //       }
  //     }

  //     return res.status(StatusCodes.OK).json({ data: result })
  //   }),

  getByBrandsAndCategories: asyncMiddleware(async (req, res) => {
    let { brand, category } = req.query

    // Validate query params
    if (!brand && !category) {
      return res.status(400).json({ message: "At least one query param ('brand' or 'category') is required." })
    }

    // Parse query params to arrays
    const brands = brand?.split(',').map((b) => b.trim()) || []
    const categories = category?.split(',').map((c) => c.trim()) || []

    // Fetch product data
    const allProductsDoc = await Product.findOne()
    if (!allProductsDoc) {
      return res.status(404).json({ message: 'No products found.' })
    }

    const productsMap = allProductsDoc.products
    const result = {}

    // Case: Only category is provided → search across all brands for those categories
    if (!brands.length && categories.length) {
      for (const [brandName, brandData] of productsMap.entries()) {
        const matchedCategories = {}
        for (const cat of categories) {
          matchedCategories[cat] = Array.isArray(brandData[cat]) ? brandData[cat] : []
        }
        result[brandName] = matchedCategories
      }
    }

    // Case: Only brand is provided → return all categories for that brand
    else if (brands.length && !categories.length) {
      for (const b of brands) {
        const brandData = productsMap.get(b)
        if (!brandData) {
          result[b] = {} // Brand not found, still include empty object
          continue
        }

        const plainBrandData = brandData.toObject() // <-- Fix

        result[b] = {}
        for (const cat in plainBrandData) {
          result[b][cat] = Array.isArray(plainBrandData[cat]) ? plainBrandData[cat] : []
        }
      }
    }

    // Case: Both brand & category are provided → filter selected brands for selected categories
    else if (brands.length && categories.length) {
      for (const b of brands) {
        const brandData = productsMap.get(b)
        result[b] = {}

        for (const cat of categories) {
          result[b][cat] = brandData?.[cat] ?? []
        }
      }
    }

    let totalCount = 0

    // Calculate total number of products
    for (const brand in result) {
      for (const category in result[brand]) {
        totalCount += result[brand][category].length
      }
    }

    return res.status(StatusCodes.OK).json({
      results: totalCount,
      data: result,
    })
  }),
}
