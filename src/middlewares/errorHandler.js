import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import Email from '../utils/email'
import StackTracey from 'stacktracey'
import { ErrorLog } from '../models'
const transformError = (req, err) => {
  const stack = new StackTracey(err)
  const { fileRelative, line } = stack.items[0]

  const newErr = {
    message: err.message,
    timeStamp: new Date().toUTCString(),
    apiPath: req.path,
    apiMethod: req.method,
    apiHost: req.hostname,
    file: fileRelative,
    line,
    db: req.currentDB,
  }
  return newErr
}

export const errorHandler = async (err, req, res, next) => {
  console.log('[❎ error-middleware ]', err)
  const newErr = transformError(req, err)

  if (req.hostname !== 'localhost') {
    console.log('[📧 notify-error]', newErr)
    try {
      const newErrorLog = new ErrorLog(newErr)
      await newErrorLog.save()
      await notifyError(newErr)
    } catch (error) {
      console.error('[❎ error-notify ] ', error)
    }
  }

  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
}

export const notifyError = async (error) => {
  // const isDevServer = error?.apiHost === 'riskdynamix-devapi.bimass.com' || error?.apiHost === '100.24.2.128'
  // const isDevServer = error?.apiHost === 'dev-api.risk-dynamix.com'
  const emailProps = {
    serverError: true,
    error: `<pre>${JSON.stringify(error)}</pre>`,
    // toMultiple: ['ayazhussainbs@gmail.com', 'muzammilsarwar0@gmail.com', 'madeeha.hiba123@gmail.com'],
    toMultiple: ['fatik.khan.200@gmail.com', 'zuhra.softthree@gmail.com'],
    isDevServer: process.env.NODE_ENV == 'development' ? true : false,
  }

  const sendEmail = await new Email()

  await sendEmail.sendServerError(emailProps)
}
