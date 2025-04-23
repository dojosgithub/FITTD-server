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

export const CONTROLLER_POST = {
  // ZEAL FITNESS APP APIS

  createPost: asyncMiddleware(async (req, res) => {
    const files = req.files // Array of files
    const { description, postOwner, group } = req.body
    let body
    if (group === '') {
      body = {
        files,
        description,
        postOwner,
      }
    } else {
      body = {
        files,
        description,
        postOwner,
        group,
      }
    }

    // console.log('body', body)

    // console.log('Files:', files)
    // console.log('Description:', description)
    // console.log('PostOwner:', postOwner)
    // console.log('Group:', group)
    let post = await createPost({ body })

    res.status(StatusCodes.OK).json({
      data: post,
      message: 'Post Created successfully',
    })
  }),

  updatePost: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const files = req.files // Array of files
    const { description } = req.body
    console.log(description)
    let body = {
      files,
      description,
    }

    // let body = req.body
    console.log('body', body)
    let post = await updatePost({ id, body })

    res.status(StatusCodes.OK).json({
      data: post,
      message: 'Post Updated successfully',
    })
  }),

  userPostAll: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    const list = await getUserPostsPaginated({ id, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'user posts fetched successfully',
    })
  }),

  postDetails: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const data = await getPostDetails({ id })

    res.status(StatusCodes.OK).json({
      data,
      message: 'Dealership details fetched successfully',
    })
  }),

  deletePost: asyncMiddleware(async (req, res) => {
    const { id } = req.query
    console.log(id)
    const post = await Post.findByIdAndDelete(id)
    res.status(StatusCodes.OK).json({
      message: 'Post deleted successfully',
    })
  }),

  groupPostAll: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const skip = parseInt(req.query.skip) || 0

    const list = await getgroupsPostsPaginated({ skip, id })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'groups fetched successfully',
    })
  }),

  allPosts: asyncMiddleware(async (req, res) => {
    const userId = req.query.userId
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    const list = await getallPostsPaginated({ userId, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'posts fetched successfully',
    })
  }),

  likePost: asyncMiddleware(async (req, res) => {
    let body = req.body
    console.log(body)
    const userId = body.userId
    const postId = body.postId
    const list = await getPostLike({ userId, postId })

    const post = await Post.findById(body.postId)
    const PostOwner = await User.findById(post.postOwner)
    const user = await User.findById(userId)

    if (PostOwner.fcmToken) {
      sendPushNotification({
        token: PostOwner.fcmToken,
        notification: {
          title: 'Like on your post',
          body: `${user.firstName} ${user.lastName} liked your post.`,
        },
      })
    }

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'groups fetched successfully',
    })
  }),

  dislikePost: asyncMiddleware(async (req, res) => {
    let body = req.body
    console.log(body)
    const userId = body.userId
    const postId = body.postId
    const list = await getPostdisLike({ userId, postId })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'groups fetched successfully',
    })
  }),
}
