import { Schema, model } from 'mongoose'

// Define a product schema for each individual product
const productSchema = new Schema(
  {
    name: String,
    url: String,
    description: String,
    price: String, // Assuming price is a string (formatted with currency)
    image: {
      primary: String,
      secondary: [String], // Array of secondary image URLs
    },
    sizes: [
      {
        size: String,
        inStock: Boolean,
      },
    ],
    gender: String,
    rating: String, // Assuming rating is a string (you can adjust as necessary)
    reviewCount: Number,
  },
  { timestamps: false, versionKey: false }
)

// Define the main schema for the collection
const productCollectionSchema = new Schema(
  {
    products: {
      // Dynamic structure for brands and categories
      // Each brand (like 'EB_Denim', 'Sabo_Skirt') has a list of categories (like 'outerwear', 'denim', etc.)
      // Each category contains an array of product objects
      type: Map,
      of: new Schema({
        outerwear: [productSchema],
        denim: [productSchema],
        tops: [productSchema],
        bottoms: [productSchema],
        dresses: [productSchema],
        accessories: [productSchema],
        footwear: [productSchema],
      }),
    },
  },
  { timestamps: false, versionKey: false }
)

// Create a model for the collection
export const Product = model('Product', productCollectionSchema)
