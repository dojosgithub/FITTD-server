// * Libraries

import jwt from 'jsonwebtoken'

// * Models
import { User } from '../models'

// * Configs
// import { getCognitoClient } from '../config/aws'

// * Utilities

// import TenantDB from '../utils/tenantDB'

// * Services

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

// -----oauth -----

// export const authenticateGoogleUser = async (token_id) => {
//   const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID)
//   const clientResponse = await client.verifyIdToken({ idToken: token_id, audience: process.env.GOOGLE_OAUTH_CLIENT_ID })

//   const { email_verified, picture, email, given_name, family_name } = clientResponse.payload

//   if (!email_verified) return null

//   // const user = await checkUserExists(null, email);

//   const signupUserData = { email, picture, firstName: given_name, lastName: family_name }
//   return signupUserData
//   // let res;

//   // if (isEmpty(user))
//   //     res = await signupOAuthUser(signupUserData)
//   // else
//   //     res = await loginOAuthUser()

//   // return res
// }

// export const authenticateFacebookUser = async (access_token) => {
//   const fbUser = await getFacebookUserData(access_token)

//   if (isEmpty(fbUser)) return null

//   const signupUserData = {
//     email: fbUser.email,
//     file: fbUser.picture.data.url,
//     firstName: fbUser.first_name,
//     lastName: fbUser.last_name,
//     userTypes: [USER_TYPES.USR],
//     role: { name: SYSTEM_USER_ROLE.USR, shortName: getRoleShortName(USER_TYPES.USR, SYSTEM_USER_ROLE.USR) },
//     level: USER_LEVELS.BEG,
//   }
//   return signupUserData
// }

// export const signupOAuthUser = async (signupUserData, fcmToken) => {
//   const { email, picture, firstName, lastName } = signupUserData

//   const newUser = new User({
//     email,
//     file: picture,
//     firstName,
//     lastName,
//     accountType: 'Google-Account',
//     userTypes: [USER_TYPES.USR],
//     role: { name: SYSTEM_USER_ROLE.USR, shortName: getRoleShortName(USER_TYPES.USR, SYSTEM_USER_ROLE.USR) },
//     level: USER_LEVELS.BEG,
//     fcmToken,
//   })

//   await newUser.save()

//   const sendEmail = await new Email({ email })
//   const emailProps = { firstName }
//   await sendEmail.welcomeToZeal(emailProps)

//   return newUser.toObject()
// }

// export const signinOAuthUser = async (user, ip) => {
//   const token = {
//     _id: user._id,
//     role: user.role,
//     userTypes: user.userTypes,
//   }
//   const jwtToken = await generateToken(token)

//   // const refreshTokenPayload = {
//   //   _id: user._id,
//   //   role: user.role,
//   // }
//   // console.log('refreshTokenPayload', refreshTokenPayload)
//   // const refreshToken = await generateToken(refreshTokenPayload, ip)
//   // await refreshToken.save()

//   return {
//     data: {
//       user,
//       tokens: {
//         accessToken: jwtToken,
//       },
//     },
//     // refreshToken: refreshToken.token,
//   }
// }
