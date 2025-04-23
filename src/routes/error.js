// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_POST } from '../controllers'

// * Utilities
// import { validateRegistration } from '../models/User'
// import { USER_PERMISSIONS, USER_ROLE } from '../utils/user'

// * Middlewares
import { validateMiddleware, permitMiddleware, Authenticate } from '../middlewares'
import { parser } from '../utils/cloudinary'
import { totpRateLimiter } from '../utils/rateLimiter'
import { USER_TYPES } from '../utils'
import { CONTROLLER_ERROR } from '../controllers/error'

const router = Router()

// Zeal App User Routes

router.post('/err-log', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_ERROR.errorLog)

export default router
