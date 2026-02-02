import {
  engine,
  Entity,
  Material,
  MeshRenderer,
  Transform,
  TextShape,
  SkyboxTime,
  VirtualCamera,
  MainCamera,
  AvatarModifierArea,
  AvatarModifierType
} from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
import { setupUi, setTimeLabel, setCameraLabel } from './ui'

// Time presets: one per hour, in seconds (0 = midnight, 3600 = 1h, ..., 82800 = 23:00)
export const TIME_PRESETS: { [key: string]: number } = Object.fromEntries(
  Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2, '0')}:00`
    return [label, h * 3600]
  })
)

// Camera positions for fixed views - focused on scene elements
export const CAMERA_POSITIONS: { [key: string]: { pos: Vector3; lookAt: Vector3 } } = {
  'Free Camera': { pos: Vector3.create(24, 2, 24), lookAt: Vector3.create(24, 1, 28) },
  'Color Cubes': { pos: Vector3.create(14, 4, 2), lookAt: Vector3.create(14, 1, 12) },
  'Emissive Cubes': { pos: Vector3.create(14, 4, 20), lookAt: Vector3.create(14, 1, 28) },
  'PBR Materials': { pos: Vector3.create(44, 4, 16), lookAt: Vector3.create(36, 1, 16) },
  'Sundial': { pos: Vector3.create(24, 5, 30), lookAt: Vector3.create(24, 1, 38) },
  'Overview': { pos: Vector3.create(24, 25, 0), lookAt: Vector3.create(24, 0, 24) }
}

// Sky viewing positions (100m up)
export const SKY_POSITIONS: { [key: string]: { pos: Vector3; lookAt: Vector3 } } = {
  'Sky - North': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(24, 100, 124) },
  'Sky - East': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(124, 100, 24) },
  'Sky - South': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(24, 100, -76) },
  'Sky - West': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(-76, 100, 24) },
  'Sky - Up': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(24, 200, 24) },
  'Sky - Sun Path': { pos: Vector3.create(24, 100, 24), lookAt: Vector3.create(124, 150, 24) }
}

let currentTimeKey = '12:00'
let currentCameraKey = 'Free Camera'

// Store virtual camera entities
const virtualCameras: Map<string, { cameraEntity: Entity; lookAtEntity: Entity }> = new Map()

// Entity to hide avatars during cinematic mode
let avatarHideEntity: Entity | null = null
let avatarHideEnabled = false

export function setTime(key: string) {
  currentTimeKey = key
  const time = TIME_PRESETS[key]
  SkyboxTime.createOrReplace(engine.RootEntity, {
    fixedTime: time,
    transitionMode: 0 // TM_FORWARD
  })
  setTimeLabel(key)
  console.log(`[LIGHTING] Time set to ${key} (${time}s)`)
}

export function setCamera(key: string, positions: { [key: string]: { pos: Vector3; lookAt: Vector3 } }) {
  currentCameraKey = key
  setCameraLabel(key)

  if (key === 'Free Camera') {
    // Remove MainCamera to return to player control
    MainCamera.deleteFrom(engine.CameraEntity)

    // Move avatar hide area far away to disable it
    if (avatarHideEntity !== null && avatarHideEnabled) {
      Transform.getMutable(avatarHideEntity).position = Vector3.create(10000, 10000, 10000)
      avatarHideEnabled = false
      console.log(`[CAMERA] Avatar hide area disabled`)
    }

    console.log(`[CAMERA] Free camera mode`)
    return
  }

  const camData = positions[key]
  const fullKey = JSON.stringify({ key, pos: camData.pos, lookAt: camData.lookAt })

  // Check if we already created this virtual camera
  let camEntities = virtualCameras.get(fullKey)

  if (!camEntities) {
    // Create lookAt target entity
    const lookAtEntity = engine.addEntity()
    Transform.create(lookAtEntity, {
      position: camData.lookAt
    })

    // Create virtual camera entity
    const cameraEntity = engine.addEntity()
    Transform.create(cameraEntity, {
      position: camData.pos
    })
    VirtualCamera.create(cameraEntity, {
      defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) },
      lookAtEntity: lookAtEntity
    })

    camEntities = { cameraEntity, lookAtEntity }
    virtualCameras.set(fullKey, camEntities)
  }

  // Activate this virtual camera
  MainCamera.createOrReplace(engine.CameraEntity, {
    virtualCameraEntity: camEntities.cameraEntity
  })

  // Create avatar hide area if not exists, or move it back to scene
  if (avatarHideEntity === null) {
    avatarHideEntity = engine.addEntity()
    Transform.create(avatarHideEntity, {
      position: Vector3.create(24, 0, 24)
    })
    AvatarModifierArea.create(avatarHideEntity, {
      area: Vector3.create(500, 500, 500),
      modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
      excludeIds: []
    })
    avatarHideEnabled = true
  } else if (!avatarHideEnabled) {
    // Move it back to the scene center
    Transform.getMutable(avatarHideEntity).position = Vector3.create(24, 0, 24)
    avatarHideEnabled = true
  }

  console.log(`[CAMERA] Set to ${key}: pos=${JSON.stringify(camData.pos)}, lookAt=${JSON.stringify(camData.lookAt)}`)
}

export function main() {
  console.log('===========================================')
  console.log('COLOR & LIGHTING TEST SCENE')
  console.log('===========================================')

  // Initialize time to noon
  setTime('12:00')

  // ============================================
  // Floor - Neutral gray (48x48m for 3x3 parcels)
  // Positioned at y=0 with thickness to cover default grass
  // ============================================
  const floor = engine.addEntity()
  Transform.create(floor, {
    position: Vector3.create(24, 0.01, 24),
    scale: Vector3.create(48, 0.02, 48)
  })
  MeshRenderer.setBox(floor)
  Material.setPbrMaterial(floor, {
    albedoColor: Color4.create(0.5, 0.5, 0.5, 1),
    roughness: 0.8,
    metallic: 0
  })

  // ============================================
  // SUNDIAL - To visualize light direction (back area)
  // ============================================
  createSundial(24, 0, 38)

  // ============================================
  // COLOR TEST CUBES - Primary colors
  // ============================================
  const cubeSize = 2
  const cubeY = cubeSize / 2
  const startX = 4
  const startZ = 8
  const spacing = 4

  // Row 1: Primary colors (fully saturated)
  createColorCube(startX + spacing * 0, cubeY, startZ, cubeSize, Color4.create(1, 0, 0, 1), 'Red')
  createColorCube(startX + spacing * 1, cubeY, startZ, cubeSize, Color4.create(0, 1, 0, 1), 'Green')
  createColorCube(startX + spacing * 2, cubeY, startZ, cubeSize, Color4.create(0, 0, 1, 1), 'Blue')
  createColorCube(startX + spacing * 3, cubeY, startZ, cubeSize, Color4.create(1, 1, 0, 1), 'Yellow')
  createColorCube(startX + spacing * 4, cubeY, startZ, cubeSize, Color4.create(1, 0, 1, 1), 'Magenta')
  createColorCube(startX + spacing * 5, cubeY, startZ, cubeSize, Color4.create(0, 1, 1, 1), 'Cyan')

  // Row 2: Secondary/pastel colors
  createColorCube(startX + spacing * 0, cubeY, startZ + spacing, cubeSize, Color4.create(1, 0.5, 0, 1), 'Orange')
  createColorCube(startX + spacing * 1, cubeY, startZ + spacing, cubeSize, Color4.create(0.5, 0, 1, 1), 'Purple')
  createColorCube(startX + spacing * 2, cubeY, startZ + spacing, cubeSize, Color4.create(0, 0.5, 0, 1), 'Dark Green')
  createColorCube(startX + spacing * 3, cubeY, startZ + spacing, cubeSize, Color4.create(0.5, 0.25, 0, 1), 'Brown')
  createColorCube(startX + spacing * 4, cubeY, startZ + spacing, cubeSize, Color4.create(1, 0.75, 0.8, 1), 'Pink')
  createColorCube(startX + spacing * 5, cubeY, startZ + spacing, cubeSize, Color4.create(0.5, 0.5, 1, 1), 'Light Blue')

  // Row 3: Grayscale
  createColorCube(startX + spacing * 0, cubeY, startZ + spacing * 2, cubeSize, Color4.create(1, 1, 1, 1), 'White')
  createColorCube(startX + spacing * 1, cubeY, startZ + spacing * 2, cubeSize, Color4.create(0.8, 0.8, 0.8, 1), 'Light Gray')
  createColorCube(startX + spacing * 2, cubeY, startZ + spacing * 2, cubeSize, Color4.create(0.5, 0.5, 0.5, 1), 'Gray')
  createColorCube(startX + spacing * 3, cubeY, startZ + spacing * 2, cubeSize, Color4.create(0.25, 0.25, 0.25, 1), 'Dark Gray')
  createColorCube(startX + spacing * 4, cubeY, startZ + spacing * 2, cubeSize, Color4.create(0.1, 0.1, 0.1, 1), 'Near Black')
  createColorCube(startX + spacing * 5, cubeY, startZ + spacing * 2, cubeSize, Color4.create(0, 0, 0, 1), 'Black')

  // ============================================
  // EMISSIVE CUBES
  // ============================================
  const emissiveStartX = 4
  const emissiveStartZ = 26

  createEmissiveCube(emissiveStartX + spacing * 0, cubeY, emissiveStartZ, cubeSize, Color4.create(1, 0, 0, 1), 2, 'Emit Red')
  createEmissiveCube(emissiveStartX + spacing * 1, cubeY, emissiveStartZ, cubeSize, Color4.create(0, 1, 0, 1), 2, 'Emit Green')
  createEmissiveCube(emissiveStartX + spacing * 2, cubeY, emissiveStartZ, cubeSize, Color4.create(0, 0, 1, 1), 2, 'Emit Blue')
  createEmissiveCube(emissiveStartX + spacing * 3, cubeY, emissiveStartZ, cubeSize, Color4.create(1, 1, 0, 1), 2, 'Emit Yellow')
  createEmissiveCube(emissiveStartX + spacing * 4, cubeY, emissiveStartZ, cubeSize, Color4.create(1, 1, 1, 1), 2, 'Emit White')
  createEmissiveCube(emissiveStartX + spacing * 5, cubeY, emissiveStartZ, cubeSize, Color4.create(1, 0.5, 0, 1), 2, 'Emit Orange')

  // Row 2 emissive - varying intensities
  createEmissiveCube(emissiveStartX + spacing * 0, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 0.5, 'Emit 0.5')
  createEmissiveCube(emissiveStartX + spacing * 1, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 1, 'Emit 1.0')
  createEmissiveCube(emissiveStartX + spacing * 2, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 2, 'Emit 2.0')
  createEmissiveCube(emissiveStartX + spacing * 3, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 4, 'Emit 4.0')
  createEmissiveCube(emissiveStartX + spacing * 4, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 8, 'Emit 8.0')
  createEmissiveCube(emissiveStartX + spacing * 5, cubeY, emissiveStartZ + spacing, cubeSize, Color4.create(1, 0, 1, 1), 16, 'Emit 16.0')

  // ============================================
  // METALLIC/ROUGHNESS TEST CUBES
  // ============================================
  const metalStartX = 32
  const metalStartZ = 8

  // Varying roughness (metallic = 0)
  for (let i = 0; i < 5; i++) {
    const roughness = i * 0.25
    createPBRCube(metalStartX, cubeY, metalStartZ + spacing * i, cubeSize,
      Color4.create(0.8, 0.8, 0.8, 1), 0, roughness, `R=${roughness.toFixed(2)}`)
  }

  // Varying metallic (roughness = 0.3)
  for (let i = 0; i < 5; i++) {
    const metallic = i * 0.25
    createPBRCube(metalStartX + spacing, cubeY, metalStartZ + spacing * i, cubeSize,
      Color4.create(0.8, 0.8, 0.8, 1), metallic, 0.3, `M=${metallic.toFixed(2)}`)
  }

  // Gold-like metals
  createPBRCube(metalStartX + spacing * 2, cubeY, metalStartZ, cubeSize,
    Color4.create(1, 0.84, 0, 1), 1, 0.3, 'Gold')
  createPBRCube(metalStartX + spacing * 2, cubeY, metalStartZ + spacing, cubeSize,
    Color4.create(0.75, 0.75, 0.75, 1), 1, 0.2, 'Silver')
  createPBRCube(metalStartX + spacing * 2, cubeY, metalStartZ + spacing * 2, cubeSize,
    Color4.create(0.72, 0.45, 0.2, 1), 1, 0.4, 'Copper')
  createPBRCube(metalStartX + spacing * 2, cubeY, metalStartZ + spacing * 3, cubeSize,
    Color4.create(0.55, 0.55, 0.55, 1), 1, 0.5, 'Iron')

  // ============================================
  // Section labels
  // ============================================
  createLabel(startX + spacing * 2.5, 4, startZ - 2, 'PRIMARY & SECONDARY COLORS', 2)
  createLabel(emissiveStartX + spacing * 2.5, 4, emissiveStartZ - 2, 'EMISSIVE MATERIALS', 2)
  createLabel(metalStartX + spacing, 4, metalStartZ - 2, 'PBR MATERIALS', 2)
  createLabel(24, 4, 44, 'SUNDIAL', 2)

  // Setup UI
  setupUi()
}

function createColorCube(x: number, y: number, z: number, size: number, color: Color4, label: string) {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(size, size, size)
  })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    roughness: 0.9,
    metallic: 0
  })

  // Label below
  const labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(x, 0.1, z - size / 2 - 0.3)
  })
  TextShape.create(labelEntity, {
    text: label,
    fontSize: 1,
    textColor: Color4.White()
  })
}

function createEmissiveCube(x: number, y: number, z: number, size: number, color: Color4, intensity: number, label: string) {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(size, size, size)
  })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(0.1, 0.1, 0.1, 1),
    emissiveColor: Color4.create(color.r, color.g, color.b, 1),
    emissiveIntensity: intensity,
    roughness: 0.5,
    metallic: 0
  })

  // Label below
  const labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(x, 0.1, z - size / 2 - 0.3)
  })
  TextShape.create(labelEntity, {
    text: label,
    fontSize: 1,
    textColor: Color4.White()
  })
}

function createPBRCube(x: number, y: number, z: number, size: number, color: Color4, metallic: number, roughness: number, label: string) {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(size, size, size)
  })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    roughness: roughness,
    metallic: metallic
  })

  // Label below
  const labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(x, 0.1, z - size / 2 - 0.3)
  })
  TextShape.create(labelEntity, {
    text: label,
    fontSize: 1,
    textColor: Color4.White()
  })
}

function createSundial(x: number, y: number, z: number) {
  // Base platform
  const base = engine.addEntity()
  Transform.create(base, {
    position: Vector3.create(x, y + 0.1, z),
    scale: Vector3.create(6, 0.2, 6)
  })
  MeshRenderer.setCylinder(base)
  Material.setPbrMaterial(base, {
    albedoColor: Color4.create(0.9, 0.85, 0.7, 1),
    roughness: 0.7,
    metallic: 0
  })

  // Gnomon (the vertical piece that casts shadow)
  const gnomon = engine.addEntity()
  Transform.create(gnomon, {
    position: Vector3.create(x, y + 1.5, z),
    scale: Vector3.create(0.15, 3, 0.15)
  })
  MeshRenderer.setBox(gnomon)
  Material.setPbrMaterial(gnomon, {
    albedoColor: Color4.create(0.3, 0.3, 0.3, 1),
    roughness: 0.3,
    metallic: 0.8
  })

  // Hour markers around the sundial
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const markerX = x + Math.sin(angle) * 2.5
    const markerZ = z + Math.cos(angle) * 2.5

    const marker = engine.addEntity()
    Transform.create(marker, {
      position: Vector3.create(markerX, y + 0.25, markerZ),
      scale: Vector3.create(0.3, 0.1, 0.1),
      rotation: Quaternion.fromEulerDegrees(0, -(i / 12) * 360, 0)
    })
    MeshRenderer.setBox(marker)
    Material.setPbrMaterial(marker, {
      albedoColor: Color4.create(0.2, 0.2, 0.2, 1),
      roughness: 0.5,
      metallic: 0
    })

    // Hour number
    const hourLabel = engine.addEntity()
    const hour = i === 0 ? 12 : i
    Transform.create(hourLabel, {
      position: Vector3.create(markerX, y + 0.4, markerZ)
    })
    TextShape.create(hourLabel, {
      text: `${hour}`,
      fontSize: 1.2,
      textColor: Color4.create(0.2, 0.2, 0.2, 1)
    })
  }

  // Cardinal direction markers
  const directions = [
    { dir: 'N', x: 0, z: 3.2 },
    { dir: 'S', x: 0, z: -3.2 },
    { dir: 'E', x: 3.2, z: 0 },
    { dir: 'W', x: -3.2, z: 0 }
  ]

  for (const d of directions) {
    const dirLabel = engine.addEntity()
    Transform.create(dirLabel, {
      position: Vector3.create(x + d.x, y + 0.3, z + d.z)
    })
    TextShape.create(dirLabel, {
      text: d.dir,
      fontSize: 1.5,
      textColor: Color4.create(0.6, 0.1, 0.1, 1)
    })
  }
}

function createLabel(x: number, y: number, z: number, text: string, fontSize: number) {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(x, y, z)
  })
  TextShape.create(entity, {
    text: text,
    fontSize: fontSize,
    textColor: Color4.White()
  })
}
