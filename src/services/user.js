// * Libraries
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import _, { isEmpty, isNull, isUndefined } from 'lodash'
import { format } from 'date-fns'

// * Models
import {
  User,
  Subscription,
  User_SubscriptionRole,
  Function,
  Category,
  Control,
  Dealership,
  Post,
  Comment,
  Reel,
  Exercise,
  Badge,
  Challenge,
  UserChallengeProgress,
  userChallengeProgressSchema,
  ErrorLog,
} from '../models'

// * Configs
// import { getCognitoClient } from '../config/aws'

// * Utilities
import {
  AUCTION_STATUS,
  CAR_STATUS,
  CHALLENGE_STATUS,
  convertTimeToSeconds,
  DEALERSHIP_STATUS,
  DOC_STATUS,
  getRoleShortName,
  SYSTEM_USER_ROLE,
  USER_LEVELS,
  USER_ROLE,
  USER_STATUS,
  USER_TYPES,
} from '../utils/user'
import { generateCognitoPassword } from '../utils/password'
// import TenantDB from '../utils/tenantDB'
import { stripe } from '../utils/stripe'

// * Services
import {
  countAssessmentTemplatesDocument,
  countSAAssessmentsGeneratedDocument,
  getUserSubscriptionDetails,
  countAssessmentsAssignedToRAA,
  countAssessmentsAssignedToRAVO,
  getAssessmentsAssignedToRAAListRecently,
  getAssessmentsAssignedToRAVOListRecently,
  getStripeProduct,
  getCompanyReports,
  listCompanyInvoice,
} from './index'
import {
  filterNullUndefined,
  getEndDateByDurationYear,
  getFacebookUserData,
  getSanitizeCompanyName,
  toObjectId,
} from '../utils/misc'
import { Group } from '../models/Group'
import { OAuth2Client } from 'google-auth-library'
import Email from '../utils/email'

export const generateToken = (payload) =>
  new Promise((resolve, reject) => {
    const token = jwt.sign(payload, process.env.USER_ROLE_JWT_SECRET_KEY, { expiresIn: '9999 years' })
    resolve(token)
  })

export const createUser = async (payload) => {
  const newUser = new User(payload)
  await newUser.save()
  return newUser
}

export const getGroupsPaginated = async ({ searchQuery, paginateOptions }) => {
  // Define the aggregation pipeline
  const aggregateQuery = Group.aggregate([
    { $match: searchQuery },
    // {
    //   $lookup: {
    //     from: 'users',
    //     localField: 'groupMembers.memberId',
    //     foreignField: '_id',
    //     as: 'groupMembersDetails',
    //   },
    // },
    // { $unwind: { path: '$groupMembersDetails', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        groupName: { $first: '$groupName' },
        // age: { $first: '$age' },
        // level: { $first: '$level' },
        // groupDescription: { $first: '$groupDescription' },
        files: { $first: '$files' },
        // groupAdmin: { $first: '$groupAdmin' },
        groupMembers: { $first: '$groupMembers' },
        // post: { $first: '$post' },
        // badges: { $first: '$badges' },
      },
    },
    {
      $project: {
        groupName: 1,
        groupMembers: 1,
        files: 1,
      },
    },
  ])

  // Paginate the results
  const data = await Group.aggregatePaginate(aggregateQuery, paginateOptions)
  return data
}

export const getUserPostsPaginated = async ({ id, paginateOptions }) => {
  const aggregateQuery = Post.aggregate([
    { $match: { postOwner: toObjectId(id) } },
    {
      $lookup: {
        from: 'groups', // Make sure this matches the collection name of 'group'
        localField: 'group',
        foreignField: '_id',
        as: 'group',
      },
    },
    {
      $unwind: {
        path: '$group',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'comments', // Lookup for comments related to the post
        localField: '_id',
        foreignField: 'post',
        as: 'comments',
      },
    },
    {
      $project: {
        description: 1,
        likes: 1,
        postOwner: 1,
        files: 1,
        createdAt: 1,
        updatedAt: 1,
        group: {
          _id: 1,
          groupName: 1,
          files: 1,
        },
        totalComments: { $size: '$comments' },
      },
    },
  ])
  const data = await Post.aggregatePaginate(aggregateQuery, paginateOptions)
  return data
}

export const getgroupsPostsPaginated = async ({ skip, id }) => {
  const getGroupPostsWithCommentsAggregation = (id, skip) => [
    {
      $match: {
        _id: toObjectId(id),
      },
    },
    {
      $lookup: {
        from: 'posts',
        localField: 'post',
        foreignField: '_id',
        as: 'posts',
      },
    },
    {
      $unwind: '$posts',
    },
    {
      $lookup: {
        from: 'users',
        localField: 'posts.likes',
        foreignField: '_id',
        as: 'posts.likes',
      },
    },
    // {
    //   $lookup: {
    //     from: 'users',
    //     let: { likesArray: '$posts.likes' },
    //     pipeline: [
    //       { $match: { $expr: { $in: ['$_id', '$$likesArray'] } } },
    //       { $project: { _id: 1, firstname: 1, lastname: 1 } }, // Specify the fields you need
    //     ],
    //     as: 'likesDetails',
    //   },
    // },
    // {
    //   $project: {
    //     'posts.likes': '$likesDetails', // Replace posts.likes with the detailed likes info
    //     // Include other fields you need from the main collection
    //   },
    // },
    {
      $lookup: {
        from: 'users',
        let: { postOwnerId: '$posts.postOwner' },
        pipeline: [
          {
            $match: { $expr: { $eq: ['$_id', '$$postOwnerId'] } },
          },
          {
            $project: {
              _id: 1,
              lastName: 1,
              firstName: 1,
              file: 1, // Add any other fields you need from the user document
            },
          },
        ],
        as: 'posts.postOwner',
      },
    },
    {
      $unwind: {
        path: '$posts.postOwner',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'comments',
        localField: 'posts._id',
        foreignField: 'post',
        as: 'posts.comments',
      },
    },
    {
      $unwind: {
        path: '$posts.comments',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { commentOwnerId: '$posts.comments.commentOwner' },
        pipeline: [
          {
            $match: { $expr: { $eq: ['$_id', '$$commentOwnerId'] } },
          },
          {
            $project: {
              _id: 1,
              lastName: 1,
              firstName: 1,
              file: 1, // Add any other fields you need from the user document
            },
          },
        ],
        as: 'posts.comments.commentOwner',
      },
    },
    {
      $unwind: {
        path: '$posts.comments.commentOwner',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$posts._id',
        post: { $first: '$posts' },
        comments: { $push: '$posts.comments' },
      },
    },
    // {
    //   $addFields: {
    //     'post.comments': '$comments',
    //   },
    // },
    // {
    //   $replaceRoot: {
    //     newRoot: '$post',
    //   },
    // },

    {
      $skip: skip,
    },
    {
      $sort: {
        'post.createdAt': -1, // Sort by 'createdAt' field of 'post'
      },
    },
  ]

  const data = await Group.aggregate(getGroupPostsWithCommentsAggregation(id, skip))
  return data
}

export const getAllComments = async ({ id }) => {
  const data = await Comment.find({ post: id })
    .populate('commentOwner', '-password -refreshTokens')
    .sort({ createdAt: -1 })
  return data
}

export const getAllExercises = async (exe) => {
  const data = await Exercise.find({ category: exe })
  return data
}

export const getAllExercisesCategory = async (exe) => {
  const data = await Exercise.distinct('category')
  return data
}

export const getABadge = async (id) => {
  const data = await Badge.findById(id)
  return data
}

export const getAllBadge = async () => {
  const data = await Badge.find({})
  return data
}

export const getChallengeBadge = async ({ pipeline, paginateOptions }) => {
  const myAggregate = Badge.aggregate(pipeline)
  const data = await Badge.aggregatePaginate(myAggregate, paginateOptions)
  return data
}

export const getUserProgress = async (id, challengeId) => {
  const userProgress = await UserChallengeProgress.aggregate([
    {
      $match: {
        challenge: toObjectId(challengeId), // Convert to ObjectId
        user: toObjectId(id), // Convert to ObjectId
      },
    },
    {
      $unwind: '$dailyProgress',
    },
    {
      $unwind: '$dailyProgress.exerciseStatus',
    },
    {
      $match: {
        'dailyProgress.exerciseStatus.isFinished': true,
      },
    },
    {
      $lookup: {
        from: 'exercises',
        localField: 'dailyProgress.exerciseStatus.exerciseId',
        foreignField: '_id',
        as: 'exerciseDetails',
      },
    },
    {
      $project: {
        _id: 1, // Include userChallengeProgress ID
        dayName: '$dailyProgress.dayName',
        date: '$dailyProgress.date',
        exerciseDetails: {
          $map: {
            input: '$exerciseDetails',
            as: 'exercise',
            in: {
              name: '$$exercise.name',
              description: '$$exercise.description',
              targetMuscle: '$$exercise.targetMuscle',
              category: '$$exercise.category',
              rest: '$$exercise.rest',
            },
          },
        },
      },
    },
  ])
  return userProgress
}

export const getUserExerciseLog = async (id, challengeId) => {
  // console.log('ids', id, ' ', challengeId)
  const userExerciseLog = await UserChallengeProgress.aggregate([
    {
      $match: {
        challenge: toObjectId(challengeId), // Convert to ObjectId
        user: toObjectId(id), // Convert to ObjectId
      },
    },
    {
      $unwind: '$dailyProgress',
    },
    {
      $unwind: '$dailyProgress.exerciseStatus',
    },
    {
      $match: {
        'dailyProgress.exerciseStatus.isFinished': true,
      },
    },
    {
      $lookup: {
        from: 'exercises',
        localField: 'dailyProgress.exerciseStatus.exerciseId',
        foreignField: '_id',
        as: 'exerciseDetails',
      },
    },
    {
      $project: {
        _id: 1, // Include userChallengeProgress ID
        totalProgress: 1, // Include totalProgress at the root level
        dayName: '$dailyProgress.dayName',
        date: '$dailyProgress.date',
        timeTaken: '$dailyProgress.exerciseStatus.timeTaken',
        caloriesBurnt: '$dailyProgress.exerciseStatus.caloriesBurnt',
        exerciseDetails: {
          $map: {
            input: '$exerciseDetails',
            as: 'exercise',
            in: {
              name: '$$exercise.name',
              description: '$$exercise.description',
              targetMuscle: '$$exercise.targetMuscle',
              category: '$$exercise.category',
              rest: '$$exercise.rest',
            },
          },
        },
      },
    },
    {
      $group: {
        _id: {
          _id: '$_id', // Group by userChallengeProgress ID
          totalProgress: '$totalProgress', // Include totalProgress in the grouping
        },
        progress: {
          $push: {
            dayName: '$dayName',
            date: '$date',
            timeTaken: '$timeTaken',
            caloriesBurnt: '$caloriesBurnt',
            exerciseDetails: '$exerciseDetails',
          },
        },
      },
    },
    {
      $project: {
        _id: '$_id._id',
        totalProgress: '$_id.totalProgress',
        progress: 1,
      },
    },
  ])
  return userExerciseLog
}

export const getChallengeHistory = async (id, dateFromFrontend) => {
  // const formattedDate = new Date(dateFromFrontend)
  // const [month, day, year] = dateFromFrontend.split('/')
  // const startDate = new Date(year, month - 1, day)
  // const endDate = new Date(year, month - 1, day, 23, 59, 59, 999)

  const startDate = new Date(dateFromFrontend)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(dateFromFrontend)
  endDate.setUTCHours(23, 59, 59, 999)

  console.log(dateFromFrontend)
  console.log(startDate)
  console.log(endDate)

  const result = await UserChallengeProgress.aggregate([
    // Step 1: Match documents by user ID
    { $match: { user: toObjectId(id) } },

    // Step 2: Filter dailyProgress array by date and isAttempted true
    {
      $addFields: {
        dailyProgress: {
          $filter: {
            input: '$dailyProgress',
            as: 'dp',
            cond: {
              $and: [
                { $gte: ['$$dp.date', startDate] },
                { $lt: ['$$dp.date', endDate] },
                // { $eq: ['$$dp.isAttempted', true] },
              ],
            },
          },
        },
      },
    },

    // Step 3: Filter exerciseStatus array by isFinished true
    {
      $addFields: {
        dailyProgress: {
          $map: {
            input: '$dailyProgress',
            as: 'dp',
            in: {
              $mergeObjects: [
                '$$dp',
                {
                  exerciseStatus: {
                    $filter: {
                      input: '$$dp.exerciseStatus',
                      as: 'es',
                      cond: { $eq: ['$$es.isFinished', true] },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },

    // Step 4: Ensure there is at least one matching dailyProgress entry
    { $match: { 'dailyProgress.0': { $exists: true } } },

    // Step 5: Populate the challenge field
    {
      $lookup: {
        from: 'challenges',
        localField: 'challenge',
        foreignField: '_id',
        as: 'challengeDetails',
      },
    },
    { $unwind: '$challengeDetails' },

    // Step 6: Populate the exerciseStatus.exerciseId field
    {
      $lookup: {
        from: 'exercises',
        localField: 'dailyProgress.exerciseStatus.exerciseId',
        foreignField: '_id',
        as: 'exerciseDetails',
      },
    },

    // Step 7: Combine exercise details into dailyProgress.exerciseStatus
    {
      $addFields: {
        dailyProgress: {
          $map: {
            input: '$dailyProgress',
            as: 'dp',
            in: {
              $mergeObjects: [
                '$$dp',
                {
                  exerciseStatus: {
                    $map: {
                      input: '$$dp.exerciseStatus',
                      as: 'es',
                      in: {
                        $mergeObjects: [
                          '$$es',
                          {
                            exerciseDetails: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$exerciseDetails',
                                    as: 'ed',
                                    cond: { $eq: ['$$ed._id', '$$es.exerciseId'] },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },

    // Project only necessary fields
    {
      $project: {
        user: 1,
        challenge: '$challengeDetails.name',
        dailyProgress: {
          date: 1,
          isAttempted: 1,
          attemptedAt: 1,
          completionInPercent: 1,
          dayName: 1,
          _id: 1,
          exerciseStatus: {
            exerciseId: 1,
            isFinished: 1,
            caloriesBurnt: 1,
            timeTaken: 1,
            'exerciseDetails.name': 1,
            'exerciseDetails.files': 1,
          },
        },
      },
    },
  ])

  return result
}

export const getChallengeLeaderboard = async (challenge) => {
  const progress = await UserChallengeProgress.find({ challenge: toObjectId(challenge._id) }).populate({
    path: 'user',
    select: 'file firstName lastName',
  })

  // Sort based on challenge type
  progress.sort((a, b) => {
    // Handle the case where points are zero
    if (a.points === 0 && b.points !== 0) return 1
    if (b.points === 0 && a.points !== 0) return -1
    if (a.points === 0 && b.points === 0) return 0

    // First sort by points (higher points come first)
    if (a.points !== b.points) return b.points - a.points

    // If points are the same, sort by finishedAt date (earlier finish comes first)
    const finishedAtA = new Date(a.finishedAt)
    const finishedAtB = new Date(b.finishedAt)

    return finishedAtA - finishedAtB
  })

  return progress
}

export const getUserStats = async (userId, completedChallenges) => {
  const user = await User.findById(userId)
  let totalPoints = user.points
  let totalTimeTakenSum = user.totalTimeInSeconds
  let totalCaloriesBurntSum = user.totalCaloriesBurnt
  let totalCompletedChallenges = completedChallenges.length

  const challengeComplete = await Challenge.aggregate([
    {
      $match: {
        user: { $in: [toObjectId(userId)] },
        status: CHALLENGE_STATUS.CLT, // Assuming "complete" indicates a finished challenge
      },
    },
    {
      $lookup: {
        from: 'userchallengeprogresses',
        let: { challengeId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$challenge', '$$challengeId'] }, { $eq: ['$user', toObjectId(userId)] }],
              },
            },
          },
          {
            $project: {
              points: 1,
            },
          },
        ],
        as: 'progressData',
      },
    },
    {
      $unwind: '$progressData', // Unwind the progressData array to return one document per progress
    },
    {
      $project: {
        _id: 1,
        name: 1,
        image: 1,
        'progressData.points': 1,
      },
    },
  ])

  const incompleteComplete = await Challenge.aggregate([
    {
      $match: {
        user: { $in: [toObjectId(userId)] }, // Match challenges that include the user
        status: 'live', // Assuming "live" indicates an ongoing challenge
      },
    },
    {
      $lookup: {
        from: 'userchallengeprogresses',
        let: { challengeId: '$_id', userId: toObjectId(userId) }, // Use challengeId and userId in the pipeline
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$challenge', '$$challengeId'] }, // Match the challenge
                  { $eq: ['$user', '$$userId'] }, // Match the user
                ],
              },
            },
          },
        ],
        as: 'progressData',
      },
    },
    {
      $unwind: '$progressData',
    },
    {
      $addFields: {
        exerciseDaysCount: {
          $size: {
            $filter: {
              input: '$progressData.dailyProgress',
              as: 'progress',
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$$progress.exerciseStatus',
                        as: 'status',
                        cond: { $eq: ['$$status.isFinished', true] },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
        totalDays: { $size: '$progressData.dailyProgress' }, // Total number of days
        totalProgress: '$progressData.totalProgress',
      },
    },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        image: { $first: '$image' },
        exerciseDaysCount: { $sum: '$exerciseDaysCount' },
        totalProgress: { $sum: '$totalProgress' },
        totalDays: { $first: '$totalDays' },
      },
    },
  ])
  return {
    totalTimeTaken: totalTimeTakenSum,
    totalCaloriesBurnt: totalCaloriesBurntSum,
    totalCompletedChallenges,
    totalPoints,
    challengeComplete,
    incompleteComplete,
  }
}

export const getChallengeDetails = async (id) => {
  const challenge = await Challenge.findById(id).populate({
    path: 'exercise.exerciseId',
    select: 'name',
  })
  const activeDaysCount = challenge.activeDays?.filter((day) => day.isActive).length

  // Create an object to store weeks and their start/end dates
  const weeks = {}

  challenge.activeDays.forEach((day) => {
    const weekNumber = day.weekNumber
    const date = new Date(day.date)

    if (!weeks[weekNumber]) {
      weeks[weekNumber] = {
        weekNumber,
        startDate: date,
        endDate: date,
      }
    } else {
      if (date < weeks[weekNumber].startDate) {
        weeks[weekNumber].startDate = date
      }
      if (date > weeks[weekNumber].endDate) {
        weeks[weekNumber].endDate = date
      }
    }
  })

  // Convert weeks object to an array and format dates
  const weekCount = Object.values(weeks).map((week) => ({
    weekNumber: week.weekNumber,
    startDate: week.startDate.toISOString().split('T')[0],
    endDate: week.endDate.toISOString().split('T')[0],
  }))

  const challengeDetails = {
    challenge,
    activeDaysCount,
    weekCount,
  }

  return challengeDetails
}

export const getBadgeDetails = async (id) => {
  const badge = await Badge.findById(id).select('-type -createdAt -updatedAt')

  return badge
}

export const retrieveUserChallange = async (id, challengeId) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set the time to the start of the day
  const retrieveChallenge = await UserChallengeProgress.aggregate([
    {
      $match: {
        user: toObjectId(id), // Match by user ID
        challenge: toObjectId(challengeId), // Match by challenge ID
      },
    },
    {
      $unwind: '$dailyProgress',
    },
    {
      $unwind: '$dailyProgress.exerciseStatus',
    },
    {
      $match: {
        'dailyProgress.date': today, // Match the current date
        'dailyProgress.exerciseStatus.isFinished': false,
      },
    },
    {
      $lookup: {
        from: 'exercises',
        localField: 'dailyProgress.exerciseStatus.exerciseId',
        foreignField: '_id',
        as: 'exerciseDetails',
      },
    },
    {
      $project: {
        _id: 1, // Include userChallengeProgress ID
        totalProgress: 1, // Include totalProgress at the root level
        dayName: '$dailyProgress.dayName',
        date: '$dailyProgress.date',
        timeTaken: '$dailyProgress.exerciseStatus.timeTaken',
        caloriesBurnt: '$dailyProgress.exerciseStatus.caloriesBurnt',
        exerciseDetails: {
          $map: {
            input: '$exerciseDetails',
            as: 'exercise',
            in: {
              name: '$$exercise.name',
              description: '$$exercise.description',
              targetMuscle: '$$exercise.targetMuscle',
              category: '$$exercise.category',
              rest: '$$exercise.rest',
            },
          },
        },
      },
    },
    {
      $group: {
        _id: {
          _id: '$_id', // Group by userChallengeProgress ID
          totalProgress: '$totalProgress', // Include totalProgress in the grouping
        },
        progress: {
          $push: {
            dayName: '$dayName',
            date: '$date',
            timeTaken: '$timeTaken',
            caloriesBurnt: '$caloriesBurnt',
            exerciseDetails: '$exerciseDetails',
          },
        },
      },
    },
    {
      $project: {
        _id: '$_id._id',
        totalProgress: '$_id.totalProgress',
        progress: 1,
      },
    },
  ])
  return retrieveChallenge
}

export const getAllZealAdminChallenges = async ({ pipeline, paginateOptions }) => {
  const myAggregate = Challenge.aggregate(pipeline)
  const data = await Challenge.aggregatePaginate(myAggregate, paginateOptions)

  return data
}

export const getFriendsChallenges = async (id) => {
  const user = await User.findById(id)

  const followingIds = user.following.map((id) => id)
  const challenge = await Challenge.find({
    challengeCreator: { $in: followingIds },
    type: 'friends',
    status: CHALLENGE_STATUS.LIV,
  })
    .populate({
      path: 'user',
      select: '-password -refreshTokens -followers -following -createdAt -updatedAt',
    })
    .populate({
      path: 'challengeCreator',
      select: 'firstName lastName file',
    })
    .sort({ createdAt: -1 })

  return challenge
}

export const getUserAllCurrentChallenges = async (id) => {
  const challenges = await Challenge.find({
    user: { $in: toObjectId(id) },
    status: CHALLENGE_STATUS.LIV,
  })
    .populate({
      path: 'user',
      select: '-password -refreshTokens -followers -following -createdAt -updatedAt',
    })
    .sort({ createdAt: -1 })
  const challengeIds = challenges.map((challenge) => challenge._id)
  console.log('challengeIds', challengeIds)
  // Find progress for the user in these challenges
  const progress = await UserChallengeProgress.find({
    user: toObjectId(id),
    challenge: { $in: challengeIds },
  })

  const dailyProgress = progress.map((days) => days.dailyProgress)
  console.log('dailyProgress', dailyProgress)
  const attemptedDays = dailyProgress.map((days) => days.filter((day) => day.isAttempted).length)
  const totalDays = progress.map((days) => days.dailyProgress.length)
  return { challenges, totalDays, attemptedDays }
}

export const getAllFeaturedChallenges = async (id) => {
  const challenges = await Challenge.find({
    type: 'zeal',
    status: CHALLENGE_STATUS.LIV,
    isFeatured: true,
  })
  return challenges
}

export const getUserCreatedChallenges = async (id) => {
  const challenges = await Challenge.find({
    challengeCreator: id,
    $or: [
      { group: { $exists: false } }, // Check if group field does not exist
      { group: null }, // Check if group field is null
    ],
  }).sort({ createdAt: -1 })
  return challenges
}

export const getSpecificCommunityChallenges = async (id) => {
  const challenges = await Challenge.find({
    group: toObjectId(id),
    status: CHALLENGE_STATUS.LIV,
  }).populate({
    path: 'group',
    select: '-groupMembers -post -groupAdmin -following -createdAt -updatedAt -badges -age -level -groupDescription',
  })
  return challenges
}

export const getAllPopularChallenges = async () => {
  // Fetch all challenges from the database
  const challenges = await Challenge.find({ status: CHALLENGE_STATUS.LIV })

  // Fetch all users from the database
  const totalUsers = await User.countDocuments({})

  // Calculate the threshold for popularity (25% of total users)
  const popularityThreshold = totalUsers * 0.25

  // Filter challenges with 25% or more users
  const popularChallenges = challenges.filter((challenge) => {
    return challenge.user.length >= popularityThreshold
  })

  return popularChallenges
}

export const getCommunityChallenges = async (id) => {
  const groups = await Group.find({ 'groupMembers.memberId': id })
  const groupIds = groups.map((group) => group.id)

  const challenges = await Challenge.find({
    group: { $in: groupIds },
    status: CHALLENGE_STATUS.LIV,
  })
    .populate({
      path: 'group',
      select: '-groupMembers -post -groupAdmin -following -createdAt -updatedAt -badges -age -level -groupDescription',
    })
    .sort({ createdAt: -1 })
  return challenges
}

export const getallPostsPaginated = async ({ userId, paginateOptions }) => {
  // Step 1: Find all users followed by the current user and their groups
  const user = await User.findById(userId).lean()
  const followedUsers = user?.following || []

  const userGroups = await Group.find({ 'groupMembers.memberId': toObjectId(userId) }).lean()
  const groupIds = userGroups.map((group) => group._id)

  // Step 2: Aggregate posts
  const aggregateQuery = Post.aggregate([
    {
      $match: {
        $or: [
          { postOwner: toObjectId(userId), group: { $exists: false } },
          { postOwner: { $in: followedUsers }, group: { $exists: false } },
          { group: { $in: groupIds } },
        ],
      },
    },
    {
      $lookup: {
        from: 'users', // Assuming the user model is named 'User'
        localField: 'postOwner',
        foreignField: '_id',
        as: 'ownerDetails',
      },
    },
    {
      $lookup: {
        from: 'groups', // Assuming the group model is named 'Group'
        localField: 'group',
        foreignField: '_id',
        as: 'groupDetails',
      },
    },
    {
      $lookup: {
        from: 'comments', // Assuming the comment model is named 'Comment'
        localField: '_id',
        foreignField: 'post',
        as: 'comments',
      },
    },
    {
      $unwind: {
        path: '$ownerDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$groupDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
  ])

  console.log('paginateOptions', paginateOptions)
  const data = await Post.aggregatePaginate(aggregateQuery, paginateOptions)
  return data
}

export const getPostLike = async ({ userId, postId }) => {
  const data = await Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } }, { new: true }).populate(
    'likes',
    '-password -refreshTokens'
  )
  return data
}

export const getPostdisLike = async ({ userId, postId }) => {
  const data = await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } }, { new: true }).populate(
    'likes',
    '-password -refreshTokens'
  )
  return data
}

export const getGroupMembersPaginated = async ({ pipeline, paginateOptions }) => {
  const myAggregate = Group.aggregate(pipeline)
  const data = await Group.aggregatePaginate(myAggregate, paginateOptions)
  return data
}

export const getGroupDetails = async ({ id }) => {
  // First, get the group data with posts populated
  const groupData = await Group.findById(id)
    .populate(
      'groupMembers.memberId',
      '-refreshTokens -createdAt -updatedAt -followers -following -challenges -badges -userTypes -lastActive -level -points -email -role -weight -height -gender -age -location -username -about -fcmToken'
    )
    .populate({
      path: 'post',
      options: { sort: { createdAt: -1 } }, // Sort posts by createdAt in descending order
      populate: {
        path: 'postOwner', // Assuming each post has a postOwner field referencing the User model
        select: 'firstName lastName file', // Select specific fields from postOwner
      },
    })
    .populate({
      path: 'badges.badgeId',
      select: 'image',
    })

  // Get post IDs to fetch related comments
  const postIds = groupData.post.map((post) => post._id)

  // Fetch comments for all posts
  const comments = await Comment.find({ post: { $in: postIds } })

  // Attach comments to each post
  const groupDataWithComments = groupData.toObject() // Convert Mongoose document to plain object
  groupDataWithComments.post = groupDataWithComments.post.map((post) => {
    return {
      ...post,
      comments: comments.filter((comment) => comment.post.toString() === post._id.toString()), // Attach comments for each post
    }
  })

  return groupDataWithComments
}

export const getPostDetails = async ({ id }) => {
  const details = await Post.findById(id)
    // .populate('comments')
    .populate(
      'postOwner',
      '-password -refreshTokens -email -followers -following -challenges -badges -createdAt -updatedAt -lastActive -location'
    )
    .populate('group', '-groupMembers -groupAdmin -post')

  const comments = await Comment.find({ post: id }).populate(
    'commentOwner',
    '-password -refreshTokens -email -followers -following -challenges -badges -createdAt -updatedAt -lastActive -location'
  )

  const data = { details, comments }

  return data
}

export const updateGroupDetails = async ({ id, body }) => {
  const data = await Group.findByIdAndUpdate(id, { ...body }, { new: true })
  return data
}

export const addGroup = async ({ body }) => {
  let newGroup = await new Group({ ...body }).save()

  return newGroup
}

export const createPost = async ({ body }) => {
  console.log(body)
  let newPost = await new Post({ ...body }).save()
  // Check if 'group' field exists in body and is not empty
  if (body?.group) {
    // Get the group ID from the body
    const groupId = body?.group

    // Find the group by ID and update its post array

    await Group.findByIdAndUpdate(groupId, { $push: { post: newPost._id } }, { new: true })
  }
  return newPost
}

export const createExercise = async ({ body }) => {
  // console.log('body inside:', body)
  let newExercise = await new Exercise({ ...body }).save()
  return newExercise
}

export const createComment = async ({ body }) => {
  let newComment = await new Comment({ ...body }).save()
  newComment = await Comment.findById(newComment._id)
    .populate({
      path: 'commentOwner',
      select: 'firstName lastName file', // Select specific fields from commentOwner
    })
    .exec()
  return newComment
}

export const createBadge = async ({ body }) => {
  let newBadge = await new Badge({ ...body }).save()
  return newBadge
}

export const createErrorLog = async ({ body }) => {
  let newErrorLog = await new ErrorLog({ ...body }).save()
  return newErrorLog
}

export const createChallenge = async (body) => {
  // console.log('service body', body)
  let newChallenge = await new Challenge({ ...body }).save()
  return newChallenge
}

export const updatePost = async ({ id, body }) => {
  let updatedPost = await Post.findByIdAndUpdate(id, body, { new: true })
  return updatedPost
}

export const updateComment = async ({ id, body }) => {
  let updatedComment = await Comment.findByIdAndUpdate(id, body, { new: true })
    .populate({
      path: 'commentOwner',
      select: 'firstName lastName file', // Select specific fields from commentOwner
    })
    .exec()
  return updatedComment
}

export const updateBadge = async ({ id, body }) => {
  let updatedBadge = await Badge.findByIdAndUpdate(id, body, { new: true })
  return updatedBadge
}

export const updateChallenge = async ({ id, body }) => {
  let updatedChallenge = await Challenge.findByIdAndUpdate(id, body, { new: true })
  return updatedChallenge
}

export const editStaff = async ({ id, body }) => {
  let user = await User.findByIdAndUpdate(id, { ...body })

  if (user) {
    return false
  }

  return user
}

export const getUsersPaginated = async ({ pipeline, paginateOptions }) => {
  const myAggregate = User.aggregate(pipeline)
  const data = await User.aggregatePaginate(myAggregate, paginateOptions)
  return data
}

// -----oauth -----

export const authenticateGoogleUser = async (token_id) => {
  const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID)
  const clientResponse = await client.verifyIdToken({ idToken: token_id, audience: process.env.GOOGLE_OAUTH_CLIENT_ID })

  const { email_verified, picture, email, given_name, family_name } = clientResponse.payload

  if (!email_verified) return null

  // const user = await checkUserExists(null, email);

  const signupUserData = { email, picture, firstName: given_name, lastName: family_name }
  return signupUserData
  // let res;

  // if (isEmpty(user))
  //     res = await signupOAuthUser(signupUserData)
  // else
  //     res = await loginOAuthUser()

  // return res
}

export const authenticateFacebookUser = async (access_token) => {
  const fbUser = await getFacebookUserData(access_token)

  if (isEmpty(fbUser)) return null

  const signupUserData = {
    email: fbUser.email,
    file: fbUser.picture.data.url,
    firstName: fbUser.first_name,
    lastName: fbUser.last_name,
    userTypes: [USER_TYPES.USR],
    role: { name: SYSTEM_USER_ROLE.USR, shortName: getRoleShortName(USER_TYPES.USR, SYSTEM_USER_ROLE.USR) },
    level: USER_LEVELS.BEG,
  }
  return signupUserData
}

export const signupOAuthUser = async (signupUserData, fcmToken) => {
  const { email, picture, firstName, lastName } = signupUserData

  const newUser = new User({
    email,
    file: picture,
    firstName,
    lastName,
    accountType: 'Google-Account',
    userTypes: [USER_TYPES.USR],
    role: { name: SYSTEM_USER_ROLE.USR, shortName: getRoleShortName(USER_TYPES.USR, SYSTEM_USER_ROLE.USR) },
    level: USER_LEVELS.BEG,
    fcmToken,
  })

  await newUser.save()

  const sendEmail = await new Email({ email })
  const emailProps = { firstName }
  await sendEmail.welcomeToZeal(emailProps)

  return newUser.toObject()
}

export const signinOAuthUser = async (user, ip) => {
  const token = {
    _id: user._id,
    role: user.role,
    userTypes: user.userTypes,
  }
  const jwtToken = await generateToken(token)

  // const refreshTokenPayload = {
  //   _id: user._id,
  //   role: user.role,
  // }
  // console.log('refreshTokenPayload', refreshTokenPayload)
  // const refreshToken = await generateToken(refreshTokenPayload, ip)
  // await refreshToken.save()

  return {
    data: {
      user,
      tokens: {
        accessToken: jwtToken,
      },
    },
    // refreshToken: refreshToken.token,
  }
}
