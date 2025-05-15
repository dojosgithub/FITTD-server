import { Router } from 'express'
import userRoutes from './user'
import authRoutes from './auth'
import measurementRoutes from './measurments'
import scraperRoutes from './scraper'
import wishlistRoutes from './wishlist'
import productRoutes from './products'

const router = Router()

router.use('/user', userRoutes)
router.use('/auth', authRoutes)
router.use('/user', measurementRoutes)
router.use('/scraper', scraperRoutes)
router.use('/wishlist', wishlistRoutes)
router.use('/product', productRoutes)

export default router
