import './App.css'

export default function ImageModal({ src, alt = 'Photo', open, onClose }) {
  if (!open || !src) return null

  return (
    <div className="image-viewer-backdrop" onClick={onClose}>
      <div className="image-viewer-container" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="image-viewer-img"
          onError={(e) => { e.currentTarget.src = '/default-avatar.svg' }}
        />
        <button
          type="button"
          className="image-viewer-close"
          onClick={onClose}
          title="Close"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
