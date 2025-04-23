import { Twilio } from 'twilio'
// import * as SMSTemplates from '@src/sms-templates'
import _ from 'lodash'

const accountSid = 'AC0dfa8aab71dbf77f24ce00c4d0a27aa9'
const authToken = '03d68ee371a5dd2d2c873876ab5fdf89'
const fromNumber = '+19192298696'

const client = new Twilio(accountSid, authToken)

export const sendSMS = async (body, to) => {
  await client.messages.create({
    body,
    from: fromNumber,
    to: `+${to}`,
  })
}

// Functions

/**
 * Create and send new game sms
 */
export const newGame = async (phoneNumbers, params) => {
  if (_.isEmpty(phoneNumbers)) return false
  await sendSMS(smsTemplate, phoneNumber)
}
