from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import os
from google import generativeai as genai
from typing import Optional, List, Tuple, Dict, Literal, Any
import time
from dotenv import load_dotenv
import enum
import json
import asyncio
import httpx
from tiktoken import get_encoding
import datetime
from firecrawl import FirecrawlApp

# Load environment variables
load_dotenv()

# Configure genai
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Initialize Firecrawl with configuration
api_key = os.getenv("FIRECRAWL_API_KEY")
if not api_key:
    raise Exception("FIRECRAWL_API_KEY environment variable is not set")
if not api_key.startswith("fc-"):
    api_key = f"fc-{api_key}"

# Initialize FirecrawlApp with direct parameters according to SDK docs
firecrawl = FirecrawlApp(
    api_key=api_key,
)

# Request models
class AnalyzeRequest(BaseModel):
    filePath: str

class DeleteFileRequest(BaseModel):
    filePath: str

class Course(BaseModel):
    id: str
    title: str
    category: str
    imageUrl: str
    assessmentScore: int

class QuestionType(enum.Enum):
    MCQ = "MCQ"
    MSQ = "MSQ"

class QuizQuestion(BaseModel):
    id: int
    type: str  # 'MCQ' or 'MSQ'
    question: str
    options: List[str]
    correctAnswers: List[int]
    timeLimit: int = 600  # Time limit in seconds (10 minutes)
    topic: str = "General"  # The topic this question belongs to

# Mock database of courses
courses_db = [
    Course(
        id='02',
        title='The Importance of Being Self-Awareness',
        category='Soft Skills',
        imageUrl='/course-images/self-awareness-2.jpg',
        assessmentScore=85,
    ),
    Course(
        id='03',
        title='Applying Self-awareness',
        category='Soft Skills',
        imageUrl='/course-images/self-awareness-3.jpg',
        assessmentScore=85,
    ),
    Course(
        id='04',
        title='How Do Resilience and Emotional Intelligence Interact?',
        category='Soft Skills',
        imageUrl='/course-images/emotional-intelligence.jpg',
        assessmentScore=45,
    ),
    Course(
        id='05',
        title='The Importance of Resilience in the World of Work and its Benefits in Managing Stress',
        category='Soft Skills',
        imageUrl='/course-images/resilience-stress.jpg',
        assessmentScore=150,
    ),
    Course(
        id='06',
        title='Strategies for Developing Resilience',
        category='Soft Skills',
        imageUrl='/course-images/developing-resilience.jpg',
        assessmentScore=95,
    ),
    Course(
        id='08',
        title='Benefits of Resourcefulness for Business Innovation',
        category='Soft Skills',
        imageUrl='/course-images/business-innovation.jpg',
        assessmentScore=75,
    )
]

# Add new class for assessment scores
class AssessmentScores:
    def __init__(self):
        self.scores = {}
        self.load_scores()
    
    def load_scores(self):
        try:
            # Get the absolute path to the assessments file
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            assessments_file = os.path.join(base_dir, "public", "course-content", "assessments.txt")
            
            print(f"Looking for assessments file at: {assessments_file}")  # Debug log
            
            with open(assessments_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines[2:]:  # Skip header lines
                    if ':' in line:
                        topic, score = line.split(':')
                        score_value = int(score.strip().split('/')[0])
                        self.scores[topic.strip()] = score_value
        except Exception as e:
            print(f"Error loading assessment scores: {str(e)}")
            # Default scores if file can't be read
            self.scores = {
                "Growth Mindset & Entrepreneurial Skills": 13,
                "Problem Solving & Critical Thinking Skills": 15,
                "Digital & Technological Skills": 27,
                "Communication & People Skills": 21,
                "Self Management Skills": 13
            }
            print("Using default assessment scores:", self.scores)  # Debug log

    def get_topic_weights(self):
        # Convert scores to weights (lower scores get higher weights)
        max_score = 30  # Maximum possible score
        weights = {}
        total_weight = 0
        
        for topic, score in self.scores.items():
            # Invert the score (lower scores get higher weights)
            weight = max_score - score
            weights[topic] = weight
            total_weight += weight
        
        # Normalize weights to percentages
        for topic in weights:
            weights[topic] = (weights[topic] / total_weight) * 100
            
        return weights

# Function to generate quiz questions based on difficulty
def generate_quiz_questions(difficulty: str, course_id: str) -> List[QuizQuestion]:
    if difficulty == "bronze":
        # Return hardcoded questions for bronze level
        return get_default_questions()
    
    # Prepare the prompt based on difficulty
    difficulty_desc = "highly intermediate" if difficulty == "silver" else "extremely advanced"
    course_topic = get_course_topic(course_id)
    
    prompt = f"""Generate a quiz based on the following course content: {course_topic}

The quiz should be at {difficulty_desc} level and consist of 5 questions (4 MCQs and 1 MSQ).

Use this JSON schema:
{{
    "questions": [
        {{
            "id": int,
            "type": str,  # "MCQ" or "MSQ"
            "question": str,
            "options": List[str],  # 4 options
            "correctAnswers": List[int],  # indices of correct answers (0-3)
            "timeLimit": int  # in seconds
        }}
    ]
}}

Requirements:
1. Questions must be directly related to the course content provided
2. Questions should be at {difficulty_desc} level
3. First 4 questions must be MCQ with exactly one correct answer
4. Last question must be MSQ with multiple correct answers
5. Each question must have exactly 4 options
6. Options should be clear, distinct, and relevant to the course material
7. Time limit should be between 30-120 seconds per question
8. Return ONLY valid JSON, no other text"""

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            contents=prompt,
            generation_config={
                "temperature": 0.7,  # Lower temperature for more structured output
                "top_p": 0.95,
                "top_k": 100,
                "max_output_tokens": 4096  # Ensure we get complete response
            }
        )
        
        # Extract JSON from response
        try:
            # Clean up the response text
            response_text = response.text.strip()
            # Remove any markdown code block markers if present
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            # Try to parse the response text directly
            try:
                quiz_data = json.loads(response_text)
            except json.JSONDecodeError:
                # If direct parsing fails, try to find JSON within the text
                import re
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if json_match:
                    quiz_data = json.loads(json_match.group())
                else:
                    print("Could not find valid JSON in response:", response_text[:200])  # Print first 200 chars for debugging
                    return get_default_questions()
                    
            # Additional validation of quiz_data structure
            if not isinstance(quiz_data, dict):
                print("Response is not a dictionary")
                return get_default_questions()
                
            if "questions" not in quiz_data:
                print("No questions field in response")
                return get_default_questions()
                
            if not isinstance(quiz_data["questions"], list):
                print("Questions is not a list")
                return get_default_questions()

            questions = []
            for i, q in enumerate(quiz_data["questions"]):
                # Ensure required fields are present
                if not all(key in q for key in ["type", "question", "options", "correctAnswers", "timeLimit"]):
                    continue
                    
                # Add id if missing
                if "id" not in q:
                    q["id"] = i + 1
                    
                # Validate and fix correctAnswers
                if q["type"] == "MCQ" and len(q["correctAnswers"]) != 1:
                    q["correctAnswers"] = [q["correctAnswers"][0] if q["correctAnswers"] else 0]
                elif q["type"] == "MSQ" and not q["correctAnswers"]:
                    q["correctAnswers"] = [0, 1]  # Default to first two options if none provided
                    
                # Ensure timeLimit is within bounds
                q["timeLimit"] = max(30, min(120, q["timeLimit"]))
                
                questions.append(QuizQuestion(**q))

            if not questions:
                print("No valid questions generated")
                return get_default_questions()

            return questions
        except Exception as e:
            print(f"Error in quiz generation: {str(e)}")
            return get_default_questions()
    except Exception as e:
        print(f"Error in quiz generation: {str(e)}")
        return get_default_questions()

def get_course_topic(course_id: str) -> str:
    try:
        # Pad course_id with leading zero if needed
        padded_id = course_id.zfill(2)
        
        # Get the absolute path to the content file
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        content_file = os.path.join(base_dir, "public", "course-content", f"self-awareness-{padded_id}.txt")
        
        if not os.path.exists(content_file):
            print(f"Course content file not found: {content_file}")
            return "self-awareness"  # Default fallback
            
        with open(content_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract course title and key topics
        course_title = ""
        key_topics = []
        in_topics = False  # Initialize the flag
        
        for line in content.split('\n'):
            if line.startswith('Course:'):
                course_title = line.replace('Course:', '').strip()
            elif line.startswith('Key Topics:'):
                # Read the following lines until we hit an empty line or a line starting with -
                in_topics = True
                continue
            elif in_topics and line.startswith('-'):
                key_topics.append(line.strip('- ').strip())
            elif in_topics and not line.strip():
                break
                
        # Combine title and key topics for a rich prompt
        topic = f"{course_title}. Focus on: {', '.join(key_topics)}"
        return topic
    except Exception as e:
        print(f"Error reading course content: {str(e)}")
        return "self-awareness"  # Default fallback

def get_default_questions() -> List[QuizQuestion]:
    return [
        QuizQuestion(
            id=1,
            type="MCQ",
            question="Which of the following statements does not include examples of self-awareness?",
            options=[
                "Following traffic signs while driving",
                "Speaking politely to elders",
                "Riding a motorcycle at high speed in an area where many children play",
                "Getting used to saying please when asking for help from others"
            ],
            correctAnswers=[2]
        ),
        QuizQuestion(
            id=2,
            type="MCQ",
            question="What is the primary benefit of developing self-awareness in professional settings?",
            options=[
                "Increased productivity and efficiency",
                "Better understanding of personal strengths and limitations",
                "Improved workplace relationships",
                "Enhanced decision-making abilities"
            ],
            correctAnswers=[1]
        ),
        QuizQuestion(
            id=3,
            type="MCQ",
            question="How does self-awareness contribute to emotional intelligence?",
            options=[
                "By helping identify personal emotional triggers",
                "By increasing technical skills",
                "By improving physical fitness",
                "By enhancing memory retention"
            ],
            correctAnswers=[0]
        ),
        QuizQuestion(
            id=4,
            type="MCQ",
            question="Which practice is most effective for developing self-awareness?",
            options=[
                "Regular exercise",
                "Daily meditation and reflection",
                "Learning new languages",
                "Playing video games"
            ],
            correctAnswers=[1]
        ),
        QuizQuestion(
            id=5,
            type="MSQ",
            question="Select all the methods that can help improve self-awareness:",
            options=[
                "Keeping a daily journal",
                "Seeking feedback from others",
                "Practicing mindfulness",
                "Taking personality assessments"
            ],
            correctAnswers=[0, 1, 2, 3]
        )
    ]

def generate_exam_questions(exam_type: str) -> Tuple[List[QuizQuestion], str]:
    # Determine difficulty level and prompt based on exam type
    if exam_type == "bronze-to-silver":
        difficulty = "moderately difficult"
    else:  # silver-to-gold
        difficulty = "extremely difficult"

    # Get topic weights based on assessment scores
    assessment = AssessmentScores()
    topic_weights = assessment.get_topic_weights()
    
    # Calculate number of questions per topic
    total_questions = 25
    questions_per_topic = {}
    remaining_questions = total_questions
    
    for topic, weight in topic_weights.items():
        num_questions = round((weight / 100) * total_questions)
        questions_per_topic[topic] = num_questions
        remaining_questions -= num_questions
    
    # Adjust for rounding errors
    if remaining_questions != 0:
        # Add/subtract remaining questions from the topic with lowest/highest score
        topic = max(topic_weights.items(), key=lambda x: x[1])[0] if remaining_questions > 0 else min(topic_weights.items(), key=lambda x: x[1])[0]
        questions_per_topic[topic] += remaining_questions

    # Generate prompt with weighted topics
    topics_section = "Topics to focus on (with question distribution):\n"
    for topic, num_questions in questions_per_topic.items():
        topics_section += f"- {topic}: {num_questions} questions\n"

    prompt = f"""Generate a {difficulty} promotion exam with 25 questions (18 MCQs and 7 MSQs).
The questions should be distributed across topics based on assessment performance.

{topics_section}

Use this JSON schema:
{{
    "questions": [
        {{
            "id": int,
            "type": str,  # "MCQ" or "MSQ"
            "question": str,
            "options": List[str],  # 4 options
            "correctAnswers": List[int],  # indices of correct answers (0-3)
            "timeLimit": int,  # in seconds (60-180)
            "topic": str  # The topic this question belongs to
        }}
    ]
}}

Requirements:
1. First 18 questions must be MCQ with exactly one correct answer
2. Last 7 questions must be MSQ with multiple correct answers
3. Each question must have exactly 4 options
4. Questions should be at {difficulty} level
5. Time limit should be between 60-180 seconds per question
6. Distribute questions according to the topic weights shown above
7. Return ONLY valid JSON, no other text"""

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            contents=prompt,
            generation_config={
                "temperature": 0.3,
                "top_p": 0.95,
                "top_k": 200,
                "max_output_tokens": 8192
            }
        )
        
        # Extract JSON from response
        try:
            # Clean up the response text
            response_text = response.text.strip()
            
            # Remove any markdown code block markers and comments
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            lines = []
            for line in response_text.split('\n'):
                # Remove comments and whitespace
                comment_idx = line.find('#')
                if comment_idx != -1:
                    line = line[:comment_idx]
                line = line.strip()
                if line:
                    lines.append(line)
            
            # Join lines and ensure proper JSON formatting
            response_text = ' '.join(lines)
            
            # Try to parse the cleaned JSON
            try:
                quiz_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"Initial JSON parsing failed: {str(e)}")
                # Try to find and extract JSON object using a simpler regex pattern
                import re
                # Look for content between outermost curly braces
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text)
                if json_match:
                    try:
                        potential_json = json_match.group()
                        # Clean up any remaining formatting issues
                        potential_json = potential_json.replace('\n', ' ').replace('\r', '')
                        quiz_data = json.loads(potential_json)
                    except json.JSONDecodeError:
                        print("Failed to parse extracted JSON")
                        return get_default_exam_questions(exam_type)
                else:
                    print("Could not find valid JSON in response")
                    return get_default_exam_questions(exam_type)

            # Validate quiz data structure
            if not isinstance(quiz_data, dict) or "questions" not in quiz_data:
                print("Invalid response structure")
                return get_default_exam_questions(exam_type)

            questions = []
            for i, q in enumerate(quiz_data["questions"]):
                try:
                    # Ensure all required fields are present
                    required_fields = ["type", "question", "options", "correctAnswers", "timeLimit", "topic"]
                    if not all(field in q for field in required_fields):
                        print(f"Missing required fields in question {i + 1}")
                        continue
                    
                    # Add id if missing
                    if "id" not in q:
                        q["id"] = i + 1
                    
                    # Validate and fix question type
                    if i < 18:  # First 18 questions should be MCQ
                        q["type"] = "MCQ"
                        q["correctAnswers"] = [q["correctAnswers"][0] if q["correctAnswers"] else 0]
                    else:  # Last 7 questions should be MSQ
                        q["type"] = "MSQ"
                        if not q["correctAnswers"]:
                            q["correctAnswers"] = [0, 1]
                    
                    # Ensure options is a list of exactly 4 strings
                    if not isinstance(q["options"], list) or len(q["options"]) != 4:
                        print(f"Invalid options in question {i + 1}")
                        continue
                    
                    # Ensure timeLimit is within bounds
                    q["timeLimit"] = max(60, min(180, int(q["timeLimit"])))
                    
                    questions.append(QuizQuestion(**q))
                except Exception as e:
                    print(f"Error processing question {i + 1}: {str(e)}")
                    continue

            if len(questions) != 25:
                print(f"Incorrect number of questions generated: {len(questions)}")
                return get_default_exam_questions(exam_type)

            return questions, difficulty
        except Exception as e:
            print(f"Error in exam generation: {str(e)}")
            return get_default_exam_questions(exam_type)
    except Exception as e:
        print(f"Error in exam generation: {str(e)}")
        return get_default_exam_questions(exam_type)

def get_default_exam_questions(exam_type: str) -> Tuple[List[QuizQuestion], str]:
    difficulty = "moderately difficult" if exam_type == "bronze-to-silver" else "extremely difficult"
    
    # Get topic weights for distribution
    assessment = AssessmentScores()
    topic_weights = assessment.get_topic_weights()
    
    # Sort topics by weight (descending) to prioritize weaker areas
    sorted_topics = sorted(topic_weights.items(), key=lambda x: x[1], reverse=True)
    
    questions = []
    topic_index = 0
    
    # Add 18 MCQs
    for i in range(18):
        # Cycle through topics based on their weights
        topic = sorted_topics[topic_index % len(sorted_topics)][0]
        topic_index += 1
        
        questions.append(QuizQuestion(
            id=i + 1,
            type="MCQ",
            question=f"Advanced {difficulty} {topic} MCQ Question {i + 1}",
            options=[
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            correctAnswers=[0],
            timeLimit=120,
            topic=topic
        ))
    
    # Add 7 MSQs
    for i in range(7):
        # Continue cycling through topics
        topic = sorted_topics[topic_index % len(sorted_topics)][0]
        topic_index += 1
        
        questions.append(QuizQuestion(
            id=i + 19,
            type="MSQ",
            question=f"Advanced {difficulty} {topic} MSQ Question {i + 1}",
            options=[
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            correctAnswers=[0, 1],
            timeLimit=180,
            topic=topic
        ))
    
    return questions, difficulty

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "temp-uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/upload")
async def upload_video(video: UploadFile = File(...)):
    try:
        # Validate video file
        if not video.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="Only video files are allowed")

        # Save video temporarily
        file_path = os.path.join(UPLOAD_DIR, video.filename)
        with open(file_path, "wb") as buffer:
            content = await video.read()
            buffer.write(content)

        return JSONResponse({
            "message": "File uploaded successfully",
            "file": {
                "name": video.filename,
                "size": len(content),
                "path": file_path
            }
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Video Analysis Models
class RequirementStatus(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    PARTIAL = "PARTIAL"

class RequirementDetail(BaseModel):
    status: RequirementStatus
    details: str

    class Config:
        use_enum_values = True

class TechnicalRequirements(BaseModel):
    video_quality: RequirementDetail
    audio_quality: RequirementDetail
    duration: RequirementDetail
    camera_position: RequirementDetail
    lighting: RequirementDetail
    background: RequirementDetail

    class Config:
        use_enum_values = True

class CompositionRequirements(BaseModel):
    entry_sequence: RequirementDetail
    seating_position: RequirementDetail
    id_verification: RequirementDetail

    class Config:
        use_enum_values = True

class AuthenticityCheck(BaseModel):
    eye_movement: RequirementDetail
    speech_pattern: RequirementDetail
    body_language: RequirementDetail
    response_style: RequirementDetail

    class Config:
        use_enum_values = True

class ContentStructure(BaseModel):
    language: RequirementDetail
    introduction_format: RequirementDetail
    required_questions: RequirementDetail

    class Config:
        use_enum_values = True

class ContentSummary(BaseModel):
    university_challenge: str
    future_development: str
    osc_program_value: str
    learning_experience: str

class VideoAnalysis(BaseModel):
    technical_requirements: TechnicalRequirements
    composition_requirements: CompositionRequirements
    authenticity_check: AuthenticityCheck
    content_structure: ContentStructure
    content_summary: ContentSummary
    final_verdict: Literal["APPROVED", "REJECTED"]
    failing_criteria: Optional[List[str]] = None

    class Config:
        use_enum_values = True

@app.post("/api/analyze")
async def analyze_video(request: AnalyzeRequest):
    try:
        print("Received request with filePath:", request.filePath)
        
        if not os.path.exists(request.filePath):
            raise HTTPException(status_code=400, detail=f"File not found: {request.filePath}")

        # Upload to Gemini File API
        print("Uploading to Gemini File API...")
        with open(request.filePath, 'rb') as file:
            video_data = file.read()
            
        # Generate content using the video file
        model = genai.GenerativeModel('gemini-2.0-flash')
        print("Sending request to Gemini API...")
        response = model.generate_content(
            contents=[
                {
                    "mime_type": "video/mp4",
                    "data": video_data
                },
                """Analyze the video interview submission in a unbiased and professional manner and provide a structured response in JSON format.

Use this schema:
{
    "technical_requirements": {
        "video_quality": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "audio_quality": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "duration": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "camera_position": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "lighting": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "background": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        }
    },
    "composition_requirements": {
        "entry_sequence": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "seating_position": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "id_verification": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        }
    },
    "authenticity_check": {
        "eye_movement": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "speech_pattern": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "body_language": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "response_style": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        }
    },
    "content_structure": {
        "language": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "introduction_format": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        },
        "required_questions": {
            "status": "PASS" | "FAIL" | "PARTIAL",
            "details": "string"
        }
    },
    "content_summary": {
        "university_challenge": "string",
        "future_development": "string",
        "osc_program_value": "string",
        "learning_experience": "string"
    },
    "final_verdict": "APPROVED" | "REJECTED",
    "failing_criteria": ["string"] // Optional, include only if final_verdict is REJECTED
}

Requirements:
1. For each criterion, provide a status (PASS/FAIL/PARTIAL) and detailed explanation
2. Include timestamps in the details when noting issues
3. Keep details concise but informative
4. For content_summary, provide 1-2 sentence summaries of answers
5. List failing_criteria in order of severity if verdict is REJECTED
6. Return ONLY valid JSON, no other text

Rejection Criteria:
- Any TECHNICAL REQUIREMENTS or COMPOSITION REQUIREMENTS failure
- More than one CONTENT STRUCTURE failure
- Even if one criterion is failed/partial in AUTHENTICITY CHECK, the video should be rejected
- Clear evidence of script reading or memorized responses"""
            ],
            generation_config={
                "temperature": 0.3,
            }
        )

        print("Received response from Gemini API")
        print("Response text:", response.text[:200], "...")  # Print first 200 chars

        # Parse the response into our Pydantic model
        try:
            # Clean up the response text and ensure it's valid JSON
            response_text = response.text.strip()
            # Remove any markdown code block markers if present
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            print("Cleaned response text:", response_text[:200], "...")  # Print first 200 chars
            
            # Parse the response into our Pydantic model
            analysis = VideoAnalysis.parse_raw(response_text)
            
            # Convert to dict with enum values as strings
            analysis_dict = analysis.dict()
            
            print("Successfully parsed response into VideoAnalysis model")
            return JSONResponse(content=analysis_dict)
        except Exception as e:
            print(f"Error parsing response: {str(e)}")
            print(f"Full response text: {response_text}")
            
            # Create a default response
            default_detail = RequirementDetail(status=RequirementStatus.FAIL, details="Failed to analyze video")
            default_analysis = VideoAnalysis(
                technical_requirements=TechnicalRequirements(
                    video_quality=default_detail,
                    audio_quality=default_detail,
                    duration=default_detail,
                    camera_position=default_detail,
                    lighting=default_detail,
                    background=default_detail
                ),
                composition_requirements=CompositionRequirements(
                    entry_sequence=default_detail,
                    seating_position=default_detail,
                    id_verification=default_detail
                ),
                authenticity_check=AuthenticityCheck(
                    eye_movement=default_detail,
                    speech_pattern=default_detail,
                    body_language=default_detail,
                    response_style=default_detail
                ),
                content_structure=ContentStructure(
                    language=default_detail,
                    introduction_format=default_detail,
                    required_questions=default_detail
                ),
                content_summary=ContentSummary(
                    university_challenge="Analysis failed",
                    future_development="Analysis failed",
                    osc_program_value="Analysis failed",
                    learning_experience="Analysis failed"
                ),
                final_verdict="REJECTED",
                failing_criteria=["Video analysis failed", str(e)]
            )
            
            return JSONResponse(content=default_analysis.dict())

    except HTTPException as e:
        raise e
    except Exception as e:
        print("Error during analysis:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files")
async def delete_file(request: DeleteFileRequest):
    try:
        print("Received delete request for file:", request.filePath)
        
        # Validate file path is within UPLOAD_DIR for security
        file_path = os.path.abspath(request.filePath)
        upload_dir = os.path.abspath(UPLOAD_DIR)
        
        if not file_path.startswith(upload_dir):
            raise HTTPException(
                status_code=403,
                detail="Access denied: Cannot delete files outside upload directory"
            )

        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        # Delete the file
        os.remove(file_path)
        
        return JSONResponse({
            "message": "File deleted successfully",
            "file": {
                "path": request.filePath
            }
        })

    except HTTPException as e:
        raise e
    except Exception as e:
        print("Error deleting file:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz/{course_id}")
async def get_quiz_questions(course_id: str, score: Optional[int] = None):
    try:
        print(f"Received quiz request - Course ID: {course_id}, Score parameter: {score}")  # Debug log
        
        # Use the score parameter directly, don't fetch from courses_db
        if score is not None:
            score = int(score)  # Ensure score is an integer
            print(f"Using provided score: {score}")  # Debug log
        else:
            # Only use database score as fallback
            course = next((c for c in courses_db if c.id == course_id), None)
            if course:
                score = course.assessmentScore
                print(f"Using fallback score from database: {score}")  # Debug log
            else:
                score = 0
                print("No score available, defaulting to 0")  # Debug log
        
        # Determine difficulty based on score
        difficulty = "bronze"
        if score > 100:
            difficulty = "gold"
        elif score > 50:
            difficulty = "silver"
        
        print(f"Selected difficulty: {difficulty} based on score: {score}")  # Debug log
        
        # Generate questions based on difficulty
        questions = generate_quiz_questions(difficulty, course_id)
        
        return JSONResponse({
            "questions": [question.dict() for question in questions],
            "totalQuestions": len(questions),
            "difficulty": difficulty,
            "usedScore": score  # Include the score that was used for debugging
        })
    except Exception as e:
        print(f"Error in quiz endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/courses")
async def get_courses():
    try:
        return JSONResponse({
            "courses": [course.dict() for course in courses_db]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/courses/{course_id}")
async def get_course(course_id: str):
    try:
        course = next((course for course in courses_db if course.id == course_id), None)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return JSONResponse(course.dict())
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/exam")
async def get_exam_questions(type: str = "bronze-to-silver"):
    try:
        questions, difficulty = generate_exam_questions(type)
        
        # Adjust required score based on difficulty
        required_to_pass = 12 if type == "bronze-to-silver" else 15
        
        return JSONResponse({
            "questions": [question.dict() for question in questions],
            "totalQuestions": len(questions),
            "requiredToPass": required_to_pass,
            "timeLimit": sum(q.timeLimit for q in questions),
            "difficulty": difficulty
        })
    except Exception as e:
        print(f"Error in exam endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Cleanup function to delete old files (can be called periodically)
def cleanup_old_files(max_age_hours: int = 24):
    """Delete files older than max_age_hours from the upload directory."""
    try:
        current_time = time.time()
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            # Skip if not a file
            if not os.path.isfile(file_path):
                continue
                
            # Check file age
            file_age_hours = (current_time - os.path.getctime(file_path)) / 3600
            if file_age_hours > max_age_hours:
                try:
                    os.remove(file_path)
                    print(f"Deleted old file: {filename}")
                except Exception as e:
                    print(f"Error deleting {filename}: {str(e)}")
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")

# --- Deep Research Models ---
class SerpQuery(BaseModel):
    query: str
    researchGoal: str

class SerpQueries(BaseModel):
    queries: List[SerpQuery]

class LearningsAndFollowUp(BaseModel):
    learnings: List[str]
    followUpQuestions: List[str]

class FinalReport(BaseModel):
    reportMarkdown: str

class FeedbackQuestions(BaseModel):
    questions: List[str]

class ResearchProgress(BaseModel):
    currentDepth: int
    totalDepth: int
    currentBreadth: int
    totalBreadth: int
    currentQuery: Optional[str] = None
    totalQueries: int
    completedQueries: int

class DeepResearchRequest(BaseModel):
    query: str
    breadth: int = Field(4, ge=1, le=10)
    depth: int = Field(2, ge=1, le=5)
    course_id: Optional[str] = None
    get_follow_up_only: Optional[bool] = False
    followUpAnswers: Optional[Dict[str, str]] = None  # Dictionary mapping questions to answers

# --- Deep Research Helper Functions ---
def system_prompt() -> str:
    now = datetime.datetime.utcnow().isoformat()
    return f"""You are an expert researcher. Today is {now}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me."""

def trim_prompt(prompt: str, context_size: int = 128_000) -> str:
    """Trims the prompt to fit within the context size using tiktoken."""
    encoding = get_encoding("cl100k_base")  # Correct encoding for o3 models
    tokens = encoding.encode(prompt)

    if len(tokens) <= context_size:
        return prompt

    return encoding.decode(tokens[:context_size])

async def generate_serp_queries(query: str, num_queries: int = 3, learnings: Optional[List[str]] = None) -> List[SerpQuery]:
    """Generates SERP queries using the LLM."""
    prompt = f"""Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of {num_queries} queries in the following JSON format:

    {{
        "queries": [
            {{
                "query": "specific search query",
                "researchGoal": "detailed explanation of what this query aims to discover"
            }}
        ]
    }}

    Make sure each query is unique and not similar to each other.

    User prompt: <prompt>{query}</prompt>"""

    if learnings:
        prompt += f"""\n\nHere are some learnings from previous research, use them to generate more specific queries: {', '.join(learnings)}"""

    model = genai.GenerativeModel('gemini-2.0-flash')
    response = await asyncio.to_thread(
        model.generate_content,
        contents=[system_prompt(), prompt],
        generation_config={"temperature": 0.7, "max_output_tokens": 4096}
    )

    try:
        response_text = response.text.strip()
        # Remove any markdown code block markers if present
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Try to parse as JSON first
            data = json.loads(response_text)
            if isinstance(data, dict) and "queries" in data:
                return [SerpQuery(**q) for q in data["queries"][:num_queries]]
        except json.JSONDecodeError:
            print(f"Failed to parse JSON response: {response_text[:200]}")  # Print first 200 chars for debugging
            # Return empty list if parsing fails
            return []

    except Exception as e:
        print(f"Error generating SERP queries: {e}")
        return []

async def process_serp_result(query: str, result: Dict, num_learnings: int = 3, num_follow_up_questions: int = 3) -> LearningsAndFollowUp:
    """Processes a single SERP result and extracts learnings."""
    try:
        # Extract markdown content from search results
        contents = []
        for item in result.get('data', []):
            if isinstance(item, dict) and item.get('markdown'):
                content = trim_prompt(item['markdown'], 25_000)
                contents.append(content)
            elif isinstance(item, str):
                content = trim_prompt(item, 25_000)
                contents.append(content)
                
        print(f"Ran {query}, found {len(contents)} contents") # Debug Log

        if not contents:
            return LearningsAndFollowUp(learnings=[], followUpQuestions=[])

        # Create the content blocks
        content_blocks = [f"<content>\n{content}\n</content>" for content in contents]
        content_string = '\n'.join(content_blocks)

        # Generate the prompt
        prompt = f"""Given the following contents from a SERP search for the query <query>{query}</query>, generate a list of learnings from the contents. Return a maximum of {num_learnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.

Return the response in this JSON format:
{{
    "learnings": ["learning1", "learning2", "learning3"],
    "followUpQuestions": ["question1", "question2", "question3"]
}}

<contents>{content_string}</contents>"""

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(
            model.generate_content,
            contents=[system_prompt(), prompt],
            generation_config={"temperature": 0.7, "max_output_tokens": 4096}
        )

        # Clean and parse the response
        response_text = response.text.strip()
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Try to parse as JSON first
            data = json.loads(response_text)
            if isinstance(data, dict):
                return LearningsAndFollowUp(
                    learnings=data.get("learnings", [])[:num_learnings],
                    followUpQuestions=data.get("followUpQuestions", [])[:num_follow_up_questions]
                )
        except json.JSONDecodeError:
            print(f"Failed to parse JSON response: {response_text[:200]}")  # Print first 200 chars for debugging
            
        # If JSON parsing fails, try to extract content directly from text
        learnings = []
        follow_up_questions = []
        
        # Simple extraction based on common patterns
        lines = response_text.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                if len(learnings) < num_learnings:
                    learnings.append(line[2:])
            elif '?' in line:
                if len(follow_up_questions) < num_follow_up_questions:
                    follow_up_questions.append(line)

        return LearningsAndFollowUp(
            learnings=learnings[:num_learnings],
            followUpQuestions=follow_up_questions[:num_follow_up_questions]
        )

    except Exception as e:
        print(f"Error processing SERP result: {e}")
        return LearningsAndFollowUp(learnings=[], followUpQuestions=[])

async def write_final_report(prompt: str, learnings: List[str], visited_urls: List[str]) -> str:
    """Generates the final report."""
    try:
        learnings_string = trim_prompt('\n'.join(f"<learning>\n{learning}\n</learning>" for learning in learnings), 150_000)
        prompt_text = f"""Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as detailed as possible, aim for 3 or more pages, include ALL the learnings from research.

Return the report in this JSON format:
{{
    "reportMarkdown": "your detailed report here"
}}

Research prompt: <prompt>{prompt}</prompt>

Learnings from research:
<learnings>
{learnings_string}
</learnings>"""

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(
            model.generate_content,
            contents=[system_prompt(), prompt_text],
            generation_config={"temperature": 0.7, "max_output_tokens": 4096}
        )

        # Clean and parse the response
        response_text = response.text.strip()
        # Remove any markdown code block markers if present
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Try to parse as JSON first
            data = json.loads(response_text)
            if isinstance(data, dict) and "reportMarkdown" in data:
                report = data["reportMarkdown"]
            else:
                # If JSON is valid but doesn't have reportMarkdown, use the whole response
                report = response_text
        except json.JSONDecodeError:
            # If JSON parsing fails, use the raw text as the report
            report = response_text

        # Add sources section
        if visited_urls:
            urls_section = "\n\n## Sources\n\n" + "\n".join(f"- {url}" for url in visited_urls)
            report += urls_section

        return report

    except Exception as e:
        print(f"Error writing final report: {e}")
        # Return a basic report with the learnings if report generation fails
        return f"""# Research Report

## Key Learnings

{chr(10).join(f'- {learning}' for learning in learnings)}

## Sources

{chr(10).join(f'- {url}' for url in visited_urls)}
"""

async def generate_feedback(query: str, num_questions: int = 3) -> List[str]:
    """Generates follow-up questions to clarify the research direction."""
    try:
        prompt = f"""Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of {num_questions} questions, but feel free to return less if the original query is clear: <query>{query}</query>

        Return the questions in this format:
        {{"questions": ["question1", "question2", "question3"]}}
        """

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(
            model.generate_content,
            contents=[system_prompt(), prompt],
            generation_config={"temperature": 0.7, "max_output_tokens": 4096}
        )

        # Clean and parse the response
        response_text = response.text.strip()
        # Remove any markdown code block markers if present
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Try to parse as JSON first
            data = json.loads(response_text)
            if isinstance(data, dict) and "questions" in data:
                return data["questions"][:num_questions]
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract questions directly from text
            # Split by newlines and clean up
            questions = [line.strip() for line in response_text.split('\n') 
                       if line.strip() and not line.strip().startswith('{') and not line.strip().startswith('}')]
            return questions[:num_questions]

    except Exception as e:
        print(f"Error generating feedback questions: {e}")
        return ["Could you elaborate more on your research topic?",
                "What specific aspects are you most interested in?",
                "What is the main goal of your research?"]

async def process_single_query(query: str, depth: int, visited_urls: List[str], learnings: List[str]) -> None:
    """Process a single SERP query and update global state."""
    try:
        # Check if Firecrawl is properly initialized
        if not firecrawl or not hasattr(firecrawl, 'api_key'):
            raise Exception("Firecrawl is not properly initialized")
            
        # Check if API key exists and has correct format
        api_key = firecrawl.api_key
        if not api_key or not isinstance(api_key, str):
            raise Exception("Firecrawl API key is not configured")
        if not api_key.startswith("fc-"):
            raise Exception("Invalid Firecrawl API key format. Key must start with 'fc-'")

        # Use Firecrawl to perform the search with options
        try:
            search_response = await asyncio.to_thread(
                firecrawl.search,
                query,
                {
                    "timeout": 15000,
                    "limit": 5,
                    "scrapeOptions": {"formats": ["markdown"]}
                }
            )

            # Check if search_response is a dictionary and has expected fields
            if not isinstance(search_response, dict):
                raise Exception("Invalid response format from Firecrawl")

            # Check for error field in response
            if 'error' in search_response:
                raise Exception(f"Search failed: {search_response['error']}")

            # Process search results if data field exists
            if 'data' in search_response and search_response['data']:
                # Update visited URLs
                new_urls = [item.get('url') for item in search_response['data'] if item.get('url')]
                visited_urls.extend(new_urls)

                # Process content and update learnings
                contents = [item.get('markdown') for item in search_response['data'] if item.get('markdown')]
                if contents:
                    processed_result = await process_serp_result(query, {"data": contents})
                    if processed_result and processed_result.learnings:
                        learnings.extend(processed_result.learnings)

        except Exception as e:
            error_msg = str(e).lower()
            if "401" in error_msg or "unauthorized" in error_msg:
                raise Exception("Invalid Firecrawl API key or unauthorized access. Please check your API key.")
            elif "429" in error_msg or "too many requests" in error_msg:
                raise Exception("Rate limit exceeded. Please try again later or reduce concurrency.")
            else:
                raise Exception(f"Firecrawl search error: {str(e)}")

    except Exception as e:
        print(f"Error processing query '{query}': {e}")
        # Return empty results but don't fail completely
        return {
            "learnings": [],
            "visitedUrls": []
        }

async def deep_research(query: str, breadth: int, depth: int, learnings: Optional[List[str]] = None, visited_urls: Optional[List[str]] = None, on_progress=None) -> Dict:
    """Main deep research function."""
    learnings = learnings or []
    visited_urls = visited_urls or []
    total_queries = 0
    completed_queries = 0

    async def process_query(current_query: str, current_depth: int):
        nonlocal completed_queries, total_queries
        await process_single_query(current_query, current_depth, visited_urls, learnings)
        completed_queries += 1
        if on_progress:
            progress_data = ResearchProgress(
                currentDepth=current_depth,
                totalDepth=depth,
                currentBreadth=0,
                totalBreadth=breadth,
                currentQuery=current_query,
                totalQueries=total_queries,
                completedQueries=completed_queries
            )
            await on_progress(progress_data.dict())

    for d in range(depth):
        print(f"Starting depth level {d + 1}") # Debug Log
        if d == 0:
            serp_queries = await generate_serp_queries(query=query, num_queries=breadth, learnings=None)  # First level
        else:
            serp_queries = await generate_serp_queries(query=query, num_queries=breadth, learnings=learnings) # Subsequent levels

        total_queries += len(serp_queries)
        if on_progress:
            progress_data = ResearchProgress(
                currentDepth=d+1,
                totalDepth=depth,
                currentBreadth=0,
                totalBreadth=breadth,
                currentQuery=None,
                totalQueries=total_queries,
                completedQueries=completed_queries
            )
            await on_progress(progress_data.dict())

        tasks = [process_query(q.query, d+1) for q in serp_queries]
        await asyncio.gather(*tasks)

    return {"learnings": learnings, "visitedUrls": visited_urls}

@app.post("/api/deep-research")
async def api_deep_research(request: DeepResearchRequest):
    """API endpoint for deep research."""
    try:
        # Generate follow-up questions
        follow_up_questions = await generate_feedback(request.query)
        print(f"Follow-up questions: {follow_up_questions}") # Debug Log

        # If only getting follow-up questions, return early
        if request.get_follow_up_only:
            return JSONResponse({
                "followUpQuestions": follow_up_questions,
                "query": {
                    "original": request.query,
                    "enhanced": None
                }
            })

        # If course_id is provided, get course content to enhance research
        course_content = ""
        if request.course_id:
            try:
                course_content = get_course_topic(request.course_id)
                print(f"Retrieved course content for course {request.course_id}")
            except Exception as e:
                print(f"Error getting course content: {e}")

        # Enhance query with course content if available
        enhanced_query = request.query
        if course_content:
            enhanced_query = f"{request.query}\n\nContext from course: {course_content}"

        # Initialize progress tracking
        progress_updates = []
        async def track_progress(progress: Dict):
            progress_updates.append(progress)
            print(f"Research Progress: {progress}")

        # Perform deep research
        research_results = await deep_research(
            query=enhanced_query,
            breadth=request.breadth,
            depth=request.depth,
            on_progress=track_progress
        )

        # Generate final report
        final_report = await write_final_report(
            prompt=enhanced_query,
            learnings=research_results["learnings"],
            visited_urls=research_results["visitedUrls"]
        )

        return JSONResponse({
            "report": final_report,
            "followUpQuestions": follow_up_questions,
            "learnings": research_results["learnings"],
            "visitedUrls": research_results["visitedUrls"],
            "progress": progress_updates,
            "query": {
                "original": request.query,
                "enhanced": enhanced_query if course_content else None
            }
        })

    except Exception as e:
        print(f"Error in deep research endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run cleanup on startup
    cleanup_old_files()
    uvicorn.run(app, host="0.0.0.0", port=3001) 