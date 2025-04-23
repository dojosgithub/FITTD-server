import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import _, { isEmpty } from 'lodash'

export const decodeRoleTokenMiddleware = (req, res, next) => {
  const roleToken = req.cookies.roleToken
  console.log('roleToken', roleToken)
  if (roleToken)
    jwt.verify(roleToken, process.env.USER_ROLE_JWT_SECRET_KEY, async (err, decoded) => {
      if (err) {
        console.log('[🖥️ decode-role-token] Error:', err)
        // return res.status(StatusCodes.UNAUTHORIZED).json({ message: err.message })
      }
      if (decoded) {
        // console.log('[🖥️ decode-role-token] :', decoded)
        req.decodedRoleToken = decoded
        req.currentDB = decoded.sanitizeCompanyName
        console.log('[🏢 current-company-name] :', decoded.sanitizeCompanyName)
      }
      next()
    })
  next()
}
