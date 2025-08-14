import React from "react";
import YouTube from "react-youtube";
import "./TrailerModal.css";

interface TrailerModalProps {
  videoKey: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const TrailerModal: React.FC<TrailerModalProps> = ({
  videoKey,
  isOpen,
  onClose,
  title = "Movie Trailer",
}) => {
  if (!isOpen) return null;

  const opts = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
    },
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const onReady = () => {
    // Player is ready
    console.log("YouTube player ready");
  };

  const onError = (error: string | object) => {
    console.error("YouTube player error:", error);
  };

  const onEnd = () => {
    // Video ended
    onClose();
  };

  return (
    <div className="trailer-modal-overlay" onClick={handleOverlayClick}>
      <div className="trailer-modal-container">
        <div className="trailer-modal-header">
          <h3>{title}</h3>
          <button
            className="trailer-close-btn"
            onClick={onClose}
            aria-label="Close trailer"
          >
            ✕
          </button>
        </div>
        <div className="trailer-video-container">
          <YouTube
            videoId={videoKey}
            opts={opts}
            onReady={onReady}
            onError={onError}
            onEnd={onEnd}
            className="trailer-youtube-player"
          />
        </div>
      </div>
    </div>
  );
};

export default TrailerModal;
