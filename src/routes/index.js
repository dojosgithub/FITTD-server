import { Router } from 'express'
import userRoutes from './user'
import authRoutes from './auth'
import measurementRoutes from './measurments'
import scraperRoutes from './scraper'

const router = Router()

router.use('/user', userRoutes)
router.use('/auth', authRoutes)
router.use('/user', measurementRoutes)
router.use('/scraper', scraperRoutes)

export default router
