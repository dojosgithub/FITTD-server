const jwt = require('jsonwebtoken')
import { StatusCodes } from 'http-status-codes'
import { User } from '../models'

// const RefreshToken = require('../models/RefreshToken')
// import _, { isEmpty } from 'lodash'

// export const Authenticate = (req, res, next) => {
//   const { role } = req.body

//   let token = req.headers['x-access-token'] || req.headers.authorization
//   if (isEmpty(token)) return res.status(STATUS.unAuthorized).json({ message: 'Unauthorized - Token was not provided' })
//   if (token.startsWith('Bearer ')) {
//     // Remove Bearer from string
//     token = token.slice(7, token.length).trimLeft()
//   }
//   jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, user) => {
//     if (err) return res.status(STATUS.unAuthorized).json({ message: err.message })
//     req.user = user
//     req.role = user.role

//     const refreshTokens = await RefreshToken.find({ user: user._id })
//     req.user.ownsToken = (token) => !!refreshTokens.find((x) => x.token === token)

//     return next()
//   })
// }

export const Authenticate =
  (config = { authorize: true }) =>
  (req, res, next) => {
    let token = req.headers['x-access-token'] || req.headers['authorization'] // Express headers are auto converted to lowercase
    if (token) {
      // Remove Bearer from string
      token = token.slice(7, token.length)
      // console.log('token', token)
      jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
        // console.log('decoded', decoded)
        if (decoded) {
          const user = await User.findById(decoded._id)
          if (!user) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
              message: 'User does not exist. Please login again.',
            })
          }
          req.decoded = decoded
          next()
        } else {
          res.status(StatusCodes.UNAUTHORIZED).json({
            message: 'Token is not valid, please login again',
          })
        }
      })
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Auth token is not supplied',
      })
    }
  }
