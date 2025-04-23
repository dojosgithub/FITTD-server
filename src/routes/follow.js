// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_FOLLOW } from '../controllers'

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

router.post('/follow', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_FOLLOW.follow)

router.post('/unfollow', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_FOLLOW.unfollow)

router.get(
  '/followers',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_FOLLOW.followers
)

router.get(
  '/followings',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_FOLLOW.followings
)

export default router
