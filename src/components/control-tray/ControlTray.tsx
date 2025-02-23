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

import { memo, ReactNode, RefObject, useEffect, useRef, useState, useMemo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import ChatBubble from "../chat-bubble/ChatBubble";
import "./control-tray.scss";

export type ControlTrayProps = {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
};

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<any>;
  stop: () => any;
};

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
    isStreaming ? (
      <button className="action-button" onClick={stop}>
        <span className="material-symbols-outlined">{onIcon}</span>
      </button>
    ) : (
      <button className="action-button" onClick={start}>
        <span className="material-symbols-outlined">{offIcon}</span>
      </button>
    ),
);

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo,
}: ControlTrayProps) {
  const webcam = useWebcam();
  const screenCapture = useScreenCapture();
  const videoStreams = useMemo(() => [webcam, screenCapture], [webcam, screenCapture]);
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  const [inVolume, setInVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(true);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  const { client, connected, connect, disconnect, volume } =
    useLiveAPIContext();

  // Store cleanup functions in a ref to avoid dependency cycles
  const cleanupRef = useRef(() => {
    audioRecorder.stop();
    videoStreams.forEach((stream) => stream.stop());
  });

  // Update cleanup function when dependencies change
  useEffect(() => {
    cleanupRef.current = () => {
      audioRecorder.stop();
      videoStreams.forEach((stream) => stream.stop());
    };
  }, [audioRecorder, videoStreams]);

  // Component mount/unmount effect
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupRef.current();
    };
  }, []);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(5, Math.min(inVolume * 200, 8))}px`,
    );
  }, [inVolume]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on("data", onData).on("volume", setInVolume).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, muted, audioRecorder]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) {
        return;
      }

      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 1.0);
        const data = base64.slice(base64.indexOf(",") + 1, Infinity);
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }
      if (connected) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
      }
    }
    if (connected && activeVideoStream !== null) {
      requestAnimationFrame(sendVideoFrame);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, activeVideoStream, client, videoRef]);

  //handler for swapping from one video-stream to the next
  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    try {
      if (next) {
        const mediaStream = await next.start();
        setActiveVideoStream(mediaStream);
        onVideoStreamChange(mediaStream);
      } else {
        setActiveVideoStream(null);
        onVideoStreamChange(null);
      }

      videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
    } catch (error) {
      // Handle permission denied or other errors
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          console.warn('Screen sharing permission was denied');
          // Stop any existing streams
          videoStreams.forEach((stream) => stream.stop());
          setActiveVideoStream(null);
          onVideoStreamChange(null);
        } else {
          console.error('Error accessing media stream:', error);
        }
      }
    }
  };

  return (
    <ChatBubble>
      <button
        className={cn("action-button mic-button")}
        onClick={() => setMuted(!muted)}
      >
        {!muted ? (
          <span className="material-symbols-outlined filled">mic</span>
        ) : (
          <span className="material-symbols-outlined filled">mic_off</span>
        )}
      </button>

      <div className="action-button no-action outlined">
        <AudioPulse volume={volume} active={connected} hover={false} />
      </div>

      {supportsVideo && (
        <>
          <MediaStreamButton
            isStreaming={screenCapture.isStreaming}
            start={changeStreams(screenCapture)}
            stop={changeStreams()}
            onIcon="cancel_presentation"
            offIcon="present_to_all"
          />
          <MediaStreamButton
            isStreaming={webcam.isStreaming}
            start={changeStreams(webcam)}
            stop={changeStreams()}
            onIcon="videocam_off"
            offIcon="videocam"
          />
        </>
      )}
      {children}

      <button
        ref={connectButtonRef}
        className={cn("action-button", { connected })}
        onClick={connected ? disconnect : connect}
      >
        <span className="material-symbols-outlined filled">
          {connected ? "pause" : "play_arrow"}
        </span>
      </button>
    </ChatBubble>
  );
}

export default memo(ControlTray);
