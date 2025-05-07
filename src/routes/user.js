// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_USER } from '../controllers'

// * Utilities
// import { validateRegistration } from '../models/User'
// import { USER_PERMISSIONS, USER_ROLE } from '../utils/user'

// * Middlewares
import { permitMiddleware, Authenticate } from '../middlewares'

import { USER_TYPES } from '../utils'
import { parser } from '../utils/cloudinary'

const router = Router()

router.get(
  '/profile',
  Authenticate(),
  //   permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_USER.getProfile
)
router.put(
  '/profile/contact',
  Authenticate(),
  //   permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_USER.verifyOrUpdateProfile
)
router.put(
  '/profile/details',
  Authenticate(),
  //   permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('image'),
  CONTROLLER_USER.updateProfile
)

export default router
