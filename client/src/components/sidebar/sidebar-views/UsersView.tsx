import Users from "@/components/common/Users"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { USER_STATUS } from "@/types/user"
import toast from "react-hot-toast"
import { GoSignOut } from "react-icons/go"
import { IoShareOutline } from "react-icons/io5"
import { LuCopy } from "react-icons/lu"
import { MdSend } from "react-icons/md"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import axios from "axios"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

function UsersView() {
    const navigate = useNavigate()
    const { viewHeight } = useResponsive()
    const { setStatus, currentUser } = useAppContext()
    const { socket } = useSocket()
    const [email, setEmail] = useState("")
    const [isSending, setIsSending] = useState(false)

    const copyURL = async () => {
        const url = window.location.href
        try {
            await navigator.clipboard.writeText(url)
            toast.success("URL copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy URL to clipboard")
            console.log(error)
        }
    }

    const shareURL = async () => {
        const url = window.location.href
        try {
            await navigator.share({ url })
        } catch (error) {
            toast.error("Unable to share URL")
            console.log(error)
        }
    }

    const leaveRoom = () => {
        socket.disconnect()
        setStatus(USER_STATUS.DISCONNECTED)
        navigate("/", {
            replace: true,
        })
    }

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) {
            toast.error("Please enter an email address")
            return
        }
        
        if (!currentUser.roomId) {
            toast.error("Room ID is not available")
            return
        }

        setIsSending(true)
        try {
            const response = await axios.post(`${BACKEND_URL}/api/send-invite`, {
                email,
                roomId: currentUser.roomId
            })
            
            if (response.data.success) {
                toast.success("Invitation sent successfully!")
                setEmail("")
            } else {
                toast.error("Failed to send invitation")
            }
        } catch (error) {
            console.error("Error sending invitation:", error)
            toast.error("Failed to send invitation")
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="flex flex-col p-4" style={{ height: viewHeight }}>
            <h1 className="view-title">Users</h1>
            {/* List of connected users */}
            <Users />
            <div className="flex flex-col items-center gap-4 pt-4">
                {/* Email invite form */}
                <form onSubmit={handleEmailSubmit} className="flex w-full gap-2">
                    <input
                        type="email"
                        placeholder="Enter email to invite"
                        className="flex-grow rounded-md bg-white p-3 text-black placeholder-gray-500"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSending}
                    />
                    <button
                        type="submit"
                        className="flex items-center justify-center rounded-md bg-primary p-3 text-black disabled:opacity-50"
                        title="Send invite"
                        disabled={isSending}
                    >
                        <MdSend size={22} />
                    </button>
                </form>
                <div className="flex w-full gap-4">
                    {/* Share URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={shareURL}
                        title="Share Link"
                    >
                        <IoShareOutline size={26} />
                    </button>
                    {/* Copy URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={copyURL}
                        title="Copy Link"
                    >
                        <LuCopy size={22} />
                    </button>
                    {/* Leave room button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-primary p-3 text-black"
                        onClick={leaveRoom}
                        title="Leave room"
                    >
                        <GoSignOut size={22} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UsersView
