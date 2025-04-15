import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User as UserType } from "./types/user"
import { Server } from "socket.io"
import path from "path"
import sgMail from "@sendgrid/mail"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import User from "./models/User"
import Room from "./models/Room"
import { auth } from "./middleware/auth"

dotenv.config()

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
	console.error('SENDGRID_API_KEY is not set in environment variables');
} else {
	sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/code-sync")
	.then(() => console.log("Connected to MongoDB"))
	.catch(err => console.error("MongoDB connection error:", err))

const app = express()

// Configure CORS
app.use(cors({
	origin: process.env.FRONTEND_URL || "http://localhost:5173",
	methods: ["GET", "POST"],
	credentials: true
}))

app.use(express.json())

app.use(express.static(path.join(__dirname, "public"))) // Serve static files

// Auth routes
app.post("/api/auth/register", async (req: Request, res: Response) => {
	const { email, username, password } = req.body;

	try {
		// Check if user already exists
		let user = await User.findOne({ $or: [{ email }, { username }] });
		if (user) {
			return res.status(400).json({ 
				success: false, 
				message: "User already exists with this email or username" 
			});
		}

		// Create new user
		user = new User({
			email,
			username,
			password
		});

		await user.save();

		// Create JWT token
		const token = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET || "your-secret-key",
			{ expiresIn: "24h" }
		);

		res.json({
			success: true,
			token,
			user: {
				id: user._id,
				email: user.email,
				username: user.username
			}
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ 
			success: false, 
			message: "Error in registration" 
		});
	}
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
	const { email, password } = req.body;

	try {
		// Check if user exists
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ 
				success: false, 
				message: "Invalid credentials" 
			});
		}

		// Check password
		const isMatch = await user.comparePassword(password);
		if (!isMatch) {
			return res.status(400).json({ 
				success: false, 
				message: "Invalid credentials" 
			});
		}

		// Create JWT token
		const token = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET || "your-secret-key",
			{ expiresIn: "24h" }
		);

		res.json({
			success: true,
			token,
			user: {
				id: user._id,
				email: user.email,
				username: user.username
			}
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ 
			success: false, 
			message: "Error in login" 
		});
	}
});

// Room routes
app.post("/api/rooms", auth, async (req: Request, res: Response) => {
	try {
		const { name } = req.body;
		const userId = (req as any).user.id;

		const room = new Room({
			name,
			createdBy: userId,
			participants: [userId]
		});

		await room.save();

		res.json({
			success: true,
			room: {
				id: room._id,
				name: room.name,
				createdBy: room.createdBy,
				participants: room.participants
			}
		});
	} catch (error) {
		console.error("Error creating room:", error);
		res.status(500).json({ 
			success: false, 
			message: "Error creating room" 
		});
	}
});

app.post("/api/rooms/:roomId/join", auth, async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params;
		const userId = (req as any).user.id;

		const room = await Room.findById(roomId);
		if (!room) {
			return res.status(404).json({ 
				success: false, 
				message: "Room not found" 
			});
		}

		if (!room.participants.includes(userId)) {
			room.participants.push(userId);
			await room.save();
		}

		res.json({
			success: true,
			room: {
				id: room._id,
				name: room.name,
				createdBy: room.createdBy,
				participants: room.participants
			}
		});
	} catch (error) {
		console.error("Error joining room:", error);
		res.status(500).json({ 
			success: false, 
			message: "Error joining room" 
		});
	}
});

// Email endpoint
app.post("/api/send-invite", auth, async (req: Request, res: Response) => {
	const { email, roomId } = req.body
	console.log("Received invite request:", { email, roomId })
	
	if (!email || !roomId) {
		return res.status(400).json({ 
			success: false, 
			message: "Email and roomId are required" 
		})
	}

	const roomUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/editor/${roomId}`

	const msg = {
		to: email,
		from: "codetogether17@gmail.com",
		subject: "Join my Code Sync room",
		text: `Join my coding session at ${roomUrl}`,
	}

	try {
		await sgMail.send(msg)
		console.log("Email sent successfully to:", email)
		res.json({ success: true, message: "Invitation sent successfully" })
	} catch (error) {
		console.error("Error sending email:", error)
		res.status(500).json({ success: false, message: "Failed to send invitation" })
	}
})

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: "*",
	},
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
})

let userSocketMap: UserType[] = []

// Function to get all users in a room
function getUsersInRoom(roomId: string): UserType[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): UserType | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: true, cursorPosition }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})
})

const PORT = process.env.PORT || 3000

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
