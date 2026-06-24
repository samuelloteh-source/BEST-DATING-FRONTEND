import { useRef, useEffect, useState } from 'react'

export default function FaceCapture({ onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
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
    } catch (err) {
      console.error('Camera error', err)
      setActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setActive(false)
  }

  const capture = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'selfie.png', { type: 'image/png' })
      onCapture(file)
      stopCamera()
    }, 'image/png')
  }

  return (
    <div className="face-capture">
      {!active ? (
        <button type="button" className="secondary-button" onClick={startCamera}>Use camera to capture selfie</button>
      ) : (
        <div>
          <video ref={videoRef} autoPlay playsInline muted style={{maxWidth: '100%', borderRadius: 12}} />
          <div style={{marginTop:8}}>
            <button type="button" className="secondary-button" onClick={capture}>Capture</button>
            <button type="button" className="secondary-button" onClick={stopCamera} style={{marginLeft:8}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
