// * Libraries

import jwt from 'jsonwebtoken'

// * Models
import { Product, User } from '../models'
import Email from '../utils/email'
import { OAuth2Client } from 'google-auth-library'
import { getCategoriesName } from '../utils'

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

export const authenticateGoogleUser = async (token_id) => {
  const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID)
  const clientResponse = await client.verifyIdToken({ idToken: token_id, audience: process.env.GOOGLE_OAUTH_CLIENT_ID })

  const { email_verified, picture, email, given_name, family_name } = clientResponse.payload

  if (!email_verified) return null

  const signupUserData = { email, picture, firstName: given_name, lastName: family_name }
  return signupUserData
}

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

export const signupOAuthUser = async (signupUserData, fcmToken) => {
  const { email, picture, firstName, lastName } = signupUserData
  const fullName = `${firstName} ${lastName}`.trim()
  const newUser = new User({
    email,
    image: picture,
    name: fullName,
    accountType: 'Google',
    isVerified: true,
    fcmToken,
  })

  await newUser.save()

  const sendEmail = await new Email({ email })
  const emailProps = { name: fullName }
  await sendEmail.welcomeToFITTD(emailProps)

  return newUser.toObject()
}

export const signinOAuthUser = async (user) => {
  const token = {
    _id: user._id,
  }
  const jwtToken = await generateToken(token)

  return {
    data: {
      user,
      tokens: {
        accessToken: jwtToken,
      },
    },
  }
}

export const updateOrCreateProductCollection = async (collectionName, groupedByType) => {
  const categories = getCategoriesName()

  let allProducts = []

  for (const category of categories) {
    const productsInCategory = groupedByType[category] || []

    const formattedProducts = productsInCategory.map((product) => ({
      ...product,
      brand: collectionName,
      category,
    }))

    allProducts = [...allProducts, ...formattedProducts]
  }

  // Option 1: Clear and insert fresh
  await Product.deleteMany({ brand: collectionName })
  await Product.insertMany(allProducts)

  return { message: `Products for ${collectionName} updated.`, count: allProducts.length }
}
