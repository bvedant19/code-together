import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import User from "../models/User"

interface AuthRequest extends Request {
    user?: any
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "")
        
        if (!token) {
            return res.status(401).json({ message: "No token, authorization denied" })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as { id: string }
        const user = await User.findById(decoded.id).select("-password")

        if (!user) {
            return res.status(401).json({ message: "User not found" })
        }

        req.user = user
        next()
    } catch (error) {
        res.status(401).json({ message: "Token is not valid" })
    }
} 