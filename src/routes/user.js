// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_USER } from '../controllers'

// * Utilities
// import { validateRegistration } from '../models/User'
// import { USER_PERMISSIONS, USER_ROLE } from '../utils/user'

// * Middlewares
import { validateMiddleware, permitMiddleware, Authenticate } from '../middlewares'
import { parser } from '../utils/cloudinary'
import { totpRateLimiter } from '../utils/rateLimiter'
import { USER_TYPES } from '../utils'

const router = Router()

// Zeal App User Routes

router.get('/profile', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_USER.profile)

router.put(
  '/profile-update',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('file'),
  CONTROLLER_USER.updateProfile
)

router.get('/home', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_USER.home)

router.get('/users', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_USER.userList)

export default router
