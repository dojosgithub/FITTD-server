// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_BADGE } from '../controllers'

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

router.post(
  '/create-badge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('image'),
  CONTROLLER_BADGE.createBadge
)

router.get('/get-badge', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_BADGE.getABadge)

router.get(
  '/get-all-badge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_BADGE.getAllBadge
)

router.get(
  '/get-challenge-badges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_BADGE.getChallengeBadge
)

router.put(
  '/update-badge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('image'),
  CONTROLLER_BADGE.updateBadge
)

router.delete(
  '/delete-badge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_BADGE.deleteBadge
)

router.post(
  '/award-badge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_BADGE.awardBadge
)

router.get(
  '/get-badge-details',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_BADGE.getBadgeDetails
)

export default router
