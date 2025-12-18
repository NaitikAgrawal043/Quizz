import mongoose, { Schema, Document, Model } from 'mongoose';

// --- Interfaces ---

export interface IBatch extends Document {
  name: string;
  description?: string;
  createdAt: Date;
}

export interface IUser extends Document {
  email: string;
  passwordHash?: string; // Optional for OAuth
  name: string;
  rollNumber?: number;
  role: 'user' | 'admin';
  batches: mongoose.Types.ObjectId[]; // References to Batches
  createdAt: Date;
}

export interface IQuestionOption {
  id: string;
  text: string;
  image?: string;
}

export interface IQuestion extends Document {
  testId: mongoose.Types.ObjectId;
  sectionId?: string;
  type: 'mcq' | 'multi-mcq' | 'integer' | 'short';
  stem: string; // HTML
  options: IQuestionOption[];
  correctAnswer: any; // string | string[] | number
  marks: number;
  negativeMarks: number;
  explanation?: string; // HTML
  needsManualReview: boolean;
  createdAt: Date;
}

export interface ISection {
  id: string;
  name: string;
  order: number;
  timeLimitSeconds?: number;
}

export interface ITest extends Document {
  title: string;
  description?: string;
  durationSeconds: number;
  sections: ISection[];
  batches: mongoose.Types.ObjectId[];
  revealAnswersPolicy: 'after_grading' | 'immediate_after_expiry' | 'embargo';
  status: 'draft' | 'published' | 'archived';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IAnswer {
  questionId: mongoose.Types.ObjectId;
  givenAnswer: any;
  savedAt: Date;
  timeTakenSeconds?: number;
  isMarkedCorrect?: boolean;
  awardedMarks?: number;
  autoScored: boolean;
}

export interface IAttempt extends Document {
  testId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  startAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  answers: IAnswer[];
  status: 'in_progress' | 'submitted' | 'grading' | 'graded';
  score?: number;
  gradedAt?: Date;
  resultVisibilityAt?: Date;
  createdAt: Date;
}

// --- Schemas ---

const BatchSchema = new Schema<IBatch>({
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  name: { type: String, required: true },
  rollNumber: { type: Number, unique: true, sparse: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  batches: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
  createdAt: { type: Date, default: Date.now },
});

const QuestionSchema = new Schema<IQuestion>({
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
  sectionId: { type: String },
  type: { type: String, enum: ['mcq', 'multi-mcq', 'integer', 'short'], required: true },
  stem: { type: String, required: true },
  options: [{
    id: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String },
  }],
  correctAnswer: { type: Schema.Types.Mixed, required: true },
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  explanation: { type: String },
  needsManualReview: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const TestSchema = new Schema<ITest>({
  title: { type: String, required: true },
  description: { type: String },
  durationSeconds: { type: Number, required: true },
  sections: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    timeLimitSeconds: { type: Number },
  }],
  batches: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
  revealAnswersPolicy: { type: String, enum: ['after_grading', 'immediate_after_expiry', 'embargo'], default: 'after_grading' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

const AttemptSchema = new Schema<IAttempt>({
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  submittedAt: { type: Date },
  answers: [{
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    givenAnswer: { type: Schema.Types.Mixed },
    savedAt: { type: Date, default: Date.now },
    timeTakenSeconds: { type: Number },
    isMarkedCorrect: { type: Boolean },
    awardedMarks: { type: Number },
    autoScored: { type: Boolean, default: true },
  }],
  status: { type: String, enum: ['in_progress', 'submitted', 'grading', 'graded'], default: 'in_progress' },
  score: { type: Number },
  gradedAt: { type: Date },
  resultVisibilityAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// --- Models ---

// Prevent overwriting models if they are already compiled (hot reload)
export const Batch = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Test = mongoose.models.Test || mongoose.model<ITest>('Test', TestSchema);
export const Question = mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema);
export const Attempt = mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);
