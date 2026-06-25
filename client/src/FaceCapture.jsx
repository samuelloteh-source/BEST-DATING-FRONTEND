import { useRef, useEffect, useState } from 'react'

const faceApiScriptUrls = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js',
  'https://unpkg.com/@vladmandic/face-api/dist/face-api.js'
]

export default function FaceCapture({ onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState('')
  const [faceApiReady, setFaceApiReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoListenersRef = useRef({})
  const videoReadyTimeoutRef = useRef(null)
  const [loadingFaceApi, setLoadingFaceApi] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [capturedFile, setCapturedFile] = useState(null)
  const faceapiRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const loadFaceApiModels = async (faceapi) => {
      if (window.faceApiModelsLoaded) return
      const modelBaseUrls = [
        'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model',
        'https://unpkg.com/@vladmandic/face-api/model'
      ]

      const models = [
        { name: 'ssdMobilenetv1', loader: (url) => faceapi.nets.ssdMobilenetv1.loadFromUri(url) },
        { name: 'faceLandmark68Net', loader: (url) => faceapi.nets.faceLandmark68Net.loadFromUri(url) },
        { name: 'faceRecognitionNet', loader: (url) => faceapi.nets.faceRecognitionNet.loadFromUri(url) }
      ]

      for (const m of models) {
        let loaded = false
        let lastErr = null
        for (const base of modelBaseUrls) {
          try {
            await m.loader(base)
            loaded = true
            break
          } catch (e) {
            console.warn(`Failed to load ${m.name} from ${base}`, e)
            lastErr = e
          }
        }
        if (!loaded) {
          throw new Error(`Failed to load model ${m.name}: ${lastErr && lastErr.message}`)
        }
      }

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
          setLoadingFaceApi(true)
          await loadFaceApiModels(faceapi)
          if (!mounted) return
          faceapiRef.current = faceapi
          setFaceApiReady(true)
          setLoadingFaceApi(false)
          setMessage('')
          console.log('face-api loaded and models ready')
        } catch (err) {
          console.error('Face API initialization error', err)
          if (mounted) {
            setLoadingFaceApi(false)
            setMessage('Face detection setup failed. Please refresh the page.')
          }
          throw err
        }
      })()

      return window.faceApiInitPromise
    }

    const loadScriptFromUrl = (url) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.crossOrigin = 'anonymous'
        script.src = url
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Face API script failed to load from ${url}`))
        document.head.appendChild(script)
      })
    }

    const loadScript = async () => {
      if (window.faceApiScriptLoaded) {
        return initFaceApi()
      }
      if (window.faceApiScriptLoadingPromise) {
        return window.faceApiScriptLoadingPromise
      }

      window.faceApiScriptLoadingPromise = (async () => {
        let lastError = null
        for (const url of faceApiScriptUrls) {
          try {
            await loadScriptFromUrl(url)
            window.faceApiScriptLoaded = true
            return await initFaceApi()
          } catch (err) {
            console.warn(err)
            lastError = err
          }
        }
        window.faceApiScriptLoaded = false
        delete window.faceApiScriptLoadingPromise
        throw lastError || new Error('Face API script failed to load from all known URLs')
      })()

      return window.faceApiScriptLoadingPromise
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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const startCamera = async () => {
    try {
      setMessage('')
      setVideoReady(false)
      // clear any previous listeners/timeouts
      if (videoReadyTimeoutRef.current) {
        clearTimeout(videoReadyTimeoutRef.current)
        videoReadyTimeoutRef.current = null
      }
      const cleanupVideoListeners = () => {
        const v = videoRef.current
        const l = videoListenersRef.current
        if (v && l.playing) v.removeEventListener('playing', l.playing)
        if (v && l.loaded) v.removeEventListener('loadedmetadata', l.loaded)
        videoListenersRef.current = {}
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not available in this browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (err) {
          // autoplay policies may prevent play(); we'll rely on events
          console.warn('video.play() failed', err)
        }

        // set up listeners to detect when video frames arrive
        const onPlaying = () => {
          setVideoReady(true)
          setMessage('')
          if (videoReadyTimeoutRef.current) { clearTimeout(videoReadyTimeoutRef.current); videoReadyTimeoutRef.current = null }
          if (videoListenersRef.current.playing) videoRef.current.removeEventListener('playing', videoListenersRef.current.playing)
          if (videoListenersRef.current.loaded) videoRef.current.removeEventListener('loadedmetadata', videoListenersRef.current.loaded)
          videoListenersRef.current = {}
        }
        const onLoaded = () => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            setVideoReady(true)
            setMessage('')
            if (videoReadyTimeoutRef.current) { clearTimeout(videoReadyTimeoutRef.current); videoReadyTimeoutRef.current = null }
          }
        }
        videoListenersRef.current.playing = onPlaying
        videoListenersRef.current.loaded = onLoaded
        videoRef.current.addEventListener('playing', onPlaying)
        videoRef.current.addEventListener('loadedmetadata', onLoaded)

        // fallback timeout: if no frames after 5s, show guidance
        videoReadyTimeoutRef.current = setTimeout(() => {
          if (!videoRef.current) return
          if (videoRef.current.videoWidth === 0) {
            setMessage('Camera started but no preview is available. Check browser camera permissions, close other apps using the camera, or try a different browser.')
            setVideoReady(false)
          }
          videoReadyTimeoutRef.current = null
        }, 5000)
      }
      setActive(true)
    } catch (err) {
      console.error('Camera error', err)
      let message = 'Camera access denied. Please allow camera access in your browser and try again.'
      if (err.message === 'Camera API is not available in this browser.') {
        message = 'Camera API unavailable. Use a supported browser with camera access.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
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
    setVideoReady(false)
    // cleanup listeners and timeouts
    try {
      if (videoRef.current && videoListenersRef.current.playing) videoRef.current.removeEventListener('playing', videoListenersRef.current.playing)
      if (videoRef.current && videoListenersRef.current.loaded) videoRef.current.removeEventListener('loadedmetadata', videoListenersRef.current.loaded)
    } catch (e) {}
    videoListenersRef.current = {}
    if (videoReadyTimeoutRef.current) { clearTimeout(videoReadyTimeoutRef.current); videoReadyTimeoutRef.current = null }
  }

  const retakeCapture = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setCapturedFile(null)
    setMessage('')
  }

  const useCapture = () => {
    if (!capturedFile) return
    onCapture(capturedFile)
    setMessage('Capture saved.')
    setPreviewUrl('')
    setCapturedFile(null)
    stopCamera()
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

      // Wait briefly for the video element to have valid dimensions / data
      let attempts = 0
      while ((video.videoWidth === 0 || video.readyState < 2) && attempts < 10) {
        // wait up to ~2s total
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 200))
        attempts++
      }

      // Run detection with a timeout so the UI doesn't hang indefinitely
      const detectPromise = faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors()
      const detections = await Promise.race([
        detectPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Face detection timed out')), 5000))
      ])

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
      const url = URL.createObjectURL(blob)
      setCapturedFile(file)
      setPreviewUrl(url)
      onCapture(file)
      setMessage('Capture saved. Preview below. Use the photo or retake it.')
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
          {!videoReady ? (
            <p style={{marginTop:8, fontSize:'0.9em', color:'#1976d2'}}>Starting camera…</p>
          ) : (
            <div style={{marginTop:8}}>
              <button type="button" className="secondary-button" onClick={capture} disabled={detecting || !faceApiReady}>
                {detecting ? 'Detecting face...' : faceApiReady ? 'Capture' : 'Loading…'}
              </button>
              <button type="button" className="secondary-button" onClick={stopCamera} style={{marginLeft:8}} disabled={detecting}>Cancel</button>
            </div>
          )}
          {previewUrl && (
            <div style={{marginTop: 12}}>
              <p style={{marginBottom: 8}}>Captured preview:</p>
              <img src={previewUrl} alt="Captured preview" style={{maxWidth: '100%', borderRadius: 12, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)'}} />
              <div style={{marginTop: 8}}>
                <button type="button" className="secondary-button" onClick={useCapture}>Use photo</button>
                <button type="button" className="secondary-button" onClick={retakeCapture} style={{marginLeft:8}}>Retake</button>
              </div>
            </div>
          )}
          {message && <p style={{marginTop: 8, fontSize: '0.9em', color: message.includes('Error') || message.includes('denied') ? '#d32f2f' : '#1976d2'}}>{message}</p>}
        </div>
      )}
    </div>
  )
}
