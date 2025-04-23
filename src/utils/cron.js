// Using ES6 module import syntax
import { schedule } from 'node-cron'
import { AUCTION_STATUS, CAR_STATUS, SYSTEM_STAFF_ROLE, USER_TYPES } from './user'
import Email from '../utils/email'
import { Notification } from '../models/Notifications'
import { toObjectId } from './misc'
import { Comment, Group, Post, User, Badge } from '../models'
import { sendPushNotification } from './pushNotification'
const admin = require('firebase-admin')

// "0 0 * * 0", Every sunday at 00:00 - Required
// "59 14 * * 1", Every monday at 14:59
// "* * * * * *", Every second
// "* * * * *", Every minute
// 0 0 0 * * *, Every Midnight
// 0 0 * * *, every 24 hour

// Define the task using ES6 arrow function syntax
export const task = schedule(
  '0 0 0 * * *', // Every 24 hours
  // '* * * * *', // Every 24 hours
  () => {
    // if (process.env.NODE_ENV) automatedEmails()
    console.log('CRON JOB RUNNING!!!')
    StreakMasterBadge()
    EngagementDynamoBadge()
    ZealVeteranBadge()
    FollowerBadge()
    ActiveCommunityBadge()
    LongevityBadge()
    GrowthChampionBadge()
  },
  { timezone: 'America/New_York' }
)

async function StreakMasterBadge() {
  try {
    const twentyFourHoursAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
    const badge = await Badge.findOne({ key: 'SMB' })
    // Find users whose lastActive is within the last 24 hours
    const users = await User.find({
      lastActive: { $gte: twentyFourHoursAgo },
    })
    if (users.length > 0) {
      for (const user of users) {
        const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
        if (badgeExist != -1) {
          user.badges[badgeExist].quantity += 1
          await user.save()
        } else {
          const newBadge = {
            badgeId: badge._id,
            name: badge.name,
            _type: badge.type,
            image: badge.image,
            quantity: 1,
          }
          user.badges.push(newBadge)
          await user.save()
          if (user.fcmToken) {
            sendPushNotification({
              token: user.fcmToken,
              notification: {
                title: 'Congratulations!',
                body: `Congratulation! You’ve received a badge for starting activity streak.`,
              },
            })
          }
        }
      }
    } else {
      console.log('No users found who were active within the last 24 hours.')
    }
    const inactiveUsers = await User.find({
      lastActive: { $lt: twentyFourHoursAgo },
    })

    if (inactiveUsers.length > 0) {
      for (const user of inactiveUsers) {
        const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
        if (badgeExist != -1 && user.badges.length > 0) {
          user.badges.splice(badgeExist, 1)
          await user.save()
        }
      }
    } else {
      console.log('No users found who were inactive for more than 24 hours.')
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function EngagementDynamoBadge() {
  try {
    const badge = await Badge.findOne({ key: 'EDB' })
    const users = await User.find({})
    for (const user of users) {
      const joinedCommunityCount = await Group.countDocuments({ 'groupMembers.memberId': toObjectId(user._id) })
      const joinedCommunities = joinedCommunityCount >= 1
      const commentsCount = await Comment.countDocuments({ commentOwner: toObjectId(user._id) })
      const hasComments = commentsCount >= 5
      const postsCount = await Post.countDocuments({ postOwner: toObjectId(user._id) })
      const hasPosts = postsCount >= 1
      if (joinedCommunities && hasComments && hasPosts) {
        const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
        if (badgeExist == -1) {
          const newBadge = {
            badgeId: badge._id,
            name: badge.name,
            _type: badge.type,
            image: badge.image,
            quantity: 1,
          }
          user.badges.push(newBadge)
          await user.save()

          if (user.fcmToken) {
            sendPushNotification({
              token: user.fcmToken,
              notification: {
                title: 'Congratulations!',
                body: `Congratulation! You’ve received a badge for active participation.`,
              },
            })
          }
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function ZealVeteranBadge() {
  try {
    const badge = await Badge.findOne({ key: 'ZVB' })
    const users = await User.find({})

    for (const user of users) {
      // Check if the user already has the badge
      const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (badgeExist == -1) {
        const newBadge = {
          badgeId: badge._id,
          name: badge.name,
          _type: badge.type,
          image: badge.image,
          quantity: 1,
        }
        user.badges.push(newBadge)
        await user.save()
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'Congratulations!',
              body: `Congratulation! You’ve received a badge for an early zeal user.`,
            },
          })
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function FollowerBadge() {
  try {
    const badge = await Badge.findOne({ key: 'FB' })
    const badgeId = badge._id
    const users = await User.find({})
    const badgeUsers = users.filter((item) => item.followers.length >= 500)
    const noBadgeUsers = users.filter((item) => item.followers.length < 500)
    for (const user of badgeUsers) {
      const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (badgeExist == -1) {
        const newBadge = {
          badgeId: badge._id,
          name: badge.name,
          _type: badge.type,
          image: badge.image,
          quantity: 1,
        }
        user.badges.push(newBadge)
        await user.save()
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'Congratulations!',
              body: `Congratulation! You’ve received a badge for hitting 500 followers.`,
            },
          })
        }
        console.log('NOTIFICATION SEND')
      }

      if (!user && badgeExist != -1) {
        if (user.badges.length > 0) {
          user.badges.splice(badgeExist, 1)
          await user.save()
        }
      }
    }
    for (const user of noBadgeUsers) {
      const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (user && badgeExist != -1) {
        if (user.badges.length > 0) {
          user.badges.splice(badgeExist, 1)
          await user.save()
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function ActiveCommunityBadge() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  try {
    const badge = await Badge.findOne({ key: 'ACB' })
    const groups = await Group.find({
      updatedAt: { $gte: sevenDaysAgo },
    })
    const inactiveGroups = await Group.find({
      'badges.badgeId': toObjectId(badge._id),
      updatedAt: { $lte: sevenDaysAgo },
    })
    for (const group of groups) {
      // Check if the badge already exists
      const badgeExist = group?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (badgeExist == -1) {
        const newBadge = {
          badgeId: badge._id,
          name: badge.name,
          _type: badge.type,
          image: badge.image,
          quantity: 1,
        }
        group.badges.push(newBadge)
        await group.save()
        const user = await User.findById(group.groupAdmin[0])
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'Congratulations!',
              body: `Congratulation! Your community received a badge for consistent engagement.`,
            },
          })
        }
      }
    }
    for (const inactiveGroup of inactiveGroups) {
      const badgeExist = inactiveGroup?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (inactiveGroup && badgeExist != -1) {
        if (inactiveGroup.badges.length > 0) {
          inactiveGroup.badges.splice(badgeExist, 1)
          await inactiveGroup.save()
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function LongevityBadge() {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  try {
    const badge = await Badge.findOne({ key: 'LB' })
    const activeGroups = await Group.find({
      updatedAt: { $gte: threeMonthsAgo },
    })
    console.log('activeGroups', activeGroups)
    for (const group of activeGroups) {
      const badgeExist = group?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
      if (badgeExist == -1) {
        const newBadge = {
          badgeId: badge._id,
          name: badge.name,
          _type: badge.type,
          image: badge.image,
          quantity: 1,
        }
        group.badges.push(newBadge)
        await group.save()
        const user = await User.findById(group.groupAdmin[0])
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'Congratulations!',
              body: `Congratulation! Your community received a badge for three months of continuous activity.`,
            },
          })
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}

async function GrowthChampionBadge() {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  try {
    const badge = await Badge.findOne({ key: 'GCB' })
    const badgeId = badge._id
    const badgeName = badge.name

    const groups = await Group.find({
      'groupMembers.joinDate': { $gte: oneWeekAgo },
    })
    for (const group of groups) {
      const recentMembersCount = group.groupMembers.filter((member) => member.joinDate >= oneWeekAgo).length
      if (recentMembersCount >= 10) {
        const badgeExist = group?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
        if (badgeExist == -1) {
          const newBadge = {
            badgeId: badge._id,
            name: badge.name,
            _type: badge.type,
            image: badge.image,
            quantity: 1,
          }
          group.badges.push(newBadge)
          await group.save()
          const user = await User.findById(group.groupAdmin[0])
          if (user.fcmToken) {
            sendPushNotification({
              token: user.fcmToken,
              notification: {
                title: 'Congratulations!',
                body: `Congratulation! Your community received a badge for onboarding 10 new members this week.`,
              },
            })
          }
        }
      }
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}
