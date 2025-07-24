import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const canvasRef = useRef(null)
  const originalImageRef = useRef(null)
  const [hasImage, setHasImage] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 })
  const [currentSelection, setCurrentSelection] = useState(null)

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    }
  }

  const applyBlurToRectangle = (x1, y1, x2, y2) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    
    // Ensure we have proper rectangle bounds
    const startX = Math.max(0, Math.min(x1, x2))
    const startY = Math.max(0, Math.min(y1, y2))
    const endX = Math.min(canvas.width, Math.max(x1, x2))
    const endY = Math.min(canvas.height, Math.max(y1, y2))
    
    const width = endX - startX
    const height = endY - startY
    
    if (width <= 0 || height <= 0) return
    
    // Use CSS filter blur - much simpler and more reliable
    ctx.save()
    
    // Create clipping rectangle
    ctx.beginPath()
    ctx.rect(startX, startY, width, height)
    ctx.clip()
    
    // Apply blur filter and redraw the current canvas state (not original)
    ctx.filter = 'blur(6px)'
    
    // Create temporary canvas with current canvas state
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    
    // Get current canvas state (including any previous blurs)
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    tempCtx.putImageData(currentImageData, 0, 0)
    
    // Draw the current state with blur applied only in clipped area
    ctx.drawImage(tempCanvas, 0, 0)
    
    ctx.restore()
  }

  const handleMouseDown = (event) => {
    if (!hasImage) return
    const coords = getCanvasCoordinates(event)
    setIsSelecting(true)
    setSelectionStart(coords)
    setSelectionEnd(coords)
    setCurrentSelection(null)
  }

  const handleMouseMove = (event) => {
    if (!isSelecting || !hasImage) return
    const coords = getCanvasCoordinates(event)
    setSelectionEnd(coords)
    
    // Show current selection rectangle
    setCurrentSelection({
      x: Math.min(selectionStart.x, coords.x),
      y: Math.min(selectionStart.y, coords.y),
      width: Math.abs(coords.x - selectionStart.x),
      height: Math.abs(coords.y - selectionStart.y)
    })
  }

  const handleMouseUp = () => {
    if (!isSelecting || !hasImage) return
    
    // Apply blur to the selected rectangle
    applyBlurToRectangle(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y)
    
    setIsSelecting(false)
    setCurrentSelection(null)
  }

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

    const loadImageToCanvas = (file) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        // Store original image data for blur operations
        originalImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setHasImage(true)
      }
      
      img.src = URL.createObjectURL(file)
    }

    document.addEventListener('paste', handlePaste)
    
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h1 className="text-xl font-medium mb-2">Hide Information</h1>
        <p className="text-gray-600 text-sm">Paste an image (Ctrl+V) and drag to select areas to blur</p>
      </div>
      
      <div className="flex justify-center">
        <div className="relative">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`max-w-full max-h-[80vh] ${hasImage ? 'block' : 'hidden'}`}
            style={{ cursor: hasImage ? 'crosshair' : 'default' }}
          />
          
          {/* Selection rectangle overlay */}
          {currentSelection && (
            <div
              className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 pointer-events-none"
              style={{
                left: currentSelection.x * (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1),
                top: currentSelection.y * (canvasRef.current?.getBoundingClientRect().height / canvasRef.current?.height || 1),
                width: currentSelection.width * (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1),
                height: currentSelection.height * (canvasRef.current?.getBoundingClientRect().height / canvasRef.current?.height || 1)
              }}
            />
          )}
          
          {!hasImage && (
            <div className="border-2 border-dashed border-gray-300 rounded p-16 text-center text-gray-500">
              <p>Paste an image here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
