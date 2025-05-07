import { Schema, model } from 'mongoose'

const productSchema = new Schema(
  {
    name: String,
    imageUrl: String,
    description: String,
    price: Number,
    sizeChart: String,
    brand: String,
    category: String,
    productUrl: String,
  },
  { timestamps: true }
)

export const Product = model('Product', productSchema)
