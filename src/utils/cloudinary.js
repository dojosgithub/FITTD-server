import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'

cloudinary.config({
  cloud_name: process.env.COUDINARY_NAME,
  api_key: process.env.COUDINARY_KEY,
  api_secret: process.env.COUDINARY_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    resource_type: 'auto',
    folder: process.env.NODE_ENV == 'development' ? 'zeal-dev' : 'zeal',
    format: async (req, file) => file.originalname.substr(file.originalname.lastIndexOf('.') + 1), // supports promises as well
    public_id: (req, file) => Date.now().toString(),
    transformation: {
      flags: 'attachment',
    },
  },
})

export const parser = multer({
  storage: storage,
})
