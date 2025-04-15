import mongoose, { Schema, Document } from "mongoose";

export interface IRoom extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>({
  name: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
RoomSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IRoom>("Room", RoomSchema); 