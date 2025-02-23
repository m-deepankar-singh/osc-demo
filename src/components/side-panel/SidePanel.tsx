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

import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import { Link, useLocation } from "react-router-dom";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger, { LoggerFilterType } from "../logger/Logger";
import "./side-panel.scss";

const filterOptions = [
  { value: "conversations", label: "Conversations" },
  { value: "tools", label: "Tool Use" },
  { value: "none", label: "All" },
];

export default function SidePanel() {
  const { connected, client } = useLiveAPIContext();
  const [open, setOpen] = useState(true);
  const loggerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);
  const { log, logs } = useLoggerStore();
  const location = useLocation();

  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (textInput.trim() && client) {
      client.send([{ text: textInput }]);
      setTextInput("");
    }
  };

  //scroll the log to the bottom when new logs come in
  useEffect(() => {
    if (loggerRef.current) {
      const el = loggerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  // listen for log events and store them
  useEffect(() => {
    if (client) {
      client.on("log", log);
      return () => {
        client.off("log", log);
      };
    }
  }, [client, log]);

  return (
    <div className={cn("side-panel", { open })}>
      <div className="side-panel-content">
        <nav className="side-nav">
          <Link to="/" className={cn("nav-link", { active: location.pathname === "/" })}>
            Home
          </Link>
          <Link to="/courses" className={cn("nav-link", { active: location.pathname === "/courses" })}>
            Courses
          </Link>
          <Link to="/submissions" className={cn("nav-link", { active: location.pathname === "/submissions" })}>
            Submissions
          </Link>
        </nav>
        
        <div className="logger-container" ref={loggerRef}>
          <Logger filter={(selectedOption?.value as LoggerFilterType) || "none"} />
        </div>
        
        <div className="input-container">
          <div className="filter-container">
            <Select
              className="filter-select"
              value={selectedOption}
              onChange={setSelectedOption}
              options={filterOptions}
              placeholder="Filter logs..."
              isClearable
            />
          </div>
          <div className="text-input-container">
            <textarea
              ref={inputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!connected}
            />
            <button
              className="submit-button"
              onClick={handleSubmit}
              disabled={!connected || !textInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      <button className="toggle-button" onClick={() => setOpen(!open)}>
        {open ? <RiSidebarFoldLine /> : <RiSidebarUnfoldLine />}
      </button>
    </div>
  );
}
