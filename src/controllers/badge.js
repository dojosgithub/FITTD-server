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
  getChallengeBadge,
  getBadgeDetails,
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

export const CONTROLLER_BADGE = {
  createBadge: asyncMiddleware(async (req, res) => {
    let body = JSON.parse(req.body.body)

    body = {
      ...body,
      image: req.file && req.file.path,
    }

    let badge = await createBadge({ body })

    res.status(StatusCodes.OK).json({
      data: badge,
      message: 'Badge created successfully',
    })
  }),

  getABadge: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const badge = await getABadge(id)

    res.status(StatusCodes.OK).json({
      data: badge,
      message: 'badge fetched successfully',
    })
  }),

  getAllBadge: asyncMiddleware(async (req, res) => {
    const list = await getAllBadge()

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'All badges fetched successfully',
    })
  }),

  getChallengeBadge: asyncMiddleware(async (req, res) => {
    const query = req.query.query
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    let searchQuery = { type: 'Challenge' }
    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    if (!isEmpty(query)) {
      const documentMatchKeys = ['name']
      const ORqueryArray = documentMatchKeys.map((key) => ({
        [key]: { $regex: new RegExp(escapeRegex(req.query.query), 'gi') },
      }))
      searchQuery = {
        ...searchQuery,
        $and: [
          {
            $or: ORqueryArray,
          },
        ],
      }
    }

    const pipeline = [{ $match: searchQuery }]

    const list = await getChallengeBadge({ pipeline, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'All Challenge badges fetched successfully',
    })
  }),

  updateBadge: asyncMiddleware(async (req, res) => {
    let id = req.query.id
    let body = JSON.parse(req.body.body)

    body = {
      ...body,
      image: req.file && req.file.path,
    }

    let badge = await updateBadge({ id, body })

    res.status(StatusCodes.OK).json({
      data: badge,
      message: 'badge updated successfully',
    })
  }),

  deleteBadge: asyncMiddleware(async (req, res) => {
    const { id } = req.query
    const badge = await Badge.findByIdAndDelete(id)
    res.status(StatusCodes.OK).json({
      message: 'badge deleted successfully',
    })
  }),

  awardBadge: asyncMiddleware(async (req, res) => {
    const { userId, badgeId } = req.body

    if (!userId || !badgeId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID and Badge ID are required.' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
    }

    const badge = await Badge.findById(badgeId)
    if (!badge) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Badge not found.' })
    }

    const existingBadge = user.badges.find((b) => b.badgeId.equals(badgeId))

    if (existingBadge) {
      // If the badge exists, increment the quantity
      existingBadge.quantity += 1
    } else {
      // If the badge does not exist, add it to the array
      user.badges.push({
        badgeId: badge._id,
        name: badge.name,
        _type: badge.type,
        image: badge.image,
        quantity: 1,
      })
    }

    await user.save()

    res.status(StatusCodes.OK).json({
      message: 'Badge awarded successfully.',
    })
  }),

  getBadgeDetails: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const data = await getBadgeDetails(id)

    res.status(StatusCodes.OK).json({
      data,
      message: 'badge details fetched successfully',
    })
  }),
}
