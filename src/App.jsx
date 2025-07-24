import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const canvasRef = useRef(null)
  const originalImageRef = useRef(null)
  const [hasImage, setHasImage] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [isDrawing, setIsDrawing] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

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

  const applyBlur = (x, y) => {
    const canvas = canvasRef.current
    if (!canvas || !originalImageRef.current) return


    
    const ctx = canvas.getContext('2d')
    const radius = brushSize / 2
    const blurRadius = 8 // Fixed blur radius regardless of brush size
    
    // Get the area we want to blur from the original image
    const startX = Math.max(0, Math.floor(x - radius))
    const startY = Math.max(0, Math.floor(y - radius))
    const endX = Math.min(canvas.width, Math.ceil(x + radius))
    const endY = Math.min(canvas.height, Math.ceil(y + radius))
    
    const width = endX - startX
    const height = endY - startY
    
    if (width <= 0 || height <= 0) return
    
    // Get current canvas data
    const imageData = ctx.getImageData(startX, startY, width, height)
    const data = imageData.data
    const originalData = originalImageRef.current.data
    
    // Apply blur effect pixel by pixel
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const actualX = startX + px
        const actualY = startY + py
        
        // Check if this pixel is within the circular brush
        const dx = actualX - x
        const dy = actualY - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance <= radius) {
          let r = 0, g = 0, b = 0, a = 0, count = 0
          
          // Sample surrounding pixels for blur effect with fixed radius
          for (let by = -blurRadius; by <= blurRadius; by++) {
            for (let bx = -blurRadius; bx <= blurRadius; bx++) {
              const sampleX = actualX + bx
              const sampleY = actualY + by
              
              if (sampleX >= 0 && sampleX < canvas.width && 
                  sampleY >= 0 && sampleY < canvas.height) {
                const sampleIndex = (sampleY * canvas.width + sampleX) * 4
                r += originalData[sampleIndex]
                g += originalData[sampleIndex + 1]
                b += originalData[sampleIndex + 2]
                a += originalData[sampleIndex + 3]
                count++
              }
            }
          }
          
          // Set the blurred pixel
          const pixelIndex = (py * width + px) * 4
          data[pixelIndex] = r / count
          data[pixelIndex + 1] = g / count
          data[pixelIndex + 2] = b / count
          data[pixelIndex + 3] = a / count
        }
      }
    }
    
    // Put the blurred data back to canvas
    ctx.putImageData(imageData, startX, startY)
  }

  const handleMouseDown = (event) => {
    if (!hasImage) return
    setIsDrawing(true)
    const coords = getCanvasCoordinates(event)
    applyBlur(coords.x, coords.y)
  }

  const handleMouseMove = (event) => {
    const coords = getCanvasCoordinates(event)
    setCursorPos(coords)
    
    if (isDrawing && hasImage) {
      applyBlur(coords.x, coords.y)
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
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
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Image Paste Canvas</h1>
      <p>Press Ctrl+V (or Cmd+V) to paste an image from your clipboard</p>
      
      {hasImage && (
        <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          <span>Blur Brush:</span>
          <button 
            onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
            style={{ 
              padding: '8px 12px', 
              fontSize: '16px', 
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#f5f5f5'
            }}
          >
            -
          </button>
          <span style={{ minWidth: '60px', fontWeight: 'bold' }}>
            {brushSize}px
          </span>
          <button 
            onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
            style={{ 
              padding: '8px 12px', 
              fontSize: '16px', 
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#f5f5f5'
            }}
          >
            +
          </button>
          <div 
            style={{
              width: `${brushSize}px`,
              height: `${brushSize}px`,
              border: '2px solid #666',
              borderRadius: '50%',
              marginLeft: '10px',
              minWidth: '10px',
              minHeight: '10px'
            }}
          />
        </div>
      )}
      
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas 
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            border: '2px dashed #ccc',
            maxWidth: '100%',
            maxHeight: '70vh',
            display: hasImage ? 'block' : 'none',
            cursor: hasImage ? 'crosshair' : 'default'
          }}
        />
        
        {hasImage && (
          <div
            style={{
              position: 'absolute',
              left: cursorPos.x * (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1) - brushSize / 2,
              top: cursorPos.y * (canvasRef.current?.getBoundingClientRect().height / canvasRef.current?.height || 1) - brushSize / 2,
              width: `${brushSize}px`,
              height: `${brushSize}px`,
              border: '2px solid rgba(255, 0, 0, 0.7)',
              borderRadius: '50%',
              pointerEvents: 'none',
              transform: 'translate(-2px, -2px)'
            }}
          />
        )}
      </div>
      
      {!hasImage && (
        <div style={{
          border: '2px dashed #ccc',
          padding: '40px',
          margin: '20px auto',
          maxWidth: '600px',
          color: '#666'
        }}>
          No image pasted yet. Copy an image and paste it here!
        </div>
      )}
    </div>
  )
}

export default App
