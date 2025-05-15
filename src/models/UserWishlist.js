import { Schema, model } from 'mongoose'

const wishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
  },
  { versionKey: false, timestamps: true }
)
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true })

export const UserWishlist = model('UserWishlist', wishlistSchema)
