// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_PROGRESS } from '../controllers'

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

router.put(
  '/update-progress',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.updateProgress
)

router.get(
  '/GetUserProgress',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.getUserProgress
)

router.get(
  '/GetUserExerciseLog',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.getUserExerciseLog
)

router.get(
  '/get-challenge-history',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.getChallengeHistory
)

router.get(
  '/get-leaderboard',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.getLeaderBoard
)

router.get(
  '/stats',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_PROGRESS.getUserStats
)

export default router
