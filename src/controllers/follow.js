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
import {
  comparePassword,
  generateOTToken,
  generatePassword,
  generateToken,
  sendPushNotification,
  verifyTOTPToken,
} from '../utils'
import { sendSMS } from '../utils/smsUtil'
import { getIO } from '../socket'

const { ObjectId } = mongoose.Types

// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// const REDIRECT_URI = 'http://localhost:3000/api/user/auth/google/callback'

export const CONTROLLER_FOLLOW = {
  // ZEAL FITNESS APP APIS

  follow: asyncMiddleware(async (req, res) => {
    const { followedId, userId } = req.body

    const follower = await User.findById(userId)
    const followed = await User.findById(followedId)

    if (!follower || !followed) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (follower.following.includes(followedId)) {
      return res.status(StatusCodes.OK).json({
        message: 'Already following',
      })
    }

    follower.following.push(followedId)
    followed.followers.push(userId)

    await follower.save()
    await followed.save()

    const userName = await User.findById(userId).select('firstName lastName')
    console.log('userName', userName)

    if (followed.fcmToken) {
      sendPushNotification({
        token: followed.fcmToken,
        notification: {
          title: 'New Follower',
          body: `${userName.firstName} ${userName.lastName} started following you.`,
        },
      })
    }

    res.status(StatusCodes.OK).json({
      message: 'Followed successfully',
    })
  }),

  unfollow: asyncMiddleware(async (req, res) => {
    const { followedId, userId } = req.body

    const follower = await User.findById(userId)
    const followed = await User.findById(followedId)

    if (!follower || !followed) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!follower.following.includes(followedId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Not following',
      })
    }

    follower.following = follower.following.filter((id) => id.toString() !== followedId)
    followed.followers = followed.followers.filter((id) => id.toString() !== userId)

    await follower.save()
    await followed.save()

    res.status(StatusCodes.OK).json({
      message: 'Unfollowed successfully',
    })
  }),

  followers: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const searchQuery = req.query.firstName || ''

    // const user = await User.findById(id).populate('followers').select('firstName lastName files')
    const user = await User.findById(id).populate({
      path: 'followers',
      match: { firstName: new RegExp(searchQuery, 'i') },
      select: 'firstName lastName email file',
    })

    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User not found' })
    }

    // const data = user.followers
    res.status(StatusCodes.OK).json({
      data: user.followers,
      message: 'followers fetched successfully',
    })
  }),

  followings: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const searchQuery = req.query.firstName || ''

    // const user = await User.findById(id).populate('followers').select('firstName lastName files')
    const user = await User.findById(id).populate({
      path: 'following',
      match: { firstName: new RegExp(searchQuery, 'i') },
      select: 'firstName lastName email file',
    })

    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User not found' })
    }

    // const data = user.followers
    res.status(StatusCodes.OK).json({
      data: user.following,
      message: 'followings fetched successfully',
    })
  }),
}
