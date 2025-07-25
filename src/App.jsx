import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const canvasRef = useRef(null)
  const originalImageRef = useRef(null)
  const toolbarRef = useRef(null)
  const [hasImage, setHasImage] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 })
  const [currentSelection, setCurrentSelection] = useState(null)

  // Toolbar state
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [selectedTool, setSelectedTool] = useState('blur')
  const [showCopyToast, setShowCopyToast] = useState(false)
  const fileInputRef = useRef(null)
  const dragRef = useRef()

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Handle both mouse and touch events
    let clientX, clientY
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX
      clientY = event.changedTouches[0].clientY
    } else {
      clientX = event.clientX
      clientY = event.clientY
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const applyBlurToRectangle = (x1, y1, x2, y2) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    
    const startX = Math.max(0, Math.min(x1, x2))
    const startY = Math.max(0, Math.min(y1, y2))
    const endX = Math.min(canvas.width, Math.max(x1, x2))
    const endY = Math.min(canvas.height, Math.max(y1, y2))
    
    const width = endX - startX
    const height = endY - startY
    
    if (width <= 0 || height <= 0) return
    
    ctx.save()
    ctx.beginPath()
    ctx.rect(startX, startY, width, height)
    ctx.clip()
    ctx.filter = 'blur(6px)'
    
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    tempCtx.putImageData(currentImageData, 0, 0)
    
    ctx.drawImage(tempCanvas, 0, 0)
    ctx.restore()
  }

  const copyToClipboard = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          setShowCopyToast(true)
          setTimeout(() => setShowCopyToast(false), 2000)
        }
      }, 'image/png')
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err)
    }
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'edited-image.png'
    link.href = canvas.toDataURL('image/png')
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      loadImageToCanvas(file)
    }
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const loadImageToCanvas = (file) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      originalImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setHasImage(true)
    }
    
    img.src = URL.createObjectURL(file)
  }

  const handleMouseDown = (event) => {
    if (!hasImage || selectedTool !== 'blur') return
    
    // Prevent default behavior for touch events
    if (event.type.startsWith('touch')) {
      event.preventDefault()
    }
    
    const coords = getCanvasCoordinates(event)
    setIsSelecting(true)
    setSelectionStart(coords)
    setSelectionEnd(coords)
    setCurrentSelection(null)
  }

  const handleMouseMove = (event) => {
    if (!isSelecting || !hasImage || selectedTool !== 'blur') return
    
    // Prevent default behavior for touch events
    if (event.type.startsWith('touch')) {
      event.preventDefault()
    }
    
    const coords = getCanvasCoordinates(event)
    setSelectionEnd(coords)
    
    setCurrentSelection({
      x: Math.min(selectionStart.x, coords.x),
      y: Math.min(selectionStart.y, coords.y),
      width: Math.abs(coords.x - selectionStart.x),
      height: Math.abs(coords.y - selectionStart.y)
    })
  }

  const handleMouseUp = () => {
    if (!isSelecting || !hasImage || selectedTool !== 'blur') return
    
    applyBlurToRectangle(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y)
    
    setIsSelecting(false)
    setCurrentSelection(null)
  }

  // Toolbar drag handlers
  const handleToolbarMouseDown = useCallback((e) => {
    if (!toolbarRef.current) return

    // Handle both mouse and touch events
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPos: position,
    }
    setIsDragging(true)
  }, [position])

  const handleToolbarMouseMove = useCallback((e) => {
    if (!isDragging || !dragRef.current) return

    e.preventDefault()
    
    // Handle both mouse and touch events
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    const deltaX = clientX - dragRef.current.startX
    const deltaY = clientY - dragRef.current.startY

    const newX = Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.startPos.x + deltaX))
    const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPos.y + deltaY))

    setPosition({ x: newX, y: newY })
  }, [isDragging])

  const handleToolbarMouseUp = useCallback(() => {
    setIsDragging(false)
    dragRef.current = undefined
  }, [])

  useEffect(() => {
    const handlePaste = (event) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            loadImageToCanvas(file)
          }
          break
        }
      }
    }


    document.addEventListener('paste', handlePaste)
    
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  // Global event listeners for toolbar drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleToolbarMouseMove)
      document.addEventListener("mouseup", handleToolbarMouseUp)
      document.addEventListener("touchmove", handleToolbarMouseMove, { passive: false })
      document.addEventListener("touchend", handleToolbarMouseUp, { passive: false })
    }

    return () => {
      document.removeEventListener("mousemove", handleToolbarMouseMove)
      document.removeEventListener("mouseup", handleToolbarMouseUp)
      document.removeEventListener("touchmove", handleToolbarMouseMove)
      document.removeEventListener("touchend", handleToolbarMouseUp)
    }
  }, [isDragging, handleToolbarMouseMove, handleToolbarMouseUp])

  // Global event listeners for canvas selection
  useEffect(() => {
    if (isSelecting) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleMouseMove, { passive: false })
      document.addEventListener("touchend", handleMouseUp, { passive: false })
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleMouseMove)
      document.removeEventListener("touchend", handleMouseUp)
    }
  }, [isSelecting, handleMouseMove])

  // Add touch event listeners directly to canvas with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const options = { passive: false }
    
    canvas.addEventListener('touchstart', handleMouseDown, options)
    canvas.addEventListener('touchmove', handleMouseMove, options)
    canvas.addEventListener('touchend', handleMouseUp, options)

    return () => {
      canvas.removeEventListener('touchstart', handleMouseDown)
      canvas.removeEventListener('touchmove', handleMouseMove)
      canvas.removeEventListener('touchend', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp])

  // Add touch event listeners directly to toolbar with passive: false
  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const options = { passive: false }
    
    toolbar.addEventListener('touchstart', handleToolbarMouseDown, options)

    return () => {
      toolbar.removeEventListener('touchstart', handleToolbarMouseDown)
    }
  }, [handleToolbarMouseDown])

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden">
      <div className="w-full h-full flex flex-col justify-center items-center p-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            Image Editor
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Paste an image (Ctrl+V) and drag to select areas to blur
          </p>
        </div>
        
        <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden flex justify-center items-center">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`block max-w-[85vw] max-h-[65vh] ${hasImage ? '' : 'hidden'}`}
            style={{ cursor: hasImage && selectedTool === 'blur' ? 'crosshair' : 'default' }}
          />
          
          {/* Selection rectangle overlay */}
          {currentSelection && (
            <div
              className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none rounded-sm"
              style={{
                left: currentSelection.x * (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1),
                top: currentSelection.y * (canvasRef.current?.getBoundingClientRect().height / canvasRef.current?.height || 1),
                width: currentSelection.width * (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1),
                height: currentSelection.height * (canvasRef.current?.getBoundingClientRect().height / canvasRef.current?.height || 1)
              }}
            />
          )}
          
          {!hasImage && (
            <div className="w-[800px] h-[500px] bg-white/95 backdrop-blur-md border-2 border-dashed border-indigo-300 rounded-xl flex flex-col items-center justify-center text-gray-500 text-xl font-medium transition-all duration-300 hover:border-indigo-500 hover:bg-white hover:-translate-y-1 hover:shadow-lg gap-6">
              <p>Paste an image or upload a file</p>
              <button
                onClick={triggerFileUpload}
                className="flex items-center gap-3 px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors duration-200 text-base font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Toolbar */}
      {hasImage && (
        <div
          ref={toolbarRef}
          className={`fixed bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-3 select-none z-50 ${
            isDragging ? 'scale-105 shadow-2xl cursor-grabbing transition-none' : 'hover:shadow-xl hover:-translate-y-1 cursor-grab transition-all duration-200'
          }`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            willChange: isDragging ? 'transform' : 'auto',
          }}
          onMouseDown={handleToolbarMouseDown}
        >
          <div className="flex items-center gap-2">
            {/* Blur Tool */}
            <button
              className={`w-12 h-12 border-none rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200 relative overflow-hidden ${
                selectedTool === 'blur' 
                  ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600 hover:scale-105' 
                  : 'bg-transparent hover:bg-gray-100 hover:scale-105'
              }`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedTool(selectedTool === 'blur' ? null : 'blur')}
            >
              <svg className="w-5 h-5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </button>

            {/* Copy to Clipboard */}
            <button
              className="w-12 h-12 border-none rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200 relative overflow-hidden bg-transparent hover:bg-gray-100 hover:scale-105"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={copyToClipboard}
              title="Copy to clipboard"
            >
              <svg className="w-5 h-5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>

            {/* Download Image */}
            <button
              className="w-12 h-12 border-none rounded-xl cursor-pointer flex items-center justify-center transition-all duration-200 relative overflow-hidden bg-transparent hover:bg-gray-100 hover:scale-105"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={downloadImage}
              title="Download image"
            >
              <svg className="w-5 h-5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
            </button>

            {/* Drag Handle */}
            <div className="flex flex-col gap-1 px-3 opacity-40 cursor-grab active:cursor-grabbing">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* Tool Info */}
      {selectedTool && hasImage && (
        <div className="fixed bottom-6 left-6 bg-gray-900/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg border border-gray-700/50 text-sm font-medium z-40 transition-all duration-300 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            Blur tool selected
          </div>
        </div>
      )}

      {/* Copy Toast */}
      {showCopyToast && (
        <div className="fixed bottom-6 right-6 bg-green-600/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg border border-green-500/50 text-sm font-medium z-40 transition-all duration-300 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied to clipboard!
          </div>
        </div>
      )}

    </div>
  )
}

export default App
