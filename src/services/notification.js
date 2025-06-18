import { User, UserMeasurement } from '../models'
import { sendPushNotification } from '../utils'

const isMeasurementComplete = (measurement) => {
  if (!measurement) return false
  if (typeof measurement !== 'object') return false
  return measurement.value != null && measurement.unit != null
}

export const isUserMeasurementComplete = (measurementDoc) => {
  if (!measurementDoc) return false

  for (const [key, value] of Object.entries(measurementDoc.toObject())) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = value
      for (const field of Object.values(nested)) {
        if (!isMeasurementComplete(field)) return false
      }
    } else if (!isMeasurementComplete(value)) {
      return false
    }
  }

  return true
}
export const sendMeasurementUpdateReminders = async () => {
  const now = new Date()
  const oneMonthAgo = new Date(now)
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

  const users = await User.find({
    isVerified: true,
    createdAt: { $lte: oneMonthAgo },
    fcmToken: { $exists: true, $ne: null },
    $or: [
      { lastMeasurementReminderSentAt: { $exists: false } },
      { lastMeasurementReminderSentAt: { $lte: oneMonthAgo } },
    ],
  })

  for (const user of users) {
    const measurement = await UserMeasurement.findOne({ userId: user._id })

    if (measurement) {
      sendPushNotification({
        token: user.fcmToken,
        userId: user._id,
        notification: {
          title: 'Keep Your Fit Fresh!',
          body: `Your body measurements might change over time. Update them now to get the most accurate clothing recommendations.`,
        },
      })
      await User.updateOne({ _id: user._id }, { $set: { lastMeasurementReminderSentAt: now } })
    }
  }
}
export const sendIncompleteMeasurementReminders = async () => {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const users = await User.find({
    isVerified: true,
    createdAt: { $lte: oneWeekAgo },
    fcmToken: { $exists: true, $ne: null },
  })

  for (const user of users) {
    const measurement = await UserMeasurement.findOne({ userId: user._id })

    if (!measurement || !isUserMeasurementComplete(measurement)) {
      sendPushNotification({
        token: user.fcmToken,
        userId: user._id,
        notification: {
          title: 'Complete Your Profile!',
          body: `We noticed you haven’t finished adding your measurements yet. Complete them now to unlock your perfect fit recommendations.`,
        },
      })
    }
  }
}
