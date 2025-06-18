// const admin = require('firebase-admin')

// export const sendPushNotification = ({ token, userId, notification }) => {
//   const message = {
//     notification,
//     token,
//   }

//   admin
//     .messaging()
//     .send(message)
//     .then((response) => {
//       console.log('Notification sent:', response)
//       new Notification({
//         title: notification.title,
//         message: notification.body,
//         receivers: [{ userId }], // set isUnRead to default: true
//       }).save()
//     })
//     .catch((error) => {
//       console.error('Error sending notification:', error)
//     })
// }
import { Notification } from '../models' // Adjust path as needed
const admin = require('firebase-admin')

export const sendPushNotification = async ({ token, userId, notification }) => {
  const message = {
    notification,
    token,
  }

  try {
    const response = await admin.messaging().send(message)
    console.log('Notification sent:', response)

    // Save to DB
    await new Notification({
      title: notification.title,
      message: notification.body,
      receivers: [{ userId }], // isUnRead defaults to true
    }).save()
  } catch (error) {
    console.error('Error sending notification or saving to DB:', error)
  }
}
