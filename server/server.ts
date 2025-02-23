import express, { Request, Response, NextFunction } from 'express';
import multer, { MulterError, FileFilterCallback } from 'multer';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

const app = express();
const port = process.env.PORT || 3001;

// Initialize Gemini APIs
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Enable CORS with specific options
app.use(cors());  // Allow all CORS for development

// Add request logging middleware before file handling
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'temp-uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, uploadsDir);
  },
  filename: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit (File API maximum)
  },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Accept only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'));
    }
  }
});

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// File upload endpoint
app.post('/api/upload', upload.single('video'), (req: MulterRequest, res: Response) => {
  console.log('Upload request received:', req.file);
  try {
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
      message: 'File uploaded successfully',
      file: {
        name: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

// Video analysis endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path provided' });
    }

    // Upload file to Gemini File API
    const uploadResponse = await fileManager.uploadFile(filePath, {
      mimeType: "video/mp4",
      displayName: path.basename(filePath),
    });

    // Poll for file processing status
    let file = await fileManager.getFile(uploadResponse.file.name);
    while (file.state === FileState.PROCESSING) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      file = await fileManager.getFile(uploadResponse.file.name);
    }

    if (file.state === FileState.FAILED) {
      throw new Error("Video processing failed.");
    }

    // Generate content using the file URI
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri
        }
      },
      { text: "Analyze this video and provide a detailed description of its content." }
    ]);

    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error analyzing video' });
  }
});

// Error handling middleware
app.use((err: Error | MulterError, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 2GB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err.message === 'Only video files are allowed!') {
    return res.status(400).json({ error: err.message });
  }
  
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 