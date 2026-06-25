import { useRef, useEffect, useState } from 'react'

const faceapiScriptUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'

export default function FaceCapture({ onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState('')
  const faceapiRef = useRef(null)

  useEffect(() => {
    if (!window.faceapi) {
      const script = document.createElement('script')
      script.src = faceapiScriptUrl
      script.onload = () => {
        faceapiRef.current = window.faceapi
        console.log('face-api loaded from CDN')
      }
      script.onerror = () => console.error('Failed to load face-api')
      document.head.appendChild(script)
    } else {
      faceapiRef.current = window.faceapi
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setActive(true)
      setMessage('')
    } catch (err) {
      console.error('Camera error', err)
      setMessage('Camera access denied')
      setActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setActive(false)
  }

  const capture = async () => {
    if (!videoRef.current || !faceapiRef.current) {
      setMessage('Face-api not ready. Please try again.')
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
        setDetecting(false)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob((blob) => {
        if (!blob) return
        const file = new File([blob], 'selfie.png', { type: 'image/png' })
        file.descriptor = detections[0].descriptor
        onCapture(file)
        stopCamera()
        setMessage('')
      }, 'image/png')
    } catch (err) {
      console.error('Face detection error', err)
      setMessage('Error: ' + err.message)
      setDetecting(false)
    }
  }

  return (
    <div className="face-capture">
      {!active ? (
        <button type="button" className="secondary-button" onClick={startCamera}>Use camera to capture selfie</button>
      ) : (
        <div>
          <video ref={videoRef} autoPlay playsInline muted style={{maxWidth: '100%', borderRadius: 12}} />
          <div style={{marginTop:8}}>
            <button type="button" className="secondary-button" onClick={capture} disabled={detecting}>
              {detecting ? 'Detecting face...' : 'Capture'}
            </button>
            <button type="button" className="secondary-button" onClick={stopCamera} style={{marginLeft:8}} disabled={detecting}>Cancel</button>
          </div>
          {message && <p style={{marginTop: 8, fontSize: '0.9em', color: message.includes('Error') ? '#d32f2f' : '#1976d2'}}>{message}</p>}
        </div>
      )}
    </div>
  )
}
