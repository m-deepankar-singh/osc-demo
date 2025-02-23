/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import { CourseProvider } from "./contexts/CourseContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import CoursesPage from "./pages/CoursesPage";
import CourseDetails from "./pages/CourseDetails";
import SubmissionsPage from "./pages/SubmissionsPage";
import ExamPage from "./pages/ExamPage";
import { DeepResearchPortal } from "./components/DeepResearch/DeepResearchPortal";
import cn from "classnames";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

const AppContent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const location = useLocation();
  const isCoursePage = location.pathname.startsWith('/courses/') && !location.pathname.includes('/deep-research');

  return (
    <div className="streaming-console">
      <SidePanel />
      <main>
        <Routes>
          <Route 
            path="/" 
            element={
              <div className="main-app-area">
                <Altair />
                <video
                  className={cn("stream", {
                    hidden: !videoRef.current || !videoStream,
                  })}
                  ref={videoRef}
                  autoPlay
                  playsInline
                />
              </div>
            } 
          />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/deep-research" element={<DeepResearchPortal />} />
          <Route path="/courses/:courseId" element={<CourseDetails />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/exam" element={<ExamPage />} />
        </Routes>

        {isCoursePage && (
          <ControlTray
            videoRef={videoRef}
            supportsVideo={true}
            onVideoStreamChange={setVideoStream}
          />
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <CourseProvider>
        <LiveAPIProvider url={uri} apiKey={API_KEY}>
          <Router>
            <AppContent />
          </Router>
        </LiveAPIProvider>
      </CourseProvider>
    </div>
  );
}

export default App;
