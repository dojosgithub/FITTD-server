// utils/generateOTP.js
import speakeasy from 'speakeasy'
import { TOTP } from '../models'
import { isEmpty } from 'lodash'
import { generateOTToken } from './auth'

export const generateOTP = async (userIdentifier) => {
  // Generate a secret for OTP generation
  const secret = speakeasy.generateSecret({ length: 20 }).base32

  // Generate TOTP code
  const code = speakeasy.totp({
    digits: 6,
    secret: secret,
    encoding: 'base32',
    window: 6,
  })

  // Generate TOTP token for saving in DB
  const TOTPToken = await generateOTToken({ secret })

  // Check if there's an existing OTP record for the user
  const query = userIdentifier.email ? { email: userIdentifier.email } : { mobile: userIdentifier.mobile }

  // Try to update existing TOTP document
  let totp = await TOTP.findOneAndUpdate(query, { token: TOTPToken })

  // If no existing document found, create a new one
  if (isEmpty(totp)) {
    await new TOTP({
      ...query,
      token: TOTPToken,
    }).save()
  }

  // Return the generated OTP code and TOTP token
  return code
}
