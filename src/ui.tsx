import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { TIME_PRESETS, CAMERA_POSITIONS, SKY_POSITIONS, setTime, setCamera } from './index'

let currentTimeLabel = '12:00 Noon'
let currentCameraLabel = 'Free Camera'

export function setTimeLabel(label: string) {
  currentTimeLabel = label
}

export function setCameraLabel(label: string) {
  currentCameraLabel = label
}

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiComponent)
}

const uiComponent = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center'
    }}
  >
    {/* Main panel container - centered at top */}
    <UiEntity
      uiTransform={{
        width: 'auto',
        height: 'auto',
        margin: '16px 0 0 0',
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start'
      }}
      uiBackground={{ color: Color4.create(0.05, 0.05, 0.05, 0.9) }}
    >
      {/* Time controls panel */}
      <UiEntity
        uiTransform={{
          width: 220,
          height: 'auto',
          margin: '0 8px',
          padding: 12,
          flexDirection: 'column'
        }}
        uiBackground={{ color: Color4.create(0.15, 0.15, 0.2, 1) }}
      >
        <Label
          value="TIME OF DAY"
          fontSize={18}
          color={Color4.White()}
          uiTransform={{ width: '100%', height: 28, margin: '0 0 4px 0' }}
        />
        <Label
          value={currentTimeLabel}
          fontSize={14}
          color={Color4.create(0.5, 0.8, 1, 1)}
          uiTransform={{ width: '100%', height: 24, margin: '0 0 12px 0' }}
        />
        {Object.keys(TIME_PRESETS).map((key) => (
          <Button
            key={key}
            uiTransform={{ width: '100%', height: 36, margin: '3px 0' }}
            value={key}
            variant='secondary'
            fontSize={14}
            onMouseDown={() => setTime(key)}
            uiBackground={{
              color: currentTimeLabel === key
                ? Color4.create(0.2, 0.5, 0.8, 1)
                : Color4.create(0.25, 0.25, 0.3, 1)
            }}
          />
        ))}
      </UiEntity>

      {/* Camera positions panel */}
      <UiEntity
        uiTransform={{
          width: 220,
          height: 'auto',
          margin: '0 8px',
          padding: 12,
          flexDirection: 'column'
        }}
        uiBackground={{ color: Color4.create(0.15, 0.15, 0.2, 1) }}
      >
        <Label
          value="CAMERA POSITION"
          fontSize={18}
          color={Color4.White()}
          uiTransform={{ width: '100%', height: 28, margin: '0 0 4px 0' }}
        />
        <Label
          value={currentCameraLabel}
          fontSize={14}
          color={Color4.create(0.9, 0.9, 0.5, 1)}
          uiTransform={{ width: '100%', height: 24, margin: '0 0 12px 0' }}
        />
        {Object.keys(CAMERA_POSITIONS).map((key) => (
          <Button
            key={key}
            uiTransform={{ width: '100%', height: 36, margin: '3px 0' }}
            value={key}
            variant='secondary'
            fontSize={14}
            onMouseDown={() => setCamera(key, CAMERA_POSITIONS)}
            uiBackground={{
              color: currentCameraLabel === key
                ? Color4.create(0.6, 0.6, 0.2, 1)
                : Color4.create(0.25, 0.25, 0.3, 1)
            }}
          />
        ))}
      </UiEntity>

      {/* Sky viewing panel */}
      <UiEntity
        uiTransform={{
          width: 220,
          height: 'auto',
          margin: '0 8px',
          padding: 12,
          flexDirection: 'column'
        }}
        uiBackground={{ color: Color4.create(0.15, 0.15, 0.2, 1) }}
      >
        <Label
          value="SKY VIEW (100m up)"
          fontSize={18}
          color={Color4.White()}
          uiTransform={{ width: '100%', height: 28, margin: '0 0 12px 0' }}
        />
        {Object.keys(SKY_POSITIONS).map((key) => (
          <Button
            key={key}
            uiTransform={{ width: '100%', height: 36, margin: '3px 0' }}
            value={key}
            variant='secondary'
            fontSize={14}
            onMouseDown={() => setCamera(key, SKY_POSITIONS)}
            uiBackground={{
              color: currentCameraLabel === key
                ? Color4.create(0.5, 0.3, 0.7, 1)
                : Color4.create(0.25, 0.25, 0.3, 1)
            }}
          />
        ))}
      </UiEntity>
    </UiEntity>
  </UiEntity>
)
