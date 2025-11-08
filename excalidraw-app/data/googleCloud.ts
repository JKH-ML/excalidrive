/* eslint-disable no-console */
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

// Google Cloud Storage configuration
const GOOGLE_CLOUD_CONFIG = {
  projectId: import.meta.env.VITE_APP_GOOGLE_PROJECT_ID || "",
  bucketName:
    import.meta.env.VITE_APP_GOOGLE_BUCKET_NAME || "excalidraw-storage",
  folderName: "excalidraw",
};

interface SaveToCloudResult {
  success: boolean;
  message: string;
  fileName?: string;
}

// Store access token globally
let accessToken: string | null = null;

/**
 * Save drawing to Google Cloud Storage
 * This function handles authentication and file upload to Google Cloud Storage
 */
export const saveToGoogleCloud = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles,
): Promise<SaveToCloudResult> => {
  try {
    console.log("Starting Google Cloud save...");

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `excalidraw-${timestamp}.excalidraw`;

    // Prepare the data to save
    const data = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        viewBackgroundColor: "#ffffff",
      },
      files,
    };

    // Convert data to JSON string
    const jsonString = JSON.stringify(data, null, 2);
    console.log("Data prepared, size:", jsonString.length);

    // Initialize Google API client
    if (!window.gapi) {
      throw new Error("Google API not loaded. Please refresh the page.");
    }

    console.log("Loading Google Drive API...");
    // Load the Google Drive API
    await loadGoogleDriveAPI();

    console.log("Authenticating user...");
    // Authenticate user
    const token = await authenticateGoogleUser();
    if (!token) {
      throw new Error("Google authentication failed or was cancelled.");
    }
    accessToken = token;

    console.log("Getting/creating excalidraw folder...");
    // Create or get the excalidraw folder
    const folderId = await getOrCreateFolder(GOOGLE_CLOUD_CONFIG.folderName);
    console.log("Folder ID:", folderId);

    console.log("Uploading file...");
    // Upload the file
    const file = new Blob([jsonString], { type: "application/json" });
    const uploadResult = await uploadToGoogleDrive(file, fileName, folderId);
    console.log("Upload successful:", uploadResult);

    return {
      success: true,
      message: "File saved successfully to Google Cloud!",
      fileName: uploadResult.name,
    };
  } catch (error: any) {
    console.error("Error saving to Google Cloud:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      error,
    });
    return {
      success: false,
      message: `Failed to save: ${error.message || "Unknown error"}`,
    };
  }
};

/**
 * Load Google Drive API
 */
const loadGoogleDriveAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.gapi?.client?.drive) {
      console.log("Google Drive API already loaded");
      resolve();
      return;
    }

    console.log("Loading gapi client...");
    window.gapi.load("client", async () => {
      try {
        console.log("Initializing gapi client...");
        console.log(
          "API Key:",
          import.meta.env.VITE_APP_GOOGLE_API_KEY ? "Present" : "Missing",
        );

        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_APP_GOOGLE_API_KEY,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
        });
        console.log("Google API client initialized successfully");
        resolve();
      } catch (error: any) {
        console.error("Failed to initialize Google API client:", error);
        console.error("Error type:", typeof error);
        console.error("Error keys:", Object.keys(error));

        let errorMessage = "Unknown error";
        if (error.details) {
          errorMessage = error.details;
        } else if (error.error) {
          errorMessage =
            typeof error.error === "string"
              ? error.error
              : JSON.stringify(error.error);
        } else if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }

        reject(new Error(`Google API initialization failed: ${errorMessage}`));
      }
    });
  });
};

/**
 * Authenticate Google user using new Google Identity Services
 */
const authenticateGoogleUser = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Initializing Google Identity Services...");

      if (!window.google?.accounts?.oauth2) {
        reject(
          new Error(
            "Google Identity Services not loaded. Please refresh the page.",
          ),
        );
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_APP_GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response: any) => {
          if (response.error) {
            console.error("Authentication error:", response);
            reject(
              new Error(
                `Authentication failed: ${
                  response.error_description || response.error
                }`,
              ),
            );
            return;
          }

          console.log("Authentication successful");
          resolve(response.access_token);
        },
      });

      console.log("Requesting access token...");
      client.requestAccessToken();
    } catch (error: any) {
      console.error("Authentication error:", error);
      reject(
        new Error(`Authentication failed: ${error.message || "Unknown error"}`),
      );
    }
  });
};

/**
 * Get or create folder in Google Drive
 */
const getOrCreateFolder = async (folderName: string): Promise<string> => {
  try {
    console.log(`Searching for folder: ${folderName}...`);
    // Search for existing folder
    const response = await window.gapi.client.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    console.log("Folder search response:", response);

    if (response.result.files && response.result.files.length > 0) {
      console.log(`Folder found: ${response.result.files[0].id}`);
      return response.result.files[0].id!;
    }

    console.log(`Folder not found, creating new folder: ${folderName}...`);
    // Create new folder if not exists
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await window.gapi.client.drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    console.log("Folder created:", folder.result.id);
    return folder.result.id!;
  } catch (error: any) {
    console.error("Error in getOrCreateFolder:", error);
    throw new Error(`Folder operation failed: ${error.message || error}`);
  }
};

/**
 * Upload file to Google Drive
 */
const uploadToGoogleDrive = async (
  file: Blob,
  fileName: string,
  folderId: string,
): Promise<any> => {
  try {
    console.log(`Preparing to upload file: ${fileName} to folder: ${folderId}`);

    const metadata = {
      name: fileName,
      mimeType: "application/json",
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("file", file);

    console.log("Access token available:", accessToken ? "Yes" : "No");

    if (!accessToken) {
      throw new Error("No access token available");
    }

    console.log("Sending upload request to Google Drive...");
    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      },
    );

    console.log(
      "Upload response status:",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Upload failed. Status:",
        response.status,
        "Response:",
        errorText,
      );
      throw new Error(
        `Failed to upload file to Google Drive: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log("Upload successful, result:", result);
    return result;
  } catch (error: any) {
    console.error("Error in uploadToGoogleDrive:", error);
    throw new Error(`Upload failed: ${error.message || error}`);
  }
};

/**
 * List files from Google Drive excalidraw folder
 */
export const listFilesFromGoogleCloud = async (): Promise<any[]> => {
  try {
    console.log("Loading Google Drive API for file listing...");
    await loadGoogleDriveAPI();

    console.log("Authenticating user for file listing...");
    const token = await authenticateGoogleUser();
    if (!token) {
      throw new Error("Google authentication failed or was cancelled.");
    }
    accessToken = token;

    console.log("Getting excalidraw folder...");
    const folderId = await getOrCreateFolder(GOOGLE_CLOUD_CONFIG.folderName);

    console.log("Listing files from folder...");
    const response = await window.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, createdTime, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    });

    console.log("Files found:", response.result.files?.length || 0);
    return response.result.files || [];
  } catch (error: any) {
    console.error("Error listing files from Google Cloud:", error);
    throw new Error(
      `Failed to list files: ${error.message || "Unknown error"}`,
    );
  }
};

/**
 * Load file from Google Drive
 */
export const loadFromGoogleCloud = async (fileId: string): Promise<any> => {
  try {
    console.log(`Loading file ${fileId} from Google Drive...`);

    if (!accessToken) {
      throw new Error("Not authenticated. Please try again.");
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Download failed:", response.status, errorText);
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("File loaded successfully");
    return data;
  } catch (error: any) {
    console.error("Error loading file from Google Cloud:", error);
    throw new Error(`Failed to load file: ${error.message || "Unknown error"}`);
  }
};

// Type declarations for Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
