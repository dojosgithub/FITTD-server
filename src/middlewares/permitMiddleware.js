import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import _, { isEmpty } from 'lodash'

export const permitMiddleware = (permittedRoles) => (req, res, next) => {
  // const { role } = req.decodedRoleToken
  const { userTypes } = req.decoded
  console.log('userTypes', userTypes)

  console.log(permittedRoles, userTypes)
  if (permittedRoles.some((v) => userTypes.includes(v))) next()
  else return res.status(StatusCodes.FORBIDDEN).json({ message: getReasonPhrase(StatusCodes.FORBIDDEN) })
}
