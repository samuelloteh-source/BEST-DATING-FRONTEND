import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsPath = path.join(__dirname, '..', 'models');

let modelsLoaded = false;
let loadingModelsPromise = null;

function ensureDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid live frame data: expected data:image base64 URL');
  }
}

function parseBase64DataUrl(dataUrl) {
  ensureDataUrl(dataUrl);
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Malformed base64 data URL');
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  return Buffer.from(base64, 'base64');
}

function createImageFromBuffer(buffer) {
  const image = new Image();
  image.src = buffer;
  return image;
}

async function loadModels() {
  if (modelsLoaded) return;
  if (loadingModelsPromise) return loadingModelsPromise;

  loadingModelsPromise = (async () => {
    try {
      await tf.setBackend('cpu');
      await tf.ready();

      faceapi.env.monkeyPatch({ Canvas, Image, ImageData, loadImage });

      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

      modelsLoaded = true;
    } catch (error) {
      loadingModelsPromise = null;
      throw new Error(`Failed to load face-api models: ${error.message}`);
    }
  })();

  return loadingModelsPromise;
}

async function loadImageFromBase64(base64DataUrl) {
  try {
    const buffer = parseBase64DataUrl(base64DataUrl);
    return createImageFromBuffer(buffer);
  } catch (error) {
    throw new Error(`Failed to decode live frame: ${error.message}`);
  }
}

async function loadImageFromUrlOrPath(profileImageUrl) {
  if (typeof profileImageUrl !== 'string' || !profileImageUrl.trim()) {
    throw new Error('Invalid profile image URL');
  }

  const normalized = profileImageUrl.trim();
  try {
    if (/^https?:\/\//i.test(normalized)) {
      const response = await fetch(normalized);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      return createImageFromBuffer(Buffer.from(buffer));
    }

    const fileBuffer = await fs.readFile(normalized);
    return createImageFromBuffer(fileBuffer);
  } catch (error) {
    throw new Error(`Failed to load profile image from '${normalized}': ${error.message}`);
  }
}

async function getSingleFaceDescriptor(image) {
  if (!image) {
    throw new Error('Image is required for face detection');
  }

  const result = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result || !result.descriptor) {
    return null;
  }

  return result.descriptor;
}

export async function matchFaceFromBase64(base64DataUrl, profileImageUrl) {
  try {
    await loadModels();

    const liveImage = await loadImageFromBase64(base64DataUrl);
    const profileImage = await loadImageFromUrlOrPath(profileImageUrl);

    const [liveDescriptor, profileDescriptor] = await Promise.all([
      getSingleFaceDescriptor(liveImage),
      getSingleFaceDescriptor(profileImage),
    ]);

    if (!liveDescriptor || !profileDescriptor) {
      return { match: false, reason: 'Face not detected' };
    }

    const distance = faceapi.euclideanDistance(liveDescriptor, profileDescriptor);
    const matched = typeof distance === 'number' && distance < 0.6;

    return {
      match: matched,
      distance: Number(distance.toFixed(6)),
    };
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown face matching error';
    return { match: false, reason: message };
  }
}

async function loadProfileImageUrl(userId) {
  if (!userId) {
    throw new Error('Missing userId');
  }

  const helper = typeof globalThis.getUserById === 'function' ? globalThis.getUserById : null;
  if (!helper) {
    throw new Error('getUserById helper is not available');
  }

  const user = await helper(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user.profileImageUrl || user.photo || user.avatar || user.image || user.profilePhoto || '';
}

export async function verifyFaceHandler(req, res) {
  try {
    const { liveFrame, userId } = req.body || {};
    if (!liveFrame || !userId) {
      return res.status(400).json({ match: false, reason: 'Missing liveFrame or userId' });
    }

    const profileImageUrl = await loadProfileImageUrl(userId);
    if (!profileImageUrl) {
      return res.status(404).json({ match: false, reason: 'Profile image URL not found for user' });
    }

    const result = await matchFaceFromBase64(liveFrame, profileImageUrl);
    return res.json(result);
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected verification error';
    return res.status(500).json({ match: false, reason: message });
  }
}
