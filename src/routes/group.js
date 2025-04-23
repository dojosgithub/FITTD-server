// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_GROUP } from '../controllers'

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
  '/group',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('file'),
  CONTROLLER_GROUP.addGroup
)

router.post(
  '/join-group',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.joinGroup
)

router.post(
  '/leave-group',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.leaveGroup
)

router.get(
  '/group/search',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.groupList
)

router.get(
  '/group-details',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.groupDetails
)

router.put(
  '/group-update',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('file'),
  CONTROLLER_GROUP.groupUpdate
)

router.post(
  '/group-members',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.groupMembersList
)

router.delete(
  '/delete-group',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_GROUP.deleteGroup
)

export default router
