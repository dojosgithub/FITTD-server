const admin = require('firebase-admin')

export const sendPushNotification = ({ token, notification }) => {
  const message = {
    notification,
    token,
  }

  admin
    .messaging()
    .send(message)
    .then((response) => {
      console.log('Notification sent:', response)
    })
    .catch((error) => {
      console.error('Error sending notification:', error)
    })
}
