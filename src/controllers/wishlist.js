// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { User, UserWishlist } from '../models'
import { asyncMiddleware } from '../middlewares'

dotenv.config()

// * Models

// * Middlewares

// * Services

// * Utilities

export const CONTROLLER_WISHLIST = {
  // Add to Wishlist
  addWishlist: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded
    const { productId } = req.body

    if (!userId || !productId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing userId or productId' })
    }

    const exists = await UserWishlist.findOne({ userId, productId })

    if (exists) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Already in wishlist' })
    }

    const wishlistItem = await UserWishlist.create({ userId, productId })
    await User.findByIdAndUpdate(userId, {
      $addToSet: { wishlist: wishlistItem._id }, // avoids duplicates
    })
    return res.status(StatusCodes.CREATED).json({
      data: wishlistItem,
      message: 'Added to wishlist',
    })
  }),

  // Remove from Wishlist
  removeWishlist: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded
    const { productId } = req.body

    const deleted = await UserWishlist.findOneAndDelete({ userId, productId })
    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: deleted._id },
    })
    // Remove reference from user

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Item not in wishlist' })
    }

    return res.status(StatusCodes.OK).json({ message: 'Removed from wishlist' })
  }),

  // Get all wishlist items for user
  getUserWishlist: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded

    const items = await UserWishlist.find({ userId })

    return res.status(StatusCodes.OK).json({ data: items })
  }),
}
