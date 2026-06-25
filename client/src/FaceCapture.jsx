import { useRef, useEffect, useState } from 'react'

const faceapiScriptUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'

export default function FaceCapture({ onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState('')
  const [faceApiReady, setFaceApiReady] = useState(false)
  const faceapiRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const loadFaceApiModels = async (faceapi) => {
      if (window.faceApiModelsLoaded) return
      const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
      await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl)
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl)
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
      window.faceApiModelsLoaded = true
    }

    const initFaceApi = async () => {
      if (window.faceApiInitPromise) {
        return window.faceApiInitPromise
      }

      window.faceApiInitPromise = (async () => {
        try {
          const faceapi = window.faceapi
          if (!faceapi) {
            throw new Error('Face API script failed to load')
          }
          setMessage('Loading face detection models...')
          await loadFaceApiModels(faceapi)
          if (!mounted) return
          faceapiRef.current = faceapi
          setFaceApiReady(true)
          setMessage('')
          console.log('face-api loaded and models ready')
        } catch (err) {
          console.error('Face API initialization error', err)
          if (mounted) setMessage('Face detection setup failed. Please refresh the page.')
          throw err
        }
      })()

      return window.faceApiInitPromise
    }

    const loadScript = () => {
      if (window.faceApiScriptLoaded) {
        return initFaceApi()
      }
      window.faceApiScriptLoaded = true
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = faceapiScriptUrl
        script.onload = async () => {
          try {
            await initFaceApi()
            resolve()
          } catch (err) {
            reject(err)
          }
        }
        script.onerror = () => {
          console.error('Failed to load face-api')
          if (mounted) setMessage('Face API failed to load. Please check your connection.')
          reject(new Error('Face API script failed to load'))
        }
        document.head.appendChild(script)
      })
    }

    if (!window.faceapi) {
      loadScript().catch(() => {})
    } else {
      initFaceApi().catch(() => {})
    }

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      setMessage('')
    } catch (err) {
      console.error('Camera error', err)
      let message = 'Camera access denied. Please allow camera access in your browser and try again.'
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found. Please connect a camera and try again.'
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Allow camera access in your browser settings and retry.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is already in use or cannot be accessed. Close other camera apps and try again.'
      }
      setMessage(message)
      setActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setActive(false)
  }

  const capture = async () => {
    if (!videoRef.current || !faceapiRef.current || !faceApiReady) {
      setMessage('Face detection models are not ready yet. Please wait a moment and try again.')
      return
    }

    setDetecting(true)
    setMessage('Detecting face...')

    try {
      const video = videoRef.current
      const faceapi = faceapiRef.current
      const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors()
      
      if (!detections || detections.length === 0) {
        setMessage('No face detected. Please try again.')
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        setMessage('Unable to capture image. Please try again.')
        return
      }
      const file = new File([blob], `selfie-${Date.now()}.png`, { type: 'image/png' })
      file.descriptor = detections[0].descriptor
      onCapture(file)
      stopCamera()
      setMessage('')
    } catch (err) {
      console.error('Face detection error', err)
      setMessage('Error: ' + err.message)
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div className="face-capture">
      {!active ? (
        <div>
          <button type="button" className="secondary-button" onClick={startCamera}>Use camera to capture selfie</button>
          {message && <p style={{marginTop: 8, fontSize: '0.9em', color: message.includes('Error') || message.includes('denied') ? '#d32f2f' : '#1976d2'}}>{message}</p>}
        </div>
      ) : (
        <div>
          <video ref={videoRef} autoPlay playsInline muted style={{maxWidth: '100%', borderRadius: 12}} />
          <div style={{marginTop:8}}>
            <button type="button" className="secondary-button" onClick={capture} disabled={detecting || !faceApiReady}>
              {detecting ? 'Detecting face...' : faceApiReady ? 'Capture' : 'Loading…'}
            </button>
            <button type="button" className="secondary-button" onClick={stopCamera} style={{marginLeft:8}} disabled={detecting}>Cancel</button>
          </div>
          {message && <p style={{marginTop: 8, fontSize: '0.9em', color: message.includes('Error') || message.includes('denied') ? '#d32f2f' : '#1976d2'}}>{message}</p>}
        </div>
      )}
    </div>
  )
}
