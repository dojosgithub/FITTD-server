import { User, UserMeasurement } from '../models'
import { sendPushNotification } from '../utils'

const isMeasurementComplete = (m) => !!m && typeof m === 'object' && m.value != null && m.unit != null

export const isUserMeasurementComplete = (measurementDoc) => {
  if (!measurementDoc) return false

  const doc = measurementDoc.toObject()
  const gender = doc.gender

  // Define required fields based on gender
  const requiredFields = {
    male: {
      upperBody: ['chest', 'shoulderWidth', 'bicep', 'sleevesLength', 'torsoHeight'],
      lowerBody: ['waist', 'hip', 'inseam', 'legLength', 'thighCircumference'],
    },
    female: {
      upperBody: ['bust', 'bandSize', 'cupSize', 'sleevesLength', 'torsoHeight'],
      lowerBody: ['waist', 'hip', 'inseam', 'legLength'],
    },
  }

  const commonFields = {
    height: true,
    footMeasurement: ['footLength', 'footWidth'],
    handMeasurement: ['handLength', 'handWidth'],
    headMeasurement: ['headCircumference'],
    faceMeasurement: ['faceLength', 'faceWidth'],
  }

  const genderFields = requiredFields[gender]
  if (!genderFields) return false

  // ✅ Check top-level height
  if (commonFields.height && !isMeasurementComplete(doc.height)) {
    return false
  }

  // ✅ Check gender-specific upperBody and lowerBody
  for (const [section, keys] of Object.entries(genderFields)) {
    for (const key of keys) {
      if (!isMeasurementComplete(doc[section]?.[key])) {
        return false
      }
    }
  }

  // ✅ Check common sections for all users
  for (const [section, keys] of Object.entries(commonFields)) {
    if (section === 'height') continue // already checked
    for (const key of keys) {
      if (!isMeasurementComplete(doc[section]?.[key])) {
        return false
      }
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
      await sendPushNotification({
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
      await sendPushNotification({
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
