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
  stem: string; // Markdown
  options: IQuestionOption[];
  correctAnswer: any; // string | string[] | number
  marks: number;
  negativeMarks: number;
  explanation?: string; // Markdown
  images: { url: string; publicId: string }[]; // Cloudinary uploaded images
  needsManualReview: boolean;
  timeLimit?: number; // Time limit in seconds for this specific question
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

export interface ITestSession extends Document {
  testId: mongoose.Types.ObjectId;
  status: 'waiting' | 'active' | 'paused' | 'finished';
  currentQuestionIndex: number;
  startedAt?: Date;
  updatedAt: Date;
}

export interface IAttemptResultItem {
  questionId: mongoose.Types.ObjectId;
  stem: string;
  options: IQuestionOption[];
  correctAnswer: unknown;
  explanation?: string;
  marks: number;
  negativeMarks: number;
  userAnswer: unknown;
  isCorrect: boolean;
  isAttempted: boolean;
  awardedMarks: number;
}

export interface IAttemptResult extends Document {
  attemptId: mongoose.Types.ObjectId;
  testId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  gradedAt: Date;
  resultVisibilityAt: Date;
  schemaVersion: number;
  items: IAttemptResultItem[];
  createdAt: Date;
  updatedAt: Date;
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
  images: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  }],
  needsManualReview: { type: Boolean, default: false },
  timeLimit: { type: Number, default: 60 }, // Default 60 seconds per question
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

const TestSessionSchema = new Schema<ITestSession>({
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true, unique: true },
  status: { type: String, enum: ['waiting', 'active', 'paused', 'finished'], default: 'waiting' },
  currentQuestionIndex: { type: Number, default: 0 },
  startedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
});

// Index: question lookups by test (used in /api/attempts/[id]/play and grading)
QuestionSchema.index({ testId: 1 });

// Index: test lookups by batch + status (used in /api/tests/user-attempts)
TestSchema.index({ batches: 1, status: 1 });

// Indexes: attempt lookups (used across results, user-attempts, grading, violations)
AttemptSchema.index({ userId: 1 });
AttemptSchema.index({ testId: 1 });
AttemptSchema.index({ testId: 1, status: 1 });
AttemptSchema.index({ userId: 1, testId: 1 }, { unique: true, sparse: true });

const AttemptResultSchema = new Schema<IAttemptResult>({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true },
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  incorrectCount: { type: Number, required: true },
  unattemptedCount: { type: Number, required: true },
  gradedAt: { type: Date, required: true },
  resultVisibilityAt: { type: Date, required: true },
  schemaVersion: { type: Number, default: 1 },
  items: [{
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    stem: { type: String, required: true },
    options: [{
      id: { type: String, required: true },
      text: { type: String, required: true },
      image: { type: String },
    }],
    correctAnswer: { type: Schema.Types.Mixed, required: true },
    explanation: { type: String },
    marks: { type: Number, required: true },
    negativeMarks: { type: Number, required: true },
    userAnswer: { type: Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, required: true },
    isAttempted: { type: Boolean, required: true },
    awardedMarks: { type: Number, required: true },
  }],
}, { timestamps: true });

AttemptResultSchema.index({ attemptId: 1 }, { unique: true });
AttemptResultSchema.index({ testId: 1, userId: 1 });
AttemptResultSchema.index({ userId: 1, createdAt: -1 });
AttemptResultSchema.index({ testId: 1, createdAt: -1 });

// --- Models ---

// Prevent overwriting models if they are already compiled (hot reload)
export const Batch = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Test = mongoose.models.Test || mongoose.model<ITest>('Test', TestSchema);
export const Question = mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema);
export const Attempt = mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);
export const TestSession = mongoose.models.TestSession || mongoose.model<ITestSession>('TestSession', TestSessionSchema);
export const AttemptResult = mongoose.models.AttemptResult || mongoose.model<IAttemptResult>('AttemptResult', AttemptResultSchema);
