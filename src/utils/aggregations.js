// utils.js
import { Product } from "../models"
export const aggregateProductsByBrandAndCategory = (brands = [], categories = [], gender = "male", page = 1, limit = 10) => {
  const match = {}
  if (brands.length) match.brand = { $in: brands }
  if (categories.length) match.category = { $in: categories }
  if (gender) match.gender = gender

  const ITEMS_PER_GROUP = Number(limit)
  const skip = (Number(page) - 1) * ITEMS_PER_GROUP

  return [
    { $match: match },
    {
      $group: {
        _id: { brand: '$brand', category: '$category' },
        products: { $push: '$$ROOT' },
      },
    },
    {
      $project: {
        brand: '$_id.brand',
        category: '$_id.category',
        products: { $slice: ['$products', skip, ITEMS_PER_GROUP] },
      },
    },
    {
      $group: {
        _id: '$brand',
        categories: {
          $push: {
            k: '$category',
            v: '$products',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        brand: '$_id',
        categories: { $arrayToObject: '$categories' },
      },
    },
  ]
}


export const getCategoryCounts = async (categories, brand, ProductModel) => {
  const matchCriteria = {
    category: { $in: categories },
  };

  if (brand) {
    matchCriteria.brand = brand;  // single brand string, no array
  }

  const counts = await Product.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        count: 1,
      },
    },
  ]);

  const categoryCounts = {};
  for (const cat of categories) {
    const found = counts.find(c => c.category === cat);
    categoryCounts[cat] = found ? found.count : 0;
  }

  return categoryCounts;
}

