import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  radius: number; opacity: number
  hue: number; pulse: number
}

interface Node3D {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  radius: number; opacity: number
  hue: number; connections: number[]
  pulseSpeed: number; pulsePhase: number
}

export function StructureFlowBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const c = ctx
    let w = 0, h = 0, cx = 0, cy = 0

    const PARTICLE_COUNT = 180
    const NODE_COUNT = 24
    const CONNECTION_DIST = 180
    const DOME_RADIUS = 400
    const MOUSE_INFLUENCE = 120
    const mouse = { x: -9999, y: -9999 }

    const particles: Particle[] = []
    const nodes: Node3D[] = []

    function resize() {
      w = window.innerWidth; h = window.innerHeight
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      cx = w / 2; cy = h / 2
    }

    function initParticles() {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI * 0.6
        const r = DOME_RADIUS * (0.3 + Math.random() * 0.7)
        particles.push({
          x: cx + r * Math.sin(phi) * Math.cos(theta),
          y: cy + r * Math.sin(phi) * Math.sin(theta) * 0.5,
          z: r * Math.cos(phi),
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.15,
          vz: (Math.random() - 0.5) * 0.2,
          radius: 1 + Math.random() * 2,
          opacity: 0.2 + Math.random() * 0.5,
          hue: 200 + Math.random() * 40,
          pulse: Math.random() * Math.PI * 2
        })
      }
    }

    function initNodes() {
      nodes.length = 0
      for (let i = 0; i < NODE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI * 0.5
        const r = DOME_RADIUS * (0.4 + Math.random() * 0.5)
        nodes.push({
          x: cx + r * Math.sin(phi) * Math.cos(theta),
          y: cy + r * Math.sin(phi) * Math.sin(theta) * 0.4,
          z: r * Math.cos(phi),
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.05,
          vz: (Math.random() - 0.5) * 0.08,
          radius: 2.5 + Math.random() * 3,
          opacity: 0.4 + Math.random() * 0.5,
          hue: 210 + Math.random() * 30,
          connections: [],
          pulseSpeed: 0.5 + Math.random() * 1.5,
          pulsePhase: Math.random() * Math.PI * 2
        })
      }
    }

    function updateParticle(p: Particle, time: number) {
      p.x += p.vx
      p.y += p.vy
      p.z += p.vz

      const dx = cx - p.x, dy = cy - p.y, dz = 0 - p.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist > DOME_RADIUS) {
        const force = (dist - DOME_RADIUS) * 0.001
        p.vx += (dx / dist) * force
        p.vy += (dy / dist) * force
        p.vz += (dz / dist) * force
      }

      const mdx = mouse.x - p.x, mdy = mouse.y - p.y
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
      if (mdist < MOUSE_INFLUENCE && mdist > 0) {
        const force = (1 - mdist / MOUSE_INFLUENCE) * 0.02
        p.vx -= (mdx / mdist) * force
        p.vy -= (mdy / mdist) * force
      }

      p.vx *= 0.995; p.vy *= 0.995; p.vz *= 0.995
      p.pulse += 0.02
    }

    function updateNode(n: Node3D, time: number) {
      n.x += n.vx; n.y += n.vy; n.z += n.vz
      const dx = cx - n.x, dy = cy - n.y, dz = 0 - n.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist > DOME_RADIUS * 0.8) {
        const force = (dist - DOME_RADIUS * 0.8) * 0.0008
        n.vx += (dx / dist) * force
        n.vy += (dy / dist) * force
        n.vz += (dz / dist) * force
      }
      n.vx *= 0.998; n.vy *= 0.998; n.vz *= 0.998
    }

    function draw() {
      const time = performance.now() * 0.001
      c.clearRect(0, 0, w, h)

      // Background gradient
      const grad = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7)
      grad.addColorStop(0, '#0a1628')
      grad.addColorStop(0.4, '#060e1a')
      grad.addColorStop(1, '#000000')
      c.fillStyle = grad
      c.fillRect(0, 0, w, h)

      // Dome glow
      const domeGrad = c.createRadialGradient(cx, cy, 0, cx, cy, DOME_RADIUS)
      domeGrad.addColorStop(0, 'rgba(30, 64, 175, 0.06)')
      domeGrad.addColorStop(0.5, 'rgba(30, 64, 175, 0.03)')
      domeGrad.addColorStop(1, 'rgba(30, 64, 175, 0)')
      c.fillStyle = domeGrad
      c.fillRect(0, 0, w, h)

      // Update
      for (const p of particles) updateParticle(p, time)
      for (const n of nodes) updateNode(n, time)

      // Draw particle connections
      c.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dz = particles[i].z - particles[j].z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.15
            c.strokeStyle = `hsla(215, 70%, 60%, ${alpha})`
            c.beginPath()
            c.moveTo(particles[i].x, particles[i].y)
            c.lineTo(particles[j].x, particles[j].y)
            c.stroke()
          }
        }
      }

      // Draw node connections
      c.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dz = nodes[i].z - nodes[j].z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < CONNECTION_DIST * 1.5) {
            const alpha = (1 - dist / (CONNECTION_DIST * 1.5)) * 0.3
            const pulseAlpha = alpha * (0.6 + 0.4 * Math.sin(time * nodes[i].pulseSpeed + nodes[i].pulsePhase))
            c.strokeStyle = `hsla(215, 80%, 55%, ${pulseAlpha})`
            c.beginPath()
            c.moveTo(nodes[i].x, nodes[i].y)
            c.lineTo(nodes[j].x, nodes[j].y)
            c.stroke()
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        const pulseScale = 0.7 + 0.3 * Math.sin(p.pulse)
        const alpha = p.opacity * pulseScale
        const r = p.radius * pulseScale

        c.beginPath()
        c.arc(p.x, p.y, r, 0, Math.PI * 2)
        c.fillStyle = `hsla(${p.hue}, 60%, 70%, ${alpha})`
        c.fill()
      }

      // Draw nodes (larger, brighter)
      for (const n of nodes) {
        const pulseScale = 0.6 + 0.4 * Math.sin(time * n.pulseSpeed + n.pulsePhase)
        const alpha = n.opacity * pulseScale
        const r = n.radius * pulseScale

        // Outer glow
        const glow = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4)
        glow.addColorStop(0, `hsla(${n.hue}, 70%, 60%, ${alpha * 0.3})`)
        glow.addColorStop(1, `hsla(${n.hue}, 70%, 60%, 0)`)
        c.fillStyle = glow
        c.beginPath()
        c.arc(n.x, n.y, r * 4, 0, Math.PI * 2)
        c.fill()

        // Core
        c.beginPath()
        c.arc(n.x, n.y, r, 0, Math.PI * 2)
        c.fillStyle = `hsla(${n.hue}, 80%, 75%, ${alpha})`
        c.fill()
      }

      // Scan line effect (subtle horizontal sweep)
      const scanY = (time * 40) % h
      const scanGrad = c.createLinearGradient(0, scanY - 2, 0, scanY + 2)
      scanGrad.addColorStop(0, 'rgba(59, 130, 246, 0)')
      scanGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.03)')
      scanGrad.addColorStop(1, 'rgba(59, 130, 246, 0)')
      c.fillStyle = scanGrad
      c.fillRect(0, scanY - 2, w, 4)

      animRef.current = requestAnimationFrame(draw)
    }

    function onMouse(e: MouseEvent) { mouse.x = e.clientX; mouse.y = e.clientY }
    function onMouseLeave() { mouse.x = -9999; mouse.y = -9999 }

    resize()
    initParticles()
    initNodes()

    window.addEventListener('resize', () => { resize(); initParticles(); initNodes() })
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('mouseleave', onMouseLeave)

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none'
      }}
    />
  )
}
