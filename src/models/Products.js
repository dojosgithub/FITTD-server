import { Schema, model } from 'mongoose'

const productSchema = new Schema(
  {
    brand: String,
    category: String,
    name: String,
    url: String,
    description: String,
    price: String,
    image: {
      primary: String,
      secondary: [String],
    },
    sizes: [
      {
        size: String,
        inStock: Boolean,
      },
    ],
    gender: String,
    rating: String,
    reviewCount: Number,
  },
  { timestamps: true }
)

export const Product = model('Product', productSchema)
