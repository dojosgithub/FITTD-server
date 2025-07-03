// services/scraping/houseofcb.service.js
import {
  categorizeProductByName,
  getAllProducts,
  getEbDenimProductUrlsFromCategory,
  getHouseOfCbProductUrlsFromCategory,
  getJCrewProductUrlsFromCategory,
  getLuluLemonProductUrlsFromCategory,
  getProductUrlsFromCategory,
  getSelfPotraitProductUrlsFromCategory,
  getTheReformationProductUrlsFromCategory,
  groupedByType,
  transformProducts,
} from '../utils'
import { updateOrCreateProductCollection } from './user.js'

export const scrapeHouseOfCB = async () => {
  const categories = [
    { type: 'accessories', url: 'https://app.houseofcb.com/category?category_id=11' },
    { type: 'clothing', url: 'https://app.houseofcb.com/category?category_id=2' },
  ]

  for (const category of categories) {
    const products = await getHouseOfCbProductUrlsFromCategory(category.url)

    for (const product of products) {
      let cat = category.type === 'accessories' ? 'accessories' : categorizeProductByName(product.name)
      groupedByType[cat].push(product)
    }
  }
  return await updateOrCreateProductCollection('House_Of_CB', groupedByType)
}

export const scrapeEbDenim = async () => {
  const categoryUrl = 'https://www.ebdenim.com/collections/all-products' // Example category URL

  const products = await getEbDenimProductUrlsFromCategory(categoryUrl)
  for (const product of products) {
    const cat = categorizeProductByName(product.name, true)
    groupedByType[cat].push(product)
  }
  // return await updateOrCreateProductCollection('EB_Denim', groupedByType)
}
export const scrapeLuluLemon = async () => {
  const categories = [
    { type: 'men', url: 'https://shop.lululemon.com/c/men-bestsellers/n1nrqwznskl' },
    { type: 'women', url: 'https://shop.lululemon.com/c/women-bestsellers/n16o10znskl' },
  ]

  for (const category of categories) {
    const products = await getLuluLemonProductUrlsFromCategory(category.url)
    const gender = category.type === 'men' ? 'male' : 'female'
    for (const product of products) {
      const productWithGender = { ...product, gender }
      const cat = categorizeProductByName(productWithGender.name)
      groupedByType[cat].push(productWithGender)
    }
  }
  return await updateOrCreateProductCollection('Lululemon', groupedByType)
}
export const scrapeAgolde = async () => {
  const menUrl = 'https://agolde.com/collections/shop-all-mens/products.json'
  const womenUrl = 'https://agolde.com/collections/shop-all-womens/products.json'

  // Fetch both categories in parallel
  const [menProductsRaw, womenProductsRaw] = await Promise.all([getAllProducts(menUrl), getAllProducts(womenUrl)])

  // Transform data
  const menProducts = transformProducts(menProductsRaw).map((product) => ({
    ...product,
    gender: 'male',
  }))
  const womenProducts = transformProducts(womenProductsRaw).map((product) => ({
    ...product,
    gender: 'female',
  }))
  const allProducts = [...menProducts, ...womenProducts]

  for (const product of allProducts) {
    const cat = categorizeProductByName(product.name)
    groupedByType[cat].push(product)
  }
  return await updateOrCreateProductCollection('Agolde', groupedByType)
}
export const scrapeTheReformation = async () => {
  const categories = [
    { type: 'clothes', url: 'https://www.thereformation.com/clothing?page=125' },
    { type: 'wedding', url: 'https://www.thereformation.com/bridal?page=28' },
    { type: 'shoes', url: 'https://www.thereformation.com/shoes?page=29' },
    { type: 'bags', url: 'https://www.thereformation.com/bags?page=7' },
  ]

  for (const category of categories) {
    const products = await getTheReformationProductUrlsFromCategory(category.url)
    for (const product of products) {
      let cat
      if (category.type === 'shoes') cat = 'footwear'
      else if (category.type === 'bags') cat = 'accessories'
      else if (category.type === 'wedding') cat = 'dresses'
      else cat = categorizeProductByName(product.name)
      groupedByType[cat].push(product)
    }
  }
  return await updateOrCreateProductCollection('Reformation', groupedByType)
}
export const scrapeSelfPotrait = async () => {
  const categoryUrl = 'https://us.self-portrait.com/collections/all' // Example category URL

  const products = await getSelfPotraitProductUrlsFromCategory(categoryUrl)
  for (const product of products) {
    const cat = categorizeProductByName(product.name)
    groupedByType[cat].push(product)
  }
  return await updateOrCreateProductCollection('Self_Potrait', groupedByType)
}
export const scrapeJCrew = async () => {
  const categories = [
    { type: 'men', url: 'https://www.jcrew.com/plp/mens?Npge=1&Nrpp=9' },
    { type: 'women', url: 'https://www.jcrew.com/plp/womens?Npge=1&Nrpp=9' },
  ]

  for (const category of categories) {
    const products = await getJCrewProductUrlsFromCategory(category.url)
    const gender = category.type === 'men' ? 'male' : 'female'
    for (const product of products) {
      const productWithGender = { ...product, gender }
      const cat = categorizeProductByName(productWithGender.name)
      groupedByType[cat].push(productWithGender)
    }
  }
  return await updateOrCreateProductCollection('J_Crew', groupedByType)
}
export const scrapeSaboSkirt = async () => {
  const categoryUrl = 'https://us.saboskirt.com/collections/active-products'

  const products = await getProductUrlsFromCategory(categoryUrl)
  for (const product of products) {
    const cat = categorizeProductByName(product.name)
    groupedByType[cat].push(product)
  }
  return await updateOrCreateProductCollection('Sabo_Skirt', groupedByType)
}
