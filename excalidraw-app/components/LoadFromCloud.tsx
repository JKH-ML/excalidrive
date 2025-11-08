import React, { useState } from "react";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { LoadIcon } from "@excalidraw/excalidraw/components/icons";

import {
  listFilesFromGoogleCloud,
  loadFromGoogleCloud,
} from "../data/googleCloud";

interface CloudFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
}

export const LoadFromCloud: React.FC<{
  onLoadFile: (data: any) => void;
  onError: (error: Error) => void;
}> = ({ onLoadFile, onError }) => {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFileList, setShowFileList] = useState(false);

  const handleListFiles = async () => {
    try {
      setIsLoading(true);
      const fileList = await listFilesFromGoogleCloud();
      setFiles(fileList);
      setShowFileList(true);
    } catch (error: any) {
      console.error("Error listing files:", error);
      onError(new Error(error.message || "Failed to list files"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFile = async (fileId: string) => {
    try {
      setIsLoading(true);
      const data = await loadFromGoogleCloud(fileId);
      onLoadFile(data);
    } catch (error: any) {
      console.error("Error loading file:", error);
      onError(new Error(error.message || "Failed to load file"));
    } finally {
      setIsLoading(false);
    }
  };

  if (showFileList) {
    return (
      <Card color="primary">
        <h2>Load from Google Cloud</h2>
        <div className="Card-details">
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {files.length === 0 ? (
              <p>No files found in Google Cloud.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {files.map((file) => (
                  <li
                    key={file.id}
                    style={{
                      padding: "8px",
                      borderBottom: "1px solid #e0e0e0",
                      cursor: "pointer",
                    }}
                    onClick={() => handleLoadFile(file.id)}
                  >
                    <div style={{ fontWeight: "bold" }}>{file.name}</div>
                    <div style={{ fontSize: "0.8em", color: "#666" }}>
                      Modified: {new Date(file.modifiedTime).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ToolButton
            className="Card-button"
            type="button"
            title="Back"
            aria-label="Back"
            showAriaLabel={true}
            onClick={() => setShowFileList(false)}
            style={{ marginTop: "10px" }}
          >
            Back
          </ToolButton>
        </div>
      </Card>
    );
  }

  return (
    <Card color="primary">
      <div
        className="Card-icon"
        style={{
          width: "2.8rem",
          height: "2.8rem",
        }}
      >
        {LoadIcon}
      </div>
      <h2>Google Cloud</h2>
      <div className="Card-details">
        Load your Excalidraw files from Google Cloud Storage
      </div>
      <ToolButton
        className="Card-button"
        type="button"
        title="Load from Cloud"
        aria-label="Load from Cloud"
        showAriaLabel={true}
        onClick={handleListFiles}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Load from Cloud"}
      </ToolButton>
    </Card>
  );
};
