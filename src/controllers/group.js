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

export const CONTROLLER_GROUP = {
  addGroup: asyncMiddleware(async (req, res) => {
    const { _id } = req.decoded
    let { body } = req.body

    body = {
      files: req.file && req.file.path,
      ...JSON.parse(req.body.body),
    }

    // Ensure groupAdmin and groupMembers are arrays
    if (!Array.isArray(body.groupAdmin)) {
      body.groupAdmin = []
    }

    if (!Array.isArray(body.groupMembers)) {
      body.groupMembers = []
    }

    // Add the admin (current user) to groupAdmin
    body.groupAdmin.push(_id)

    // Add the admin (current user) to groupMembers with joinDate
    body.groupMembers.push({
      memberId: _id,
      joinDate: new Date(),
    })

    // Log the body for debugging
    console.log(body)

    // Create and save the group
    let group = await Group.create(body)

    res.status(StatusCodes.OK).json({
      data: group,
      message: 'Group created successfully',
    })
  }),

  joinGroup: asyncMiddleware(async (req, res) => {
    const { groupId, newMemberId } = req.body
    const membercheck = await Group.findById(groupId)
    const isMemberAlready = membercheck.groupMembers.some((member) => member.memberId.toString() === newMemberId)

    if (isMemberAlready) {
      return res.status(StatusCodes.OK).json({
        message: 'group member already exists',
      })
    }

    let updatedGroup
    if (!isMemberAlready) {
      updatedGroup = await Group.findByIdAndUpdate(
        groupId,
        {
          $addToSet: { groupMembers: { memberId: toObjectId(newMemberId), joinDate: new Date() } },
          $set: { updatedAt: new Date() },
        },
        { new: true }
      )
    }

    if (!updatedGroup) {
      return res.status(404).send('Group not found')
    }

    const group = await Group.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(groupId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'groupMembers.memberId',
          foreignField: '_id',
          as: 'groupMembers',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'groupAdmin',
          foreignField: '_id',
          as: 'groupAdmin',
        },
      },
      {
        $unwind: { path: '$groupMembers', preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: '$_id',
          groupName: { $first: '$groupName' },
          age: { $first: '$age' },
          level: { $first: '$level' },
          groupDescription: { $first: '$groupDescription' },
          files: { $first: '$files' },
          groupAdmin: { $first: '$groupAdmin' },
          groupMembers: { $push: '$groupMembers' },
          post: { $first: '$post' },
          badges: { $first: '$badges' },
        },
      },
    ])

    const user = await User.findById(newMemberId)
    const fcmUserId = await User.findById(membercheck.groupAdmin)
    if (fcmUserId.fcmToken) {
      sendPushNotification({
        token: fcmUserId.fcmToken,
        notification: {
          title: 'New Member Joined Community',
          body: `${user.firstName} ${user.lastName} has joined the Community ${group[0]?.groupName}.`,
        },
      })
    }

    res.status(StatusCodes.OK).json({
      data: group,
      message: 'Added to group successfully',
    })
  }),

  leaveGroup: asyncMiddleware(async (req, res) => {
    const { groupId, memberId } = req.body

    // Ensure memberId is in the correct format
    const memberObjectId = toObjectId(memberId)

    // Update the group by pulling the member out of the groupMembers array
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        $pull: {
          groupMembers: { memberId: memberObjectId }, // Match the whole object to remove
        },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    )

    if (!updatedGroup) {
      return res.status(404).send('Group not found')
    }

    res.status(200).json({
      data: updatedGroup,
      message: 'Removed from group successfully',
    })
  }),

  groupList: asyncMiddleware(async (req, res) => {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    // const query = req.query.query || ''
    const query = req.query.query ? escapeRegex(req.query.query) : ''

    console.log(query)
    let searchQuery = {}

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    if (!isEmpty(query)) {
      const documentMatchKeys = ['groupName']
      const ORqueryArray = documentMatchKeys.map((key) => ({
        // [key]: { $regex: new RegExp(escapeRegex(query), 'gi') },
        [key]: { $regex: new RegExp(query, 'gi') },
      }))

      searchQuery = {
        $or: ORqueryArray,
      }
    }

    const list = await getGroupsPaginated({ searchQuery, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'groups fetched successfully',
    })
  }),

  groupDetails: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    console.log(id)

    const data = await getGroupDetails({ id })

    res.status(StatusCodes.OK).json({
      data,
      message: 'group details fetched successfully',
    })
  }),

  groupUpdate: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    let body = JSON.parse(req.body.body)

    body = {
      files: req.file && req.file.path,
      ...body,
    }

    const data = await updateGroupDetails({ id, body })

    res.status(StatusCodes.OK).json({
      data,
      message: 'group updated successfully',
    })
  }),

  deleteGroup: asyncMiddleware(async (req, res) => {
    const { id } = req.query
    console.log(id)
    const group = await Group.findById(id)
    if (!group) {
      return res.status(404).json({ message: 'Group not found' })
    }
    const postCount = await Post.countDocuments({ group: id })
    if (postCount > 0) {
      // Delete all posts associated with the group
      await Post.deleteMany({ group: id })
    }
    await Group.findByIdAndDelete(id)
    res.status(StatusCodes.OK).json({
      message: 'group deleted successfully',
    })
  }),

  groupMembersList: asyncMiddleware(async (req, res) => {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const searchQuery = req.query.query || ''
    const groupId = req.query.groupId

    if (!groupId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'groupId is required',
      })
    }

    const pipeline = [
      {
        $match: {
          _id: toObjectId(groupId),
        },
      },
      {
        $unwind: '$groupMembers', // Deconstruct the groupMembers array
      },
      {
        $lookup: {
          from: 'users',
          localField: 'groupMembers.memberId', // Match users by _id field within groupMembers
          foreignField: '_id',
          as: 'memberDetails',
        },
      },
      {
        $unwind: {
          path: '$memberDetails',
          preserveNullAndEmptyArrays: true, // Keep documents even if there are no matches
        },
      },
      {
        $addFields: {
          fullName: { $concat: ['$memberDetails.firstName', ' ', '$memberDetails.lastName'] },
        },
      },
      {
        $match: {
          fullName: { $regex: new RegExp(searchQuery, 'i') },
        },
      },
      {
        $group: {
          _id: '$_id',
          // groupName: { $first: '$groupName' },
          // age: { $first: '$age' },
          // level: { $first: '$level' },
          // groupDescription: { $first: '$groupDescription' },
          // files: { $first: '$files' },
          groupAdmin: { $first: '$groupAdmin' },
          groupMembers: {
            $push: {
              // _id: '$memberDetails._id',
              firstName: '$memberDetails.firstName',
              lastName: '$memberDetails.lastName',
              email: '$memberDetails.email',
              file: '$memberDetails.file',
              joinDate: '$groupMembers.joinDate',
              memberId: '$groupMembers.memberId',
              post: '$groupMembers.post',
              badges: '$groupMembers.badges',
              createdAt: '$groupMembers.createdAt',
              updatedAt: '$groupMembers.updatedAt',
            },
          },
          // createdAt: { $first: '$createdAt' },
          // updatedAt: { $first: '$updatedAt' },
        },
      },
    ]

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    const list = await getGroupMembersPaginated({ pipeline, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'members list fetched successfully',
    })
  }),
}
