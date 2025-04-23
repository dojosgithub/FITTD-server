// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_AUTH } from '../controllers'

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

router.post('/get-code', CONTROLLER_AUTH.getCode)

router.post('/verify-account', CONTROLLER_AUTH.verifyAccount)

router.post('/sign-up', CONTROLLER_AUTH.signUp)

router.post('/sign-out', CONTROLLER_AUTH.signOut)

router.post('/sign-in', CONTROLLER_AUTH.signIn)

router.post('/forgot-password', CONTROLLER_AUTH.forgotPassword)

router.post('/verify', CONTROLLER_AUTH.verifyUpdatePasswordCode)

router.post(
  '/forgot-password-update',

  CONTROLLER_AUTH.forgotPasswordUpdate
)

router.post(
  '/sendNotification',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_AUTH.sendNotification
)

router.put(
  '/change-password',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_AUTH.changePassword
)

router.post('/oauth', CONTROLLER_AUTH.OAuth)

export default router
