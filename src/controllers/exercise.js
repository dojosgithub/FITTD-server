// * Libraries
import { StatusCodes } from 'http-status-codes'
import { isEmpty, isUndefined, concat, cloneDeep } from 'lodash'
import speakeasy, { totp } from 'speakeasy'
import mongoose, { model } from 'mongoose'
const axios = require('axios')
import passport from 'passport'
import dotenv from 'dotenv'

const admin = require('firebase-admin')

dotenv.config()

// * Models
import { User, TOTP, Group, Post, Comment, Badge, Challenge, UserChallengeProgress } from '../models'

// * Middlewares
import { asyncMiddleware } from '../middlewares'

// * Services
import {
  addGroup,
  getGroupsPaginated,
  getGroupDetails,
  updateGroupDetails,
  getGroupMembersPaginated,
  createPost,
  getUserPostsPaginated,
  updatePost,
  getPostDetails,
  getgroupsPostsPaginated,
  getallPostsPaginated,
  getPostLike,
  getPostdisLike,
  createComment,
  updateComment,
  getAllComments,
  createExercise,
  getAllExercises,
  createBadge,
  getABadge,
  getAllBadge,
  updateBadge,
  createChallenge,
  updateChallenge,
  getAllZealAdminChallenges,
  getFriendsChallenges,
  getCommunityChallenges,
  getUserProgress,
  getUserExerciseLog,
  getChallengeHistory,
  getUserAllCurrentChallenges,
  getAllFeaturedChallenges,
  getUserCreatedChallenges,
  getSpecificCommunityChallenges,
  getAllPopularChallenges,
  getChallengeDetails,
  retrieveUserChallange,
  getAllExercisesCategory,
  getChallengeLeaderboard,
} from '../services'

// * Utilities
import {
  DEALERSHIP_STATUS,
  DEALERSHIP_STAFF_ROLE,
  DOC_STATUS,
  getRoleByValue,
  getRoleShortName,
  USER_ROLE,
  USER_TYPES,
  AUCTION_STATUS,
  CAR_STATUS,
  SYSTEM_STAFF_ROLE,
  BID_STATUS,
  getCurrentDayName,
  getDateForDay,
  getStartOfDayISO,
  getDayName,
  CHALLENGE_STATUS,
} from '../utils/user'
import { getLoginLinkByEnv, getSanitizeCompanyName, toObjectId } from '../utils/misc'
import { stripe } from '../utils/stripe'
import Email from '../utils/email'
import { escapeRegex } from '../utils/misc'
import { comparePassword, generateOTToken, generatePassword, generateToken, verifyTOTPToken } from '../utils'
import { sendSMS } from '../utils/smsUtil'
import { getIO } from '../socket'

const { ObjectId } = mongoose.Types

// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// const REDIRECT_URI = 'http://localhost:3000/api/user/auth/google/callback'

export const CONTROLLER_EXERCISE = {
  createExercise: asyncMiddleware(async (req, res) => {
    let body = JSON.parse(req.body.body)

    let files = {}
    if (req.files['Icon']) {
      const file = req.files['Icon'][0]
      files['Icon'] = {
        name: file.originalname,
        size: file.size,
        preview: file.path,
        type: file.mimetype,
        key: file.filename,
      }
    }

    if (req.files['demo']) {
      const file = req.files['demo'][0]
      files['demo'] = {
        name: file.originalname,
        size: file.size,
        preview: file.path,
        type: file.mimetype,
        key: file.filename,
      }
    }

    body.files = files

    let exercise = await createExercise({ body })

    res.status(StatusCodes.OK).json({
      data: exercise,
      message: 'exercise Created successfully',
    })
  }),

  getAllExercises: asyncMiddleware(async (req, res) => {
    const category = req.query.category

    const list = await getAllExercises(category)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'Categories fetched successfully',
    })
  }),

  getAllExercisesCategory: asyncMiddleware(async (req, res) => {
    const category = req.query.category

    const list = await getAllExercisesCategory(category)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'Exercises fetched successfully',
    })
  }),
}
